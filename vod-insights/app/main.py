from __future__ import annotations

import argparse
import logging
import time
from pathlib import Path

import cv2

from app.capture import CaptureBackend, CaptureRegion
from app.config import load_config
from app.detector import EventDetector
from app.ocr import OcrSettings, preprocess, run_ocr
from app.runtime_paths import get_config_path, resolve_log_path, reset_log_file


def overlay_text(image: cv2.Mat, lines: list[str]) -> cv2.Mat:
    display = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    font = cv2.FONT_HERSHEY_SIMPLEX
    y = 18
    for line in lines[:2]:
        cv2.putText(display, line, (8, y), font, 0.5, (0, 255, 0), 1, cv2.LINE_AA)
        y += 18
    return display


def preview_loop(
    capture: CaptureBackend,
    scale: float,
    threshold: int,
    ocr_settings: OcrSettings,
    log_ocr: bool,
    ocr_interval: float,
) -> None:
    last_ocr_time = 0.0
    last_lines: list[str] = []
    while True:
        frame = capture.grab()
        if frame is None:
            time.sleep(0.1)
            continue

        processed = preprocess(frame, scale=scale, threshold=threshold)
        now = time.time()
        if now - last_ocr_time >= ocr_interval:
            last_ocr_time = now
            last_lines = run_ocr(processed, ocr_settings)
            if log_ocr and last_lines:
                logging.info("OCR preview: %s", " | ".join(last_lines))

        display = overlay_text(processed, last_lines)
        cv2.imshow("Apex Killfeed Preview", display)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cv2.destroyAllWindows()


def main() -> None:
    parser = argparse.ArgumentParser(description="Apex event OCR -> live event logger")
    parser.add_argument(
        "--config",
        default=str(get_config_path()),
        help="Path to config.json",
    )
    parser.add_argument(
        "--preview",
        action="store_true",
        help="Preview capture region for calibration (press q to quit)",
    )
    args = parser.parse_args()

    config = load_config(Path(args.config))

    log_path = resolve_log_path(Path(args.config), config.logging.file)
    reset_log_file(log_path)
    logging.basicConfig(
        level=getattr(logging, config.logging.level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[
            logging.FileHandler(log_path, encoding="utf-8"),
            logging.StreamHandler(),
        ],
    )

    capture = CaptureBackend(
        CaptureRegion(
            left=config.capture.left,
            top=config.capture.top,
            width=config.capture.width,
            height=config.capture.height,
        ),
        backend=config.capture.backend,
    )

    if args.preview:
        preview_loop(
            capture,
            config.capture.scale,
            config.capture.threshold,
            OcrSettings(psm=config.ocr.psm, lang=config.ocr.lang, engine=config.ocr.engine),
            config.logging.log_ocr,
            config.ocr.interval_seconds,
        )
        return

    detector = EventDetector(
        keywords=config.detection.keywords,
        cooldown_seconds=config.detection.cooldown_seconds,
    )

    ocr_settings = OcrSettings(psm=config.ocr.psm, lang=config.ocr.lang, engine=config.ocr.engine)

    frame_interval = 1.0 / max(1, config.capture.fps)
    last_frame = 0.0
    last_logged_ocr = ""
    last_ocr_time = 0.0

    while True:
        now = time.time()
        if now - last_frame < frame_interval:
            time.sleep(0.001)
            continue
        last_frame = now

        frame = capture.grab()
        if frame is None:
            time.sleep(0.01)
            continue

        if now - last_ocr_time < config.ocr.interval_seconds:
            continue
        last_ocr_time = now

        processed = preprocess(frame, config.capture.scale, config.capture.threshold)
        lines = run_ocr(processed, ocr_settings)
        if config.logging.log_ocr and lines:
            ocr_text = " | ".join(lines)
            if ocr_text != last_logged_ocr:
                last_logged_ocr = ocr_text
                logging.info("OCR: %s", ocr_text)
        result = detector.detect(lines)
        if result.matched:
            logging.info("Event: %s", result.matched_line)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
