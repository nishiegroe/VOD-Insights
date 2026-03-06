from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from flask import Blueprint


@dataclass(frozen=True)
class ClipsRouteDeps:
    clip_days_response: Callable[[], Any]
    clips_by_day_response: Callable[[], Any]
    clip_lookup_response: Callable[[], Any]
    clip_range_response: Callable[[], Any]
    clip_name_response: Callable[[], Any]
    clips_response: Callable[[], Any]


def create_clips_blueprint(deps: ClipsRouteDeps) -> Blueprint:
    clips_bp = Blueprint("clips", __name__)

    @clips_bp.route("/api/clips/days")
    def api_clip_days() -> Any:
        return deps.clip_days_response()

    @clips_bp.route("/api/clips/by-day")
    def api_clips_by_day() -> Any:
        return deps.clips_by_day_response()

    @clips_bp.route("/api/clips/lookup")
    def api_clip_lookup() -> Any:
        return deps.clip_lookup_response()

    @clips_bp.route("/api/clip-range", methods=["POST"])
    def api_clip_range() -> Any:
        return deps.clip_range_response()

    @clips_bp.route("/api/clip-name", methods=["POST"])
    def api_clip_name() -> Any:
        return deps.clip_name_response()

    @clips_bp.route("/api/clips")
    def api_clips() -> Any:
        return deps.clips_response()

    return clips_bp
