"""
Twitch VOD Download Manager
Handles downloading Twitch VODs using yt-dlp with progress tracking

Created: 2026-02-26
"""

import subprocess
import json
import threading
import re
from pathlib import Path
from typing import Optional, Callable, Dict, Any
from datetime import datetime
import uuid
import shutil


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
            cmd = [
                "yt-dlp",
                "--no-warnings",
                "-f",
                "best",  # Best quality available
                "-o",
                str(output_path),
                url,
            ]

            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )

            # Monitor progress
            while process.poll() is None:
                # Poll for output to detect progress
                # yt-dlp outputs progress to stderr
                try:
                    _, stderr_data = process.communicate(timeout=1)
                    if stderr_data:
                        # Parse progress from stderr
                        self._parse_progress(job_id, stderr_data, progress_callback)
                except subprocess.TimeoutExpired:
                    pass

            # Final poll for any remaining output
            stdout_data, stderr_data = process.communicate()
            if stderr_data:
                self._parse_progress(job_id, stderr_data, progress_callback)

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
        Parse progress information from yt-dlp output

        Args:
            job_id: Job identifier
            output: Output from yt-dlp
            progress_callback: Optional progress callback
        """
        # yt-dlp outputs progress like:
        # [download]   1.5% of 2.50GiB at  1.50MiB/s ETA 00:27:35
        pattern = r"\[download\]\s+([\d.]+)%\s+of\s+([\d.]+\w+)\s+at\s+([\d.]+\w+/s)\s+ETA\s+([\d:]+)"
        match = re.search(pattern, output)

        if match:
            percentage = float(match.group(1))
            speed = match.group(3)
            eta = match.group(4)

            with self._lock:
                self.jobs[job_id]["percentage"] = int(percentage)
                self.jobs[job_id]["speed"] = speed
                self.jobs[job_id]["eta"] = eta

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
