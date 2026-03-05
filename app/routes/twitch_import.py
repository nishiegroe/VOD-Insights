from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from flask import Blueprint


@dataclass(frozen=True)
class TwitchImportRouteDeps:
    twitch_imports_response: Callable[[], Any]
    twitch_import_start_response: Callable[[], Any]
    twitch_import_status_response: Callable[[str], Any]


def create_twitch_import_blueprint(deps: TwitchImportRouteDeps) -> Blueprint:
    twitch_bp = Blueprint("twitch_import", __name__)

    @twitch_bp.route("/api/twitch-imports")
    def api_twitch_imports() -> Any:
        return deps.twitch_imports_response()

    @twitch_bp.route("/api/twitch-import", methods=["POST"])
    def api_twitch_import() -> Any:
        return deps.twitch_import_start_response()

    @twitch_bp.route("/api/twitch-import/<job_id>")
    def api_twitch_import_status(job_id: str) -> Any:
        return deps.twitch_import_status_response(job_id)

    return twitch_bp
