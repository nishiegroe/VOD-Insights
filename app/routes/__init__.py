from __future__ import annotations

from flask import Flask

from app.routes.gpu import GpuRouteDeps, create_gpu_blueprint
from app.routes.overlay import OverlayRouteDeps, create_overlay_blueprint
from app.routes.system import SystemRouteDeps, create_system_blueprint
from app.routes.vod_download import VodDownloadRouteDeps, create_vod_download_blueprint


def register_blueprints(
    app: Flask,
    *,
    system_deps: SystemRouteDeps,
    gpu_deps: GpuRouteDeps,
    overlay_deps: OverlayRouteDeps,
    vod_download_deps: VodDownloadRouteDeps,
) -> Flask:
    if "system" not in app.blueprints:
        app.register_blueprint(create_system_blueprint(system_deps))
    if "gpu" not in app.blueprints:
        app.register_blueprint(create_gpu_blueprint(gpu_deps))
    if "overlay" not in app.blueprints:
        app.register_blueprint(create_overlay_blueprint(overlay_deps))
    if "vod_download" not in app.blueprints:
        app.register_blueprint(create_vod_download_blueprint(vod_download_deps))
    return app
