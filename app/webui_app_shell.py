from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from threading import Lock
from typing import Any, Callable, Dict, Optional

from app.runtime_paths import get_project_root
from app.vod.scan_files import get_scan_marker_paths, resolve_bookmarks_context


def cleanup_vod_scans_on_exit(
    load_config: Callable[[], Dict[str, Any]],
    process_lock: Lock,
    vod_ocr_processes: Dict[str, subprocess.Popen],
) -> None:
    print("Cleaning up: pausing all active VOD scans...")
    try:
        config = load_config()
        bookmarks_dir, session_prefix = resolve_bookmarks_context(config)

        with process_lock:
            for vod_path in list(vod_ocr_processes.keys()):
                try:
                    _, paused_marker = get_scan_marker_paths(bookmarks_dir, session_prefix, vod_path)
                    paused_marker.write_text(json.dumps({"paused": True}), encoding="utf-8")
                    print(f"Paused scan for: {vod_path}")
                except Exception as exc:
                    print(f"Error pausing scan for {vod_path}: {exc}")
    except Exception as exc:
        print(f"Error during cleanup: {exc}")


def register_signal_handlers(cleanup_fn: Callable[[], None]) -> None:
    def _signal_handler(signum: int, frame: Any) -> None:
        print(f"Received signal {signum}, cleaning up...")
        cleanup_fn()
        sys.exit(0)

    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)


def watch_for_changes(
    paths: list[Path],
    exit_restart_code: int,
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
            os._exit(exit_restart_code)
        last_state = current


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
