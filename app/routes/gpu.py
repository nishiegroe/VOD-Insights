from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from flask import Blueprint


@dataclass(frozen=True)
class GpuRouteDeps:
    ocr_gpu_status_response: Callable[[], Any]
    ocr_gpu_diagnostics_response: Callable[[], Any]
    install_gpu_ocr_response: Callable[[], Any]


def create_gpu_blueprint(deps: GpuRouteDeps) -> Blueprint:
    gpu_bp = Blueprint("gpu", __name__)

    @gpu_bp.route("/api/ocr-gpu-status")
    def api_ocr_gpu_status() -> Any:
        return deps.ocr_gpu_status_response()

    @gpu_bp.route("/api/ocr-gpu-diagnostics")
    def api_ocr_gpu_diagnostics() -> Any:
        return deps.ocr_gpu_diagnostics_response()

    @gpu_bp.route("/api/install-gpu-ocr", methods=["POST"])
    def api_install_gpu_ocr() -> Any:
        return deps.install_gpu_ocr_response()

    return gpu_bp
