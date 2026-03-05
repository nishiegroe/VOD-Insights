from __future__ import annotations

import json
from typing import Any, Dict, List
from urllib.request import urlopen

from app.runtime_paths import get_project_root


def load_patch_notes() -> List[Any]:
    meta_path = get_project_root() / "app_meta.json"
    if not meta_path.exists():
        return []
    try:
        payload = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception:
        return []
    notes = payload.get("patchNotes") or payload.get("patch_notes") or []
    return notes if isinstance(notes, list) else []


def get_current_app_version() -> str:
    meta_path = get_project_root() / "app_meta.json"
    if not meta_path.exists():
        return ""
    try:
        payload = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception:
        return ""
    value = payload.get("version")
    return str(value).strip() if isinstance(value, str) else ""


def fetch_latest_update_metadata(update_feed_url: str, timeout_seconds: int) -> Dict[str, Any]:
    with urlopen(update_feed_url, timeout=timeout_seconds) as response:
        status = getattr(response, "status", 200)
        if status < 200 or status >= 300:
            raise RuntimeError(f"Update feed request failed with status {status}.")
        raw = response.read().decode("utf-8")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Invalid update metadata received.") from exc
    if not isinstance(payload, dict):
        raise RuntimeError("Invalid update metadata received.")
    return payload
