from __future__ import annotations

from dataclasses import dataclass
import json
import logging
import shutil
import subprocess
import threading
import time
import urllib.request
import zipfile
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import urlparse

from app.runtime_paths import ensure_dir, get_app_data_dir, get_install_dir


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DependencySpec:
    name: str
    url: str
    kind: str  # "zip", "file", "pip" (Python package)
    required: bool


# Required tools that block startup
DEPENDENCIES: tuple[DependencySpec, ...] = (
    DependencySpec(
        name="ffmpeg",
        url="https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
        kind="zip",
        required=True,
    ),
    DependencySpec(
        name="yt-dlp",
        url="https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
        kind="file",
        required=True,
    ),
)

# Optional GPU OCR dependencies (do not block startup)
GPU_OCR_DEPENDENCIES: tuple[DependencySpec, ...] = (
    DependencySpec(
        name="torch",
        url="",  # Installed via pip
        kind="pip",
        required=False,
    ),
    DependencySpec(
        name="torchvision",
        url="",
        kind="pip",
        required=False,
    ),
    DependencySpec(
        name="torchaudio",
        url="",
        kind="pip",
        required=False,
    ),
    DependencySpec(
        name="easyocr",
        url="",
        kind="pip",
        required=False,
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
        
        # If GPU OCR installation already complete and required tools ready, return
        if status["gpu_ocr_ready"] and status["required_ready"]:
            self._set_state(running=False, phase="ready", 
                          message="All dependencies are ready.", error="")
            return self.get_status()
        
        # If we need to install GPU OCR, always do it
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
                "install_gpu_ocr": True,  # Always install GPU OCR
            })
            self._save_state()
            self._thread = threading.Thread(target=self._run, daemon=True)
            self._thread.start()

        return self.get_status()

    def _validate_host(self, url: str) -> None:
        host = (urlparse(url).hostname or "").lower()
        if not host:
            raise RuntimeError("Dependency URL host is missing.")
        allowed = {
            "www.gyan.dev",
            "github.com",
            "objects.githubusercontent.com",
            "githubusercontent.com",
        }
        if host in allowed or host.endswith(".githubusercontent.com"):
            return
        raise RuntimeError(f"Dependency host not allowed: {host}")

    def _download(self, spec: DependencySpec, destination: Path) -> None:
        self._validate_host(spec.url)
        req = urllib.request.Request(spec.url, headers={"User-Agent": "VODInsights/1.0"})
        with urllib.request.urlopen(req, timeout=60) as response:
            total = int(response.headers.get("Content-Length") or 0)
            ensure_dir(destination.parent)
            with destination.open("wb") as handle:
                downloaded = 0
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    handle.write(chunk)
                    downloaded += len(chunk)
                    self._set_state(
                        phase="downloading",
                        dependency=spec.name,
                        message=f"Downloading {spec.name}...",
                        bytes_downloaded=downloaded,
                        bytes_total=total,
                    )

    def _install_file(self, spec: DependencySpec, archive_path: Path) -> None:
        if spec.name == "yt-dlp":
            target = self._tool_path(spec)
            ensure_dir(target.parent)
            shutil.move(str(archive_path), str(target))
            return

        if spec.name == "ffmpeg":
            target_dir = self._tool_path(spec)
            if target_dir.exists():
                shutil.rmtree(target_dir, ignore_errors=True)
            ensure_dir(target_dir)
            with zipfile.ZipFile(archive_path, "r") as archive:
                archive.extractall(target_dir)
            return

        raise RuntimeError(f"Unsupported dependency install target: {spec.name}")

    def _install_python_package(self, package_name: str) -> None:
        """Install a Python package using pip."""
        self._set_state(
            phase="installing",
            dependency=package_name,
            message=f"Installing Python package: {package_name}...",
            bytes_downloaded=0,
            bytes_total=0,
        )
        try:
            import sys
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install", "--upgrade", "--quiet", package_name],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except subprocess.CalledProcessError as exc:
            raise RuntimeError(f"Failed to install {package_name}: {exc}")

    def _is_python_package_installed(self, package_name: str) -> bool:
        """Check if a Python package is installed."""
        try:
            __import__(package_name.replace("-", "_"))
            return True
        except ImportError:
            return False

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

            # Install GPU OCR dependencies automatically (non-blocking if they fail)
            # This is done in the background after required tools are ready
            for spec in GPU_OCR_DEPENDENCIES:
                try:
                    if self._is_python_package_installed(spec.name):
                        self._set_state(
                            phase="checking",
                            dependency=spec.name,
                            message=f"{spec.name} already installed.",
                            completed={**self._state.get("completed", {}), spec.name: True},
                        )
                        continue
                    
                    self._install_python_package(spec.name)
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
