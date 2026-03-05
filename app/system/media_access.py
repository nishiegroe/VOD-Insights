from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

from app.runtime_paths import get_downloads_dir


DOWNLOADS_DIR = get_downloads_dir()


def get_allowed_media_dirs(config: Dict[str, Any]) -> List[Path]:
    replay_cfg = config.get("replay", {})
    dirs = []

    vods_dir = replay_cfg.get("directory", "")
    if vods_dir:
        p = Path(vods_dir).resolve()
        if p.exists():
            dirs.append(p)

    if DOWNLOADS_DIR.exists() and DOWNLOADS_DIR not in dirs:
        dirs.append(DOWNLOADS_DIR)
    return dirs