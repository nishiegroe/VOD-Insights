from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.runtime_paths import is_frozen, prepare_torch_runtime


def ocr_gpu_status_payload() -> Dict[str, Any]:
    runtime_info = prepare_torch_runtime()
    try:
        import torch  # type: ignore

        cuda_available = torch.cuda.is_available()
        payload: Dict[str, Any] = {
            "ok": True,
            "available": bool(cuda_available),
            "runtime": runtime_info,
            "torch_version": getattr(torch, "__version__", "unknown"),
            "torch_cuda_build": getattr(getattr(torch, "version", None), "cuda", None),
        }
        if cuda_available:
            try:
                payload["device_count"] = int(torch.cuda.device_count())
                if payload["device_count"] > 0:
                    payload["device_name"] = str(torch.cuda.get_device_name(0))
            except Exception:
                pass
        return payload
    except Exception as e:
        err = str(e)
        print(f"Torch/CUDA check failed: {err[:200]}")
        return {
            "ok": True,
            "available": False,
            "runtime": runtime_info,
            "error": err[:400],
            "error_type": type(e).__name__,
        }


def ocr_gpu_diagnostics_payload() -> Dict[str, Any]:
    runtime_info = prepare_torch_runtime()
    payload: Dict[str, Any] = {
        "ok": True,
        "runtime": runtime_info,
        "python_executable": sys.executable,
        "frozen": is_frozen(),
    }
    try:
        import torch  # type: ignore

        payload.update(
            {
                "import_torch_ok": True,
                "torch_version": getattr(torch, "__version__", "unknown"),
                "torch_cuda_build": getattr(getattr(torch, "version", None), "cuda", None),
                "cuda_available": bool(torch.cuda.is_available()),
            }
        )
        if torch.cuda.is_available():
            payload["cuda_device_count"] = int(torch.cuda.device_count())
            if payload["cuda_device_count"] > 0:
                payload["cuda_device_0"] = str(torch.cuda.get_device_name(0))
    except Exception as e:
        payload.update(
            {
                "import_torch_ok": False,
                "error_type": type(e).__name__,
                "error": str(e)[:800],
            }
        )
    return payload


def install_gpu_ocr_dependencies() -> Tuple[Dict[str, Any], int]:
    try:
        python_candidates: List[List[str]] = []
        if not is_frozen():
            python_candidates.append([sys.executable])
        python_candidates.extend(
            [
                ["py", "-3.12"],
                ["py", "-3"],
                ["python"],
            ]
        )

        chosen_python: Optional[List[str]] = None
        for candidate in python_candidates:
            probe = subprocess.run(
                [*candidate, "-V"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if probe.returncode == 0:
                chosen_python = candidate
                break

        if chosen_python is None:
            return {
                "ok": False,
                "message": "No system Python found. Install Python 3.12+ and try again.",
            }, 400

        python_path_probe = subprocess.run(
            [*chosen_python, "-c", "import sys; print(sys.executable)"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        python_exe_path = (python_path_probe.stdout or "").strip()
        if not python_exe_path:
            python_exe_path = " ".join(chosen_python)

        required_bytes = 10 * 1024 * 1024 * 1024
        try:
            free_bytes = shutil.disk_usage(Path(python_exe_path).anchor or str(Path.home().anchor)).free
        except Exception:
            free_bytes = 0
        if free_bytes and free_bytes < required_bytes:
            free_gb = round(free_bytes / (1024 ** 3), 2)
            required_gb = round(required_bytes / (1024 ** 3), 0)
            return {
                "ok": False,
                "message": (
                    f"Not enough free disk space to install GPU OCR. "
                    f"Free about {required_gb} GB on drive {Path(python_exe_path).anchor or 'system drive'} "
                    f"(currently {free_gb} GB free)."
                ),
            }, 400

        purge_cache_cmd = [*chosen_python, "-m", "pip", "cache", "purge"]
        subprocess.run(
            purge_cache_cmd,
            capture_output=True,
            text=True,
            timeout=120,
        )

        install_easyocr_cmd = [
            *chosen_python,
            "-m",
            "pip",
            "install",
            "easyocr",
            "--no-cache-dir",
            "--disable-pip-version-check",
            "--upgrade",
        ]
        install_torch_cmd = [
            *chosen_python,
            "-m",
            "pip",
            "install",
            "torch",
            "torchvision",
            "torchaudio",
            "--index-url",
            "https://download.pytorch.org/whl/cu124",
            "--no-cache-dir",
            "--disable-pip-version-check",
            "--upgrade",
        ]

        print(f"Installing EasyOCR: {' '.join(install_easyocr_cmd)}")
        easyocr_result = subprocess.run(
            install_easyocr_cmd,
            capture_output=True,
            text=True,
            timeout=600,
        )
        if easyocr_result.returncode != 0:
            error_msg = easyocr_result.stderr or easyocr_result.stdout
            return {
                "ok": False,
                "message": f"EasyOCR install failed: {error_msg[:300]}",
            }, 400

        print(f"Installing CUDA Torch: {' '.join(install_torch_cmd)}")
        torch_result = subprocess.run(
            install_torch_cmd,
            capture_output=True,
            text=True,
            timeout=1200,
        )

        if torch_result.returncode != 0:
            error_msg = torch_result.stderr or torch_result.stdout
            if "No space left on device" in error_msg or "Errno 28" in error_msg:
                return {
                    "ok": False,
                    "message": (
                        "Torch install failed: insufficient disk space. "
                        "Free at least 10 GB on the Python install drive and try again."
                    ),
                }, 400
            return {
                "ok": False,
                "message": f"Torch install failed: {error_msg[:300]}",
            }, 400

        verify_cmd = [*chosen_python, "-c", "import torch; print(torch.cuda.is_available())"]
        verify_result = subprocess.run(
            verify_cmd,
            capture_output=True,
            text=True,
            timeout=30,
        )
        cuda_available = verify_result.returncode == 0 and "True" in (verify_result.stdout or "")

        return {
            "ok": True,
            "message": "GPU OCR dependencies installed.",
            "cuda_available": cuda_available,
            "python": " ".join(chosen_python),
        }, 200

    except subprocess.TimeoutExpired:
        return {
            "ok": False,
            "message": "Installation timed out. Check internet connection and try again.",
        }, 400
    except Exception as e:
        error_str = str(e)
        print(f"GPU install error: {error_str[:200]}")
        return {
            "ok": False,
            "message": f"Error: {error_str[:200]}",
        }, 500