from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


def calculate_averages(files: List[Path]) -> Dict[str, float]:
    kills = []
    assists = []
    for path in files:
        details = parse_clip_details(path.name)
        counts = details.get("counts")
        if counts:
            kills.append(counts.get("kills", 0))
            assists.append(counts.get("assists", 0))
    avg_kills = sum(kills) / len(kills) if kills else 0.0
    avg_assists = sum(assists) / len(assists) if assists else 0.0
    return {"kills": avg_kills, "assists": avg_assists}


def is_above_average(details: Dict[str, Any], averages: Dict[str, float]) -> bool:
    counts = details.get("counts")
    if not counts:
        return False
    return counts.get("kills", 0) > averages.get("kills", 0) or counts.get(
        "assists", 0
    ) > averages.get("assists", 0)


def build_top_reason(details: Dict[str, Any], averages: Dict[str, float]) -> str:
    counts = details.get("counts")
    if not counts:
        return ""
    reasons = []
    avg_kills = averages.get("kills", 0.0)
    avg_assists = averages.get("assists", 0.0)
    if counts.get("kills", 0) > avg_kills:
        reasons.append(f"Kills {counts.get('kills', 0)} > avg {avg_kills:.2f}")
    if counts.get("assists", 0) > avg_assists:
        reasons.append(f"Assists {counts.get('assists', 0)} > avg {avg_assists:.2f}")
    return "; ".join(reasons)


def parse_clip_details(filename: str) -> Dict[str, Any]:
    stem = Path(filename).stem
    details: Dict[str, Any] = {"timestamp": None, "counts": None, "offset_seconds": None}
    ts_match = re.search(r"(\d{8}_\d{6})", stem)
    if ts_match:
        try:
            details["timestamp"] = datetime.strptime(ts_match.group(1), "%Y%m%d_%H%M%S")
        except ValueError:
            details["timestamp"] = None
    counts_match = re.search(r"k(\d+)_a(\d+)_d(\d+)", stem)
    if counts_match:
        details["counts"] = {
            "kills": int(counts_match.group(1)),
            "assists": int(counts_match.group(2)),
            "deaths": int(counts_match.group(3)),
        }
    offset_match = re.search(r"_t(\d+)s", stem)
    if offset_match:
        details["offset_seconds"] = int(offset_match.group(1))
    return details


def parse_vod_timestamp(filename: str) -> Optional[datetime]:
    stem = Path(filename).stem
    ts_match = re.search(r"(\d{8}_\d{6})", stem)
    if not ts_match:
        dashed_match = re.search(r"(\d{4}-\d{2}-\d{2})[ _](\d{2}-\d{2}-\d{2})", stem)
        if not dashed_match:
            date_only_match = re.search(r"(\d{4}-\d{2}-\d{2})", stem)
            if not date_only_match:
                return None
            try:
                return datetime.strptime(date_only_match.group(1), "%Y-%m-%d")
            except ValueError:
                return None
        try:
            return datetime.strptime(
                f"{dashed_match.group(1)} {dashed_match.group(2).replace('-', ':')}",
                "%Y-%m-%d %H:%M:%S",
            )
        except ValueError:
            return None
    try:
        return datetime.strptime(ts_match.group(1), "%Y%m%d_%H%M%S")
    except ValueError:
        return None


def get_session_start(files: List[Path]) -> Optional[datetime]:
    timestamps = []
    for path in files:
        details = parse_clip_details(path.name)
        timestamp = details.get("timestamp")
        if isinstance(timestamp, datetime):
            timestamps.append(timestamp)
    return min(timestamps) if timestamps else None


def format_timestamp(timestamp: Optional[datetime]) -> str:
    if not isinstance(timestamp, datetime):
        return ""
    day = timestamp.day
    suffix = "th" if 11 <= day <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
    time_str = timestamp.strftime("%I:%M %p").lstrip("0")
    return f"{timestamp.strftime('%A, %b')} {day}{suffix} at {time_str}"


def parse_streamer_name(filename: str) -> Optional[str]:
    stem = Path(filename).stem
    match = re.match(r"^(.+?)_{2,}\d{4}-\d{2}-\d{2}", stem)
    if match:
        name = match.group(1).strip("_")
        return name or None
    match = re.match(r"^([A-Za-z][A-Za-z0-9]*)_\d{8}_\d{6}", stem)
    if match:
        return match.group(1)
    return None


def format_vod_display_title(filename: str) -> str:
    timestamp = parse_vod_timestamp(filename)
    streamer = parse_streamer_name(filename)
    date_label = ""
    if isinstance(timestamp, datetime):
        day = timestamp.day
        suffix = "th" if 11 <= day <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
        date_label = f"{timestamp.strftime('%A, %b')} {day}{suffix}"
    if streamer and date_label:
        return f"{streamer}, {date_label}"
    return date_label


def format_session_offset(timestamp: Optional[datetime], start: Optional[datetime]) -> str:
    if not isinstance(timestamp, datetime) or not isinstance(start, datetime):
        return ""
    seconds = max(0, int((timestamp - start).total_seconds()))
    return format_offset_seconds(seconds)


def format_offset_seconds(seconds: int) -> str:
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    if hours > 0:
        return f"{hours} hr {minutes} min into session"
    return f"{minutes} min into session"