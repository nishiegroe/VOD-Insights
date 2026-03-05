from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any, Dict, List, Tuple

from app.runtime_paths import get_app_data_dir


def _is_under_bookmarks(file_path: Path, bookmarks_dir: Path) -> bool:
    try:
        return file_path.is_relative_to(bookmarks_dir)
    except (ValueError, AttributeError):
        return str(file_path).startswith(str(bookmarks_dir))


def _read_session_bookmarks(file_path: Path) -> List[Dict[str, Any]]:
    bookmarks: List[Dict[str, Any]] = []
    with file_path.open("r", encoding="utf-8") as handle:
        if file_path.suffix.lower() == ".csv":
            reader = csv.DictReader(handle)
            for row in reader:
                try:
                    bookmarks.append(
                        {
                            "timestamp": row.get("timestamp", ""),
                            "seconds": float(row.get("seconds_since_start", 0)),
                            "event": row.get("event", ""),
                            "ocr": row.get("ocr", ""),
                        }
                    )
                except (ValueError, KeyError):
                    continue
        elif file_path.suffix.lower() == ".jsonl":
            for line in handle:
                try:
                    data = json.loads(line)
                    bookmarks.append(
                        {
                            "timestamp": data.get("timestamp", ""),
                            "seconds": float(data.get("seconds_since_start", 0)),
                            "event": data.get("event", ""),
                            "ocr": data.get("ocr", ""),
                        }
                    )
                except (json.JSONDecodeError, ValueError, KeyError):
                    continue
    return bookmarks


def session_data_payload(session_path: str, config: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
    if not session_path:
        return {"ok": False, "error": "Missing session path"}, 400

    file_path = Path(session_path)
    if not file_path.exists():
        return {"ok": False, "error": "Session file not found"}, 404

    bookmarks_dir = Path(config.get("bookmarks", {}).get("directory", ""))
    if not bookmarks_dir.is_absolute():
        bookmarks_dir = get_app_data_dir() / bookmarks_dir

    if not _is_under_bookmarks(file_path, bookmarks_dir):
        return {"ok": False, "error": "Invalid session path"}, 403

    try:
        bookmarks = _read_session_bookmarks(file_path)
    except (OSError, IOError):
        return {"ok": False, "error": "Failed to read session file"}, 500

    return {
        "ok": True,
        "bookmarks": bookmarks,
        "session_name": file_path.name,
    }, 200
