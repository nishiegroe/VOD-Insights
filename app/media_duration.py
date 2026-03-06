from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Dict, Optional

from app.runtime_paths import resolve_tool
from app.system.subprocess_policy import UnsafePathError, ffmpeg_argv, normalize_process_path
from app.system.path_policy import normalize_allowed_dirs


_duration_cache: Dict[tuple, Optional[float]] = {}


def get_media_duration(path: Path) -> Optional[float]:
    try:
        normalized_path = normalize_process_path(
            path,
            allowed_dirs=normalize_allowed_dirs([path.parent]),
        )
    except UnsafePathError:
        return None

    try:
        mtime = normalized_path.stat().st_mtime
    except OSError:
        return None

    # codeql[py/path-injection]: normalized_path is validated by normalize_process_path and restricted to allowed_dirs.
    cache_key = (str(normalized_path), mtime)  # lgtm [py/path-injection] normalized_path is allowlisted via normalize_process_path.
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