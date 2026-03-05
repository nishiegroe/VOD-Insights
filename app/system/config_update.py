from __future__ import annotations

from typing import Any, Dict, List


def update_config_from_payload(config: Dict[str, Any], payload: Dict[str, Any]) -> None:
    def _set(path: List[str], value: Any) -> None:
        obj = config
        for key in path[:-1]:
            obj = obj.setdefault(key, {})
        obj[path[-1]] = value

    def _to_bool(value: Any) -> bool:
        if isinstance(value, bool):
            return value
        return str(value).lower() in {"1", "true", "on", "yes"}

    def _to_event_windows(value: Any) -> Dict[str, Dict[str, float]]:
        if not isinstance(value, dict):
            return {}
        result: Dict[str, Dict[str, float]] = {}
        for raw_key, raw_window in value.items():
            key = str(raw_key).strip()
            if not key or not isinstance(raw_window, dict):
                continue
            try:
                pre_seconds = max(0.0, float(raw_window.get("pre_seconds", 0.0)))
                post_seconds = max(0.0, float(raw_window.get("post_seconds", 0.0)))
            except (TypeError, ValueError):
                continue
            result[key] = {
                "pre_seconds": pre_seconds,
                "post_seconds": post_seconds,
            }
        return result

    mapping = {
        "capture_left": ("capture", "left", int),
        "capture_top": ("capture", "top", int),
        "capture_width": ("capture", "width", int),
        "capture_height": ("capture", "height", int),
        "capture_fps": ("capture", "fps", int),
        "capture_scale": ("capture", "scale", float),
        "capture_threshold": ("capture", "threshold", int),
        "capture_backend": ("capture", "backend", str),
        "ocr_interval": ("ocr", "interval_seconds", float),
        "ocr_engine": ("ocr", "engine", str),
        "detection_keywords": (
            "detection",
            "keywords",
            lambda v: [s.strip() for s in str(v).split(",") if s.strip()],
        ),
        "detection_cooldown": ("detection", "cooldown_seconds", float),
        "replay_dir": ("replay", "directory", str),
        "replay_prefix": ("replay", "prefix", str),
        "replay_include_event": ("replay", "include_event", _to_bool),
        "replay_wait": ("replay", "wait_seconds", float),
        "bookmarks_directory": ("bookmarks", "directory", str),
        "bookmarks_prefix": ("bookmarks", "session_prefix", str),
        "bookmarks_file": ("bookmarks", "file", str),
        "bookmarks_format": ("bookmarks", "format", str),
        "split_pre": ("split", "pre_seconds", float),
        "split_post": ("split", "post_seconds", float),
        "split_event_windows": ("split", "event_windows", _to_event_windows),
        "split_gap": ("split", "merge_gap_seconds", float),
        "wizard_vods_completed": ("ui", "vods_wizard_completed", _to_bool),
        "overlay_x": ("ui", "overlay_x", float),
        "overlay_y": ("ui", "overlay_y", float),
        "overlay_width": ("ui", "overlay_width", float),
        "overlay_opacity": ("ui", "overlay_opacity", float),
        "overlay_enabled": ("ui", "overlay_enabled", _to_bool),
    }

    for field, (section, key, caster) in mapping.items():
        if field in payload and payload[field] is not None:
            _set([section, key], caster(payload[field]))