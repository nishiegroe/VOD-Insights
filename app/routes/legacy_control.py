from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from flask import Blueprint


@dataclass(frozen=True)
class LegacyControlRouteDeps:
    update_config_response: Callable[[], Any]
    choose_replay_dir_response: Callable[[], Any]
    api_choose_replay_dir_response: Callable[[], Any]
    control_start_response: Callable[[], Any]
    api_control_start_response: Callable[[], Any]
    control_stop_response: Callable[[], Any]
    api_control_stop_response: Callable[[], Any]


def create_legacy_control_blueprint(deps: LegacyControlRouteDeps) -> Blueprint:
    legacy_control_bp = Blueprint("legacy_control", __name__)

    @legacy_control_bp.route("/config", methods=["POST"])
    def update_config() -> Any:
        return deps.update_config_response()

    @legacy_control_bp.route("/choose-replay-dir", methods=["POST"])
    def choose_replay_dir() -> Any:
        return deps.choose_replay_dir_response()

    @legacy_control_bp.route("/api/choose-replay-dir", methods=["POST"])
    def api_choose_replay_dir() -> Any:
        return deps.api_choose_replay_dir_response()

    @legacy_control_bp.route("/control/start", methods=["POST"])
    def control_start() -> Any:
        return deps.control_start_response()

    @legacy_control_bp.route("/api/control/start", methods=["POST"])
    def api_control_start() -> Any:
        return deps.api_control_start_response()

    @legacy_control_bp.route("/control/stop", methods=["POST"])
    def control_stop() -> Any:
        return deps.control_stop_response()

    @legacy_control_bp.route("/api/control/stop", methods=["POST"])
    def api_control_stop() -> Any:
        return deps.api_control_stop_response()

    return legacy_control_bp