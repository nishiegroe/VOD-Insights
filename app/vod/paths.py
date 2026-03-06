from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from app.system.path_policy import resolve_allowed_child_path, resolve_allowed_path


def resolve_path_within_dirs(candidate: Path, allowed_dirs: List[Path]) -> Optional[Path]:
    return resolve_allowed_path(str(candidate), allowed_dirs)


def resolve_vod_path(vod_path: str, allowed_dirs: List[Path]) -> Optional[Path]:
    if not vod_path:
        return None
    return resolve_path_within_dirs(Path(vod_path), allowed_dirs)


def resolve_vod_media_filename(filename: str, allowed_dirs: List[Path]) -> Optional[Path]:
    return resolve_allowed_child_path(filename, allowed_dirs)