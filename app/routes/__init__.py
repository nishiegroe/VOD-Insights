from __future__ import annotations

from flask import Flask

from app.routes.gpu import GpuRouteDeps, create_gpu_blueprint
from app.routes.system import SystemRouteDeps, create_system_blueprint


def register_blueprints(
    app: Flask,
    *,
    system_deps: SystemRouteDeps,
    gpu_deps: GpuRouteDeps,
) -> Flask:
    if "system" not in app.blueprints:
        app.register_blueprint(create_system_blueprint(system_deps))
    if "gpu" not in app.blueprints:
        app.register_blueprint(create_gpu_blueprint(gpu_deps))
    return app
