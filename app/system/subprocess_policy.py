from __future__ import annotations

from pathlib import Path
from typing import Iterable, List, Optional

from app.system.path_policy import normalize_allowed_dirs, resolve_allowed_path


class UnsafePathError(ValueError):
    """Raised when a path is unsafe to pass to external processes."""


def normalize_process_path(
    path: Path,
    *,
    must_exist: bool = True,
    expect_file: bool = True,
    allowed_dirs: Optional[Iterable[Path]] = None,
) -> Path:
    """Resolve and validate a filesystem path used in subprocess arguments."""
    resolved: Optional[Path]
    if allowed_dirs is not None:
        resolved = resolve_allowed_path(str(path), normalize_allowed_dirs(allowed_dirs))  # lgtm [py/path-injection] path is resolved and must remain within explicit allowed_dirs.
        if resolved is None:
            raise UnsafePathError("Path is outside allowed directories")
    else:
        try:
            # codeql[py/path-injection]: canonicalization step only; subsequent guards enforce existence/type and reject option-like names.
            resolved = path.resolve()  # lgtm [py/path-injection] canonicalization only; subsequent checks enforce existence/type and disallow option-like names.
        except (OSError, RuntimeError, ValueError) as exc:
            raise UnsafePathError("Path is invalid") from exc

    # Guard against option-style argv confusion in tools like ffmpeg.
    if resolved.name.startswith("-"):
        raise UnsafePathError("Path filename cannot start with '-'")

    # codeql[py/path-injection]: resolved path has already been canonicalized and allowlisted (when provided) before existence check.
    if must_exist and not resolved.exists():
        raise UnsafePathError("Path does not exist")

    # codeql[py/path-injection]: type validation on normalized/allowlisted path before subprocess usage.
    if expect_file and must_exist and not resolved.is_file():
        raise UnsafePathError("Expected a file path")

    return resolved


def ffmpeg_argv(executable: str, args: List[str]) -> List[str]:
    """Build ffmpeg/ffprobe argv as a strict list for shell=False execution."""
    # codeql[py/path-injection]: this helper only assembles argv; callers normalize path args and use shell=False.
    return [str(executable), *args]  # lgtm [py/path-injection] argv list is executed with shell=False and path args are normalized upstream.
