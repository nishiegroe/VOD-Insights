from __future__ import annotations

import subprocess
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Tuple

from app.runtime_paths import get_app_data_dir
from app.split_bookmarks import count_events, load_bookmarks, parse_vod_start_time, run_ffmpeg
from app.system.path_policy import normalize_allowed_dirs, resolve_allowed_path
from app.vod.catalog import get_vod_dirs, list_sessions_for_vod


def create_clip_range_payload(
    config: Dict[str, Any],
    vod_path: Any,
    start_value: Any,
    end_value: Any,
) -> Tuple[Dict[str, Any], int]:
    path_value = str(vod_path or "").strip()
    if not path_value:
        return {"ok": False, "error": "Missing VOD path"}, 400

    try:
        start = float(start_value)
        end = float(end_value)
    except (TypeError, ValueError):
        return {"ok": False, "error": "Invalid start/end"}, 400

    if end <= start:
        return {"ok": False, "error": "End must be after start"}, 400

    allowed_dirs = normalize_allowed_dirs([path for path in get_vod_dirs(config) if str(path)])
    vod_file = resolve_allowed_path(path_value, allowed_dirs)
    if vod_file is None:
        return {"ok": False, "error": "Invalid VOD path"}, 403
    if not vod_file.exists() or not vod_file.is_file():
        return {"ok": False, "error": "VOD not found"}, 404

    extensions = {ext.lower() for ext in config.get("split", {}).get("extensions", [])}
    if extensions and vod_file.suffix.lower() not in extensions:
        return {"ok": False, "error": "Unsupported VOD type"}, 400

    split_cfg = config.get("split", {})
    output_dir = Path(split_cfg.get("output_dir", ""))
    if not output_dir.name:
        output_dir = vod_file.parent / "clips"
    elif not output_dir.is_absolute():
        output_dir = vod_file.parent / output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    vod_start = parse_vod_start_time(vod_file)
    if vod_start is None:
        vod_start = datetime.fromtimestamp(vod_file.stat().st_mtime)

    duration = max(0.1, end - start)
    offset_seconds = int(round(start))
    clip_time = vod_start + timedelta(seconds=start)
    timestamp = clip_time.strftime("%Y%m%d_%H%M%S")
    output_name = f"clip_{timestamp}_t{offset_seconds}s"

    bookmarks_dir = Path(config.get("bookmarks", {}).get("directory", ""))
    if not bookmarks_dir.is_absolute():
        bookmarks_dir = get_app_data_dir() / bookmarks_dir
    session_prefix = config.get("bookmarks", {}).get("session_prefix", "session")
    sessions = list_sessions_for_vod(bookmarks_dir, session_prefix, vod_file.stem)

    if sessions and split_cfg.get("encode_counts", True):
        session_path = Path(sessions[0]["path"])
        try:
            all_events = load_bookmarks(session_path)
            clip_events = [event for event in all_events if start <= event.time <= end]
            if clip_events:
                counts = count_events(clip_events)
                count_format = split_cfg.get("count_format", "k{kills}_a{assists}_d{deaths}")
                output_name = f"{output_name}_{count_format.format(**counts)}"
        except Exception:
            pass

    output_file = output_dir / f"{output_name}{vod_file.suffix}"

    try:
        run_ffmpeg(vod_file, output_file, start, duration)
    except (subprocess.CalledProcessError, RuntimeError):
        logging.exception("Failed to create clip range with FFmpeg")
        return {"ok": False, "error": "Failed to create clip"}, 500

    return {"ok": True, "clip_path": str(output_file)}, 200
