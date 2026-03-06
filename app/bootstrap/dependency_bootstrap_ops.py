from __future__ import annotations

import hashlib
import re
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


def _download_text(url: str) -> str:
    validate_dependency_host(url)
    req = urllib.request.Request(url, headers={"User-Agent": "VODInsights/1.0"})
    with urllib.request.urlopen(req, timeout=60) as response:
        return response.read().decode("utf-8", errors="replace")


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def _extract_expected_checksum(raw_text: str, artifact_name: str) -> str:
    cleaned_lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    if not cleaned_lines:
        raise RuntimeError("Checksum source returned no data.")

    basename = artifact_name.strip().lower()
    checksum_re = re.compile(r"^([A-Fa-f0-9]{64})\s+[* ]?(.+)?$")
    bsd_checksum_re = re.compile(r"^SHA256\s*\((.+)\)\s*=\s*([A-Fa-f0-9]{64})$", re.IGNORECASE)

    for line in cleaned_lines:
        match = checksum_re.match(line)
        if not match:
            bsd_match = bsd_checksum_re.match(line)
            if not bsd_match:
                continue
            candidate_name = (bsd_match.group(1) or "").strip().lower()
            if candidate_name and candidate_name.endswith(basename):
                return bsd_match.group(2).lower()
            continue
        candidate_name = (match.group(2) or "").strip().strip("*").lower()
        if candidate_name and candidate_name.endswith(basename):
            return match.group(1).lower()

    # Support plain single-line checksum files.
    if len(cleaned_lines) == 1 and re.fullmatch(r"[A-Fa-f0-9]{64}", cleaned_lines[0]):
        return cleaned_lines[0].lower()

    # If line contains only hash + filename but no direct match, keep compatibility
    # with providers that expose a single artifact in the checksum file.
    hash_only_matches = [m.group(1).lower() for line in cleaned_lines if (m := checksum_re.match(line))]
    if len(hash_only_matches) == 1:
        return hash_only_matches[0]

    raise RuntimeError(f"Could not find checksum for artifact: {artifact_name}")


def verify_dependency_checksum(
    spec_name: str,
    spec_url: str,
    checksum_url: str,
    downloaded_path: Path,
) -> None:
    if not checksum_url:
        raise RuntimeError(f"Missing checksum URL for dependency: {spec_name}")
    artifact_name = Path(urlparse(spec_url).path).name or downloaded_path.name
    raw_checksum = _download_text(checksum_url)
    expected = _extract_expected_checksum(raw_checksum, artifact_name)
    actual = _sha256_file(downloaded_path)
    if actual.lower() != expected.lower():
        raise RuntimeError(
            f"Checksum verification failed for {spec_name}. "
            f"expected={expected.lower()} actual={actual.lower()}"
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
