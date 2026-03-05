from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from flask import Blueprint


@dataclass(frozen=True)
class VodsRouteDeps:
    vods_response: Callable[[], Any]
    vod_single_response: Callable[[], Any]
    delete_vod_response: Callable[[], Any]
    vods_stream_response: Callable[[], Any]


def create_vods_blueprint(deps: VodsRouteDeps) -> Blueprint:
    vods_bp = Blueprint("vods", __name__)

    @vods_bp.route("/api/vods")
    def api_vods() -> Any:
        return deps.vods_response()

    @vods_bp.route("/api/vods/single")
    def api_vod_single() -> Any:
        return deps.vod_single_response()

    @vods_bp.route("/api/vods/delete", methods=["POST"])
    def api_delete_vod() -> Any:
        return deps.delete_vod_response()

    @vods_bp.route("/api/vods/stream")
    def api_vods_stream() -> Any:
        return deps.vods_stream_response()

    return vods_bp
