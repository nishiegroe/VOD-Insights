"""
Twitch VOD Download Manager
Handles downloading Twitch VODs using yt-dlp with progress tracking

Created: 2026-02-26
"""

import json
import logging
import subprocess
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from app.runtime_paths import resolve_tool
from app.vod.download_utils import (
    parse_ffmpeg_progress,
    parse_progress_template,
    sanitize_filename,
    validate_twitch_vod_url,
)

logger = logging.getLogger(__name__)


class TwitchVODDownloader:
    """Download Twitch VODs using yt-dlp with progress tracking."""

    def __init__(self, output_dir: Path):
        self.output_dir = Path(output_dir)
        self.jobs: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def check_yt_dlp(self) -> bool:
        """Check if yt-dlp is installed and accessible."""
        yt_dlp_path = self._resolve_yt_dlp_path()
        if not yt_dlp_path:
            return False

        try:
            subprocess.run(
                [yt_dlp_path, "--version"],
                capture_output=True,
                check=True,
                timeout=5,
            )
            return True
        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
            return False

    @staticmethod
    def _resolve_yt_dlp_path() -> Optional[str]:
        return resolve_tool("yt-dlp", ["yt-dlp.exe"])

    def validate_url(self, url: str) -> bool:
        return validate_twitch_vod_url(url)

    def start_download(
        self,
        url: str,
        job_id: str,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> None:
        with self._lock:
            self.jobs[job_id] = {
                "status": "initializing",
                "url": url,
                "percentage": 0,
                "speed": "0 B/s",
                "eta": "unknown",
                "error": None,
                "output_file": None,
                "started_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

        thread = threading.Thread(
            target=self._download_worker,
            args=(job_id, url, progress_callback),
            daemon=True,
        )
        thread.start()

    def list_jobs(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self.jobs.items())

    def get_progress(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self.jobs.get(job_id)

    def _download_worker(
        self,
        job_id: str,
        url: str,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> None:
        try:
            if not self.check_yt_dlp():
                with self._lock:
                    self.jobs[job_id]["status"] = "error"
                    self.jobs[job_id]["error"] = (
                        "yt-dlp not installed. Install with: pip install yt-dlp"
                    )
                    self.jobs[job_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
                if progress_callback:
                    progress_callback(self.jobs[job_id])
                return

            with self._lock:
                self.jobs[job_id]["status"] = "fetching_metadata"
                self.jobs[job_id]["updated_at"] = datetime.now(timezone.utc).isoformat()

            metadata = self._get_metadata(url)
            if not metadata:
                with self._lock:
                    self.jobs[job_id]["status"] = "error"
                    self.jobs[job_id]["error"] = "Failed to fetch VOD metadata"
                    self.jobs[job_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
                if progress_callback:
                    progress_callback(self.jobs[job_id])
                return

            filename = self._get_filename(metadata)
            output_path = self.output_dir / filename
            self.output_dir.mkdir(parents=True, exist_ok=True)

            with self._lock:
                self.jobs[job_id]["status"] = "downloading"
                self.jobs[job_id]["output_file"] = str(output_path)
                self.jobs[job_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
                duration_value = metadata.get("duration_seconds")
                try:
                    if duration_value is not None:
                        self.jobs[job_id]["duration_seconds"] = float(duration_value)
                except (TypeError, ValueError):
                    pass

            self._download_vod(job_id, url, output_path, progress_callback)

        except Exception as exc:
            logger.exception(
                "Unhandled Twitch VOD download worker error: job_id=%s url=%s",
                job_id,
                url,
            )
            with self._lock:
                self.jobs[job_id]["status"] = "error"
                self.jobs[job_id]["error"] = str(exc)
                self.jobs[job_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
            if progress_callback:
                progress_callback(self.jobs[job_id])

    def _get_metadata(self, url: str) -> Optional[Dict[str, Any]]:
        yt_dlp_path = self._resolve_yt_dlp_path()
        if not yt_dlp_path:
            return None

        try:
            result = subprocess.run(
                [yt_dlp_path, "--dump-json", url],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode != 0:
                return None

            data = json.loads(result.stdout)
            uploader = data.get("uploader", "Unknown")
            upload_date = data.get("upload_date", "")

            if upload_date and len(upload_date) >= 8:
                date_str = f"{upload_date[0:4]}-{upload_date[4:6]}-{upload_date[6:8]}"
            else:
                date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

            return {
                "streamer": sanitize_filename(uploader),
                "date": date_str,
                "duration_seconds": data.get("duration"),
            }
        except Exception:
            return None

    def _get_filename(self, metadata: Dict[str, Any]) -> str:
        streamer = metadata.get("streamer", "unknown")
        date = metadata.get("date", "unknown")
        return f"{streamer}_{date}.mp4"

    def _download_vod(
        self,
        job_id: str,
        url: str,
        output_path: Path,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> None:
        try:
            last_output_line: Optional[str] = None
            yt_dlp_path = self._resolve_yt_dlp_path()
            if not yt_dlp_path:
                raise FileNotFoundError("yt-dlp is not available")

            cmd = [
                yt_dlp_path,
                "--no-warnings",
                "--newline",
                "--progress-template",
                "download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s",
                "-f",
                "best",
                "-o",
                str(output_path),
                url,
            ]

            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )

            assert process.stdout is not None
            for line in iter(process.stdout.readline, ""):
                print(f"[vod_download] yt-dlp: {line!r}", flush=True)
                stripped = line.strip()
                if stripped:
                    last_output_line = stripped
                self._parse_progress(job_id, line, progress_callback)

            process.wait()

            if process.returncode == 0 and output_path.exists():
                with self._lock:
                    self.jobs[job_id]["status"] = "completed"
                    self.jobs[job_id]["percentage"] = 100
                    self.jobs[job_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
                if progress_callback:
                    progress_callback(self.jobs[job_id])
                return

            err_message = f"Download failed (exit code: {process.returncode})"
            if last_output_line:
                err_message = f"{err_message}: {last_output_line[:300]}"
            logger.error(
                "Twitch VOD download failed: job_id=%s url=%s output=%s exit_code=%s last_line=%r",
                job_id,
                url,
                output_path,
                process.returncode,
                last_output_line,
            )
            with self._lock:
                self.jobs[job_id]["status"] = "error"
                self.jobs[job_id]["error"] = err_message
                self.jobs[job_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
            if progress_callback:
                progress_callback(self.jobs[job_id])

        except Exception as exc:
            logger.exception(
                "Unhandled Twitch VOD download error: job_id=%s url=%s output=%s",
                job_id,
                url,
                output_path,
            )
            with self._lock:
                self.jobs[job_id]["status"] = "error"
                self.jobs[job_id]["error"] = str(exc)
                self.jobs[job_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
            if progress_callback:
                progress_callback(self.jobs[job_id])

    def _parse_progress(
        self,
        job_id: str,
        output: str,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> None:
        parsed = parse_progress_template(output)
        if parsed:
            percentage, speed_str, eta_str = parsed
            print(
                f"[vod_download] parsed template: {percentage:.1f}% speed={speed_str!r} eta={eta_str!r}",
                flush=True,
            )
            with self._lock:
                self.jobs[job_id]["percentage"] = round(float(percentage), 1)
                if speed_str:
                    self.jobs[job_id]["speed"] = speed_str
                if eta_str:
                    self.jobs[job_id]["eta"] = eta_str
                self.jobs[job_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
            if progress_callback:
                progress_callback(self.jobs[job_id])
            return

        ffmpeg_parsed = parse_ffmpeg_progress(output)
        if not ffmpeg_parsed:
            return

        current_seconds, speed_multiplier, bitrate_kbits = ffmpeg_parsed
        with self._lock:
            job = self.jobs[job_id]
            duration_seconds = job.get("duration_seconds")

            if isinstance(duration_seconds, (int, float)) and duration_seconds > 0:
                pct = min(100.0, max(0.0, (current_seconds / float(duration_seconds)) * 100.0))
                job["percentage"] = round(pct, 1)

                if speed_multiplier and speed_multiplier > 0:
                    eta_seconds = max(0.0, (float(duration_seconds) - current_seconds) / speed_multiplier)
                    job["eta"] = self._format_eta(eta_seconds)

            if bitrate_kbits and bitrate_kbits > 0:
                job["speed"] = f"{bitrate_kbits / 8192.0:.2f} MiB/s"
            elif speed_multiplier and speed_multiplier > 0:
                job["speed"] = f"{speed_multiplier:.2f}x"
            job["updated_at"] = datetime.now(timezone.utc).isoformat()

        if progress_callback:
            progress_callback(self.jobs[job_id])

    @staticmethod
    def _format_eta(total_seconds: float) -> str:
        remaining = max(0, int(round(total_seconds)))
        hours = remaining // 3600
        minutes = (remaining % 3600) // 60
        seconds = remaining % 60
        if hours > 0:
            return f"{hours}:{minutes:02d}:{seconds:02d}"
        return f"{minutes:02d}m {seconds:02d}s"
