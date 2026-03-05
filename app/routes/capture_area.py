from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from flask import Blueprint


@dataclass(frozen=True)
class CaptureAreaRouteDeps:
    capture_area_save_response: Callable[[], Any]


def create_capture_area_blueprint(deps: CaptureAreaRouteDeps) -> Blueprint:
    capture_area_bp = Blueprint("capture_area", __name__)

    @capture_area_bp.route("/capture-area/save", methods=["POST"])
    def capture_area_save() -> Any:
        return deps.capture_area_save_response()

    return capture_area_bp