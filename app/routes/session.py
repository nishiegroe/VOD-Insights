from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from flask import Blueprint


@dataclass(frozen=True)
class SessionRouteDeps:
    session_data_response: Callable[[], Any]


def create_session_blueprint(deps: SessionRouteDeps) -> Blueprint:
    session_bp = Blueprint("session", __name__)

    @session_bp.route("/api/session-data")
    def api_session_data() -> Any:
        return deps.session_data_response()

    return session_bp
