from __future__ import annotations

from json import JSONDecodeError
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote

from app.clips.insights import format_timestamp, format_vod_display_title, parse_vod_timestamp
from app.media_duration import get_media_duration
from app.split_bookmarks import load_bookmarks
from app.vod.catalog import list_sessions_for_vod
from app.vod.scan_files import find_vod_scan_state


def get_hottest_event_time(bookmark_path: Path, duration: Optional[float]) -> Optional[float]:
    try:
        events = load_bookmarks(bookmark_path)
    except (OSError, ValueError, JSONDecodeError, TypeError):
        return None

    if not events:
        return None

    max_event_time = max(event.time for event in events)
    span = max(float(duration or 0), max_event_time)
    if span <= 0:
        return None

    bin_count = 60
    bins = [0] * bin_count
    for event in events:
        idx = int((event.time / span) * bin_count)
        idx = max(0, min(bin_count - 1, idx))
        bins[idx] += 1

    hottest = max(bins)
    if hottest <= 0:
        return None

    hottest_bins = {index for index, count in enumerate(bins) if count == hottest}
    hottest_events = [
        event.time
        for event in events
        if int((event.time / span) * bin_count) in hottest_bins
    ]
    if not hottest_events:
        return None
    return max(hottest_events)


def build_vod_entries(
    paths: List[Path],
    bookmarks_dir: Path,
    session_prefix: str,
) -> List[Dict[str, Any]]:
    result = []
    for path in paths:
        stat = path.stat()
        duration = get_media_duration(path)
        pretty_time = format_timestamp(parse_vod_timestamp(path.name))
        display_title = format_vod_display_title(path.name)
        scan_state = find_vod_scan_state(bookmarks_dir, session_prefix, path.stem)
        sessions = list_sessions_for_vod(bookmarks_dir, session_prefix, path.stem)
        thumbnail_time = None
        if sessions:
            session_path = Path(sessions[0].get("path", ""))
            if session_path.exists():
                thumbnail_time = get_hottest_event_time(session_path, duration)

        # Prefer event-driven thumbnails when scan data exists.
        # Fall back to a standard preview frame at 10% into the VOD.
        fallback_time = (float(duration) * 0.1) if duration else 0.0
        preview_time = thumbnail_time if thumbnail_time is not None else fallback_time
        encoded_path = quote(str(path))
        thumbnail_url = f"/vod-thumbnail?path={encoded_path}&t={preview_time:.3f}"
        result.append(
            {
                "name": path.name,
                "path": str(path),
                "mtime": stat.st_mtime,
                "size": stat.st_size,
                "duration": duration,
                "pretty_time": pretty_time,
                "display_title": display_title,
                "scanned": scan_state["scanned"],
                "scanning": scan_state["scanning"],
                "paused": scan_state["paused"],
                "scan_progress": scan_state.get("progress"),
                "sessions": sessions,
                "thumbnail_time": thumbnail_time,
                "thumbnail_url": thumbnail_url,
            }
        )
    return result