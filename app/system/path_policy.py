from __future__ import annotations

from pathlib import Path
from typing import Iterable, List, Optional


def normalize_allowed_dirs(allowed_dirs: Iterable[Path]) -> List[Path]:
    normalized: List[Path] = []
    for base in allowed_dirs:
        try:
            base_resolved = base.resolve()
        except (OSError, RuntimeError, ValueError):
            continue
        if base_resolved not in normalized:
            normalized.append(base_resolved)
    return normalized


def parse_path_value(path_value: str) -> Optional[Path]:
    if not path_value:
        return None
    try:
        return Path(path_value)
    except (OSError, RuntimeError, ValueError):
        return None


def resolve_path_candidate(path_value: str) -> Optional[Path]:
    candidate = parse_path_value(path_value)
    if candidate is None:
        return None
    try:
        return candidate.resolve()
    except (OSError, RuntimeError, ValueError):
        return None


def is_path_within_allowed_dirs(candidate: Path, allowed_dirs: Iterable[Path]) -> bool:
    for base_resolved in normalize_allowed_dirs(allowed_dirs):
        try:
            if candidate.is_relative_to(base_resolved):
                return True
        except AttributeError:
            if candidate == base_resolved or base_resolved in candidate.parents:
                return True
    return False


def _is_simple_child_name(name: str) -> bool:
    if not name:
        return False
    candidate = Path(name)
    if candidate.is_absolute():
        return False
    if candidate.name != name:
        return False
    return name not in {".", ".."}


def resolve_allowed_path(path_value: str, allowed_dirs: List[Path]) -> Optional[Path]:
    candidate = resolve_path_candidate(path_value)
    if candidate is None:
        return None
    return candidate if is_path_within_allowed_dirs(candidate, allowed_dirs) else None


def resolve_existing_allowed_path(path_value: str, allowed_dirs: List[Path]) -> Optional[Path]:
    file_path = resolve_allowed_path(path_value, allowed_dirs)
    if file_path is None or not file_path.exists():
        return None
    return file_path


def resolve_allowed_child_path(name: str, allowed_dirs: List[Path]) -> Optional[Path]:
    if not _is_simple_child_name(name):
        return None
    for base in normalize_allowed_dirs(allowed_dirs):
        resolved = resolve_allowed_path(str(base / name), [base])  # lgtm [py/path-injection] child name is restricted to a simple basename and rechecked against base.
        if resolved is not None:
            return resolved
    return None


def resolve_existing_allowed_child_path(name: str, allowed_dirs: List[Path]) -> Optional[Path]:
    file_path = resolve_allowed_child_path(name, allowed_dirs)
    if file_path is None or not file_path.exists():
        return None
    return file_path
