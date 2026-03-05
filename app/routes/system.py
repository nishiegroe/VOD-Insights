from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict

from flask import Blueprint, jsonify, request


@dataclass(frozen=True)
class SystemRouteDeps:
	get_status: Callable[[], Dict[str, Any]]
	load_config: Callable[[], Dict[str, Any]]
	save_config: Callable[[Dict[str, Any]], None]
	update_config_from_payload: Callable[[Dict[str, Any], Dict[str, Any]], None]


def create_system_blueprint(deps: SystemRouteDeps) -> Blueprint:
	system_bp = Blueprint("system", __name__)

	@system_bp.route("/api/status")
	def api_status() -> Any:
		return jsonify(deps.get_status())

	@system_bp.route("/api/test-connection")
	def api_test_connection() -> Any:
		return jsonify({"status": "ok", "message": "Server is running with latest code"})

	@system_bp.route("/api/config", methods=["GET", "POST"])
	def api_config() -> Any:
		if request.method == "GET":
			return jsonify(deps.load_config())
		payload = request.get_json(silent=True) or {}
		config = deps.load_config()
		deps.update_config_from_payload(config, payload)
		deps.save_config(config)
		return jsonify({"ok": True, "config": config})

	return system_bp
