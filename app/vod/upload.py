from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any, Dict

from app.runtime_paths import build_mode_command, get_project_root, get_uploads_dir
from app.twitch.jobs import sanitize_filename


def save_uploaded_vod_file(vod_file: Any, config: Dict[str, Any]) -> Path:
    recordings_dir = Path(config.get("replay", {}).get("directory", "")).resolve()
    upload_dir = recordings_dir if recordings_dir.exists() else get_uploads_dir()
    upload_dir.mkdir(parents=True, exist_ok=True)

    filename = sanitize_filename(vod_file.filename)
    dest_path = upload_dir / filename
    vod_file.save(dest_path)
    return dest_path


def start_vod_scan_for_path(config_path: Path, vod_path: Path) -> None:
    subprocess.Popen(
        build_mode_command("vod", config_path, ["--vod", str(vod_path)]),
        cwd=str(get_project_root()),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )