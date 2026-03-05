from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from flask import Blueprint


@dataclass(frozen=True)
class VodDownloadRouteDeps:
    vod_download_start_response: Callable[[], Any]
    vod_download_progress_response: Callable[[str], Any]
    vod_check_tools_response: Callable[[], Any]


def create_vod_download_blueprint(deps: VodDownloadRouteDeps) -> Blueprint:
    vod_download_bp = Blueprint("vod_download", __name__)

    @vod_download_bp.route("/api/vod/download", methods=["POST"])
    def vod_download_start() -> Any:
        return deps.vod_download_start_response()

    @vod_download_bp.route("/api/vod/progress/<job_id>", methods=["GET"])
    def vod_download_progress(job_id: str) -> Any:
        return deps.vod_download_progress_response(job_id)

    @vod_download_bp.route("/api/vod/check-tools", methods=["GET"])
    def vod_check_tools() -> Any:
        return deps.vod_check_tools_response()

    return vod_download_bp
