from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Dict, Optional

from app.runtime_paths import resolve_tool


_duration_cache: Dict[tuple, Optional[float]] = {}


def get_media_duration(path: Path) -> Optional[float]:
    try:
        mtime = path.stat().st_mtime
    except OSError:
        return None

    cache_key = (str(path), mtime)
    if cache_key in _duration_cache:
        return _duration_cache[cache_key]

    duration: Optional[float] = None
    try:
        ffprobe_path = resolve_tool("ffprobe", ["ffprobe.exe"])
        if ffprobe_path:
            result = subprocess.run(
                [
                    ffprobe_path,
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration",
                    "-of",
                    "default=noprint_wrappers=1:nokey=1",
                    str(path),
                ],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            duration = float(result.stdout.strip())
    except Exception:
        duration = None

    _duration_cache[cache_key] = duration
    return duration