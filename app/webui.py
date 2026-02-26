from __future__ import annotations

from __future__ import annotations

import atexit
import csv
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import threading
import time
import uuid
from urllib.parse import quote
from urllib.request import urlopen
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

from flask import Flask, Response, abort, jsonify, redirect, request, send_file, send_from_directory, stream_with_context, url_for

from app.runtime_paths import (
    build_mode_command,
    get_app_data_dir,
    get_config_path,
    get_downloads_dir,
    prepare_torch_runtime,
    get_project_root,
    get_react_dist,
    get_uploads_dir,
    is_frozen,
    resolve_log_path,
    resolve_tool,
    reset_log_file,
)
from app.dependency_bootstrap import dependency_bootstrap
from app.split_bookmarks import BookmarkEvent, count_events, load_bookmarks, parse_vod_start_time, run_ffmpeg, split_from_config
from app.vod_ocr import sanitize_stem
from app.vod_download import TwitchVODDownloader
from app.routes.ocr_sync import ocr_sync_bp


APP_ROOT = Path(__file__).resolve().parent
CONFIG_PATH = get_config_path()
EXIT_RESTART_CODE = 3
REACT_DIST = get_react_dist()
DOWNLOADS_DIR = get_downloads_dir()
UPDATE_REQUEST_TIMEOUT_SECONDS = 30

UPDATE_REPO_OWNER = os.environ.get("AET_UPDATE_REPO_OWNER", "nishiegroe")
UPDATE_REPO_NAME = os.environ.get("AET_UPDATE_REPO_NAME", "VOD-Insights")
DEFAULT_UPDATE_FEED_URL = (
    f"https://github.com/{UPDATE_REPO_OWNER}/{UPDATE_REPO_NAME}/releases/latest/download/latest.json"
)
UPDATE_FEED_URL = os.environ.get("AET_UPDATE_FEED_URL", DEFAULT_UPDATE_FEED_URL)

app = Flask(__name__)

# Register blueprints
app.register_blueprint(ocr_sync_bp)

_process_lock = threading.Lock()
_bookmark_process: Optional[subprocess.Popen] = None
_vod_ocr_processes: Dict[str, subprocess.Popen] = {}
_selected_vod: Optional[Path] = None
_selected_session: Optional[Path] = None

# Initialize VOD downloader (will be set after config is loaded)
_vod_downloader: Optional[TwitchVODDownloader] = None


def load_patch_notes() -> List[Any]:
    meta_path = get_project_root() / "app_meta.json"
    if not meta_path.exists():
        return []
    try:
        payload = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception:
        return []
    notes = payload.get("patchNotes") or payload.get("patch_notes") or []
    return notes if isinstance(notes, list) else []


def get_current_app_version() -> str:
    meta_path = get_project_root() / "app_meta.json"
    if not meta_path.exists():
        return ""
    try:
        payload = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception:
        return ""
    value = payload.get("version")
    return str(value).strip() if isinstance(value, str) else ""


def fetch_latest_update_metadata() -> Dict[str, Any]:
    with urlopen(UPDATE_FEED_URL, timeout=UPDATE_REQUEST_TIMEOUT_SECONDS) as response:
        status = getattr(response, "status", 200)
        if status < 200 or status >= 300:
            raise RuntimeError(f"Update feed request failed with status {status}.")
        raw = response.read().decode("utf-8")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Invalid update metadata received.") from exc
    if not isinstance(payload, dict):
        raise RuntimeError("Invalid update metadata received.")
    return payload


def cleanup_on_exit() -> None:
    """Pause all running VOD scans when the application exits"""
    print("Cleaning up: pausing all active VOD scans...")
    try:
        config = load_config()
        bookmarks_dir = Path(config.get("bookmarks", {}).get("directory", ""))
        if not bookmarks_dir.is_absolute():
            bookmarks_dir = get_app_data_dir() / bookmarks_dir
        session_prefix = config.get("bookmarks", {}).get("session_prefix", "session")
        
        with _process_lock:
            for vod_path in list(_vod_ocr_processes.keys()):
                try:
                    vod_path_obj = Path(vod_path)
                    safe_stem = sanitize_stem(vod_path_obj.stem) or "vod"
                    paused_marker = bookmarks_dir / f"{session_prefix}_{safe_stem}.paused"
                    # Create pause marker to trigger graceful pause
                    paused_marker.write_text(json.dumps({"paused": True}), encoding="utf-8")
                    print(f"Paused scan for: {vod_path}")
                except Exception as e:
                    print(f"Error pausing scan for {vod_path}: {e}")
    except Exception as e:
        print(f"Error during cleanup: {e}")


# Register cleanup handlers
atexit.register(cleanup_on_exit)


def signal_handler(signum, frame):
    """Handle signals like SIGINT and SIGTERM"""
    print(f"Received signal {signum}, cleaning up...")
    cleanup_on_exit()
    sys.exit(0)


# Register signal handlers for graceful shutdown
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


def watch_for_changes(
    paths: List[Path],
    interval: float = 1.0,
    include_suffixes: Optional[set[str]] = None,
    ignore_paths: Optional[set[Path]] = None,
) -> None:
    include_suffixes = include_suffixes or {".py", ".html", ".css", ".js"}
    ignore_paths = ignore_paths or set()

    def _is_ignored(path: Path) -> bool:
        if path in ignore_paths:
            return True
        for ignored in ignore_paths:
            if ignored.is_dir():
                try:
                    if path.is_relative_to(ignored):
                        return True
                except ValueError:
                    continue
        return False

    def _snapshot() -> Dict[Path, float]:
        snapshot: Dict[Path, float] = {}
        for root in paths:
            if not root.exists():
                continue
            if root.is_file():
                if _is_ignored(root) or root.suffix not in include_suffixes:
                    continue
                snapshot[root] = root.stat().st_mtime
                continue
            for file in root.rglob("*"):
                if not file.is_file():
                    continue
                if _is_ignored(file) or file.suffix not in include_suffixes:
                    continue
                snapshot[file] = file.stat().st_mtime
        return snapshot

    last_state = _snapshot()
    while True:
        time.sleep(interval)
        current = _snapshot()
        if current != last_state:
            print("File change detected. Restarting web UI...")
            os._exit(EXIT_RESTART_CODE)
        last_state = current


def load_config() -> Dict[str, Any]:
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def save_config(data: Dict[str, Any]) -> None:
    CONFIG_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


def choose_directory(initial: Optional[str] = None) -> str:
    initial_dir = initial or str(get_project_root())

    if sys.platform == "win32":
        script = """
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.ShowNewFolderButton = $false
$dialog.Description = 'Select replay directory'
$initial = $env:AET_INITIAL_DIR
if ($initial -and (Test-Path $initial)) { $dialog.SelectedPath = $initial }
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  Write-Output $dialog.SelectedPath
}
"""
        env = os.environ.copy()
        env["AET_INITIAL_DIR"] = initial_dir
        try:
            result = subprocess.run(
                ["powershell", "-NoProfile", "-STA", "-Command", script],
                check=False,
                capture_output=True,
                text=True,
                env=env,
            )
        except OSError:
            return ""
        if result.returncode == 0:
            return result.stdout.strip()
        return ""

    return ""


def get_status() -> Dict[str, Any]:
    with _process_lock:
        running = _bookmark_process is not None and _bookmark_process.poll() is None
    bootstrap_status = dependency_bootstrap.get_status()
    return {
        "bookmark_running": running,
        "dev_mode": not is_frozen(),
        "bootstrap_required_ready": bool(bootstrap_status.get("required_ready")),
    }


def start_bookmark_process() -> None:
    global _bookmark_process
    with _process_lock:
        if _bookmark_process is not None and _bookmark_process.poll() is None:
            return
        command = build_mode_command("bookmarks", CONFIG_PATH)
        _bookmark_process = subprocess.Popen(
            command,
            cwd=str(get_project_root()),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )


def stop_bookmark_process() -> None:
    global _bookmark_process
    with _process_lock:
        if _bookmark_process is None:
            return
        if _bookmark_process.poll() is None:
            _bookmark_process.terminate()
            try:
                _bookmark_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                _bookmark_process.kill()
        _bookmark_process = None


def tail_lines(path: Path, max_lines: int = 200) -> List[str]:
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    return lines[-max_lines:]


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


def get_clip_dirs(config: Dict[str, Any]) -> List[Path]:
    """Get all directories where clips might be stored."""
    replay_cfg = config.get("replay", {})
    recordings_dir = Path(replay_cfg.get("directory", ""))
    clips_subdir = recordings_dir / "clips" if recordings_dir else Path("")
    
    dirs = []
    for path in [clips_subdir, recordings_dir]:
        if path and path not in dirs:
            dirs.append(path)
    return dirs


def iter_clip_files(config: Dict[str, Any]) -> List[Path]:
    split_cfg = config.get("split", {})
    extensions = {ext.lower() for ext in split_cfg.get("extensions", [])}
    clip_dirs = get_clip_dirs(config)
    clips_dir = get_clips_dir(config)
    files: List[Path] = []

    for directory in clip_dirs:
        if not directory.exists():
            continue
        for path in directory.iterdir():
            if not path.is_file():
                continue
            if extensions and path.suffix.lower() not in extensions:
                continue
            if directory != clips_dir and not CLIP_NAME_PATTERN.search(path.stem):
                continue
            files.append(path)

    files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return files


def build_clip_entry(
    path: Path,
    titles: Dict[str, str],
    averages: Dict[str, float],
    session_start: Optional[datetime],
    include_duration: bool = True,
) -> Dict[str, Any]:
    stat = path.stat()
    details = parse_clip_details(path.name)
    details["above_avg"] = is_above_average(details, averages)
    details["top_reason"] = build_top_reason(details, averages)
    details["pretty_time"] = format_timestamp(details.get("timestamp"))
    offset_seconds = details.get("offset_seconds")
    if isinstance(offset_seconds, int):
        details["session_offset"] = format_offset_seconds(offset_seconds)
    else:
        details["session_offset"] = format_session_offset(
            details.get("timestamp"), session_start
        )
    display_name = get_clip_title(path, titles)
    duration = get_media_duration(path) if include_duration else None
    day_key = "unknown"
    if isinstance(details.get("timestamp"), datetime):
        day_key = details["timestamp"].strftime("%Y-%m-%d")
    return {
        "name": path.name,
        "path": str(path),
        "mtime": stat.st_mtime,
        "size": stat.st_size,
        "duration": duration,
        "details": details,
        "display_name": display_name,
        "day_key": day_key,
    }


def list_clips(config: Dict[str, Any], limit: int = 20) -> List[Dict[str, Any]]:
    files = iter_clip_files(config)
    averages = calculate_averages(files)
    session_start = get_session_start(files)
    titles = load_clip_titles()
    return [
        build_clip_entry(path, titles, averages, session_start)
        for path in files[:limit]
    ]


def serialize_clip(clip: Dict[str, Any]) -> Dict[str, Any]:
    details = dict(clip.get("details", {}))
    timestamp = details.get("timestamp")
    if isinstance(timestamp, datetime):
        details["timestamp"] = timestamp.isoformat()
    else:
        details.pop("timestamp", None)
    return {
        "name": clip.get("name"),
        "path": clip.get("path"),
        "mtime": clip.get("mtime"),
        "size": clip.get("size"),
        "duration": clip.get("duration"),
        "display_name": clip.get("display_name") or "",
        "day_key": clip.get("day_key"),
        "details": details,
    }


def resolve_clip_path(path_value: str, config: Dict[str, Any]) -> Optional[Path]:
    if not path_value:
        return None
    candidate = Path(path_value).resolve()
    for base in get_clip_dirs(config):
        if not base:
            continue
        base = base.resolve()
        try:
            if candidate.is_relative_to(base):
                return candidate
        except AttributeError:
            if str(candidate).lower().startswith(str(base).lower()):
                return candidate
    return None


@app.route("/api/clips/days")
def api_clip_days() -> Any:
    config = load_config()
    files = iter_clip_files(config)
    day_counts: Dict[str, int] = {}
    for path in files:
        details = parse_clip_details(path.name)
        timestamp = details.get("timestamp")
        if isinstance(timestamp, datetime):
            key = timestamp.strftime("%Y-%m-%d")
        else:
            key = "unknown"
        day_counts[key] = day_counts.get(key, 0) + 1

    def sort_key(item: tuple[str, int]) -> tuple[int, str]:
        key, _ = item
        return (1, "") if key == "unknown" else (0, key)

    ordered = sorted(day_counts.items(), key=sort_key, reverse=True)
    payload = [{"day": key, "count": count} for key, count in ordered]
    return jsonify({"days": payload})


@app.route("/api/clips/by-day")
def api_clips_by_day() -> Any:
    config = load_config()
    day_value = request.args.get("date", "unknown")
    limit_arg = request.args.get("limit")
    offset_arg = request.args.get("offset")

    try:
        limit = int(limit_arg) if limit_arg is not None and limit_arg != "" else None
    except ValueError:
        limit = None
    if isinstance(limit, int) and limit < 0:
        limit = 0

    try:
        offset = int(offset_arg) if offset_arg else 0
    except ValueError:
        offset = 0
    offset = max(0, offset)

    files = iter_clip_files(config)
    averages = calculate_averages(files)
    session_start = get_session_start(files)
    titles = load_clip_titles()

    filtered: List[Path] = []
    for path in files:
        details = parse_clip_details(path.name)
        timestamp = details.get("timestamp")
        if day_value == "unknown":
            if not isinstance(timestamp, datetime):
                filtered.append(path)
        elif isinstance(timestamp, datetime) and timestamp.strftime("%Y-%m-%d") == day_value:
            filtered.append(path)

    total = len(filtered)
    page_paths = filtered[offset:] if limit is None else filtered[offset : offset + limit]

    entries = [
        build_clip_entry(path, titles, averages, session_start)
        for path in page_paths
    ]
    serialized = [serialize_clip(entry) for entry in entries]
    returned = len(serialized)
    return jsonify(
        {
            "clips": serialized,
            "total": total,
            "offset": offset,
            "limit": limit,
            "returned": returned,
            "has_more": offset + returned < total,
        }
    )


@app.route("/api/clips/lookup")
def api_clip_lookup() -> Any:
    config = load_config()
    path_value = request.args.get("path", "")
    file_path = resolve_clip_path(path_value, config)
    if file_path is None or not file_path.exists():
        return jsonify({"ok": False, "error": "Clip not found"}), 404

    files = iter_clip_files(config)
    averages = calculate_averages(files)
    session_start = get_session_start(files)
    titles = load_clip_titles()
    entry = build_clip_entry(file_path, titles, averages, session_start)
    serialized = serialize_clip(entry)
    return jsonify({"ok": True, "clip": serialized, "day": serialized.get("day_key")})


def calculate_averages(files: List[Path]) -> Dict[str, float]:
    kills = []
    assists = []
    for path in files:
        details = parse_clip_details(path.name)
        counts = details.get("counts")
        if counts:
            kills.append(counts.get("kills", 0))
            assists.append(counts.get("assists", 0))
    avg_kills = sum(kills) / len(kills) if kills else 0.0
    avg_assists = sum(assists) / len(assists) if assists else 0.0
    return {"kills": avg_kills, "assists": avg_assists}


def is_above_average(details: Dict[str, Any], averages: Dict[str, float]) -> bool:
    counts = details.get("counts")
    if not counts:
        return False
    return counts.get("kills", 0) > averages.get("kills", 0) or counts.get(
        "assists", 0
    ) > averages.get("assists", 0)


def build_top_reason(details: Dict[str, Any], averages: Dict[str, float]) -> str:
    counts = details.get("counts")
    if not counts:
        return ""
    reasons = []
    avg_kills = averages.get("kills", 0.0)
    avg_assists = averages.get("assists", 0.0)
    if counts.get("kills", 0) > avg_kills:
        reasons.append(f"Kills {counts.get('kills', 0)} > avg {avg_kills:.2f}")
    if counts.get("assists", 0) > avg_assists:
        reasons.append(f"Assists {counts.get('assists', 0)} > avg {avg_assists:.2f}")
    return "; ".join(reasons)


def parse_clip_details(filename: str) -> Dict[str, Any]:
    stem = Path(filename).stem
    details: Dict[str, Any] = {"timestamp": None, "counts": None, "offset_seconds": None}
    ts_match = re.search(r"(\d{8}_\d{6})", stem)
    if ts_match:
        try:
            details["timestamp"] = datetime.strptime(ts_match.group(1), "%Y%m%d_%H%M%S")
        except ValueError:
            details["timestamp"] = None
    counts_match = re.search(r"k(\d+)_a(\d+)_d(\d+)", stem)
    if counts_match:
        details["counts"] = {
            "kills": int(counts_match.group(1)),
            "assists": int(counts_match.group(2)),
            "deaths": int(counts_match.group(3)),
        }
    offset_match = re.search(r"_t(\d+)s", stem)
    if offset_match:
        details["offset_seconds"] = int(offset_match.group(1))
    return details


def parse_vod_timestamp(filename: str) -> Optional[datetime]:
    stem = Path(filename).stem
    ts_match = re.search(r"(\d{8}_\d{6})", stem)
    if not ts_match:
        dashed_match = re.search(r"(\d{4}-\d{2}-\d{2})[ _](\d{2}-\d{2}-\d{2})", stem)
        if not dashed_match:
            # Try date-only format: YYYY-MM-DD (e.g. ImperialHal___2024-01-30)
            date_only_match = re.search(r"(\d{4}-\d{2}-\d{2})", stem)
            if not date_only_match:
                return None
            try:
                return datetime.strptime(date_only_match.group(1), "%Y-%m-%d")
            except ValueError:
                return None
        try:
            return datetime.strptime(
                f"{dashed_match.group(1)} {dashed_match.group(2).replace('-', ':')}",
                "%Y-%m-%d %H:%M:%S",
            )
        except ValueError:
            return None
    try:
        return datetime.strptime(ts_match.group(1), "%Y%m%d_%H%M%S")
    except ValueError:
        return None


def get_session_start(files: List[Path]) -> Optional[datetime]:
    timestamps = []
    for path in files:
        details = parse_clip_details(path.name)
        timestamp = details.get("timestamp")
        if isinstance(timestamp, datetime):
            timestamps.append(timestamp)
    return min(timestamps) if timestamps else None


def format_timestamp(timestamp: Optional[datetime]) -> str:
    if not isinstance(timestamp, datetime):
        return ""
    day = timestamp.day
    suffix = "th" if 11 <= day <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
    time_str = timestamp.strftime("%I:%M %p").lstrip("0")
    return f"{timestamp.strftime('%A, %b')} {day}{suffix} at {time_str}"


def format_date_label(timestamp: Optional[datetime]) -> str:
    if not isinstance(timestamp, datetime):
        return "Unknown session"
    day = timestamp.day
    suffix = "th" if 11 <= day <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
    return f"{timestamp.strftime('%A, %b')} {day}{suffix}"


def parse_streamer_name(filename: str) -> Optional[str]:
    """Extract streamer/channel name from a VOD filename if present before a date pattern."""
    stem = Path(filename).stem
    # Format: Name___YYYY-MM-DD (e.g. ImperialHal___2024-01-30)
    match = re.match(r"^(.+?)_{2,}\d{4}-\d{2}-\d{2}", stem)
    if match:
        name = match.group(1).strip("_")
        return name or None
    # Format: Name_YYYYMMDD_HHMMSS (e.g. ImperialHal_20240130_120000)
    match = re.match(r"^([A-Za-z][A-Za-z0-9]*)_\d{8}_\d{6}", stem)
    if match:
        return match.group(1)
    return None


def format_vod_display_title(filename: str) -> str:
    """Format a human-readable VOD title: 'StreamerName, Weekday, Mon Dayth'."""
    timestamp = parse_vod_timestamp(filename)
    streamer = parse_streamer_name(filename)
    date_label = ""
    if isinstance(timestamp, datetime):
        day = timestamp.day
        suffix = "th" if 11 <= day <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
        date_label = f"{timestamp.strftime('%A, %b')} {day}{suffix}"
    if streamer and date_label:
        return f"{streamer}, {date_label}"
    return date_label


def format_session_offset(timestamp: Optional[datetime], start: Optional[datetime]) -> str:
    if not isinstance(timestamp, datetime) or not isinstance(start, datetime):
        return ""
    seconds = max(0, int((timestamp - start).total_seconds()))
    return format_offset_seconds(seconds)


def format_offset_seconds(seconds: int) -> str:
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    if hours > 0:
        return f"{hours} hr {minutes} min into session"
    return f"{minutes} min into session"


def get_clips_dir(config: Dict[str, Any]) -> Path:
    """Get the clips directory, derived from replay directory."""
    vods_dir = Path(config.get("replay", {}).get("directory", ""))
    if vods_dir:
        return vods_dir / "clips"
    return Path("")


def get_vods_dir(config: Dict[str, Any]) -> Path:
    return Path(config.get("replay", {}).get("directory", ""))  # Use replay directory


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
            # Skip yt-dlp in-progress temp files (e.g. foo.temp.mp4, foo.part)
            if path.stem.endswith(".temp") or path.suffix.lower() == ".part":
                continue
            files.append(path)
    files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return files


def find_vod_scan_state(
    bookmarks_dir: Path,
    session_prefix: str,
    vod_stem: str,
) -> Dict[str, Any]:
    if not bookmarks_dir.exists():
        return {"scanned": False, "scanning": False, "paused": False, "progress": None}
    safe_stem = sanitize_stem(vod_stem) or "vod"
    pattern_csv = f"{session_prefix}_{safe_stem}_*.csv"
    pattern_jsonl = f"{session_prefix}_{safe_stem}_*.jsonl"
    scanning_marker = bookmarks_dir / f"{session_prefix}_{safe_stem}.scanning"
    paused_marker = bookmarks_dir / f"{session_prefix}_{safe_stem}.paused"
    scanned = bool(list(bookmarks_dir.glob(pattern_csv)) or list(bookmarks_dir.glob(pattern_jsonl)))
    scanning = scanning_marker.exists()
    paused = paused_marker.exists()
    progress: Optional[int] = None
    if scanning:
        try:
            payload = json.loads(scanning_marker.read_text(encoding="utf-8"))
            if isinstance(payload, dict):
                if isinstance(payload.get("progress"), (int, float)):
                    progress = int(payload["progress"])
                # Check if the scan is paused
                if payload.get("paused"):
                    paused = True
        except (json.JSONDecodeError, OSError, ValueError, TypeError):
            progress = None
    elif paused:
        # If only paused marker exists, try to get progress from it
        try:
            payload = json.loads(paused_marker.read_text(encoding="utf-8"))
            if isinstance(payload, dict) and isinstance(payload.get("progress"), (int, float)):
                progress = int(payload["progress"])
        except (json.JSONDecodeError, OSError, ValueError, TypeError):
            progress = None
    return {"scanned": scanned, "scanning": scanning, "paused": paused, "progress": progress}


def build_vod_entries(
    paths: List[Path],
    bookmarks_dir: Path,
    session_prefix: str,
) -> List[Dict[str, Any]]:
    result = []
    for path in paths:
        stat = path.stat()
        duration = get_media_duration(path)
        pretty_time = format_timestamp(parse_vod_timestamp(path.name))
        display_title = format_vod_display_title(path.name)
        scan_state = find_vod_scan_state(bookmarks_dir, session_prefix, path.stem)
        sessions = list_sessions_for_vod(bookmarks_dir, session_prefix, path.stem)
        thumbnail_time = None
        if sessions:
            session_path = Path(sessions[0].get("path", ""))
            if session_path.exists():
                thumbnail_time = get_hottest_event_time(session_path, duration)
        thumbnail_url = None
        if thumbnail_time is not None:
            encoded_path = quote(str(path))
            thumbnail_url = f"/vod-thumbnail?path={encoded_path}&t={thumbnail_time:.3f}"
        result.append(
            {
                "name": path.name,
                "path": str(path),
                "mtime": stat.st_mtime,
                "size": stat.st_size,
                "duration": duration,
                "pretty_time": pretty_time,
                "display_title": display_title,
                "scanned": scan_state["scanned"],
                "scanning": scan_state["scanning"],
                "paused": scan_state["paused"],
                "scan_progress": scan_state.get("progress"),
                "sessions": sessions,
                "thumbnail_time": thumbnail_time,
                "thumbnail_url": thumbnail_url,
            }
        )
    return result


def get_hottest_event_time(bookmark_path: Path, duration: Optional[float]) -> Optional[float]:
    try:
        events = load_bookmarks(bookmark_path)
    except (OSError, ValueError, json.JSONDecodeError, TypeError):
        return None

    if not events:
        return None

    max_event_time = max(event.time for event in events)
    span = max(float(duration or 0), max_event_time)
    if span <= 0:
        return None

    bin_count = 60
    bins = [0] * bin_count
    for event in events:
        idx = int((event.time / span) * bin_count)
        idx = max(0, min(bin_count - 1, idx))
        bins[idx] += 1

    hottest = max(bins)
    if hottest <= 0:
        return None

    hottest_bins = {index for index, count in enumerate(bins) if count == hottest}
    hottest_events = [
        event.time
        for event in events
        if int((event.time / span) * bin_count) in hottest_bins
    ]
    if not hottest_events:
        return None
    return max(hottest_events)


def get_media_duration(path: Path) -> Optional[float]:
    try:
        ffprobe_path = resolve_tool("ffprobe", ["ffprobe.exe"])
        if not ffprobe_path:
            return None
        result = subprocess.run(
            [
                ffprobe_path,
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        return float(result.stdout.strip())
    except Exception:
        return None


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


def get_allowed_media_dirs(config: Dict[str, Any]) -> List[Path]:
    """Get directories that are allowed for media file serving."""
    replay_cfg = config.get("replay", {})
    dirs = []
    
    # Only use replay directory (VOD directory)
    vods_dir = replay_cfg.get("directory", "")
    if vods_dir:
        p = Path(vods_dir).resolve()
        if p.exists():
            dirs.append(p)
    
    if DOWNLOADS_DIR.exists() and DOWNLOADS_DIR not in dirs:
        dirs.append(DOWNLOADS_DIR)
    return dirs


def resolve_allowed_path(path_value: str, allowed_dirs: List[Path]) -> Optional[Path]:
    if not path_value:
        return None
    candidate = Path(path_value).resolve()
    for base in allowed_dirs:
        try:
            if candidate.is_relative_to(base):
                return candidate
        except AttributeError:
            if str(candidate).lower().startswith(str(base).lower()):
                return candidate
    return None


@app.route("/media-path")
def media_by_path() -> Any:
    config = load_config()
    allowed_dirs = get_allowed_media_dirs(config)
    file_path = resolve_allowed_path(request.args.get("path", ""), allowed_dirs)
    if file_path is None or not file_path.exists():
        abort(404)
    return send_file(file_path)


@app.route("/download-path")
def download_by_path() -> Any:
    config = load_config()
    allowed_dirs = get_allowed_media_dirs(config)
    file_path = resolve_allowed_path(request.args.get("path", ""), allowed_dirs)
    if file_path is None or not file_path.exists():
        abort(404)
    display_name = get_clip_title(file_path)
    download_name = build_download_name(display_name, file_path)
    try:
        return send_file(file_path, as_attachment=True, download_name=download_name)
    except TypeError:
        return send_file(file_path, as_attachment=True, attachment_filename=download_name)


@app.route("/open-folder-path", methods=["POST"])
def open_folder_by_path() -> Any:
    config = load_config()
    allowed_dirs = get_allowed_media_dirs(config)
    file_path = resolve_allowed_path(request.args.get("path", ""), allowed_dirs)
    if file_path is None or not file_path.exists():
        abort(404)
    subprocess.run(
        [
            "explorer",
            "/select,",
            str(file_path),
        ],
        check=False,
    )
    return jsonify({"ok": True})




def sanitize_filename(filename: str) -> str:
    name = Path(filename).name
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
    return name or "upload.mp4"


def is_twitch_vod_url(url: str) -> bool:
    return bool(re.search(r"twitch\.tv/videos/\d+", url))


def write_twitch_job(job_id: str, payload: Dict[str, Any]) -> None:
    DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
    job_path = DOWNLOADS_DIR / f"job_{job_id}.json"
    job_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def read_twitch_job(job_id: str) -> Optional[Dict[str, Any]]:
    job_path = DOWNLOADS_DIR / f"job_{job_id}.json"
    if not job_path.exists():
        return None
    try:
        return json.loads(job_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def list_twitch_jobs(limit: int = 20) -> List[Dict[str, Any]]:
    if not DOWNLOADS_DIR.exists():
        return []
    jobs = []
    for path in sorted(DOWNLOADS_DIR.glob("job_*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        jobs.append(payload)
        if len(jobs) >= limit:
            break
    return jobs


def run_twitch_import(job_id: str, url: str) -> None:
    job = read_twitch_job(job_id) or {"id": job_id, "url": url}
    job.update({"status": "downloading", "progress": 0, "message": "Starting download"})
    write_twitch_job(job_id, job)

    output_template = str(DOWNLOADS_DIR / "%(id)s.%(ext)s")
    yt_dlp_path = resolve_tool("yt-dlp", ["yt-dlp.exe"])
    if not yt_dlp_path:
        job.update({"status": "failed", "message": "yt-dlp not found"})
        write_twitch_job(job_id, job)
        return
    cmd = [
        yt_dlp_path,
        "--newline",
        "--progress-template",
        "download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s",
        "-o",
        output_template,
        url,
    ]
    dest_path = None
    progress_re = re.compile(r"(\d{1,3}(?:\.\d+)?)%")
    template_re = re.compile(r"^download:(.*?)\|(.*?)\|(.*?)\s*$")
    eta_re = re.compile(r"ETA\s+(\d+:\d+:\d+|\d+:\d+)")
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    assert proc.stdout is not None
    for line in proc.stdout:
        if "Destination:" in line:
            _, _, dest = line.partition("Destination:")
            dest_path = dest.strip()
        template_match = template_re.search(line)
        if template_match:
            percent_str = template_match.group(1).strip()
            speed_str = template_match.group(2).strip()
            eta_str = template_match.group(3).strip()
            percent_match = progress_re.search(percent_str)
            if percent_match:
                progress_value = min(100.0, float(percent_match.group(1)))
                job.update(
                    {
                        "progress": round(progress_value, 1),
                        "message": "Downloading",
                        "eta": eta_str or None,
                        "speed": speed_str or None,
                    }
                )
                write_twitch_job(job_id, job)
            continue

        match = progress_re.search(line)
        if match:
            progress_value = min(100.0, float(match.group(1)))
            eta_match = eta_re.search(line)
            eta_value = eta_match.group(1) if eta_match else None
            job.update({"progress": round(progress_value, 1), "message": "Downloading", "eta": eta_value})
            write_twitch_job(job_id, job)

    exit_code = proc.wait()
    if exit_code != 0:
        job.update({"status": "failed", "message": f"Download failed (exit {exit_code})"})
        write_twitch_job(job_id, job)
        return

    if not dest_path:
        files = list(DOWNLOADS_DIR.glob("*.*"))
        files = [p for p in files if p.is_file() and p.suffix.lower() != ".json"]
        files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        if files:
            dest_path = str(files[0])

    if not dest_path or not Path(dest_path).exists():
        job.update({"status": "failed", "message": "Download completed but file not found"})
        write_twitch_job(job_id, job)
        return

    job.update({"status": "scanning", "progress": 100, "message": "Scan started", "vod_path": dest_path})
    write_twitch_job(job_id, job)

    scan_proc = subprocess.Popen(
        build_mode_command("vod", CONFIG_PATH, ["--vod", str(dest_path)]),
        cwd=str(get_project_root()),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    scan_code = scan_proc.wait()
    if scan_code != 0:
        job.update({"status": "failed", "message": f"Scan failed (exit {scan_code})"})
        write_twitch_job(job_id, job)
        return

    job.update({"status": "completed", "message": "Scan complete"})
    write_twitch_job(job_id, job)


def update_config_from_payload(config: Dict[str, Any], payload: Dict[str, Any]) -> None:
    def _set(path: List[str], value: Any) -> None:
        obj = config
        for key in path[:-1]:
            obj = obj.setdefault(key, {})
        obj[path[-1]] = value

    def _to_bool(value: Any) -> bool:
        if isinstance(value, bool):
            return value
        return str(value).lower() in {"1", "true", "on", "yes"}

    def _to_event_windows(value: Any) -> Dict[str, Dict[str, float]]:
        if not isinstance(value, dict):
            return {}
        result: Dict[str, Dict[str, float]] = {}
        for raw_key, raw_window in value.items():
            key = str(raw_key).strip()
            if not key or not isinstance(raw_window, dict):
                continue
            try:
                pre_seconds = max(0.0, float(raw_window.get("pre_seconds", 0.0)))
                post_seconds = max(0.0, float(raw_window.get("post_seconds", 0.0)))
            except (TypeError, ValueError):
                continue
            result[key] = {
                "pre_seconds": pre_seconds,
                "post_seconds": post_seconds,
            }
        return result

    mapping = {
        "capture_left": ("capture", "left", int),
        "capture_top": ("capture", "top", int),
        "capture_width": ("capture", "width", int),
        "capture_height": ("capture", "height", int),
        "capture_fps": ("capture", "fps", int),
        "capture_scale": ("capture", "scale", float),
        "capture_threshold": ("capture", "threshold", int),
        "capture_backend": ("capture", "backend", str),
        "ocr_interval": ("ocr", "interval_seconds", float),
        "ocr_engine": ("ocr", "engine", str),
        "detection_keywords": (
            "detection",
            "keywords",
            lambda v: [s.strip() for s in str(v).split(",") if s.strip()],
        ),
        "detection_cooldown": ("detection", "cooldown_seconds", float),
        "replay_dir": ("replay", "directory", str),
        "replay_prefix": ("replay", "prefix", str),
        "replay_include_event": ("replay", "include_event", _to_bool),
        "replay_wait": ("replay", "wait_seconds", float),
        "bookmarks_directory": ("bookmarks", "directory", str),
        "bookmarks_prefix": ("bookmarks", "session_prefix", str),
        "bookmarks_file": ("bookmarks", "file", str),
        "bookmarks_format": ("bookmarks", "format", str),
        "split_pre": ("split", "pre_seconds", float),
        "split_post": ("split", "post_seconds", float),
        "split_event_windows": ("split", "event_windows", _to_event_windows),
        "split_gap": ("split", "merge_gap_seconds", float),
        "wizard_vods_completed": ("ui", "vods_wizard_completed", _to_bool),
    }

    for field, (section, key, caster) in mapping.items():
        if field in payload and payload[field] is not None:
            _set([section, key], caster(payload[field]))


@app.route("/vod-ocr-upload", methods=["POST"])
def vod_ocr_upload() -> str:
    file = request.files.get("vod_file")
    if file is None or not file.filename:
        return redirect("/")

    config = load_config()
    recordings_dir = Path(config.get("replay", {}).get("directory", "")).resolve()  # Use replay directory
    upload_dir = recordings_dir if recordings_dir.exists() else get_uploads_dir()
    upload_dir.mkdir(parents=True, exist_ok=True)

    filename = sanitize_filename(file.filename)
    dest_path = upload_dir / filename
    file.save(dest_path)

    subprocess.Popen(
        build_mode_command("vod", CONFIG_PATH, ["--vod", str(dest_path)]),
        cwd=str(get_project_root()),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return redirect("/vods")


@app.route("/api/vod-ocr-upload", methods=["POST"])
def api_vod_ocr_upload() -> Any:
    file = request.files.get("vod_file")
    if file is None or not file.filename:
        return jsonify({"ok": False, "error": "Missing file"}), 400

    config = load_config()
    recordings_dir = Path(config.get("replay", {}).get("directory", "")).resolve()  # Use replay directory
    upload_dir = recordings_dir if recordings_dir.exists() else get_uploads_dir()
    upload_dir.mkdir(parents=True, exist_ok=True)

    filename = sanitize_filename(file.filename)
    dest_path = upload_dir / filename
    file.save(dest_path)

    subprocess.Popen(
        build_mode_command("vod", CONFIG_PATH, ["--vod", str(dest_path)]),
        cwd=str(get_project_root()),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return jsonify({"ok": True, "path": str(dest_path), "name": dest_path.name})


@app.route("/delete-path", methods=["POST"])
def delete_by_path() -> Any:
    config = load_config()
    allowed_dirs = get_allowed_media_dirs(config)
    file_path = resolve_allowed_path(request.args.get("path", ""), allowed_dirs)
    if file_path is None or not file_path.exists():
        abort(404)
    file_path.unlink(missing_ok=True)
    set_clip_title(file_path, "")
    return jsonify({"ok": True})


@app.route("/capture-area/save", methods=["POST"])
def capture_area_save() -> Any:
    payload = request.get_json(silent=True) or {}
    try:
        left = int(payload.get("left", 0))
        top = int(payload.get("top", 0))
        width = int(payload.get("width", 0))
        height = int(payload.get("height", 0))
        target_width = int(payload.get("target_width", 0))
        target_height = int(payload.get("target_height", 0))
    except (TypeError, ValueError):
        return jsonify({"ok": False, "error": "Invalid payload"}), 400

    if left < 0 or top < 0 or width <= 0 or height <= 0:
        return jsonify({"ok": False, "error": "Invalid capture area"}), 400

    config = load_config()
    capture = config.setdefault("capture", {})
    capture["left"] = left
    capture["top"] = top
    capture["width"] = width
    capture["height"] = height
    if target_width > 0 and target_height > 0:
        capture["target_width"] = target_width
        capture["target_height"] = target_height
    save_config(config)
    return jsonify({"ok": True})


@app.route("/media/<path:filename>")
def media_file(filename: str) -> Any:
    config = load_config()
    clips_dir = get_clips_dir(config).resolve()
    file_path = (clips_dir / filename).resolve()
    try:
        if not file_path.is_relative_to(clips_dir):
            abort(404)
    except AttributeError:
        if str(file_path).lower().startswith(str(clips_dir).lower()) is False:
            abort(404)
    if not file_path.exists():
        abort(404)
    return send_file(file_path)


@app.route("/vod-media/<path:filename>")
def vod_media_file(filename: str) -> Any:
    config = load_config()
    allowed_dirs = [p.resolve() for p in get_vod_dirs(config) if p]
    file_path = None
    for base in allowed_dirs:
        candidate = (base / filename).resolve()
        try:
            if candidate.is_relative_to(base):
                file_path = candidate
                break
        except AttributeError:
            if str(candidate).lower().startswith(str(base).lower()):
                file_path = candidate
                break
    if file_path is None or not file_path.exists():
        abort(404)
    return send_file(file_path)


def resolve_vod_path(vod_path: str) -> Optional[Path]:
    if not vod_path:
        return None
    config = load_config()
    allowed_dirs = [p.resolve() for p in get_vod_dirs(config) if p]
    candidate = Path(vod_path).resolve()
    for base in allowed_dirs:
        try:
            if candidate.is_relative_to(base):
                return candidate
        except AttributeError:
            if str(candidate).lower().startswith(str(base).lower()):
                return candidate
    return None


def extract_vod_thumbnail(vod_path: Path, seconds: float, output_path: Path) -> None:
    ffmpeg_path = resolve_tool("ffmpeg", ["ffmpeg.exe"])
    if not ffmpeg_path:
        raise RuntimeError("FFmpeg not found. Install it or bundle tools/ffmpeg.exe.")
    cmd = [
        ffmpeg_path,
        "-y",
        "-ss",
        f"{seconds:.3f}",
        "-i",
        str(vod_path),
        "-frames:v",
        "1",
        "-vf",
        "scale=320:-1",
        "-q:v",
        "3",
        str(output_path),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


@app.route("/vod-thumbnail")
def vod_thumbnail() -> Any:
    vod_path = request.args.get("path", "")
    time_str = request.args.get("t", "")
    try:
        seconds = max(0.0, float(time_str))
    except (TypeError, ValueError):
        abort(404)

    file_path = resolve_vod_path(vod_path)
    if file_path is None or not file_path.exists():
        abort(404)

    thumbs_dir = get_app_data_dir() / "thumbnails"
    thumbs_dir.mkdir(parents=True, exist_ok=True)
    safe_stem = sanitize_stem(file_path.stem) or "vod"
    thumb_name = f"{safe_stem}_t{int(round(seconds))}.jpg"
    thumb_path = thumbs_dir / thumb_name

    try:
        if not thumb_path.exists():
            extract_vod_thumbnail(file_path, seconds, thumb_path)
    except Exception as exc:
        print(f"Error generating thumbnail: {exc}")
        abort(404)

    return send_file(thumb_path)


@app.route("/download/<path:filename>")
def download_file(filename: str) -> Any:
    config = load_config()
    clips_dir = get_clips_dir(config).resolve()
    file_path = (clips_dir / filename).resolve()
    try:
        if not file_path.is_relative_to(clips_dir):
            abort(404)
    except AttributeError:
        if str(file_path).lower().startswith(str(clips_dir).lower()) is False:
            abort(404)
    if not file_path.exists():
        abort(404)
    display_name = get_clip_title(file_path)
    download_name = build_download_name(display_name, file_path)
    try:
        return send_file(file_path, as_attachment=True, download_name=download_name)
    except TypeError:
        return send_file(file_path, as_attachment=True, attachment_filename=download_name)


@app.route("/open-folder/<path:filename>", methods=["POST"])
def open_folder(filename: str) -> Any:
    config = load_config()
    clips_dir = get_clips_dir(config).resolve()
    file_path = (clips_dir / filename).resolve()
    try:
        if not file_path.is_relative_to(clips_dir):
            abort(404)
    except AttributeError:
        if str(file_path).lower().startswith(str(clips_dir).lower()) is False:
            abort(404)
    if not file_path.exists():
        abort(404)
    subprocess.run(
        [
            "explorer",
            "/select,",
            str(file_path),
        ],
        check=False,
    )
    return redirect("/clips")


@app.route("/delete/<path:filename>", methods=["POST"])
def delete_file(filename: str) -> Any:
    config = load_config()
    clips_dir = get_clips_dir(config).resolve()
    file_path = (clips_dir / filename).resolve()
    try:
        if not file_path.is_relative_to(clips_dir):
            abort(404)
    except AttributeError:
        if str(file_path).lower().startswith(str(clips_dir).lower()) is False:
            abort(404)
    if not file_path.exists():
        abort(404)
    file_path.unlink(missing_ok=True)
    set_clip_title(file_path, "")
    return jsonify({"ok": True})


@app.route("/config", methods=["POST"])
def update_config() -> str:
    config = load_config()
    payload = request.form.to_dict()
    update_config_from_payload(config, payload)
    save_config(config)
    return redirect("/")


@app.route("/choose-replay-dir", methods=["POST"])
def choose_replay_dir() -> str:
    config = load_config()
    replay_dir = config.get("replay", {}).get("directory")
    recordings_dir = config.get("split", {}).get("recordings_dir")
    initial_dir = None
    if replay_dir and Path(replay_dir).exists():
        initial_dir = replay_dir
    elif recordings_dir and Path(recordings_dir).exists():
        initial_dir = recordings_dir
    selected = choose_directory(initial_dir)
    if selected:
        config.setdefault("replay", {})["directory"] = selected
        save_config(config)
    return redirect("/")


@app.route("/api/choose-replay-dir", methods=["POST"])
def api_choose_replay_dir() -> Any:
    config = load_config()
    replay_dir = config.get("replay", {}).get("directory")
    recordings_dir = config.get("split", {}).get("recordings_dir")
    initial_dir = None
    if replay_dir and Path(replay_dir).exists():
        initial_dir = replay_dir
    elif recordings_dir and Path(recordings_dir).exists():
        initial_dir = recordings_dir
    selected = choose_directory(initial_dir)
    if selected:
        config.setdefault("replay", {})["directory"] = selected
        save_config(config)
    return jsonify({"ok": True, "directory": selected or ""})


@app.route("/split-selected", methods=["POST"])
def split_selected() -> str:
    vod_path = request.form.get("vod_path", "")
    session_path = request.form.get("session_path", "")
    if not vod_path or not session_path:
        if request.headers.get("X-Requested-With") == "fetch":
            return jsonify({"ok": False, "error": "Missing VOD or session"}), 400
        return redirect("/vods")
    split_from_config(CONFIG_PATH, bookmarks_override=Path(session_path), input_override=Path(vod_path))
    if request.headers.get("X-Requested-With") == "fetch":
        return jsonify({"ok": True, "redirect": "/clips"})
    return redirect("/clips")


@app.route("/api/split-selected", methods=["POST"])
def api_split_selected() -> Any:
    payload = request.get_json(silent=True) or {}
    vod_path = payload.get("vod_path", "")
    session_path = payload.get("session_path", "")
    if not vod_path or not session_path:
        return jsonify({"ok": False, "error": "Missing VOD or session"}), 400
    split_from_config(CONFIG_PATH, bookmarks_override=Path(session_path), input_override=Path(vod_path))
    return jsonify({"ok": True})


@app.route("/vod-ocr", methods=["POST"])
def vod_ocr_run() -> str:
    vod_path = request.form.get("vod_path", "")
    if not vod_path:
        return redirect("/vods")
    config = load_config()
    log_path = resolve_log_path(CONFIG_PATH, config.get("logging", {}).get("file", "app.log"))
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_handle = log_path.open("a", encoding="utf-8")
    cmd = build_mode_command("vod", CONFIG_PATH, ["--vod", vod_path])
    print(f"Starting VOD OCR: {cmd}")
    subprocess.Popen(
        cmd,
        cwd=str(get_project_root()),
        stdout=log_handle,
        stderr=log_handle,
    )
    return redirect("/vods")


@app.route("/api/vod-ocr", methods=["POST"])
def api_vod_ocr_run() -> Any:
    global _vod_ocr_processes
    payload = request.get_json(silent=True) or {}
    vod_path = payload.get("vod_path", "")
    if not vod_path:
        return jsonify({"ok": False, "error": "Missing VOD"}), 400
    config = load_config()
    log_path = resolve_log_path(CONFIG_PATH, config.get("logging", {}).get("file", "app.log"))
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_handle = log_path.open("a", encoding="utf-8")
    cmd = build_mode_command("vod", CONFIG_PATH, ["--vod", vod_path])
    print(f"Starting VOD OCR: {cmd}")
    with _process_lock:
        proc = subprocess.Popen(
            cmd,
            cwd=str(get_project_root()),
            stdout=log_handle,
            stderr=log_handle,
        )
        _vod_ocr_processes[vod_path] = proc
    return jsonify({"ok": True})


@app.route("/api/stop-vod-ocr", methods=["POST"])
def api_stop_vod_ocr() -> Any:
    global _vod_ocr_processes
    payload = request.get_json(silent=True) or {}
    vod_path = payload.get("vod_path", "")
    if not vod_path:
        return jsonify({"ok": False, "error": "Missing VOD"}), 400
    try:
        with _process_lock:
            proc = _vod_ocr_processes.get(vod_path)
            if proc is not None:
                # Process exists, try to terminate it
                if proc.poll() is None:
                    # Process is still running
                    proc.terminate()
                    try:
                        proc.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        proc.kill()
                # Remove from tracking dict
                if vod_path in _vod_ocr_processes:
                    del _vod_ocr_processes[vod_path]
        
        # Clean up the .scanning and .paused marker files
        config = load_config()
        bookmarks_dir = Path(config.get("bookmarks", {}).get("directory", ""))
        if not bookmarks_dir.is_absolute():
            bookmarks_dir = get_app_data_dir() / bookmarks_dir
        session_prefix = config.get("bookmarks", {}).get("session_prefix", "session")
        vod_path_obj = Path(vod_path)
        safe_stem = sanitize_stem(vod_path_obj.stem) or "vod"
        scanning_marker = bookmarks_dir / f"{session_prefix}_{safe_stem}.scanning"
        paused_marker = bookmarks_dir / f"{session_prefix}_{safe_stem}.paused"
        if scanning_marker.exists():
            scanning_marker.unlink()
        if paused_marker.exists():
            paused_marker.unlink()
        
        return jsonify({"ok": True})
    except Exception as e:
        print(f"Error stopping VOD OCR: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/pause-vod-ocr", methods=["POST"])
def api_pause_vod_ocr() -> Any:
    """Pause an ongoing VOD scan by creating a .paused marker file"""
    payload = request.get_json(silent=True) or {}
    vod_path = payload.get("vod_path", "")
    if not vod_path:
        return jsonify({"ok": False, "error": "Missing VOD"}), 400
    try:
        config = load_config()
        bookmarks_dir = Path(config.get("bookmarks", {}).get("directory", ""))
        if not bookmarks_dir.is_absolute():
            bookmarks_dir = get_app_data_dir() / bookmarks_dir
        session_prefix = config.get("bookmarks", {}).get("session_prefix", "session")
        vod_path_obj = Path(vod_path)
        safe_stem = sanitize_stem(vod_path_obj.stem) or "vod"
        paused_marker = bookmarks_dir / f"{session_prefix}_{safe_stem}.paused"
        
        # Create the paused marker - the scanning process will detect it and save state
        paused_marker.write_text(json.dumps({"paused": True}), encoding="utf-8")
        
        return jsonify({"ok": True})
    except Exception as e:
        print(f"Error pausing VOD OCR: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/resume-vod-ocr", methods=["POST"])
def api_resume_vod_ocr() -> Any:
    """Resume a paused VOD scan"""
    global _vod_ocr_processes
    payload = request.get_json(silent=True) or {}
    vod_path = payload.get("vod_path", "")
    if not vod_path:
        return jsonify({"ok": False, "error": "Missing VOD"}), 400
    try:
        config = load_config()
        bookmarks_dir = Path(config.get("bookmarks", {}).get("directory", ""))
        if not bookmarks_dir.is_absolute():
            bookmarks_dir = get_app_data_dir() / bookmarks_dir
        session_prefix = config.get("bookmarks", {}).get("session_prefix", "session")
        vod_path_obj = Path(vod_path)
        safe_stem = sanitize_stem(vod_path_obj.stem) or "vod"
        paused_marker = bookmarks_dir / f"{session_prefix}_{safe_stem}.paused"
        
        if not paused_marker.exists():
            return jsonify({"ok": False, "error": "No paused scan found"}), 400
        
        # Start a new scan process with --resume flag
        log_path = resolve_log_path(CONFIG_PATH, config.get("logging", {}).get("file", "app.log"))
        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_handle = log_path.open("a", encoding="utf-8")
        cmd = build_mode_command("vod", CONFIG_PATH, ["--vod", vod_path, "--resume"])
        print(f"Resuming VOD OCR: {cmd}")
        
        with _process_lock:
            proc = subprocess.Popen(
                cmd,
                cwd=str(get_project_root()),
                stdout=log_handle,
                stderr=log_handle,
            )
            _vod_ocr_processes[vod_path] = proc
        
        return jsonify({"ok": True})
    except Exception as e:
        print(f"Error resuming VOD OCR: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/delete-sessions", methods=["POST"])
def api_delete_sessions() -> Any:
    payload = request.get_json(silent=True) or {}
    vod_path = payload.get("vod_path", "")
    if not vod_path:
        return jsonify({"ok": False, "error": "Missing VOD"}), 400
    try:
        config = load_config()
        bookmarks_dir = Path(config.get("bookmarks", {}).get("directory", ""))
        if not bookmarks_dir.is_absolute():
            bookmarks_dir = get_app_data_dir() / bookmarks_dir
        session_prefix = config.get("bookmarks", {}).get("session_prefix", "session")
        vod_path_obj = Path(vod_path)
        safe_stem = sanitize_stem(vod_path_obj.stem) or "vod"
        pattern_csv = f"{session_prefix}_{safe_stem}_*.csv"
        pattern_jsonl = f"{session_prefix}_{safe_stem}_*.jsonl"
        files = list(bookmarks_dir.glob(pattern_csv)) + list(bookmarks_dir.glob(pattern_jsonl))
        for file in files:
            file.unlink()
        return jsonify({"ok": True})
    except Exception as e:
        print(f"Error deleting sessions: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/control/start", methods=["POST"])
def control_start() -> str:
    start_bookmark_process()
    return redirect("/")


@app.route("/api/control/start", methods=["POST"])
def api_control_start() -> Any:
    start_bookmark_process()
    return jsonify({"ok": True})


@app.route("/control/stop", methods=["POST"])
def control_stop() -> str:
    stop_bookmark_process()
    return redirect("/")


@app.route("/api/control/stop", methods=["POST"])
def api_control_stop() -> Any:
    stop_bookmark_process()
    return jsonify({"ok": True})


@app.route("/api/status")
def api_status() -> Any:
    return jsonify(get_status())


@app.route("/api/test-connection")
def api_test_connection() -> Any:
    return jsonify({"status": "ok", "message": "Server is running with latest code"})


@app.route("/api/bootstrap/status")
def api_bootstrap_status() -> Any:
    return jsonify(dependency_bootstrap.get_status())


@app.route("/api/bootstrap/start", methods=["POST"])
def api_bootstrap_start() -> Any:
    payload = request.get_json() or {}
    install_gpu_ocr = bool(payload.get("install_gpu_ocr", False))
    return jsonify(dependency_bootstrap.start(install_gpu_ocr=install_gpu_ocr))


_STATUS_MAP = {
    "initializing": "downloading",
    "fetching_metadata": "downloading",
    "downloading": "downloading",
    "completed": "completed",
    "error": "failed",
}


def _vod_downloader_as_twitch_jobs() -> List[Dict[str, Any]]:
    """Convert in-memory TwitchVODDownloader jobs to the twitch_jobs shape."""
    if not _vod_downloader:
        return []
    result = []
    for job_id, job in _vod_downloader.list_jobs():
        result.append({
            "id": job_id,
            "url": job.get("url", ""),
            "status": _STATUS_MAP.get(job.get("status", ""), "downloading"),
            "progress": job.get("percentage", 0),
            "message": job.get("error") or job.get("status", ""),
            "eta": job.get("eta"),
            "speed": job.get("speed"),
        })
    return result


@app.route("/api/notifications")
def api_notifications() -> Any:
    return jsonify(
        {
            "bootstrap": dependency_bootstrap.get_status(),
            "twitch_jobs": list_twitch_jobs(limit=10) + _vod_downloader_as_twitch_jobs(),
            "patch_notes": load_patch_notes(),
        }
    )


@app.route("/api/update/latest")
def api_update_latest() -> Any:
    current_version = get_current_app_version()
    try:
        metadata = fetch_latest_update_metadata()
    except Exception as exc:
        return (
            jsonify(
                {
                    "ok": False,
                    "latest_version": "",
                    "current_version": current_version,
                    "error": str(exc),
                }
            ),
            502,
        )

    latest_version = str(metadata.get("version", "")).strip()
    return jsonify(
        {
            "ok": True,
            "latest_version": latest_version,
            "current_version": current_version,
            "feed_url": UPDATE_FEED_URL,
        }
    )


@app.route("/api/ocr-gpu-status")
def api_ocr_gpu_status() -> Any:
    """Check if Torch CUDA is available. Always returns 200 with graceful degradation."""
    runtime_info = prepare_torch_runtime()
    try:
        import torch  # type: ignore
        cuda_available = torch.cuda.is_available()
        payload: Dict[str, Any] = {
            "ok": True,
            "available": bool(cuda_available),
            "runtime": runtime_info,
            "torch_version": getattr(torch, "__version__", "unknown"),
            "torch_cuda_build": getattr(getattr(torch, "version", None), "cuda", None),
        }
        if cuda_available:
            try:
                payload["device_count"] = int(torch.cuda.device_count())
                if payload["device_count"] > 0:
                    payload["device_name"] = str(torch.cuda.get_device_name(0))
            except Exception:
                pass
        return jsonify(payload)
    except Exception as e:
        err = str(e)
        print(f"Torch/CUDA check failed: {err[:200]}")
        # Any failure means CUDA is not available - fall back to CPU/Tesseract
        return jsonify({
            "ok": True,
            "available": False,
            "runtime": runtime_info,
            "error": err[:400],
            "error_type": type(e).__name__,
        })


@app.route("/api/ocr-gpu-diagnostics")
def api_ocr_gpu_diagnostics() -> Any:
    """Detailed diagnostics for packaged Torch/CUDA runtime issues."""
    runtime_info = prepare_torch_runtime()
    payload: Dict[str, Any] = {
        "ok": True,
        "runtime": runtime_info,
        "python_executable": sys.executable,
        "frozen": is_frozen(),
    }
    try:
        import torch  # type: ignore

        payload.update({
            "import_torch_ok": True,
            "torch_version": getattr(torch, "__version__", "unknown"),
            "torch_cuda_build": getattr(getattr(torch, "version", None), "cuda", None),
            "cuda_available": bool(torch.cuda.is_available()),
        })
        if torch.cuda.is_available():
            payload["cuda_device_count"] = int(torch.cuda.device_count())
            if payload["cuda_device_count"] > 0:
                payload["cuda_device_0"] = str(torch.cuda.get_device_name(0))
    except Exception as e:
        payload.update({
            "import_torch_ok": False,
            "error_type": type(e).__name__,
            "error": str(e)[:800],
        })
    return jsonify(payload)


@app.route("/api/install-gpu-ocr", methods=["POST"])
def api_install_gpu_ocr() -> Any:
    """Download and install Torch/CUDA for GPU OCR support."""
    try:
        python_candidates: List[List[str]] = []
        if not is_frozen():
            python_candidates.append([sys.executable])
        python_candidates.extend([
            ["py", "-3.12"],
            ["py", "-3"],
            ["python"],
        ])

        chosen_python: Optional[List[str]] = None
        for candidate in python_candidates:
            probe = subprocess.run(
                [*candidate, "-V"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if probe.returncode == 0:
                chosen_python = candidate
                break

        if chosen_python is None:
            return jsonify({
                "ok": False,
                "message": "No system Python found. Install Python 3.12+ and try again.",
            }), 400

        python_path_probe = subprocess.run(
            [*chosen_python, "-c", "import sys; print(sys.executable)"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        python_exe_path = (python_path_probe.stdout or "").strip()
        if not python_exe_path:
            python_exe_path = " ".join(chosen_python)

        required_bytes = 10 * 1024 * 1024 * 1024
        try:
            free_bytes = shutil.disk_usage(Path(python_exe_path).anchor or str(Path.home().anchor)).free
        except Exception:
            free_bytes = 0
        if free_bytes and free_bytes < required_bytes:
            free_gb = round(free_bytes / (1024 ** 3), 2)
            required_gb = round(required_bytes / (1024 ** 3), 0)
            return jsonify({
                "ok": False,
                "message": (
                    f"Not enough free disk space to install GPU OCR. "
                    f"Free about {required_gb} GB on drive {Path(python_exe_path).anchor or 'system drive'} "
                    f"(currently {free_gb} GB free)."
                ),
            }), 400

        purge_cache_cmd = [*chosen_python, "-m", "pip", "cache", "purge"]
        subprocess.run(
            purge_cache_cmd,
            capture_output=True,
            text=True,
            timeout=120,
        )

        install_easyocr_cmd = [
            *chosen_python,
            "-m",
            "pip",
            "install",
            "easyocr",
            "--no-cache-dir",
            "--disable-pip-version-check",
            "--upgrade",
        ]
        install_torch_cmd = [
            *chosen_python,
            "-m",
            "pip",
            "install",
            "torch",
            "torchvision",
            "torchaudio",
            "--index-url",
            "https://download.pytorch.org/whl/cu124",
            "--no-cache-dir",
            "--disable-pip-version-check",
            "--upgrade",
        ]

        print(f"Installing EasyOCR: {' '.join(install_easyocr_cmd)}")
        easyocr_result = subprocess.run(
            install_easyocr_cmd,
            capture_output=True,
            text=True,
            timeout=600,
        )
        if easyocr_result.returncode != 0:
            error_msg = easyocr_result.stderr or easyocr_result.stdout
            return jsonify({
                "ok": False,
                "message": f"EasyOCR install failed: {error_msg[:300]}",
            }), 400

        print(f"Installing CUDA Torch: {' '.join(install_torch_cmd)}")
        torch_result = subprocess.run(
            install_torch_cmd,
            capture_output=True,
            text=True,
            timeout=1200,
        )

        if torch_result.returncode != 0:
            error_msg = torch_result.stderr or torch_result.stdout
            if "No space left on device" in error_msg or "Errno 28" in error_msg:
                return jsonify({
                    "ok": False,
                    "message": (
                        "Torch install failed: insufficient disk space. "
                        "Free at least 10 GB on the Python install drive and try again."
                    ),
                }), 400
            return jsonify({
                "ok": False,
                "message": f"Torch install failed: {error_msg[:300]}",
            }), 400

        verify_cmd = [*chosen_python, "-c", "import torch; print(torch.cuda.is_available())"]
        verify_result = subprocess.run(
            verify_cmd,
            capture_output=True,
            text=True,
            timeout=30,
        )
        cuda_available = verify_result.returncode == 0 and "True" in (verify_result.stdout or "")

        return jsonify({
            "ok": True,
            "message": "GPU OCR dependencies installed.",
            "cuda_available": cuda_available,
            "python": " ".join(chosen_python),
        })
            
    except subprocess.TimeoutExpired:
        return jsonify({
            "ok": False,
            "message": "Installation timed out. Check internet connection and try again."
        }), 400
    except Exception as e:
        error_str = str(e)
        print(f"GPU install error: {error_str[:200]}")
        return jsonify({
            "ok": False,
            "message": f"Error: {error_str[:200]}"
        }), 500


@app.route("/api/config", methods=["GET", "POST"])
def api_config() -> Any:
    if request.method == "GET":
        return jsonify(load_config())
    payload = request.get_json(silent=True) or {}
    config = load_config()
    update_config_from_payload(config, payload)
    save_config(config)
    return jsonify({"ok": True, "config": config})


@app.route("/api/debug/paths")
def api_debug_paths() -> Any:
    index_path = REACT_DIST / "index.html"
    assets_path = REACT_DIST / "assets"
    return jsonify({
        "react_dist": str(REACT_DIST),
        "react_dist_exists": REACT_DIST.exists(),
        "index_html_path": str(index_path),
        "index_html_exists": index_path.exists(),
        "index_html_content": index_path.read_text()[:500] if index_path.exists() else None,
        "assets_files": [f.name for f in assets_path.iterdir()] if assets_path.exists() else []
    })


@app.route("/api/vods")
def api_vods() -> Any:
    config = load_config()
    bookmarks_dir = Path(config.get("bookmarks", {}).get("directory", ""))
    # If path is relative, resolve it to app data directory
    if not bookmarks_dir.is_absolute():
        bookmarks_dir = get_app_data_dir() / bookmarks_dir
    session_prefix = config.get("bookmarks", {}).get("session_prefix", "session")
    vod_paths = get_vod_paths(
        get_vod_dirs(config), config.get("split", {}).get("extensions", [])
    )
    show_all = request.args.get("all") == "1"
    limit_arg = request.args.get("limit")
    try:
        limit_value = int(limit_arg) if limit_arg else 10
    except ValueError:
        limit_value = 10
    limit = None if show_all else limit_value
    limited_paths = vod_paths if limit is None else vod_paths[:limit]
    vods = build_vod_entries(limited_paths, bookmarks_dir, session_prefix)
    remaining_count = max(0, len(vod_paths) - len(limited_paths))
    return jsonify({"vods": vods, "remaining_count": remaining_count})


@app.route("/api/vods/delete", methods=["POST"])
def api_delete_vod() -> Any:
    payload = request.get_json(silent=True) or {}
    vod_path = str(payload.get("path", "")).strip()
    if not vod_path:
        return jsonify({"ok": False, "error": "Missing VOD path"}), 400

    file_path = resolve_vod_path(vod_path)
    if file_path is None or not file_path.exists():
        return jsonify({"ok": False, "error": "VOD not found"}), 404

    try:
        config = load_config()
        bookmarks_dir = Path(config.get("bookmarks", {}).get("directory", ""))
        if not bookmarks_dir.is_absolute():
          bookmarks_dir = get_app_data_dir() / bookmarks_dir
        session_prefix = config.get("bookmarks", {}).get("session_prefix", "session")
        safe_stem = sanitize_stem(file_path.stem) or "vod"
        pattern_csv = f"{session_prefix}_{safe_stem}_*.csv"
        pattern_jsonl = f"{session_prefix}_{safe_stem}_*.jsonl"
        for file in list(bookmarks_dir.glob(pattern_csv)) + list(bookmarks_dir.glob(pattern_jsonl)):
            file.unlink(missing_ok=True)
        scanning_marker = bookmarks_dir / f"{session_prefix}_{safe_stem}.scanning"
        paused_marker = bookmarks_dir / f"{session_prefix}_{safe_stem}.paused"
        scanning_marker.unlink(missing_ok=True)
        paused_marker.unlink(missing_ok=True)

        file_path.unlink(missing_ok=True)
        thumbs_dir = get_app_data_dir() / "thumbnails"
        for thumb in thumbs_dir.glob(f"{safe_stem}_t*.jpg"):
            thumb.unlink(missing_ok=True)
        return jsonify({"ok": True})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.route("/api/vods/stream")
def api_vods_stream() -> Response:
    def event_stream() -> Any:
        while True:
            config = load_config()
            bookmarks_dir = Path(config.get("bookmarks", {}).get("directory", ""))
            # If path is relative, resolve it to app data directory
            if not bookmarks_dir.is_absolute():
                bookmarks_dir = get_app_data_dir() / bookmarks_dir
            session_prefix = config.get("bookmarks", {}).get("session_prefix", "session")
            vod_paths = get_vod_paths(
                get_vod_dirs(config), config.get("split", {}).get("extensions", [])
            )
            show_all = request.args.get("all") == "1"
            limit_arg = request.args.get("limit")
            try:
                limit_value = int(limit_arg) if limit_arg else 10
            except ValueError:
                limit_value = 10
            limit = None if show_all else limit_value
            limited_paths = vod_paths if limit is None else vod_paths[:limit]
            vods = build_vod_entries(limited_paths, bookmarks_dir, session_prefix)
            remaining_count = max(0, len(vod_paths) - len(limited_paths))
            payload = json.dumps({"vods": vods, "remaining_count": remaining_count})
            yield f"data: {payload}\n\n"
            time.sleep(1)

    return Response(
        stream_with_context(event_stream()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.route("/api/twitch-imports")
def api_twitch_imports() -> Any:
    limit_arg = request.args.get("limit")
    try:
        limit = int(limit_arg) if limit_arg else 20
    except ValueError:
        limit = 20
    return jsonify({"jobs": list_twitch_jobs(limit=limit)})


@app.route("/api/twitch-import", methods=["POST"])
def api_twitch_import() -> Any:
    payload = request.get_json(silent=True) or {}
    url = str(payload.get("url", "")).strip()
    if not url:
        return jsonify({"ok": False, "error": "Missing URL"}), 400
    if not is_twitch_vod_url(url):
        return jsonify({"ok": False, "error": "Only Twitch VOD URLs are supported"}), 400
    if resolve_tool("yt-dlp", ["yt-dlp.exe"]) is None:
        return jsonify({"ok": False, "error": "yt-dlp not found"}), 400

    job_id = uuid.uuid4().hex
    job = {
        "id": job_id,
        "url": url,
        "status": "queued",
        "progress": 0,
        "message": "Queued",
    }
    write_twitch_job(job_id, job)
    worker = threading.Thread(target=run_twitch_import, args=(job_id, url), daemon=True)
    worker.start()
    return jsonify({"ok": True, "job": job})


@app.route("/api/twitch-import/<job_id>")
def api_twitch_import_status(job_id: str) -> Any:
    job = read_twitch_job(job_id)
    if not job:
        return jsonify({"ok": False, "error": "Job not found"}), 404
    return jsonify({"ok": True, "job": job})


@app.route("/api/session-data")
def api_session_data() -> Any:
    session_path = request.args.get("path", "")
    if not session_path:
        return jsonify({"ok": False, "error": "Missing session path"}), 400
    
    file_path = Path(session_path)
    if not file_path.exists():
        return jsonify({"ok": False, "error": "Session file not found"}), 404
    
    config = load_config()
    bookmarks_dir = Path(config.get("bookmarks", {}).get("directory", ""))
    if not bookmarks_dir.is_absolute():
        bookmarks_dir = get_app_data_dir() / bookmarks_dir
    
    # Validate that the file is in the bookmarks directory
    try:
        if not file_path.is_relative_to(bookmarks_dir):
            return jsonify({"ok": False, "error": "Invalid session path"}), 403
    except (ValueError, AttributeError):
        # Fallback for Python < 3.9 or path validation issues
        if not str(file_path).startswith(str(bookmarks_dir)):
            return jsonify({"ok": False, "error": "Invalid session path"}), 403
    
    bookmarks = []
    try:
        with file_path.open("r", encoding="utf-8") as f:
            if file_path.suffix.lower() == ".csv":
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        bookmarks.append({
                            "timestamp": row.get("timestamp", ""),
                            "seconds": float(row.get("seconds_since_start", 0)),
                            "event": row.get("event", ""),
                            "ocr": row.get("ocr", "")
                        })
                    except (ValueError, KeyError):
                        continue
            elif file_path.suffix.lower() == ".jsonl":
                for line in f:
                    try:
                        data = json.loads(line)
                        bookmarks.append({
                            "timestamp": data.get("timestamp", ""),
                            "seconds": float(data.get("seconds_since_start", 0)),
                            "event": data.get("event", ""),
                            "ocr": data.get("ocr", "")
                        })
                    except (json.JSONDecodeError, ValueError, KeyError):
                        continue
    except (OSError, IOError) as e:
        return jsonify({"ok": False, "error": "Failed to read session file"}), 500
    
    return jsonify({
        "ok": True,
        "bookmarks": bookmarks,
        "session_name": file_path.name
    })


@app.route("/api/clip-range", methods=["POST"])
def api_clip_range() -> Any:
    payload = request.get_json(silent=True) or {}
    vod_path = str(payload.get("vod_path", "")).strip()
    if not vod_path:
        return jsonify({"ok": False, "error": "Missing VOD path"}), 400

    try:
        start = float(payload.get("start"))
        end = float(payload.get("end"))
    except (TypeError, ValueError):
        return jsonify({"ok": False, "error": "Invalid start/end"}), 400

    if end <= start:
        return jsonify({"ok": False, "error": "End must be after start"}), 400

    config = load_config()
    vod_file = Path(vod_path)
    if not vod_file.exists() or not vod_file.is_file():
        return jsonify({"ok": False, "error": "VOD not found"}), 404

    extensions = {
        ext.lower() for ext in config.get("split", {}).get("extensions", [])
    }
    if extensions and vod_file.suffix.lower() not in extensions:
        return jsonify({"ok": False, "error": "Unsupported VOD type"}), 400

    allowed_dirs = [path for path in get_vod_dirs(config) if str(path)]
    if allowed_dirs:
        try:
            allowed = any(vod_file.is_relative_to(root) for root in allowed_dirs)
        except (AttributeError, ValueError):
            allowed = any(str(vod_file).startswith(str(root)) for root in allowed_dirs)
        if not allowed:
            return jsonify({"ok": False, "error": "Invalid VOD path"}), 403

    split_cfg = config.get("split", {})
    output_dir = Path(split_cfg.get("output_dir", ""))
    # Output is relative to the VOD directory unless explicitly absolute.
    if not output_dir.name:
        output_dir = vod_file.parent / "clips"
    elif not output_dir.is_absolute():
        output_dir = vod_file.parent / output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    vod_start = parse_vod_start_time(vod_file)
    if vod_start is None:
        vod_start = datetime.fromtimestamp(vod_file.stat().st_mtime)

    duration = max(0.1, end - start)
    offset_seconds = int(round(start))
    clip_time = vod_start + timedelta(seconds=start)
    timestamp = clip_time.strftime("%Y%m%d_%H%M%S")
    output_name = f"clip_{timestamp}_t{offset_seconds}s"
    
    # Try to load bookmarks and count events within the clip range
    bookmarks_dir = Path(config.get("bookmarks", {}).get("directory", ""))
    if not bookmarks_dir.is_absolute():
        bookmarks_dir = get_app_data_dir() / bookmarks_dir
    session_prefix = config.get("bookmarks", {}).get("session_prefix", "session")
    sessions = list_sessions_for_vod(bookmarks_dir, session_prefix, vod_file.stem)
    
    if sessions and split_cfg.get("encode_counts", True):
        # Use the first (most recent) session
        session_path = Path(sessions[0]["path"])
        try:
            all_events = load_bookmarks(session_path)
            # Filter events within the clip range
            clip_events = [e for e in all_events if start <= e.time <= end]
            if clip_events:
                counts = count_events(clip_events)
                count_format = split_cfg.get("count_format", "k{kills}_a{assists}_d{deaths}")
                output_name = f"{output_name}_{count_format.format(**counts)}"
        except Exception:
            # If bookmark loading fails, just skip counts
            pass
    
    output_file = output_dir / f"{output_name}{vod_file.suffix}"

    try:
        run_ffmpeg(vod_file, output_file, start, duration)
    except (subprocess.CalledProcessError, RuntimeError) as exc:
        return jsonify({"ok": False, "error": f"FFmpeg failed: {exc}"}), 500

    return jsonify({"ok": True, "clip_path": str(output_file)})


@app.route("/api/clip-name", methods=["POST"])
def api_clip_name() -> Any:
    payload = request.get_json(silent=True) or {}
    path_value = str(payload.get("path", "")).strip()
    if not path_value:
        return jsonify({"ok": False, "error": "Missing clip path"}), 400
    config = load_config()
    allowed_dirs = get_allowed_media_dirs(config)
    file_path = resolve_allowed_path(path_value, allowed_dirs)
    if file_path is None or not file_path.exists():
        return jsonify({"ok": False, "error": "Clip not found"}), 404

    name_value = str(payload.get("name", ""))
    display_name = set_clip_title(file_path, name_value)
    return jsonify({"ok": True, "display_name": display_name})


@app.route("/api/clips")
def api_clips() -> Any:
    config = load_config()
    limit_arg = request.args.get("limit")
    try:
        limit = int(limit_arg) if limit_arg else 20
    except ValueError:
        limit = 20
    clips = list_clips(config, limit=limit)
    serialized = [serialize_clip(clip) for clip in clips]
    return jsonify({"clips": serialized})


@app.route("/api/logs")
def api_logs() -> Any:
    limit_arg = request.args.get("lines")
    try:
        limit = int(limit_arg) if limit_arg else 200
    except ValueError:
        limit = 200
    config = load_config()
    log_path = resolve_log_path(CONFIG_PATH, config.get("logging", {}).get("file", "app.log"))
    return jsonify({"lines": tail_lines(log_path, max_lines=limit)})


@app.route("/api/open-backend-log", methods=["POST"])
def api_open_backend_log() -> Any:
    config = load_config()
    log_path = resolve_log_path(CONFIG_PATH, config.get("logging", {}).get("file", "app.log"))
    if not log_path.exists():
        return jsonify({"ok": False, "error": "Log file not found"}), 404
    try:
        if sys.platform.startswith("win"):
            subprocess.Popen(["notepad", str(log_path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif sys.platform == "darwin":
            subprocess.Popen(["open", "-a", "TextEdit", str(log_path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            subprocess.Popen(["xdg-open", str(log_path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        return jsonify({"ok": False, "error": "Failed to open log"}), 500
    return jsonify({"ok": True})


@app.route("/logo.png")
def react_logo() -> Any:
    logo_file = REACT_DIST / "logo.png"
    if not logo_file.exists() or not logo_file.is_file():
        abort(404)
    response = send_from_directory(REACT_DIST, "logo.png", conditional=False, etag=False, max_age=0)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


# ==================== Twitch VOD Download Routes ====================

@app.route("/api/vod/download", methods=["POST"])
def vod_download_start() -> Any:
    """
    Start a Twitch VOD download job

    Request JSON:
    {
        "url": "https://twitch.tv/videos/123456789"
    }

    Response:
    {
        "job_id": "uuid-string",
        "status": "downloading"
    }
    """
    if not _vod_downloader:
        return jsonify({"error": "VOD downloader not initialized"}), 500

    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        url = data.get("url", "").strip()
        if not url:
            return jsonify({"error": "URL is required"}), 400

        # Validate URL
        if not _vod_downloader.validate_url(url):
            return jsonify({
                "error": "Invalid Twitch VOD URL",
                "example": "https://twitch.tv/videos/123456789"
            }), 400

        # Check if yt-dlp is installed
        if not _vod_downloader.check_yt_dlp():
            return jsonify({
                "error": "yt-dlp not installed",
                "install": "pip install yt-dlp"
            }), 400

        # Start the download
        job_id = str(uuid.uuid4())
        _vod_downloader.start_download(url, job_id)

        return jsonify({
            "job_id": job_id,
            "status": "initializing",
            "message": "Download started. Check progress with /api/vod/progress/<job_id>"
        }), 202

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/vod/progress/<job_id>", methods=["GET"])
def vod_download_progress(job_id: str) -> Any:
    """
    Get the progress of a VOD download job

    Response:
    {
        "status": "downloading|completed|error",
        "percentage": 0-100,
        "speed": "1.5 MB/s",
        "eta": "00:15:30",
        "error": null or error message,
        "output_file": null or path to downloaded file
    }
    """
    if not _vod_downloader:
        return jsonify({"error": "VOD downloader not initialized"}), 500

    progress = _vod_downloader.get_progress(job_id)
    if not progress:
        return jsonify({"error": "Job not found"}), 404

    return jsonify(progress), 200


@app.route("/api/vod/check-tools", methods=["GET"])
def vod_check_tools() -> Any:
    """
    Check if required tools are installed

    Response:
    {
        "yt_dlp_installed": true/false,
        "message": "All tools ready" or error message
    }
    """
    if not _vod_downloader:
        return jsonify({"error": "VOD downloader not initialized"}), 500

    yt_dlp_ok = _vod_downloader.check_yt_dlp()

    return jsonify({
        "yt_dlp_installed": yt_dlp_ok,
        "message": "All tools ready" if yt_dlp_ok else "yt-dlp not installed: pip install yt-dlp"
    }), 200


# =====================================================================

# React catch-all route - MUST be last so it doesn't intercept API routes
@app.route("/")
@app.route("/<path:path>")
def react_app(path: str = "") -> Any:
    if not REACT_DIST.exists():
        return "React build not found. Run `npm run build` in frontend.", 404
    target = REACT_DIST / path
    if path and target.exists() and target.is_file():
        response = send_from_directory(REACT_DIST, path)
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Expires'] = '0'
        return response
    response = send_from_directory(REACT_DIST, "index.html")
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Expires'] = '0'
    return response


def main() -> None:
    global _vod_downloader

    config = load_config()
    log_path = resolve_log_path(CONFIG_PATH, config.get("logging", {}).get("file", "app.log"))
    reset_log_file(log_path)
    port = int(os.environ.get("APEX_WEBUI_PORT", "5170"))

    # Initialize VOD downloader
    replay_dir = Path(config.get("replay", {}).get("directory", get_downloads_dir()))
    replay_dir.mkdir(parents=True, exist_ok=True)
    _vod_downloader = TwitchVODDownloader(replay_dir)

    print(f"Starting VOD Insights Web UI on port {port}...")
    print(f"Logs: {log_path}")
    print(f"VOD Download Directory: {replay_dir}")

    if os.environ.get("APEX_WEBUI_WATCH", "1") == "1":
        watch_paths = [APP_ROOT]
        ignore_paths = {log_path, get_uploads_dir()}
        watcher = threading.Thread(
            target=watch_for_changes,
            args=(watch_paths,),
            kwargs={"ignore_paths": ignore_paths},
            daemon=True,
        )
        watcher.start()
    
    print(f"Web UI ready at http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, debug=False)


if __name__ == "__main__":
    main()
