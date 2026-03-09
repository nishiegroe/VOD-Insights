from __future__ import annotations

import re
from typing import Optional, Tuple


PROGRESS_TEMPLATE_RE = re.compile(
    r"(?:\[download\]\s*)?(?:download\s*:\s*)?([\d.]+)%\s*\|\s*([^|]*)\|\s*([^\r\n]*)",
    re.IGNORECASE,
)
ANSI_ESCAPE_RE = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]")
CLASSIC_PROGRESS_RE = re.compile(r"(\d{1,3}(?:\.\d+)?)%")
CLASSIC_SPEED_RE = re.compile(r"at\s+([^\s]+/s)", re.IGNORECASE)
CLASSIC_ETA_RE = re.compile(r"ETA\s+([^\s]+)", re.IGNORECASE)
FFMPEG_TIME_RE = re.compile(r"time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)")
FFMPEG_SPEED_RE = re.compile(r"speed=\s*([\d.]+)x", re.IGNORECASE)
FFMPEG_BITRATE_RE = re.compile(r"bitrate=\s*([\d.]+)kbits/s", re.IGNORECASE)
TWITCH_VOD_URL_RE = re.compile(r"https?:\/\/(www\.)?twitch\.tv\/videos\/\d+")


def validate_twitch_vod_url(url: str) -> bool:
    if not url:
        return False
    return bool(TWITCH_VOD_URL_RE.match(url))


def parse_progress_template(output: str) -> Optional[Tuple[float, str, str]]:
    normalized = ANSI_ESCAPE_RE.sub("", output or "")

    match = PROGRESS_TEMPLATE_RE.search(normalized)
    if not match:
        classic_match = CLASSIC_PROGRESS_RE.search(normalized)
        if not classic_match:
            return None

        percentage = min(100.0, float(classic_match.group(1)))
        speed_match = CLASSIC_SPEED_RE.search(normalized)
        eta_match = CLASSIC_ETA_RE.search(normalized)
        speed_str = speed_match.group(1).strip() if speed_match else ""
        eta_str = eta_match.group(1).strip() if eta_match else ""
        return percentage, speed_str, eta_str

    percentage = min(100.0, float(match.group(1)))
    speed_str = match.group(2).strip()
    eta_str = match.group(3).strip()
    return percentage, speed_str, eta_str


def parse_ffmpeg_progress(output: str) -> Optional[Tuple[float, Optional[float], Optional[float]]]:
    """Parse FFmpeg-style progress lines emitted via yt-dlp fallback output.

    Returns: (current_seconds, speed_multiplier, bitrate_kbits_per_sec)
    """
    normalized = ANSI_ESCAPE_RE.sub("", output or "")
    time_match = FFMPEG_TIME_RE.search(normalized)
    if not time_match:
        return None

    hours = int(time_match.group(1))
    minutes = int(time_match.group(2))
    seconds = float(time_match.group(3))
    current_seconds = hours * 3600 + minutes * 60 + seconds

    speed_match = FFMPEG_SPEED_RE.search(normalized)
    speed_multiplier = float(speed_match.group(1)) if speed_match else None

    bitrate_match = FFMPEG_BITRATE_RE.search(normalized)
    bitrate_kbits_per_sec = float(bitrate_match.group(1)) if bitrate_match else None

    return current_seconds, speed_multiplier, bitrate_kbits_per_sec


def sanitize_filename(filename: str) -> str:
    invalid_chars = r'[<>:"/\\|?*]'
    sanitized = re.sub(invalid_chars, "_", filename)
    sanitized = sanitized.strip(". ")
    return sanitized[:200]
