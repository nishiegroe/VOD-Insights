from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from flask import Blueprint


@dataclass(frozen=True)
class OverlayRouteDeps:
    overlay_upload_response: Callable[[], Any]
    overlay_image_response: Callable[[], Any]
    overlay_remove_response: Callable[[], Any]


def create_overlay_blueprint(deps: OverlayRouteDeps) -> Blueprint:
    overlay_bp = Blueprint("overlay", __name__)

    @overlay_bp.route("/api/overlay/upload", methods=["POST"])
    def api_overlay_upload() -> Any:
        return deps.overlay_upload_response()

    @overlay_bp.route("/api/overlay/image")
    def api_overlay_image() -> Any:
        return deps.overlay_image_response()

    @overlay_bp.route("/api/overlay/remove", methods=["POST"])
    def api_overlay_remove() -> Any:
        return deps.overlay_remove_response()

    return overlay_bp
