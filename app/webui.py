from __future__ import annotations

import atexit
import json
import logging
import os
import re
import signal
import subprocess
import sys
import threading
import time
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

from flask import Flask, Response, abort, jsonify, redirect, request, send_file, send_from_directory, stream_with_context, url_for

from app.runtime_paths import (
    build_mode_command,
    get_app_data_dir,
    get_config_path,
    get_downloads_dir,
    get_project_root,
    get_react_dist,
    get_uploads_dir,
    is_frozen,
    resolve_log_path,
    resolve_tool,
    reset_log_file,
)
from app.bootstrap.dependency_bootstrap import dependency_bootstrap
from app.clips.insights import (
    calculate_averages,
    get_session_start,
    parse_clip_details,
)
from app.clips.titles import (
    build_download_name,
    get_clip_title,
    load_clip_titles,
    set_clip_title,
)
from app.twitch.jobs import (
    is_twitch_vod_url,
    list_twitch_jobs,
    read_twitch_job,
    write_twitch_job,
)
from app.vod.catalog import (
    get_clips_dir,
    get_vod_dirs,
    get_vod_paths,
    list_sessions,
    list_sessions_for_vod,
)
from app.vod.scan_files import (
    get_safe_vod_stem,
    get_scan_marker_paths,
    list_vod_session_files,
    resolve_bookmarks_context,
)
from app.twitch.vod_download_jobs import vod_downloader_as_twitch_jobs
from app.ocr_pipeline.gpu_ocr import (
    install_gpu_ocr_dependencies,
    ocr_gpu_diagnostics_payload,
    ocr_gpu_status_payload,
)
from app.twitch.import_runner import run_twitch_import
from app.vod.paths import resolve_vod_media_filename
from app.system.config_update import update_config_from_payload
from app.vod.thumbnails import ensure_vod_thumbnail
from app.system.replay_directory import choose_and_save_replay_dir
from app.vod.scan_runner import launch_vod_scan_process, terminate_process
from app.vod.entries import build_vod_entries
from app.vod.upload import save_uploaded_vod_file, start_vod_scan_for_path
from app.system.file_explorer import reveal_file_in_explorer
from app.system.media_access import get_allowed_media_dirs
from app.clips.library import (
    build_clip_entry,
    iter_clip_files,
    list_clips,
    resolve_clip_path,
    serialize_clip,
)
from app.system.backend_logs import get_backend_log_path, open_backend_log, tail_lines
from app.system.http_cache import set_no_cache_headers
from app.system.request_guard import load_request_guard_from_env
from app.vod.download_api import (
    progress_response as vod_download_progress_payload,
    start_download_response as vod_download_start_payload,
    tools_check_response as vod_download_tools_payload,
)
from app.clips.queries import (
    clip_days_payload,
    clip_lookup_payload,
    clips_by_day_payload,
)
from app.clips.range import create_clip_range_payload
from app.session_data import session_data_payload
from app.split_bookmarks import BookmarkEvent, count_events, load_bookmarks, parse_vod_start_time, run_ffmpeg, split_from_config
from app.vod.download import TwitchVODDownloader
from app.system.update_metadata import (
    fetch_latest_update_metadata as fetch_update_metadata,
    get_current_app_version,
    load_patch_notes,
)
from app.routes import register_blueprints
from app.routes.capture_area import CaptureAreaRouteDeps
from app.routes.clips import ClipsRouteDeps
from app.routes.gpu import GpuRouteDeps
from app.routes.legacy_control import LegacyControlRouteDeps
from app.routes.logs import LogsRouteDeps
from app.routes.media_paths import MediaPathsRouteDeps
from app.routes.overlay import OverlayRouteDeps
from app.routes.spa import SpaRouteDeps
from app.routes.session import SessionRouteDeps
from app.routes.system import SystemRouteDeps
from app.routes.twitch_import import TwitchImportRouteDeps
from app.routes.vod_scan import VodScanRouteDeps
from app.routes.vod_actions import VodActionsRouteDeps
from app.routes.vod_download import VodDownloadRouteDeps
from app.routes.vod_thumbnail import VodThumbnailRouteDeps
from app.routes.vods import VodsRouteDeps
from app.system.path_policy import (
    normalize_allowed_dirs,
    resolve_allowed_path,
    resolve_existing_allowed_child_path,
    resolve_existing_allowed_path,
)
from app.webui_app_shell import (
    choose_directory,
    cleanup_vod_scans_on_exit,
    register_signal_handlers,
    watch_for_changes,
)


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
_request_guard = load_request_guard_from_env()


def _resolve_max_upload_bytes() -> int:
    raw = os.environ.get("AET_MAX_UPLOAD_MB", "4096").strip()
    try:
        size_mb = max(1, int(raw))
    except ValueError:
        size_mb = 4096
    return size_mb * 1024 * 1024


def create_app() -> Flask:
    app.config["MAX_CONTENT_LENGTH"] = _resolve_max_upload_bytes()

    if not app.config.get("_aet_request_guard_registered"):
        @app.before_request
        def _guard_sensitive_requests() -> Any:
            allowed, message, status_code = _request_guard.validate(request)
            if not allowed:
                return jsonify({"ok": False, "error": message}), status_code
            return None

        app.config["_aet_request_guard_registered"] = True

    register_blueprints(
        app,
        capture_area_deps=CaptureAreaRouteDeps(
            capture_area_save_response=capture_area_save_response,
        ),
        system_deps=SystemRouteDeps(
            get_status=get_status,
            load_config=load_config,
            save_config=save_config,
            update_config_from_payload=update_config_from_payload,
            get_bootstrap_status=dependency_bootstrap.get_status,
            start_bootstrap=lambda install_gpu_ocr: dependency_bootstrap.start(
                install_gpu_ocr=install_gpu_ocr
            ),
            get_notifications=lambda: {
                "bootstrap": dependency_bootstrap.get_status(),
                "twitch_jobs": list_twitch_jobs(limit=10) + vod_downloader_as_twitch_jobs(_vod_downloader),
                "patch_notes": load_patch_notes(),
            },
            get_current_app_version=get_current_app_version,
            fetch_latest_update_metadata=lambda: fetch_update_metadata(
                UPDATE_FEED_URL,
                UPDATE_REQUEST_TIMEOUT_SECONDS,
            ),
            update_feed_url=UPDATE_FEED_URL,
            debug_paths_response=debug_paths_response,
        ),
        gpu_deps=GpuRouteDeps(
            ocr_gpu_status_response=ocr_gpu_status_response,
            ocr_gpu_diagnostics_response=ocr_gpu_diagnostics_response,
            install_gpu_ocr_response=install_gpu_ocr_response,
        ),
        overlay_deps=OverlayRouteDeps(
            overlay_upload_response=overlay_upload_response,
            overlay_image_response=overlay_image_response,
            overlay_remove_response=overlay_remove_response,
        ),
        vod_download_deps=VodDownloadRouteDeps(
            vod_download_start_response=vod_download_start_response,
            vod_download_progress_response=vod_download_progress_response,
            vod_check_tools_response=vod_check_tools_response,
        ),
        twitch_import_deps=TwitchImportRouteDeps(
            twitch_imports_response=twitch_imports_response,
            twitch_import_start_response=twitch_import_start_response,
            twitch_import_status_response=twitch_import_status_response,
        ),
        logs_deps=LogsRouteDeps(
            logs_response=logs_response,
            open_backend_log_response=open_backend_log_response,
        ),
        media_paths_deps=MediaPathsRouteDeps(
            media_by_path_response=media_by_path_response,
            download_by_path_response=download_by_path_response,
            open_folder_by_path_response=open_folder_by_path_response,
            delete_by_path_response=delete_by_path_response,
            media_file_response=media_file_response,
            vod_media_file_response=vod_media_file_response,
            download_file_response=download_file_response,
            open_folder_response=open_folder_response,
            delete_file_response=delete_file_response,
        ),
        legacy_control_deps=LegacyControlRouteDeps(
            update_config_response=update_config_response,
            choose_replay_dir_response=choose_replay_dir_response,
            api_choose_replay_dir_response=api_choose_replay_dir_response,
            control_start_response=control_start_response,
            api_control_start_response=api_control_start_response,
            control_stop_response=control_stop_response,
            api_control_stop_response=api_control_stop_response,
        ),
        session_deps=SessionRouteDeps(
            session_data_response=session_data_response,
        ),
        clips_deps=ClipsRouteDeps(
            clip_days_response=clip_days_response,
            clips_by_day_response=clips_by_day_response,
            clip_lookup_response=clip_lookup_response,
            clip_range_response=clip_range_response,
            clip_name_response=clip_name_response,
            clips_response=clips_response,
        ),
        vods_deps=VodsRouteDeps(
            vods_response=vods_response,
            vod_single_response=vod_single_response,
            delete_vod_response=delete_vod_response,
            vods_stream_response=vods_stream_response,
        ),
        vod_scan_deps=VodScanRouteDeps(
            vod_ocr_run_response=vod_ocr_run_response,
            stop_vod_ocr_response=stop_vod_ocr_response,
            pause_vod_ocr_response=pause_vod_ocr_response,
            resume_vod_ocr_response=resume_vod_ocr_response,
            delete_sessions_response=delete_sessions_response,
        ),
        vod_actions_deps=VodActionsRouteDeps(
            vod_ocr_upload_redirect_response=vod_ocr_upload,
            api_vod_ocr_upload_response=api_vod_ocr_upload,
            split_selected_response=split_selected,
            api_split_selected_response=api_split_selected,
            vod_ocr_run_redirect_response=vod_ocr_run,
        ),
        vod_thumbnail_deps=VodThumbnailRouteDeps(
            vod_thumbnail_response=vod_thumbnail_response,
        ),
        spa_deps=SpaRouteDeps(
            react_logo_response=react_logo,
            react_app_response=react_app,
        ),
    )
    return app

_process_lock = threading.Lock()
_bookmark_process: Optional[subprocess.Popen] = None
_vod_ocr_processes: Dict[str, subprocess.Popen] = {}
_selected_vod: Optional[Path] = None
_selected_session: Optional[Path] = None

# Initialize VOD downloader (will be set after config is loaded)
_vod_downloader: Optional[TwitchVODDownloader] = None


def cleanup_on_exit() -> None:
    cleanup_vod_scans_on_exit(load_config, _process_lock, _vod_ocr_processes)


# Register cleanup handlers
atexit.register(cleanup_on_exit)


def load_config() -> Dict[str, Any]:
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def save_config(data: Dict[str, Any]) -> None:
    CONFIG_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


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
            shell=False,
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


def clip_days_response() -> Any:
    config = load_config()
    return jsonify({"days": clip_days_payload(config)})


def clips_by_day_response() -> Any:
    config = load_config()
    day_value = request.args.get("date", "unknown")
    limit_arg = request.args.get("limit")
    offset_arg = request.args.get("offset")
    payload = clips_by_day_payload(config, day_value, limit_arg, offset_arg)
    return jsonify(payload)


def clip_lookup_response() -> Any:
    config = load_config()
    path_value = request.args.get("path", "")
    payload, status_code = clip_lookup_payload(config, path_value)
    return jsonify(payload), status_code


def media_by_path_response() -> Any:
    config = load_config()
    allowed_dirs = get_allowed_media_dirs(config)
    file_path = resolve_existing_allowed_path(request.args.get("path", ""), allowed_dirs)
    if file_path is None:
        abort(404)
    return send_file(file_path)


def download_by_path_response() -> Any:
    config = load_config()
    allowed_dirs = get_allowed_media_dirs(config)
    file_path = resolve_existing_allowed_path(request.args.get("path", ""), allowed_dirs)
    if file_path is None:
        abort(404)
    display_name = get_clip_title(file_path)
    download_name = build_download_name(display_name, file_path)
    try:
        return send_file(file_path, as_attachment=True, download_name=download_name)
    except TypeError:
        return send_file(file_path, as_attachment=True, attachment_filename=download_name)


def open_folder_by_path_response() -> Any:
    config = load_config()
    allowed_dirs = get_allowed_media_dirs(config)
    file_path = resolve_existing_allowed_path(request.args.get("path", ""), allowed_dirs)
    if file_path is None:
        abort(404)
    reveal_file_in_explorer(file_path)
    return jsonify({"ok": True})


def vod_ocr_upload() -> str:
    file = request.files.get("vod_file")
    if file is None or not file.filename:
        return redirect("/")

    config = load_config()
    dest_path = save_uploaded_vod_file(file, config)
    start_vod_scan_for_path(CONFIG_PATH, dest_path)
    return redirect("/vods")


def api_vod_ocr_upload() -> Any:
    file = request.files.get("vod_file")
    if file is None or not file.filename:
        return jsonify({"ok": False, "error": "Missing file"}), 400

    config = load_config()
    dest_path = save_uploaded_vod_file(file, config)
    start_vod_scan_for_path(CONFIG_PATH, dest_path)
    return jsonify({"ok": True, "path": str(dest_path), "name": dest_path.name})


def delete_by_path_response() -> Any:
    config = load_config()
    allowed_dirs = get_allowed_media_dirs(config)
    file_path = resolve_existing_allowed_path(request.args.get("path", ""), allowed_dirs)
    if file_path is None:
        abort(404)
    file_path.unlink(missing_ok=True)
    set_clip_title(file_path, "")
    return jsonify({"ok": True})


def capture_area_save_response() -> Any:
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


def media_file_response(filename: str) -> Any:
    config = load_config()
    clip_dirs = normalize_allowed_dirs([get_clips_dir(config)])
    file_path = resolve_existing_allowed_child_path(filename, clip_dirs)
    if file_path is None:
        abort(404)
    return send_file(file_path)


def vod_media_file_response(filename: str) -> Any:
    config = load_config()
    allowed_dirs = normalize_allowed_dirs([p for p in get_vod_dirs(config) if p])
    file_path = resolve_vod_media_filename(filename, allowed_dirs)
    if file_path is None or not file_path.exists():
        abort(404)
    return send_file(file_path)


def resolve_vod_path(vod_path: str) -> Optional[Path]:
    if not vod_path:
        return None
    config = load_config()
    allowed_dirs = normalize_allowed_dirs([p for p in get_vod_dirs(config) if p])
    return resolve_allowed_path(vod_path, allowed_dirs)


def vod_thumbnail_response() -> Any:
    vod_path = request.args.get("path", "")
    time_str = request.args.get("t", "")
    try:
        seconds = max(0.0, float(time_str))
    except (TypeError, ValueError):
        abort(404)

    file_path = resolve_vod_path(vod_path)
    if file_path is None or not file_path.exists():
        abort(404)

    try:
        thumb_path = ensure_vod_thumbnail(file_path, seconds)
    except Exception as exc:
        logging.error("Failed to generate VOD thumbnail: %s", exc)
        abort(404)

    return send_file(thumb_path)


def download_file_response(filename: str) -> Any:
    config = load_config()
    clip_dirs = normalize_allowed_dirs([get_clips_dir(config)])
    file_path = resolve_existing_allowed_child_path(filename, clip_dirs)
    if file_path is None:
        abort(404)
    display_name = get_clip_title(file_path)
    download_name = build_download_name(display_name, file_path)
    try:
        return send_file(file_path, as_attachment=True, download_name=download_name)
    except TypeError:
        return send_file(file_path, as_attachment=True, attachment_filename=download_name)


def open_folder_response(filename: str) -> Any:
    config = load_config()
    clip_dirs = normalize_allowed_dirs([get_clips_dir(config)])
    file_path = resolve_existing_allowed_child_path(filename, clip_dirs)
    if file_path is None:
        abort(404)
    reveal_file_in_explorer(file_path)
    return redirect("/clips")


def delete_file_response(filename: str) -> Any:
    config = load_config()
    clip_dirs = normalize_allowed_dirs([get_clips_dir(config)])
    file_path = resolve_existing_allowed_child_path(filename, clip_dirs)
    if file_path is None:
        abort(404)
    file_path.unlink(missing_ok=True)
    set_clip_title(file_path, "")
    return jsonify({"ok": True})


def update_config_response() -> str:
    config = load_config()
    payload = request.form.to_dict()
    update_config_from_payload(config, payload)
    save_config(config)
    return redirect("/")


def choose_replay_dir_response() -> str:
    config = load_config()
    choose_and_save_replay_dir(config, choose_directory, save_config)
    return redirect("/")


def api_choose_replay_dir_response() -> Any:
    config = load_config()
    selected = choose_and_save_replay_dir(config, choose_directory, save_config)
    return jsonify({"ok": True, "directory": selected or ""})


def split_selected() -> str:
    vod_path = request.form.get("vod_path", "")
    session_path = request.form.get("session_path", "")
    if not vod_path or not session_path:
        if request.headers.get("X-Requested-With") == "fetch":
            return jsonify({"ok": False, "error": "Missing VOD or session"}), 400
        return redirect("/vods")

    config = load_config()
    resolved_vod_path = resolve_vod_path(vod_path)
    if resolved_vod_path is None:
        if request.headers.get("X-Requested-With") == "fetch":
            return jsonify({"ok": False, "error": "Invalid VOD path"}), 403
        return redirect("/vods")
    if not resolved_vod_path.exists() or not resolved_vod_path.is_file():  # lgtm [py/path-injection] resolved_vod_path is allowlisted by resolve_vod_path before filesystem checks.
        if request.headers.get("X-Requested-With") == "fetch":
            return jsonify({"ok": False, "error": "VOD not found"}), 404
        return redirect("/vods")

    bookmarks_dir, _ = resolve_bookmarks_context(config)
    resolved_session_path = resolve_existing_allowed_path(session_path, normalize_allowed_dirs([bookmarks_dir]))
    if resolved_session_path is None:
        if request.headers.get("X-Requested-With") == "fetch":
            return jsonify({"ok": False, "error": "Invalid session path"}), 403
        return redirect("/vods")

    split_from_config(
        CONFIG_PATH,
        bookmarks_override=resolved_session_path,
        input_override=resolved_vod_path,
    )
    if request.headers.get("X-Requested-With") == "fetch":
        return jsonify({"ok": True, "redirect": "/clips"})
    return redirect("/clips")


def api_split_selected() -> Any:
    payload = request.get_json(silent=True) or {}
    vod_path = payload.get("vod_path", "")
    session_path = payload.get("session_path", "")
    if not vod_path or not session_path:
        return jsonify({"ok": False, "error": "Missing VOD or session"}), 400

    config = load_config()
    resolved_vod_path = resolve_vod_path(vod_path)
    if resolved_vod_path is None:
        return jsonify({"ok": False, "error": "Invalid VOD path"}), 403
    if not resolved_vod_path.exists() or not resolved_vod_path.is_file():  # lgtm [py/path-injection] resolved_vod_path is allowlisted by resolve_vod_path before filesystem checks.
        return jsonify({"ok": False, "error": "VOD not found"}), 404

    bookmarks_dir, _ = resolve_bookmarks_context(config)
    resolved_session_path = resolve_existing_allowed_path(session_path, normalize_allowed_dirs([bookmarks_dir]))
    if resolved_session_path is None:
        return jsonify({"ok": False, "error": "Invalid session path"}), 403

    split_from_config(
        CONFIG_PATH,
        bookmarks_override=resolved_session_path,
        input_override=resolved_vod_path,
    )
    return jsonify({"ok": True})


def vod_ocr_run() -> str:
    vod_path = request.form.get("vod_path", "")
    if not vod_path:
        return redirect("/vods")

    resolved_vod_path = resolve_vod_path(vod_path)
    if resolved_vod_path is None or not resolved_vod_path.exists() or not resolved_vod_path.is_file():  # lgtm [py/path-injection] resolve_vod_path enforces allowlisted directories before this check.
        return redirect("/vods")

    config = load_config()
    launch_vod_scan_process(CONFIG_PATH, config, str(resolved_vod_path))
    return redirect("/vods")


def vod_ocr_run_response() -> Any:
    global _vod_ocr_processes
    payload = request.get_json(silent=True) or {}
    vod_path = payload.get("vod_path", "")
    if not vod_path:
        return jsonify({"ok": False, "error": "Missing VOD"}), 400

    resolved_vod_path = resolve_vod_path(vod_path)
    if resolved_vod_path is None:
        return jsonify({"ok": False, "error": "Invalid VOD path"}), 403
    if not resolved_vod_path.exists() or not resolved_vod_path.is_file():  # lgtm [py/path-injection] resolved_vod_path is allowlisted by resolve_vod_path before filesystem checks.
        return jsonify({"ok": False, "error": "VOD not found"}), 404

    config = load_config()
    vod_key = str(resolved_vod_path)
    with _process_lock:
        proc = launch_vod_scan_process(CONFIG_PATH, config, vod_key)
        _vod_ocr_processes[vod_key] = proc
    return jsonify({"ok": True})


def stop_vod_ocr_response() -> Any:
    global _vod_ocr_processes
    payload = request.get_json(silent=True) or {}
    vod_path = payload.get("vod_path", "")
    if not vod_path:
        return jsonify({"ok": False, "error": "Missing VOD"}), 400

    resolved_vod_path = resolve_vod_path(vod_path)
    if resolved_vod_path is None:
        return jsonify({"ok": False, "error": "Invalid VOD path"}), 403
    if not resolved_vod_path.exists() or not resolved_vod_path.is_file():  # lgtm [py/path-injection] resolved_vod_path is allowlisted by resolve_vod_path before filesystem checks.
        return jsonify({"ok": False, "error": "VOD not found"}), 404

    vod_key = str(resolved_vod_path)
    try:
        with _process_lock:
            proc = _vod_ocr_processes.get(vod_key)
            if proc is not None:
                terminate_process(proc, timeout_seconds=5)
                # Remove from tracking dict
                if vod_key in _vod_ocr_processes:
                    del _vod_ocr_processes[vod_key]
        
        # Clean up the .scanning and .paused marker files
        config = load_config()
        bookmarks_dir, session_prefix = resolve_bookmarks_context(config)
        scanning_marker, paused_marker = get_scan_marker_paths(bookmarks_dir, session_prefix, vod_key)
        if scanning_marker.exists():
            scanning_marker.unlink()
        if paused_marker.exists():
            paused_marker.unlink()
        
        return jsonify({"ok": True})
    except Exception as exc:
        logging.error("Failed to stop VOD OCR: %s", exc)
        return jsonify({"ok": False, "error": "Failed to stop VOD OCR"}), 500


def pause_vod_ocr_response() -> Any:
    """Pause an ongoing VOD scan by creating a .paused marker file"""
    payload = request.get_json(silent=True) or {}
    vod_path = payload.get("vod_path", "")
    if not vod_path:
        return jsonify({"ok": False, "error": "Missing VOD"}), 400

    resolved_vod_path = resolve_vod_path(vod_path)
    if resolved_vod_path is None:
        return jsonify({"ok": False, "error": "Invalid VOD path"}), 403
    if not resolved_vod_path.exists() or not resolved_vod_path.is_file():  # lgtm [py/path-injection] resolved_vod_path is allowlisted by resolve_vod_path before filesystem checks.
        return jsonify({"ok": False, "error": "VOD not found"}), 404

    vod_key = str(resolved_vod_path)
    try:
        config = load_config()
        bookmarks_dir, session_prefix = resolve_bookmarks_context(config)
        _, paused_marker = get_scan_marker_paths(bookmarks_dir, session_prefix, vod_key)
        
        # Create the paused marker - the scanning process will detect it and save state
        paused_marker.write_text(json.dumps({"paused": True}), encoding="utf-8")
        
        return jsonify({"ok": True})
    except Exception as exc:
        logging.error("Failed to pause VOD OCR: %s", exc)
        return jsonify({"ok": False, "error": "Failed to pause VOD OCR"}), 500


def resume_vod_ocr_response() -> Any:
    """Resume a paused VOD scan"""
    global _vod_ocr_processes
    payload = request.get_json(silent=True) or {}
    vod_path = payload.get("vod_path", "")
    if not vod_path:
        return jsonify({"ok": False, "error": "Missing VOD"}), 400

    resolved_vod_path = resolve_vod_path(vod_path)
    if resolved_vod_path is None:
        return jsonify({"ok": False, "error": "Invalid VOD path"}), 403
    if not resolved_vod_path.exists() or not resolved_vod_path.is_file():  # lgtm [py/path-injection] resolved_vod_path is allowlisted by resolve_vod_path before filesystem checks.
        return jsonify({"ok": False, "error": "VOD not found"}), 404

    vod_key = str(resolved_vod_path)
    try:
        config = load_config()
        bookmarks_dir, session_prefix = resolve_bookmarks_context(config)
        _, paused_marker = get_scan_marker_paths(bookmarks_dir, session_prefix, vod_key)
        
        if not paused_marker.exists():
            return jsonify({"ok": False, "error": "No paused scan found"}), 400
        
        with _process_lock:
            proc = launch_vod_scan_process(CONFIG_PATH, config, vod_key, resume=True)
            _vod_ocr_processes[vod_key] = proc
        
        return jsonify({"ok": True})
    except Exception as exc:
        logging.error("Failed to resume VOD OCR: %s", exc)
        return jsonify({"ok": False, "error": "Failed to resume VOD OCR"}), 500


def delete_sessions_response() -> Any:
    payload = request.get_json(silent=True) or {}
    vod_path = payload.get("vod_path", "")
    if not vod_path:
        return jsonify({"ok": False, "error": "Missing VOD"}), 400

    resolved_vod_path = resolve_vod_path(vod_path)
    if resolved_vod_path is None:
        return jsonify({"ok": False, "error": "Invalid VOD path"}), 403
    if not resolved_vod_path.exists() or not resolved_vod_path.is_file():  # lgtm [py/path-injection] resolved_vod_path is allowlisted by resolve_vod_path before filesystem checks.
        return jsonify({"ok": False, "error": "VOD not found"}), 404

    vod_key = str(resolved_vod_path)
    try:
        config = load_config()
        bookmarks_dir, session_prefix = resolve_bookmarks_context(config)
        files = list_vod_session_files(bookmarks_dir, session_prefix, vod_key)
        for file in files:
            file.unlink()
        return jsonify({"ok": True})
    except Exception as exc:
        logging.error("Failed to delete VOD sessions: %s", exc)
        return jsonify({"ok": False, "error": "Failed to delete VOD sessions"}), 500


def control_start_response() -> str:
    start_bookmark_process()
    return redirect("/")


def api_control_start_response() -> Any:
    start_bookmark_process()
    return jsonify({"ok": True})


def control_stop_response() -> str:
    stop_bookmark_process()
    return redirect("/")


def api_control_stop_response() -> Any:
    stop_bookmark_process()
    return jsonify({"ok": True})


def ocr_gpu_status_response() -> Any:
    return jsonify(ocr_gpu_status_payload())


def ocr_gpu_diagnostics_response() -> Any:
    return jsonify(ocr_gpu_diagnostics_payload())


def install_gpu_ocr_response() -> Any:
    payload, status_code = install_gpu_ocr_dependencies()
    return jsonify(payload), status_code


def overlay_upload_response() -> Any:
    file = request.files.get("overlay_image")
    if file is None or not file.filename:
        return jsonify({"ok": False, "error": "Missing file"}), 400
    ext = Path(file.filename).suffix.lower()
    if ext not in {".png", ".jpg", ".jpeg", ".gif", ".webp"}:
        return jsonify({"ok": False, "error": "Unsupported image format. Use PNG, JPG, GIF, or WebP."}), 400
    overlay_dir = get_app_data_dir() / "overlay"
    overlay_dir.mkdir(parents=True, exist_ok=True)
    dest = overlay_dir / f"overlay{ext}"
    file.save(str(dest))
    config = load_config()
    config.setdefault("ui", {})["overlay_image_path"] = str(dest)
    save_config(config)
    return jsonify({"ok": True, "url": "/api/overlay/image"})


def overlay_image_response() -> Any:
    config = load_config()
    image_path = config.get("ui", {}).get("overlay_image_path", "")
    overlay_dir = get_app_data_dir() / "overlay"
    file_path = resolve_existing_allowed_path(image_path, [overlay_dir])
    if file_path is None:
        return jsonify({"ok": False, "error": "Overlay image not found"}), 404
    return send_file(file_path)


def overlay_remove_response() -> Any:
    config = load_config()
    image_path = config.get("ui", {}).get("overlay_image_path", "")
    overlay_dir = get_app_data_dir() / "overlay"
    file_path = resolve_allowed_path(image_path, [overlay_dir])
    if file_path is not None:
        try:
            file_path.unlink(missing_ok=True)
        except Exception:
            pass
        config.setdefault("ui", {})["overlay_image_path"] = ""
        save_config(config)
    elif not image_path:
        # Config field was already empty — still a no-op success
        pass
    else:
        # Path existed in config but was outside the overlay directory — clear
        # the invalid config entry but do not touch the filesystem.
        config.setdefault("ui", {})["overlay_image_path"] = ""
        save_config(config)
    return jsonify({"ok": True})


def debug_paths_response() -> Any:
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


def vods_response() -> Any:
    config = load_config()
    bookmarks_dir, session_prefix = resolve_bookmarks_context(config)
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


def vod_single_response() -> Any:
    path_value = request.args.get("path", "").strip()
    if not path_value:
        return jsonify({"ok": False, "error": "Missing path"}), 400
    file_path = resolve_vod_path(path_value)
    if file_path is None or not file_path.exists():
        return jsonify({"ok": False, "error": "VOD not found"}), 404
    config = load_config()
    bookmarks_dir, session_prefix = resolve_bookmarks_context(config)
    entries = build_vod_entries([file_path], bookmarks_dir, session_prefix)
    if not entries:
        return jsonify({"ok": False, "error": "Could not build VOD entry"}), 500
    return jsonify({"ok": True, "vod": entries[0]})


def delete_vod_response() -> Any:
    payload = request.get_json(silent=True) or {}
    vod_path = str(payload.get("path", "")).strip()
    if not vod_path:
        return jsonify({"ok": False, "error": "Missing VOD path"}), 400

    file_path = resolve_vod_path(vod_path)
    if file_path is None or not file_path.exists():
        return jsonify({"ok": False, "error": "VOD not found"}), 404

    try:
        config = load_config()
        bookmarks_dir, session_prefix = resolve_bookmarks_context(config)
        safe_stem = get_safe_vod_stem(file_path.stem)
        for file in list_vod_session_files(bookmarks_dir, session_prefix, file_path.stem):
            file.unlink(missing_ok=True)
        scanning_marker, paused_marker = get_scan_marker_paths(bookmarks_dir, session_prefix, file_path.stem)
        scanning_marker.unlink(missing_ok=True)
        paused_marker.unlink(missing_ok=True)

        file_path.unlink(missing_ok=True)
        thumbs_dir = get_app_data_dir() / "thumbnails"
        for thumb in thumbs_dir.glob(f"{safe_stem}_t*.jpg"):
            thumb.unlink(missing_ok=True)
        return jsonify({"ok": True})
    except Exception as exc:
        logging.error("Failed to delete VOD and session artifacts: %s", exc)
        return jsonify({"ok": False, "error": "Failed to delete VOD"}), 500


def vods_stream_response() -> Response:
    def event_stream() -> Any:
        while True:
            config = load_config()
            bookmarks_dir, session_prefix = resolve_bookmarks_context(config)
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


def twitch_imports_response() -> Any:
    limit_arg = request.args.get("limit")
    try:
        limit = int(limit_arg) if limit_arg else 20
    except ValueError:
        limit = 20
    return jsonify({"jobs": list_twitch_jobs(limit=limit)})


def twitch_import_start_response() -> Any:
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


def twitch_import_status_response(job_id: str) -> Any:
    job = read_twitch_job(job_id)
    if not job:
        return jsonify({"ok": False, "error": "Job not found"}), 404
    return jsonify({"ok": True, "job": job})


def session_data_response() -> Any:
    session_path = request.args.get("path", "")
    config = load_config()
    payload, status_code = session_data_payload(session_path, config)
    return jsonify(payload), status_code


def clip_range_response() -> Any:
    payload = request.get_json(silent=True) or {}
    config = load_config()
    response_payload, status_code = create_clip_range_payload(
        config,
        payload.get("vod_path", ""),
        payload.get("start"),
        payload.get("end"),
    )
    return jsonify(response_payload), status_code


def clip_name_response() -> Any:
    payload = request.get_json(silent=True) or {}
    path_value = str(payload.get("path", "")).strip()
    if not path_value:
        return jsonify({"ok": False, "error": "Missing clip path"}), 400
    config = load_config()
    allowed_dirs = get_allowed_media_dirs(config)
    file_path = resolve_existing_allowed_path(path_value, allowed_dirs)
    if file_path is None:
        return jsonify({"ok": False, "error": "Clip not found"}), 404

    name_value = str(payload.get("name", ""))
    display_name = set_clip_title(file_path, name_value)
    return jsonify({"ok": True, "display_name": display_name})


def clips_response() -> Any:
    config = load_config()
    limit_arg = request.args.get("limit")
    try:
        limit = int(limit_arg) if limit_arg else 20
    except ValueError:
        limit = 20
    clips = list_clips(config, limit=limit)
    serialized = [serialize_clip(clip) for clip in clips]
    return jsonify({"clips": serialized})


def logs_response() -> Any:
    limit_arg = request.args.get("lines")
    try:
        limit = int(limit_arg) if limit_arg else 200
    except ValueError:
        limit = 200
    config = load_config()
    log_path = get_backend_log_path(config, CONFIG_PATH)
    return jsonify({"lines": tail_lines(log_path, max_lines=limit)})


def open_backend_log_response() -> Any:
    config = load_config()
    log_path = get_backend_log_path(config, CONFIG_PATH)
    if not log_path.exists():
        return jsonify({"ok": False, "error": "Log file not found"}), 404
    try:
        open_backend_log(log_path)
    except Exception:
        return jsonify({"ok": False, "error": "Failed to open log"}), 500
    return jsonify({"ok": True})


def react_logo() -> Any:
    logo_file = REACT_DIST / "logo.png"
    if not logo_file.exists() or not logo_file.is_file():
        abort(404)
    response = send_from_directory(REACT_DIST, "logo.png", conditional=False, etag=False, max_age=0)
    return set_no_cache_headers(
        response,
        cache_control="no-store, no-cache, must-revalidate, max-age=0",
        include_pragma=True,
    )


# ==================== Twitch VOD Download Routes ====================

def vod_download_start_response() -> Any:
    try:
        payload, status_code = vod_download_start_payload(
            _vod_downloader,
            request.get_json(silent=True),
        )
        return jsonify(payload), status_code
    except Exception as exc:
        logging.error("Unhandled error while starting VOD download: %s", exc)
        return jsonify({"error": "Failed to start VOD download"}), 500


def vod_download_progress_response(job_id: str) -> Any:
    payload, status_code = vod_download_progress_payload(_vod_downloader, job_id)
    return jsonify(payload), status_code


def vod_check_tools_response() -> Any:
    payload, status_code = vod_download_tools_payload(_vod_downloader)
    return jsonify(payload), status_code


# =====================================================================

def react_app(path: str = "") -> Any:
    if not REACT_DIST.exists():
        return "React build not found. Run `npm run build` in frontend.", 404
    target = REACT_DIST / path
    if path and target.exists() and target.is_file():
        response = send_from_directory(REACT_DIST, path)
        return set_no_cache_headers(response)
    response = send_from_directory(REACT_DIST, "index.html")
    return set_no_cache_headers(response)


create_app()


def main() -> None:
    global _vod_downloader

    register_signal_handlers(cleanup_on_exit)

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
            args=(watch_paths, EXIT_RESTART_CODE),
            kwargs={"ignore_paths": ignore_paths},
            daemon=True,
        )
        watcher.start()
    
    print(f"Web UI ready at http://127.0.0.1:{port}")
    create_app().run(host="127.0.0.1", port=port, debug=False)


if __name__ == "__main__":
    main()
