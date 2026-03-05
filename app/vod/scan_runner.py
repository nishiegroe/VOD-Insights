from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any, Dict

from app.runtime_paths import build_mode_command, get_project_root, resolve_log_path


def launch_vod_scan_process(
    config_path: Path,
    config: Dict[str, Any],
    vod_path: str,
    *,
    resume: bool = False,
) -> subprocess.Popen:
    log_path = resolve_log_path(config_path, config.get("logging", {}).get("file", "app.log"))
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_handle = log_path.open("a", encoding="utf-8")
    extra_args = ["--vod", vod_path]
    if resume:
        extra_args.append("--resume")
    cmd = build_mode_command("vod", config_path, extra_args)
    action = "Resuming" if resume else "Starting"
    print(f"{action} VOD OCR: {cmd}")
    return subprocess.Popen(
        cmd,
        cwd=str(get_project_root()),
        stdout=log_handle,
        stderr=log_handle,
    )


def terminate_process(proc: subprocess.Popen, *, timeout_seconds: float = 5) -> None:
    if proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=timeout_seconds)
        except subprocess.TimeoutExpired:
            proc.kill()