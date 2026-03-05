from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from flask import Blueprint


@dataclass(frozen=True)
class SpaRouteDeps:
    react_logo_response: Callable[[], Any]
    react_app_response: Callable[[str], Any]


def create_spa_blueprint(deps: SpaRouteDeps) -> Blueprint:
    spa_bp = Blueprint("spa", __name__)

    @spa_bp.route("/logo.png")
    def react_logo() -> Any:
        return deps.react_logo_response()

    @spa_bp.route("/")
    @spa_bp.route("/<path:path>")
    def react_app(path: str = "") -> Any:
        return deps.react_app_response(path)

    return spa_bp
