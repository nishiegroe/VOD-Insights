from __future__ import annotations

from pathlib import Path
from typing import List


class UnsafePathError(ValueError):
    """Raised when a path is unsafe to pass to external processes."""


def normalize_process_path(path: Path, *, must_exist: bool = True, expect_file: bool = True) -> Path:
    """Resolve and validate a filesystem path used in subprocess arguments."""
    resolved = path.resolve()

    # Guard against option-style argv confusion in tools like ffmpeg.
    if resolved.name.startswith("-"):
        raise UnsafePathError("Path filename cannot start with '-'")

    if must_exist and not resolved.exists():
        raise UnsafePathError("Path does not exist")

    if expect_file and must_exist and not resolved.is_file():
        raise UnsafePathError("Expected a file path")

    return resolved


def ffmpeg_argv(executable: str, args: List[str]) -> List[str]:
    """Build ffmpeg/ffprobe argv as a strict list for shell=False execution."""
    return [str(executable), *args]
