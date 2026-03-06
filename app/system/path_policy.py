from __future__ import annotations

from pathlib import Path
from typing import List, Optional


def resolve_allowed_path(path_value: str, allowed_dirs: List[Path]) -> Optional[Path]:
    if not path_value:
        return None
    candidate = Path(path_value).resolve()
    for base in allowed_dirs:
        base_resolved = base.resolve()
        try:
            if candidate.is_relative_to(base_resolved):
                return candidate
        except AttributeError:
            if candidate == base_resolved or base_resolved in candidate.parents:
                return candidate
    return None


def resolve_existing_allowed_path(path_value: str, allowed_dirs: List[Path]) -> Optional[Path]:
    file_path = resolve_allowed_path(path_value, allowed_dirs)
    if file_path is None or not file_path.exists():
        return None
    return file_path
