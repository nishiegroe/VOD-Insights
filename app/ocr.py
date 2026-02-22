from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional
import logging
import os
import re

from app import runtime_paths

import cv2
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class OcrSettings:
    psm: int
    lang: str
    engine: str = "tesseract"


def preprocess(frame: np.ndarray, scale: float, threshold: int) -> np.ndarray:
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    if scale != 1.0:
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_LINEAR)
    _, binary = cv2.threshold(gray, threshold, 255, cv2.THRESH_BINARY)
    return binary


_EASYOCR_READER: Optional[object] = None
_EASYOCR_LANGS: Optional[List[str]] = None


def _is_torch_cuda_load_error(exc: Exception) -> bool:
    text = str(exc).lower()
    if "winerror 87" in text:
        return True
    if "c10.dll" in text:
        return True
    if "_mei" in text and "torch" in text and "dll" in text:
        return True
    return False


def _normalize_easyocr_langs(value: str) -> List[str]:
    raw = [part.strip() for part in re.split(r"[,;\s]+", value or "") if part.strip()]
    if not raw:
        raw = ["en"]
    mapped = []
    for part in raw:
        if part.lower() == "eng":
            mapped.append("en")
        else:
            mapped.append(part.lower())
    return mapped


def _get_easyocr_reader(langs: List[str]) -> object:
    global _EASYOCR_READER, _EASYOCR_LANGS
    runtime_paths.prepare_torch_runtime()
    try:
        import easyocr  # type: ignore
        import torch  # type: ignore
    except Exception as exc:
        if _is_torch_cuda_load_error(exc):
            raise RuntimeError(
                "Torch CUDA runtime failed to load in the packaged app "
                "(Windows DLL dependency error)."
            ) from exc
        raise RuntimeError(
            "EasyOCR is not available. Install easyocr and a CUDA-enabled torch build."
        ) from exc

    if not torch.cuda.is_available():
        raise RuntimeError(
            "GPU OCR is enabled but no CUDA GPU is available. Switch to Tesseract in Settings."
        )

    if _EASYOCR_READER is None or _EASYOCR_LANGS != langs:
        os.environ.setdefault("PYTHONIOENCODING", "utf-8")
        models_dir = runtime_paths.ensure_easyocr_models()
        _EASYOCR_READER = easyocr.Reader(
            langs,
            gpu=True,
            verbose=False,
            model_storage_directory=str(models_dir),
        )
        _EASYOCR_LANGS = list(langs)
    return _EASYOCR_READER


def _run_tesseract(image: np.ndarray, settings: OcrSettings) -> List[str]:
    try:
        import pytesseract  # type: ignore
    except Exception as exc:
        raise RuntimeError(
            "pytesseract is not available. Install it and the Tesseract binary."
        ) from exc

    tesseract_path = runtime_paths.resolve_tool("tesseract", ["tesseract.exe"])
    logger.info(f"Resolved tesseract path: {tesseract_path}")
    if tesseract_path:
        logger.info(f"Setting pytesseract.pytesseract.tesseract_cmd to: {tesseract_path}")
        pytesseract.pytesseract.tesseract_cmd = tesseract_path
    else:
        logger.warning("Tesseract path not resolved, relying on PATH")

    config = f"--psm {settings.psm}"
    text = pytesseract.image_to_string(image, lang=settings.lang, config=config)
    return [line.strip() for line in text.splitlines() if line.strip()]


def _run_easyocr(image: np.ndarray, settings: OcrSettings) -> List[str]:
    langs = _normalize_easyocr_langs(settings.lang)
    reader = _get_easyocr_reader(langs)

    if image.ndim == 2:
        rgb = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
    else:
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    lines = reader.readtext(rgb, detail=0, paragraph=False)
    return [line.strip() for line in lines if str(line).strip()]


def run_ocr(image: np.ndarray, settings: OcrSettings) -> List[str]:
    engine = (settings.engine or "tesseract").lower()
    if engine == "easyocr":
        return _run_easyocr(image, settings)
    if engine != "tesseract":
        raise RuntimeError(f"Unsupported OCR engine: {settings.engine}")
    return _run_tesseract(image, settings)
