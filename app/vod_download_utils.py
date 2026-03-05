from __future__ import annotations

import re
from typing import Optional, Tuple


PROGRESS_TEMPLATE_RE = re.compile(r"^\s*([\d.]+)%\s*\|(.*?)\|(.*?)\s*$")
TWITCH_VOD_URL_RE = re.compile(r"https?:\/\/(www\.)?twitch\.tv\/videos\/\d+")


def validate_twitch_vod_url(url: str) -> bool:
    if not url:
        return False
    return bool(TWITCH_VOD_URL_RE.match(url))


def parse_progress_template(output: str) -> Optional[Tuple[float, str, str]]:
    match = PROGRESS_TEMPLATE_RE.search(output)
    if not match:
        return None
    percentage = min(100.0, float(match.group(1)))
    speed_str = match.group(2).strip()
    eta_str = match.group(3).strip()
    return percentage, speed_str, eta_str


def sanitize_filename(filename: str) -> str:
    invalid_chars = r'[<>:"/\\|?*]'
    sanitized = re.sub(invalid_chars, "_", filename)
    sanitized = sanitized.strip(". ")
    return sanitized[:200]
