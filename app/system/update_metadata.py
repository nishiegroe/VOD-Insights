from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List
from urllib.request import urlopen

from app.runtime_paths import get_exe_dir, get_install_dir, get_project_root


def load_patch_notes() -> List[Any]:
    meta_path = get_project_root() / "app_meta.json"
    if not meta_path.exists():
        return []
    try:
        payload = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception:
        return []
    notes = payload.get("patchNotes") or payload.get("patch_notes") or []
    return notes if isinstance(notes, list) else []


def get_current_app_version() -> str:
    source_mode = _get_version_source_mode()

    if source_mode == "install-meta-only":
        return _read_meta_version(get_install_dir() / "app_meta.json")

    if source_mode == "install-meta-first":
        version = _read_meta_version(get_install_dir() / "app_meta.json")
        if version:
            return version

    generated_version = _get_generated_app_version()
    if generated_version:
        return generated_version

    for meta_path in _candidate_app_meta_paths():
        version = _read_meta_version(meta_path)
        if version:
            return version
    return ""


def _get_version_source_mode() -> str:
    # Default mode keeps legacy behavior: generated app/version.py first.
    raw = os.environ.get("AET_VERSION_SOURCE_MODE", "")
    mode = raw.strip().lower()
    if mode in {"install-meta-first", "install-meta-only"}:
        return mode
    return "default"


def _normalize_version(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _get_generated_app_version() -> str:
    try:
        from app.version import APP_VERSION
    except Exception:
        return ""
    return _normalize_version(APP_VERSION)


def _candidate_app_meta_paths() -> list[Path]:
    candidates: list[Path] = []
    seen: set[str] = set()

    def _add(path: Path) -> None:
        key = str(path)
        if key in seen:
            return
        seen.add(key)
        candidates.append(path)

    _add(get_project_root() / "app_meta.json")
    _add(get_install_dir() / "app_meta.json")
    exe_dir = get_exe_dir()
    _add(exe_dir / "app_meta.json")
    _add(exe_dir.parent / "app_meta.json")

    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        meipass_dir = Path(meipass)
        _add(meipass_dir / "app_meta.json")
        _add(meipass_dir.parent / "app_meta.json")

    return candidates


def _read_meta_version(meta_path: Path) -> str:
    if not meta_path.exists():
        return ""
    try:
        payload = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception:
        return ""
    return _normalize_version(payload.get("version"))


def fetch_latest_update_metadata(update_feed_url: str, timeout_seconds: int) -> Dict[str, Any]:
    with urlopen(update_feed_url, timeout=timeout_seconds) as response:
        status = getattr(response, "status", 200)
        if status < 200 or status >= 300:
            raise RuntimeError(f"Update feed request failed with status {status}.")
        raw = response.read().decode("utf-8")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Invalid update metadata received.") from exc
    if not isinstance(payload, dict):
        raise RuntimeError("Invalid update metadata received.")
    return payload
