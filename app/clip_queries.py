from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.clip_insights import calculate_averages, get_session_start, parse_clip_details
from app.clip_library import (
    build_clip_entry,
    iter_clip_files,
    resolve_clip_path,
    serialize_clip,
)
from app.clip_titles import load_clip_titles


def clip_days_payload(config: Dict[str, Any]) -> List[Dict[str, Any]]:
    files = iter_clip_files(config)
    day_counts: Dict[str, int] = {}
    for path in files:
        details = parse_clip_details(path.name)
        timestamp = details.get("timestamp")
        if isinstance(timestamp, datetime):
            key = timestamp.strftime("%Y-%m-%d")
        else:
            key = "unknown"
        day_counts[key] = day_counts.get(key, 0) + 1

    def sort_key(item: tuple[str, int]) -> tuple[int, str]:
        key, _ = item
        return (1, "") if key == "unknown" else (0, key)

    ordered = sorted(day_counts.items(), key=sort_key, reverse=True)
    return [{"day": key, "count": count} for key, count in ordered]


def _parse_limit_offset(limit_arg: Optional[str], offset_arg: Optional[str]) -> Tuple[Optional[int], int]:
    try:
        limit = int(limit_arg) if limit_arg is not None and limit_arg != "" else None
    except ValueError:
        limit = None
    if isinstance(limit, int) and limit < 0:
        limit = 0

    try:
        offset = int(offset_arg) if offset_arg else 0
    except ValueError:
        offset = 0
    return limit, max(0, offset)


def clips_by_day_payload(
    config: Dict[str, Any],
    day_value: str,
    limit_arg: Optional[str],
    offset_arg: Optional[str],
) -> Dict[str, Any]:
    limit, offset = _parse_limit_offset(limit_arg, offset_arg)

    files = iter_clip_files(config)
    averages = calculate_averages(files)
    session_start = get_session_start(files)
    titles = load_clip_titles()

    filtered: List[Path] = []
    for path in files:
        details = parse_clip_details(path.name)
        timestamp = details.get("timestamp")
        if day_value == "unknown":
            if not isinstance(timestamp, datetime):
                filtered.append(path)
        elif isinstance(timestamp, datetime) and timestamp.strftime("%Y-%m-%d") == day_value:
            filtered.append(path)

    total = len(filtered)
    page_paths = filtered[offset:] if limit is None else filtered[offset : offset + limit]
    entries = [
        build_clip_entry(path, titles, averages, session_start)
        for path in page_paths
    ]
    serialized = [serialize_clip(entry) for entry in entries]
    returned = len(serialized)
    return {
        "clips": serialized,
        "total": total,
        "offset": offset,
        "limit": limit,
        "returned": returned,
        "has_more": offset + returned < total,
    }


def clip_lookup_payload(config: Dict[str, Any], path_value: str) -> Tuple[Dict[str, Any], int]:
    file_path = resolve_clip_path(path_value, config)
    if file_path is None or not file_path.exists():
        return {"ok": False, "error": "Clip not found"}, 404

    files = iter_clip_files(config)
    averages = calculate_averages(files)
    session_start = get_session_start(files)
    titles = load_clip_titles()
    entry = build_clip_entry(file_path, titles, averages, session_start)
    serialized = serialize_clip(entry)
    return {"ok": True, "clip": serialized, "day": serialized.get("day_key")}, 200