from __future__ import annotations

from typing import Any, Dict, List, Optional


_STATUS_MAP = {
    "initializing": "downloading",
    "fetching_metadata": "downloading",
    "downloading": "downloading",
    "completed": "completed",
    "error": "failed",
}


def vod_downloader_as_twitch_jobs(vod_downloader: Optional[Any]) -> List[Dict[str, Any]]:
    if not vod_downloader:
        return []
    result = []
    for job_id, job in vod_downloader.list_jobs():
        result.append(
            {
                "id": job_id,
                "url": job.get("url", ""),
                "status": _STATUS_MAP.get(job.get("status", ""), "downloading"),
                "progress": job.get("percentage", 0),
                "message": job.get("error") or job.get("status", ""),
                "eta": job.get("eta"),
                "speed": job.get("speed"),
            }
        )
    return result