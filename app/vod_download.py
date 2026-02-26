"""
Twitch VOD Download Manager
Handles downloading Twitch VODs using yt-dlp with progress tracking

Created: 2026-02-26
"""

import subprocess
import json
import logging
import threading
import re
from pathlib import Path
from typing import Optional, Callable, Dict, Any, List
from datetime import datetime
import uuid
import shutil

logger = logging.getLogger(__name__)


class TwitchVODDownloader:
    """Download Twitch VODs using yt-dlp with progress tracking"""

    def __init__(self, output_dir: Path):
        """
        Initialize the downloader

        Args:
            output_dir: Directory where VODs will be saved
        """
        self.output_dir = Path(output_dir)
        self.jobs: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def check_yt_dlp(self) -> bool:
        """Check if yt-dlp is installed and accessible"""
        try:
            subprocess.run(
                ["yt-dlp", "--version"],
                capture_output=True,
                check=True,
                timeout=5,
            )
            return True
        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
            return False

    def validate_url(self, url: str) -> bool:
        """
        Validate that the URL is a valid Twitch VOD URL

        Args:
            url: URL to validate

        Returns:
            True if valid Twitch VOD URL, False otherwise
        """
        if not url:
            return False

        # Match patterns like:
        # https://twitch.tv/videos/123456789
        # https://www.twitch.tv/videos/123456789
        pattern = r"https?:\/\/(www\.)?twitch\.tv\/videos\/\d+"
        return bool(re.match(pattern, url))

    def start_download(
        self,
        url: str,
        job_id: str,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> None:
        """
        Start a background download job

        Args:
            url: Twitch VOD URL
            job_id: Unique job identifier
            progress_callback: Optional callback for progress updates
        """
        with self._lock:
            self.jobs[job_id] = {
                "status": "initializing",
                "url": url,
                "percentage": 0,
                "speed": "0 B/s",
                "eta": "unknown",
                "error": None,
                "output_file": None,
                "started_at": datetime.utcnow().isoformat(),
            }

        # Start download in background thread
        thread = threading.Thread(
            target=self._download_worker,
            args=(job_id, url, progress_callback),
            daemon=True,
        )
        thread.start()

    def list_jobs(self) -> List[Dict[str, Any]]:
        """Return a snapshot of all jobs, thread-safely."""
        with self._lock:
            return list(self.jobs.items())

    def get_progress(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the current progress of a download job

        Args:
            job_id: Job identifier

        Returns:
            Job progress dict or None if job not found
        """
        with self._lock:
            return self.jobs.get(job_id)

    def _download_worker(
        self,
        job_id: str,
        url: str,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> None:
        """
        Worker thread for downloading VOD

        Args:
            job_id: Job identifier
            url: Twitch VOD URL
            progress_callback: Optional progress callback
        """
        try:
            # Validate yt-dlp is installed
            if not self.check_yt_dlp():
                with self._lock:
                    self.jobs[job_id]["status"] = "error"
                    self.jobs[job_id]["error"] = (
                        "yt-dlp not installed. Install with: pip install yt-dlp"
                    )
                if progress_callback:
                    progress_callback(self.jobs[job_id])
                return

            # Get VOD metadata
            with self._lock:
                self.jobs[job_id]["status"] = "fetching_metadata"
            metadata = self._get_metadata(url)
            if not metadata:
                with self._lock:
                    self.jobs[job_id]["status"] = "error"
                    self.jobs[job_id]["error"] = "Failed to fetch VOD metadata"
                if progress_callback:
                    progress_callback(self.jobs[job_id])
                return

            # Generate filename
            filename = self._get_filename(metadata)
            output_path = self.output_dir / filename

            # Ensure output directory exists
            self.output_dir.mkdir(parents=True, exist_ok=True)

            # Start download
            with self._lock:
                self.jobs[job_id]["status"] = "downloading"
                self.jobs[job_id]["output_file"] = str(output_path)

            self._download_vod(job_id, url, output_path, progress_callback)

        except Exception as e:
            with self._lock:
                self.jobs[job_id]["status"] = "error"
                self.jobs[job_id]["error"] = str(e)
            if progress_callback:
                progress_callback(self.jobs[job_id])

    def _get_metadata(self, url: str) -> Optional[Dict[str, str]]:
        """
        Extract metadata from Twitch VOD

        Args:
            url: Twitch VOD URL

        Returns:
            Dict with 'streamer' and 'date' keys, or None on error
        """
        try:
            result = subprocess.run(
                [
                    "yt-dlp",
                    "--dump-json",
                    url,
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode != 0:
                return None

            data = json.loads(result.stdout)

            # Extract streamer name (uploader) and upload date
            uploader = data.get("uploader", "Unknown")
            upload_date = data.get("upload_date", "")

            # Format date as YYYY-MM-DD
            if upload_date and len(upload_date) >= 8:
                date_str = f"{upload_date[0:4]}-{upload_date[4:6]}-{upload_date[6:8]}"
            else:
                date_str = datetime.utcnow().strftime("%Y-%m-%d")

            return {
                "streamer": self._sanitize_filename(uploader),
                "date": date_str,
            }
        except Exception:
            return None

    def _get_filename(self, metadata: Dict[str, str]) -> str:
        """
        Generate output filename from metadata

        Args:
            metadata: Dict with 'streamer' and 'date' keys

        Returns:
            Filename in format [streamer]_[date].mp4
        """
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
        """
        Execute yt-dlp download with progress tracking

        Args:
            job_id: Job identifier
            url: Twitch VOD URL
            output_path: Where to save the file
            progress_callback: Optional progress callback
        """
        try:
            # Build yt-dlp command
            # --progress-template gives structured output instead of human-readable bar
            # (Twitch uses HLS so the normal bar includes "~" for estimated size,
            #  which makes ad-hoc regex matching unreliable)
            cmd = [
                "yt-dlp",
                "--no-warnings",
                "--newline",
                "--progress-template",
                "download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s",
                "-f",
                "best",  # Best quality available
                "-o",
                str(output_path),
                url,
            ]

            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,  # Merge stderr into stdout
                text=True,
                bufsize=1,  # Line-buffered for real-time output
            )

            # Read output line by line for real-time progress updates.
            # Use iter(readline, '') instead of 'for line in stdout' to avoid
            # Python's internal read-ahead buffering on Windows.
            for line in iter(process.stdout.readline, ''):
                print(f"[vod_download] yt-dlp: {line!r}", flush=True)
                self._parse_progress(job_id, line, progress_callback)

            process.wait()

            # Check if download succeeded
            if process.returncode == 0 and output_path.exists():
                with self._lock:
                    self.jobs[job_id]["status"] = "completed"
                    self.jobs[job_id]["percentage"] = 100
                if progress_callback:
                    progress_callback(self.jobs[job_id])
            else:
                with self._lock:
                    self.jobs[job_id]["status"] = "error"
                    self.jobs[job_id]["error"] = f"Download failed (exit code: {process.returncode})"
                if progress_callback:
                    progress_callback(self.jobs[job_id])

        except Exception as e:
            with self._lock:
                self.jobs[job_id]["status"] = "error"
                self.jobs[job_id]["error"] = str(e)
            if progress_callback:
                progress_callback(self.jobs[job_id])

    def _parse_progress(
        self,
        job_id: str,
        output: str,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> None:
        """
        Parse progress information from yt-dlp --progress-template output.

        Expected line format:
            download:  1.5%|  1.50MiB/s|00:27:35

        Args:
            job_id: Job identifier
            output: One line of output from yt-dlp
            progress_callback: Optional progress callback
        """
        # yt-dlp outputs the template content only (no "download:" prefix —
        # that part is the type selector, not literal text).
        # Line format: "  84.7%|  30.37MiB/s|00:01"
        template_re = re.compile(r"^\s*([\d.]+)%\s*\|(.*?)\|(.*?)\s*$")

        match = template_re.search(output)
        if not match:
            return

        percentage = min(100.0, float(match.group(1)))
        speed_str = match.group(2).strip()
        eta_str = match.group(3).strip()

        print(f"[vod_download] parsed: {percentage:.1f}% speed={speed_str!r} eta={eta_str!r}", flush=True)
        with self._lock:
            self.jobs[job_id]["percentage"] = int(percentage)
            if speed_str:
                self.jobs[job_id]["speed"] = speed_str
            if eta_str:
                self.jobs[job_id]["eta"] = eta_str

        if progress_callback:
            progress_callback(self.jobs[job_id])

    @staticmethod
    def _sanitize_filename(filename: str) -> str:
        """
        Sanitize a string to be safe as a filename

        Args:
            filename: Filename to sanitize

        Returns:
            Sanitized filename
        """
        # Remove or replace invalid filename characters
        invalid_chars = r'[<>:"/\\|?*]'
        sanitized = re.sub(invalid_chars, "_", filename)
        # Remove leading/trailing spaces and dots
        sanitized = sanitized.strip(". ")
        # Limit length
        return sanitized[:200]
