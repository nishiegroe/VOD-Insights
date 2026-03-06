from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from app.runtime_paths import get_downloads_dir


DOWNLOADS_DIR = get_downloads_dir()


def sanitize_filename(filename: str) -> str:
    name = Path(filename).name
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
    return name or "upload.mp4"


def is_twitch_vod_url(url: str) -> bool:
    value = str(url or "").strip()
    if not value:
        return False
    try:
        parsed = urlparse(value)
    except Exception:
        return False
    host = (parsed.hostname or "").lower()
    if host not in {"twitch.tv", "www.twitch.tv"}:
        return False
    if parsed.scheme != "https":
        return False
    return bool(re.fullmatch(r"/videos/\d+/?", parsed.path or ""))


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