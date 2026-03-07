from __future__ import annotations

import uuid
from typing import Any, Dict, Optional, Tuple

from app.vod.download import TwitchVODDownloader


def start_download_response(
    downloader: Optional[TwitchVODDownloader],
    data: Optional[Dict[str, Any]],
) -> Tuple[Dict[str, Any], int]:
    if not downloader:
        return {"error": "VOD downloader not initialized"}, 500

    if not data:
        return {"error": "No JSON data provided"}, 400

    url = str(data.get("url", "")).strip()
    if not url:
        return {"error": "URL is required"}, 400

    if not downloader.validate_url(url):
        return {
            "error": "Invalid Twitch VOD URL",
            "example": "https://twitch.tv/videos/123456789",
        }, 400

    if not downloader.check_yt_dlp():
        return {
            "error": "yt-dlp not installed",
            "install": "pip install yt-dlp",
        }, 400

    job_id = str(uuid.uuid4())
    downloader.start_download(url, job_id)
    return {
        "job_id": job_id,
        "status": "initializing",
        "message": "Download started. Check progress with /api/vod/progress/<job_id>",
    }, 202


def progress_response(
    downloader: Optional[TwitchVODDownloader],
    job_id: str,
) -> Tuple[Dict[str, Any], int]:
    if not downloader:
        return {"error": "VOD downloader not initialized"}, 500

    progress = downloader.get_progress(job_id)
    if not progress:
        return {"error": "Job not found"}, 404

    return progress, 200


def tools_check_response(
    downloader: Optional[TwitchVODDownloader],
) -> Tuple[Dict[str, Any], int]:
    if not downloader:
        return {"error": "VOD downloader not initialized"}, 500

    yt_dlp_ok = downloader.check_yt_dlp()
    return {
        "yt_dlp_installed": yt_dlp_ok,
        "message": "All tools ready" if yt_dlp_ok else "Install with: pip install yt-dlp",
    }, 200