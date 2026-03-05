from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

from app.clip_insights import format_timestamp, parse_vod_timestamp
from app.runtime_paths import get_downloads_dir
from app.vod_ocr import sanitize_stem


DOWNLOADS_DIR = get_downloads_dir()


def get_clips_dir(config: Dict[str, Any]) -> Path:
    vods_dir = Path(config.get("replay", {}).get("directory", ""))
    if vods_dir:
        return vods_dir / "clips"
    return Path("")


def get_vods_dir(config: Dict[str, Any]) -> Path:
    return Path(config.get("replay", {}).get("directory", ""))


def get_vod_dirs(config: Dict[str, Any]) -> List[Path]:
    dirs = []
    recordings_dir = get_vods_dir(config)
    if recordings_dir:
        dirs.append(recordings_dir)
    dirs.append(DOWNLOADS_DIR)
    return dirs


def get_vod_paths(directories: List[Path], extensions: List[str]) -> List[Path]:
    files: List[Path] = []
    allowed = {e.lower() for e in extensions}
    for directory in directories:
        if not directory.exists():
            continue
        for path in directory.iterdir():
            if not path.is_file():
                continue
            if allowed and path.suffix.lower() not in allowed:
                continue
            if path.stem.endswith(".temp") or path.suffix.lower() == ".part":
                continue
            files.append(path)
    files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return files


def build_session_entries(files: List[Path]) -> List[Dict[str, Any]]:
    result = []
    for path in files:
        stat = path.stat()
        result.append(
            {
                "name": path.name,
                "path": str(path),
                "mtime": stat.st_mtime,
                "size": stat.st_size,
            }
        )
    return result


def list_sessions(directory: Path) -> List[Dict[str, Any]]:
    if not directory.exists():
        return []
    files = list(directory.glob("*.csv")) + list(directory.glob("*.jsonl"))
    files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return build_session_entries(files)


def list_sessions_for_vod(
    directory: Path,
    session_prefix: str,
    vod_stem: str,
) -> List[Dict[str, Any]]:
    if not directory.exists():
        return []
    safe_stem = sanitize_stem(vod_stem) or "vod"
    pattern_csv = f"{session_prefix}_{safe_stem}_*.csv"
    pattern_jsonl = f"{session_prefix}_{safe_stem}_*.jsonl"
    files = list(directory.glob(pattern_csv)) + list(directory.glob(pattern_jsonl))
    files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    entries = build_session_entries(files)
    for entry in entries:
        timestamp = parse_vod_timestamp(entry.get("name", ""))
        display_name = format_timestamp(timestamp) if timestamp else entry.get("name", "")
        entry["display_name"] = display_name
    return entries