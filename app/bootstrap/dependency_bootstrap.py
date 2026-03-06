from __future__ import annotations

from dataclasses import dataclass
import json
import logging
import subprocess
import threading
import time
from pathlib import Path
from typing import Any, Dict, Optional

from app.runtime_paths import ensure_dir, get_app_data_dir, get_install_dir
from app.bootstrap.dependency_bootstrap_ops import (
    download_dependency,
    install_dependency_file,
    install_python_package,
    is_python_package_installed,
    validate_dependency_host,
    verify_dependency_checksum,
)


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DependencySpec:
    name: str
    url: str
    kind: str  # "zip", "file", "pip" (Python package)
    required: bool
    checksum_url: str = ""
    pip_requirement: str = ""
    import_name: str = ""


# Required tools that block startup
DEPENDENCIES: tuple[DependencySpec, ...] = (
    DependencySpec(
        name="ffmpeg",
        url="https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
        kind="zip",
        required=True,
        checksum_url="https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip.sha256",
    ),
    DependencySpec(
        name="yt-dlp",
        url="https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
        kind="file",
        required=True,
        checksum_url="https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS",
    ),
)

# Optional GPU OCR dependencies (do not block startup)
GPU_OCR_DEPENDENCIES: tuple[DependencySpec, ...] = (
    DependencySpec(
        name="torch",
        url="",  # Installed via pip
        kind="pip",
        required=False,
        pip_requirement="torch==2.5.1",
        import_name="torch",
    ),
    DependencySpec(
        name="torchvision",
        url="",
        kind="pip",
        required=False,
        pip_requirement="torchvision==0.20.1",
        import_name="torchvision",
    ),
    DependencySpec(
        name="torchaudio",
        url="",
        kind="pip",
        required=False,
        pip_requirement="torchaudio==2.5.1",
        import_name="torchaudio",
    ),
    DependencySpec(
        name="easyocr",
        url="",
        kind="pip",
        required=False,
        pip_requirement="easyocr==1.7.1",
        import_name="easyocr",
    ),
)


class DependencyBootstrapManager:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._state: Dict[str, Any] = {
            "running": False,
            "phase": "idle",
            "message": "",
            "dependency": "",
            "bytes_downloaded": 0,
            "bytes_total": 0,
            "error": "",
            "updated_at": time.time(),
            "completed": {},
            "install_gpu_ocr": False,  # Track if GPU OCR install is in progress
        }
        # Use install directory for tools (where the app is installed)
        # Fall back to appdata if install dir is not accessible
        try:
            install_dir = get_install_dir()
            self._base_dir = ensure_dir(install_dir / "tools")
        except Exception:
            # Fall back to appdata if install dir detection fails
            self._base_dir = ensure_dir(get_app_data_dir() / "tools")
        
        self._downloads_dir = ensure_dir(get_app_data_dir() / "downloads" / "bootstrap")
        self._state_path = get_app_data_dir() / "dependency-bootstrap-state.json"
        self._load_state()

    def _load_state(self) -> None:
        if not self._state_path.exists():
            return
        try:
            payload = json.loads(self._state_path.read_text(encoding="utf-8"))
            if isinstance(payload, dict):
                self._state.update(payload)
        except Exception:
            pass

    def _save_state(self) -> None:
        ensure_dir(self._state_path.parent)
        self._state_path.write_text(json.dumps(self._state, indent=2), encoding="utf-8")

    def _set_state(self, **fields: Any) -> None:
        with self._lock:
            self._state.update(fields)
            self._state["updated_at"] = time.time()
            self._save_state()

    def _tool_path(self, spec: DependencySpec) -> Path:
        if spec.name == "yt-dlp":
            return self._base_dir / "yt-dlp.exe"
        if spec.name == "ffmpeg":
            return self._base_dir / "ffmpeg"
        return self._base_dir / spec.name

    def _is_installed(self, spec: DependencySpec) -> bool:
        target = self._tool_path(spec)
        if spec.name == "yt-dlp":
            return target.is_file()
        if spec.name == "ffmpeg":
            if not target.exists():
                return False
            return any(p.name.lower() == "ffmpeg.exe" for p in target.rglob("ffmpeg.exe"))
        return target.exists()

    def _status_for_dependency(self, spec: DependencySpec) -> Dict[str, Any]:
        return {
            "name": spec.name,
            "required": spec.required,
            "installed": self._is_installed(spec),
            "url": spec.url,
        }

    def get_status(self) -> Dict[str, Any]:
        deps = [self._status_for_dependency(spec) for spec in DEPENDENCIES]
        gpu_deps = [self._status_for_dependency(spec) for spec in GPU_OCR_DEPENDENCIES]
        required_ready = all(dep["installed"] for dep in deps if dep["required"])
        gpu_ready = all(dep["installed"] for dep in gpu_deps)
        with self._lock:
            snapshot = dict(self._state)
        snapshot["dependencies"] = deps
        snapshot["required_ready"] = required_ready
        snapshot["gpu_ocr_dependencies"] = gpu_deps
        snapshot["gpu_ocr_ready"] = gpu_ready
        return snapshot

    def start(self, install_gpu_ocr: bool = True) -> Dict[str, Any]:
        status = self.get_status()
        install_gpu_ocr = bool(install_gpu_ocr)
        
        # If GPU OCR installation already complete and required tools ready, return
        if status["gpu_ocr_ready"] and status["required_ready"]:
            self._set_state(running=False, phase="ready", 
                          message="All dependencies are ready.", error="")
            return self.get_status()
        
        if status["required_ready"] and not install_gpu_ocr:
            self._set_state(
                running=False,
                phase="ready",
                message="Required dependencies are ready.",
                error="",
            )
            return self.get_status()

        # If required deps are ready and GPU OCR is ready, return
        if status["required_ready"] and status["gpu_ocr_ready"]:
            self._set_state(running=False, phase="ready", 
                          message="All dependencies are ready.", error="")
            return self.get_status()

        with self._lock:
            if self._running:
                return self.get_status()
            self._running = True
            self._state.update({
                "running": True,
                "phase": "starting",
                "message": "Preparing dependencies...",
                "dependency": "",
                "bytes_downloaded": 0,
                "bytes_total": 0,
                "error": "",
                "install_gpu_ocr": install_gpu_ocr,
            })
            self._save_state()
            self._thread = threading.Thread(target=self._run, daemon=True)
            self._thread.start()

        return self.get_status()

    def _validate_host(self, url: str) -> None:
        validate_dependency_host(url)

    def _download(self, spec: DependencySpec, destination: Path) -> None:
        self._validate_host(spec.url)
        download_dependency(spec.name, spec.url, destination, self._set_state)
        verify_dependency_checksum(spec.name, spec.url, spec.checksum_url, destination)

    def _install_file(self, spec: DependencySpec, archive_path: Path) -> None:
        install_dependency_file(spec.name, self._tool_path(spec), archive_path)

    def _install_python_package(self, package_name: str) -> None:
        install_python_package(package_name, self._set_state)

    def _is_python_package_installed(self, package_name: str) -> bool:
        return is_python_package_installed(package_name)

    def _run(self) -> None:
        try:
            # First, install required dependencies (they block startup)
            for spec in DEPENDENCIES:
                if not spec.required:
                    continue
                if self._is_installed(spec):
                    self._set_state(
                        phase="checking",
                        dependency=spec.name,
                        message=f"{spec.name} already installed.",
                        completed={**self._state.get("completed", {}), spec.name: True},
                    )
                    continue

                archive_suffix = ".zip" if spec.kind == "zip" else ".exe"
                download_path = self._downloads_dir / f"{spec.name}{archive_suffix}.part"
                if download_path.exists():
                    download_path.unlink(missing_ok=True)

                self._download(spec, download_path)
                self._set_state(phase="installing", dependency=spec.name, 
                              message=f"Installing {spec.name}...")
                self._install_file(spec, download_path)
                self._set_state(
                    phase="installing",
                    dependency=spec.name,
                    message=f"Installed {spec.name}.",
                    completed={**self._state.get("completed", {}), spec.name: True},
                    bytes_downloaded=0,
                    bytes_total=0,
                )

            if not self._state.get("install_gpu_ocr", False):
                self._set_state(
                    running=False,
                    phase="ready",
                    message="Required dependencies are ready.",
                    error="",
                )
                return

            # Install GPU OCR dependencies automatically (non-blocking if they fail)
            # This is done in the background after required tools are ready
            for spec in GPU_OCR_DEPENDENCIES:
                try:
                    import_name = spec.import_name or spec.name
                    if self._is_python_package_installed(import_name):
                        self._set_state(
                            phase="checking",
                            dependency=spec.name,
                            message=f"{spec.name} already installed.",
                            completed={**self._state.get("completed", {}), spec.name: True},
                        )
                        continue
                    
                    package_spec = spec.pip_requirement or spec.name
                    self._install_python_package(package_spec)
                    self._set_state(
                        phase="installing",
                        dependency=spec.name,
                        message=f"Installed {spec.name}.",
                        completed={**self._state.get("completed", {}), spec.name: True},
                        bytes_downloaded=0,
                        bytes_total=0,
                    )
                except Exception as gpu_exc:
                    # GPU OCR install failure is logged but doesn't block the app
                    logger.warning(f"Failed to install GPU OCR package {spec.name}: {gpu_exc}")
                    self._set_state(
                        phase="installing",
                        dependency=spec.name,
                        message=f"Skipped {spec.name} (optional).",
                        completed={**self._state.get("completed", {}), spec.name: False},
                        bytes_downloaded=0,
                        bytes_total=0,
                    )

            self._set_state(running=False, phase="ready", message="All dependencies are ready.", error="")
        except Exception as exc:
            self._set_state(running=False, phase="error", 
                          message="Dependency bootstrap failed.", error=str(exc))
        finally:
            with self._lock:
                self._running = False


dependency_bootstrap = DependencyBootstrapManager()
