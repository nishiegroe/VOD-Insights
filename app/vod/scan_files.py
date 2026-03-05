from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.runtime_paths import get_app_data_dir
from app.vod.stem import sanitize_stem


def resolve_bookmarks_context(config: Dict[str, Any]) -> Tuple[Path, str]:
    bookmarks_dir = Path(config.get("bookmarks", {}).get("directory", ""))
    if not bookmarks_dir.is_absolute():
        bookmarks_dir = get_app_data_dir() / bookmarks_dir
    session_prefix = config.get("bookmarks", {}).get("session_prefix", "session")
    return bookmarks_dir, session_prefix


def get_safe_vod_stem(vod_path_or_stem: str) -> str:
    return sanitize_stem(Path(vod_path_or_stem).stem) or "vod"


def get_scan_marker_paths(
    bookmarks_dir: Path,
    session_prefix: str,
    vod_path_or_stem: str,
) -> Tuple[Path, Path]:
    safe_stem = get_safe_vod_stem(vod_path_or_stem)
    scanning_marker = bookmarks_dir / f"{session_prefix}_{safe_stem}.scanning"
    paused_marker = bookmarks_dir / f"{session_prefix}_{safe_stem}.paused"
    return scanning_marker, paused_marker


def list_vod_session_files(
    bookmarks_dir: Path,
    session_prefix: str,
    vod_path_or_stem: str,
) -> List[Path]:
    safe_stem = get_safe_vod_stem(vod_path_or_stem)
    pattern_csv = f"{session_prefix}_{safe_stem}_*.csv"
    pattern_jsonl = f"{session_prefix}_{safe_stem}_*.jsonl"
    return list(bookmarks_dir.glob(pattern_csv)) + list(bookmarks_dir.glob(pattern_jsonl))


def find_vod_scan_state(
    bookmarks_dir: Path,
    session_prefix: str,
    vod_stem: str,
) -> Dict[str, Any]:
    if not bookmarks_dir.exists():
        return {"scanned": False, "scanning": False, "paused": False, "progress": None}

    scanning_marker, paused_marker = get_scan_marker_paths(bookmarks_dir, session_prefix, vod_stem)
    scanned = bool(list_vod_session_files(bookmarks_dir, session_prefix, vod_stem))
    scanning = scanning_marker.exists()
    paused = paused_marker.exists()

    progress: Optional[int] = None
    if scanning:
        try:
            payload = json.loads(scanning_marker.read_text(encoding="utf-8"))
            if isinstance(payload, dict):
                if isinstance(payload.get("progress"), (int, float)):
                    progress = int(payload["progress"])
                if payload.get("paused"):
                    paused = True
        except (json.JSONDecodeError, OSError, ValueError, TypeError):
            progress = None
    elif paused:
        try:
            payload = json.loads(paused_marker.read_text(encoding="utf-8"))
            if isinstance(payload, dict) and isinstance(payload.get("progress"), (int, float)):
                progress = int(payload["progress"])
        except (json.JSONDecodeError, OSError, ValueError, TypeError):
            progress = None

    return {"scanned": scanned, "scanning": scanning, "paused": paused, "progress": progress}