from __future__ import annotations

from flask import Flask

from app.routes.system import SystemRouteDeps, create_system_blueprint


def register_blueprints(app: Flask, *, system_deps: SystemRouteDeps) -> Flask:
    if "system" not in app.blueprints:
        app.register_blueprint(create_system_blueprint(system_deps))
    return app
