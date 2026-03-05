from __future__ import annotations

from pathlib import Path
from typing import List, Optional


def resolve_path_within_dirs(candidate: Path, allowed_dirs: List[Path]) -> Optional[Path]:
    resolved = candidate.resolve()
    for base in allowed_dirs:
        try:
            if resolved.is_relative_to(base):
                return resolved
        except AttributeError:
            if str(resolved).lower().startswith(str(base).lower()):
                return resolved
    return None


def resolve_vod_path(vod_path: str, allowed_dirs: List[Path]) -> Optional[Path]:
    if not vod_path:
        return None
    return resolve_path_within_dirs(Path(vod_path), allowed_dirs)


def resolve_vod_media_filename(filename: str, allowed_dirs: List[Path]) -> Optional[Path]:
    for base in allowed_dirs:
        resolved = resolve_path_within_dirs(base / filename, [base])
        if resolved is not None:
            return resolved
    return None