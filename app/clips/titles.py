from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Dict, Optional

from app.runtime_paths import get_app_data_dir


CLIP_NAME_PATTERN = re.compile(r"(?:^clip_|_t\d+s|k\d+_a\d+_d\d+)", re.IGNORECASE)
CLIP_TITLES_PATH = get_app_data_dir() / "clip_titles.json"


def normalize_clip_path(path: Path) -> str:
    return os.path.normcase(str(path.resolve()))


def load_clip_titles() -> Dict[str, str]:
    if not CLIP_TITLES_PATH.exists():
        return {}
    try:
        payload = json.loads(CLIP_TITLES_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    if not isinstance(payload, dict):
        return {}
    cleaned: Dict[str, str] = {}
    for key, value in payload.items():
        if isinstance(key, str) and isinstance(value, str):
            name = value.strip()
            if name:
                cleaned[key] = name
    return cleaned


def save_clip_titles(titles: Dict[str, str]) -> None:
    CLIP_TITLES_PATH.parent.mkdir(parents=True, exist_ok=True)
    CLIP_TITLES_PATH.write_text(json.dumps(titles, indent=2), encoding="utf-8")


def clean_clip_title(value: str) -> str:
    title = re.sub(r"\s+", " ", value or "").strip()
    if len(title) > 120:
        title = title[:120].rstrip()
    return title


def set_clip_title(path: Path, title: str) -> str:
    titles = load_clip_titles()
    key = normalize_clip_path(path)
    cleaned = clean_clip_title(title)
    if cleaned:
        titles[key] = cleaned
    else:
        titles.pop(key, None)
    save_clip_titles(titles)
    return cleaned


def get_clip_title(path: Path, titles: Optional[Dict[str, str]] = None) -> str:
    source = titles if titles is not None else load_clip_titles()
    return source.get(normalize_clip_path(path), "")


def build_download_name(display_name: str, file_path: Path) -> str:
    name = display_name.strip()
    if not name:
        return file_path.name
    name = re.sub(r"[\\/:*?\"<>|]+", "_", name)
    name = re.sub(r"\s+", " ", name).strip()
    if not name:
        return file_path.name
    suffix = file_path.suffix
    if suffix and not name.lower().endswith(suffix.lower()):
        name = f"{name}{suffix}"
    return name