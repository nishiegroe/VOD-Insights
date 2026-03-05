from __future__ import annotations

import re
import subprocess
from pathlib import Path

from app.runtime_paths import build_mode_command, get_config_path, get_downloads_dir, get_project_root, resolve_tool
from app.twitch.jobs import read_twitch_job, write_twitch_job


CONFIG_PATH = get_config_path()
DOWNLOADS_DIR = get_downloads_dir()


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