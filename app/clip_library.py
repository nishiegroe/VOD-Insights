from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.clip_insights import (
    build_top_reason,
    calculate_averages,
    format_offset_seconds,
    format_session_offset,
    format_timestamp,
    get_session_start,
    is_above_average,
    parse_clip_details,
)
from app.clip_titles import CLIP_NAME_PATTERN, get_clip_title, load_clip_titles
from app.media_duration import get_media_duration
from app.vod_catalog import get_clips_dir


def get_clip_dirs(config: Dict[str, Any]) -> List[Path]:
    replay_cfg = config.get("replay", {})
    recordings_dir = Path(replay_cfg.get("directory", ""))
    clips_subdir = recordings_dir / "clips" if recordings_dir else Path("")

    dirs = []
    for path in [clips_subdir, recordings_dir]:
        if path and path not in dirs:
            dirs.append(path)
    return dirs


def iter_clip_files(config: Dict[str, Any]) -> List[Path]:
    split_cfg = config.get("split", {})
    extensions = {ext.lower() for ext in split_cfg.get("extensions", [])}
    clip_dirs = get_clip_dirs(config)
    clips_dir = get_clips_dir(config)
    files: List[Path] = []

    for directory in clip_dirs:
        if not directory.exists():
            continue
        for path in directory.iterdir():
            if not path.is_file():
                continue
            if extensions and path.suffix.lower() not in extensions:
                continue
            if directory != clips_dir and not CLIP_NAME_PATTERN.search(path.stem):
                continue
            files.append(path)

    files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return files


def build_clip_entry(
    path: Path,
    titles: Dict[str, str],
    averages: Dict[str, float],
    session_start: Optional[datetime],
    include_duration: bool = True,
) -> Dict[str, Any]:
    stat = path.stat()
    details = parse_clip_details(path.name)
    details["above_avg"] = is_above_average(details, averages)
    details["top_reason"] = build_top_reason(details, averages)
    details["pretty_time"] = format_timestamp(details.get("timestamp"))
    offset_seconds = details.get("offset_seconds")
    if isinstance(offset_seconds, int):
        details["session_offset"] = format_offset_seconds(offset_seconds)
    else:
        details["session_offset"] = format_session_offset(
            details.get("timestamp"), session_start
        )
    display_name = get_clip_title(path, titles)
    duration = get_media_duration(path) if include_duration else None
    day_key = "unknown"
    if isinstance(details.get("timestamp"), datetime):
        day_key = details["timestamp"].strftime("%Y-%m-%d")
    return {
        "name": path.name,
        "path": str(path),
        "mtime": stat.st_mtime,
        "size": stat.st_size,
        "duration": duration,
        "details": details,
        "display_name": display_name,
        "day_key": day_key,
    }


def list_clips(config: Dict[str, Any], limit: int = 20) -> List[Dict[str, Any]]:
    files = iter_clip_files(config)
    averages = calculate_averages(files)
    session_start = get_session_start(files)
    titles = load_clip_titles()
    return [
        build_clip_entry(path, titles, averages, session_start)
        for path in files[:limit]
    ]


def serialize_clip(clip: Dict[str, Any]) -> Dict[str, Any]:
    details = dict(clip.get("details", {}))
    timestamp = details.get("timestamp")
    if isinstance(timestamp, datetime):
        details["timestamp"] = timestamp.isoformat()
    else:
        details.pop("timestamp", None)
    return {
        "name": clip.get("name"),
        "path": clip.get("path"),
        "mtime": clip.get("mtime"),
        "size": clip.get("size"),
        "duration": clip.get("duration"),
        "display_name": clip.get("display_name") or "",
        "day_key": clip.get("day_key"),
        "details": details,
    }


def resolve_clip_path(path_value: str, config: Dict[str, Any]) -> Optional[Path]:
    if not path_value:
        return None
    candidate = Path(path_value).resolve()
    for base in get_clip_dirs(config):
        if not base:
            continue
        base = base.resolve()
        try:
            if candidate.is_relative_to(base):
                return candidate
        except AttributeError:
            if str(candidate).lower().startswith(str(base).lower()):
                return candidate
    return None