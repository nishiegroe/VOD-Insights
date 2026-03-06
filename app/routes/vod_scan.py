from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from flask import Blueprint


@dataclass(frozen=True)
class VodScanRouteDeps:
    vod_ocr_run_response: Callable[[], Any]
    stop_vod_ocr_response: Callable[[], Any]
    pause_vod_ocr_response: Callable[[], Any]
    resume_vod_ocr_response: Callable[[], Any]
    delete_sessions_response: Callable[[], Any]


def create_vod_scan_blueprint(deps: VodScanRouteDeps) -> Blueprint:
    vod_scan_bp = Blueprint("vod_scan", __name__)

    @vod_scan_bp.route("/api/vod-ocr", methods=["POST"])
    def api_vod_ocr_run() -> Any:
        return deps.vod_ocr_run_response()

    @vod_scan_bp.route("/api/stop-vod-ocr", methods=["POST"])
    def api_stop_vod_ocr() -> Any:
        return deps.stop_vod_ocr_response()

    @vod_scan_bp.route("/api/pause-vod-ocr", methods=["POST"])
    def api_pause_vod_ocr() -> Any:
        return deps.pause_vod_ocr_response()

    @vod_scan_bp.route("/api/resume-vod-ocr", methods=["POST"])
    def api_resume_vod_ocr() -> Any:
        return deps.resume_vod_ocr_response()

    @vod_scan_bp.route("/api/delete-sessions", methods=["POST"])
    def api_delete_sessions() -> Any:
        return deps.delete_sessions_response()

    return vod_scan_bp
