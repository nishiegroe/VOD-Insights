from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Dict, Optional

from app.runtime_paths import resolve_tool
from app.system.subprocess_policy import UnsafePathError, ffmpeg_argv, normalize_process_path


_duration_cache: Dict[tuple, Optional[float]] = {}


def get_media_duration(path: Path) -> Optional[float]:
    try:
        normalized_path = normalize_process_path(path)
    except UnsafePathError:
        return None

    try:
        mtime = normalized_path.stat().st_mtime
    except OSError:
        return None

    cache_key = (str(normalized_path), mtime)
    if cache_key in _duration_cache:
        return _duration_cache[cache_key]

    duration: Optional[float] = None
    try:
        ffprobe_path = resolve_tool("ffprobe", ["ffprobe.exe"])
        if ffprobe_path:
            result = subprocess.run(
                ffmpeg_argv(ffprobe_path, [
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration",
                    "-of",
                    "default=noprint_wrappers=1:nokey=1",
                    str(normalized_path),
                ]),
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                shell=False,
            )
            duration = float(result.stdout.strip())
    except (subprocess.SubprocessError, ValueError, OSError, UnsafePathError):
        duration = None

    _duration_cache[cache_key] = duration
    return duration