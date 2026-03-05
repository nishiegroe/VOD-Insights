from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from flask import Blueprint


@dataclass(frozen=True)
class LogsRouteDeps:
    logs_response: Callable[[], Any]
    open_backend_log_response: Callable[[], Any]


def create_logs_blueprint(deps: LogsRouteDeps) -> Blueprint:
    logs_bp = Blueprint("logs", __name__)

    @logs_bp.route("/api/logs")
    def api_logs() -> Any:
        return deps.logs_response()

    @logs_bp.route("/api/open-backend-log", methods=["POST"])
    def api_open_backend_log() -> Any:
        return deps.open_backend_log_response()

    return logs_bp
