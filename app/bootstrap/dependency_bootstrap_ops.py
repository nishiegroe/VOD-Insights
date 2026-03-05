from __future__ import annotations

import shutil
import subprocess
import urllib.request
import zipfile
from pathlib import Path
from typing import Callable
from urllib.parse import urlparse

from app.runtime_paths import ensure_dir


def validate_dependency_host(url: str) -> None:
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


def download_dependency(
    spec_name: str,
    spec_url: str,
    destination: Path,
    set_state: Callable[..., None],
) -> None:
    validate_dependency_host(spec_url)
    req = urllib.request.Request(spec_url, headers={"User-Agent": "VODInsights/1.0"})
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
                set_state(
                    phase="downloading",
                    dependency=spec_name,
                    message=f"Downloading {spec_name}...",
                    bytes_downloaded=downloaded,
                    bytes_total=total,
                )


def install_dependency_file(spec_name: str, target: Path, archive_path: Path) -> None:
    if spec_name == "yt-dlp":
        ensure_dir(target.parent)
        shutil.move(str(archive_path), str(target))
        return

    if spec_name == "ffmpeg":
        if target.exists():
            shutil.rmtree(target, ignore_errors=True)
        ensure_dir(target)
        with zipfile.ZipFile(archive_path, "r") as archive:
            archive.extractall(target)
        return

    raise RuntimeError(f"Unsupported dependency install target: {spec_name}")


def install_python_package(package_name: str, set_state: Callable[..., None]) -> None:
    set_state(
        phase="installing",
        dependency=package_name,
        message=f"Installing Python package: {package_name}...",
        bytes_downloaded=0,
        bytes_total=0,
    )
    try:
        import sys

        args = [
            sys.executable,
            "-m",
            "pip",
            "install",
            "--upgrade",
            "--progress-bar=on",
            package_name,
        ]
        process = subprocess.Popen(
            args,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        if process.stderr is not None:
            buffer = ""
            while True:
                chunk = process.stderr.read(1)
                if not chunk:
                    break
                buffer += chunk
                if "\n" in buffer or "\r" in buffer:
                    parts = buffer.replace("\r", "\n").split("\n")
                    for line in parts[:-1]:
                        cleaned = line.strip()
                        if cleaned:
                            set_state(
                                phase="installing",
                                dependency=package_name,
                                message=f"{package_name}: {cleaned}",
                            )
                    buffer = parts[-1]
        if process.wait() != 0:
            raise subprocess.CalledProcessError(process.returncode, args)
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"Failed to install {package_name}: {exc}")


def is_python_package_installed(package_name: str) -> bool:
    try:
        __import__(package_name.replace("-", "_"))
        return True
    except ImportError:
        return False
