from __future__ import annotations

import logging
import subprocess
from pathlib import Path
from typing import Any, Dict

from app.runtime_paths import build_mode_command, get_project_root, get_uploads_dir
from app.system.path_policy import normalize_allowed_dirs, resolve_allowed_child_path
from app.system.subprocess_policy import UnsafePathError, normalize_process_path
from app.twitch.jobs import sanitize_filename


def save_uploaded_vod_file(vod_file: Any, config: Dict[str, Any]) -> Path:
    recordings_dir_value = Path(config.get("replay", {}).get("directory", ""))
    normalized_dirs = normalize_allowed_dirs([recordings_dir_value])
    recordings_dir = normalized_dirs[0] if normalized_dirs else recordings_dir_value
    upload_dir = recordings_dir if recordings_dir.exists() else get_uploads_dir()
    upload_dir.mkdir(parents=True, exist_ok=True)

    filename = sanitize_filename(vod_file.filename)
    dest_path = resolve_allowed_child_path(filename, [upload_dir])
    if dest_path is None:
        original_suffix = Path(str(vod_file.filename or "")).suffix
        fallback_suffix = original_suffix if original_suffix else ".mp4"
        dest_path = upload_dir / f"upload{fallback_suffix}"
    vod_file.save(dest_path)
    return dest_path


def start_vod_scan_for_path(config_path: Path, vod_path: Path) -> None:
    try:
        normalized_vod_path = normalize_process_path(vod_path)
    except UnsafePathError:
        logging.warning("Skipping VOD scan startup for unsafe path: %s", vod_path)
        return
    subprocess.Popen(
        build_mode_command("vod", config_path, ["--vod", str(normalized_vod_path)]),
        cwd=str(get_project_root()),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        shell=False,
    )