from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from flask import Blueprint


@dataclass(frozen=True)
class VodActionsRouteDeps:
    vod_ocr_upload_redirect_response: Callable[[], Any]
    api_vod_ocr_upload_response: Callable[[], Any]
    split_selected_response: Callable[[], Any]
    api_split_selected_response: Callable[[], Any]
    vod_ocr_run_redirect_response: Callable[[], Any]


def create_vod_actions_blueprint(deps: VodActionsRouteDeps) -> Blueprint:
    vod_actions_bp = Blueprint("vod_actions", __name__)

    @vod_actions_bp.route("/vod-ocr-upload", methods=["POST"])
    def vod_ocr_upload() -> Any:
        return deps.vod_ocr_upload_redirect_response()

    @vod_actions_bp.route("/api/vod-ocr-upload", methods=["POST"])
    def api_vod_ocr_upload() -> Any:
        return deps.api_vod_ocr_upload_response()

    @vod_actions_bp.route("/split-selected", methods=["POST"])
    def split_selected() -> Any:
        return deps.split_selected_response()

    @vod_actions_bp.route("/api/split-selected", methods=["POST"])
    def api_split_selected() -> Any:
        return deps.api_split_selected_response()

    @vod_actions_bp.route("/vod-ocr", methods=["POST"])
    def vod_ocr_run() -> Any:
        return deps.vod_ocr_run_redirect_response()

    return vod_actions_bp
