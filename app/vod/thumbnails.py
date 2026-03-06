from __future__ import annotations

import subprocess
from pathlib import Path

from app.runtime_paths import get_app_data_dir, resolve_tool
from app.system.path_policy import resolve_allowed_child_path
from app.system.subprocess_policy import ffmpeg_argv, normalize_process_path
from app.vod.stem import sanitize_stem


def extract_vod_thumbnail(vod_path: Path, seconds: float, output_path: Path) -> None:
    ffmpeg_path = resolve_tool("ffmpeg", ["ffmpeg.exe"])
    if not ffmpeg_path:
        raise RuntimeError("FFmpeg not found. Install it or bundle tools/ffmpeg.exe.")
    normalized_vod = normalize_process_path(vod_path)
    normalized_output = normalize_process_path(output_path, must_exist=False, expect_file=False)
    normalized_output.parent.mkdir(parents=True, exist_ok=True)

    cmd = ffmpeg_argv(ffmpeg_path, [
        "-y",
        "-ss",
        f"{seconds:.3f}",
        "-i",
        str(normalized_vod),
        "-frames:v",
        "1",
        "-vf",
        "scale=320:-1",
        "-q:v",
        "3",
        str(normalized_output),
    ])
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=False)


def get_vod_thumbnail_path(vod_path: Path, seconds: float) -> Path:
    thumbs_dir = get_app_data_dir() / "thumbnails"
    thumbs_dir.mkdir(parents=True, exist_ok=True)
    safe_stem = sanitize_stem(vod_path.stem) or "vod"
    thumb_name = f"{safe_stem}_t{int(round(seconds))}.jpg"
    resolved = resolve_allowed_child_path(thumb_name, [thumbs_dir])
    if resolved is not None:
        return resolved
    return thumbs_dir / "vod_t0.jpg"


def ensure_vod_thumbnail(vod_path: Path, seconds: float) -> Path:
    thumb_path = get_vod_thumbnail_path(vod_path, seconds)
    if not thumb_path.exists():
        extract_vod_thumbnail(vod_path, seconds, thumb_path)
    return thumb_path