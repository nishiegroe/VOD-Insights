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
	get_bootstrap_status: Callable[[], Dict[str, Any]]
	start_bootstrap: Callable[[bool], Dict[str, Any]]
	get_notifications: Callable[[], Dict[str, Any]]
	get_current_app_version: Callable[[], str]
	fetch_latest_update_metadata: Callable[[], Dict[str, Any]]
	update_feed_url: str
	debug_paths_response: Callable[[], Any]


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

	@system_bp.route("/api/bootstrap/status")
	def api_bootstrap_status() -> Any:
		return jsonify(deps.get_bootstrap_status())

	@system_bp.route("/api/bootstrap/start", methods=["POST"])
	def api_bootstrap_start() -> Any:
		payload = request.get_json() or {}
		install_gpu_ocr = bool(payload.get("install_gpu_ocr", False))
		return jsonify(deps.start_bootstrap(install_gpu_ocr))

	@system_bp.route("/api/notifications")
	def api_notifications() -> Any:
		return jsonify(deps.get_notifications())

	@system_bp.route("/api/update/latest")
	def api_update_latest() -> Any:
		current_version = deps.get_current_app_version()
		try:
			metadata = deps.fetch_latest_update_metadata()
		except Exception as exc:
			return (
				jsonify(
					{
						"ok": False,
						"latest_version": "",
						"current_version": current_version,
						"error": str(exc),
					}
				),
				502,
			)

		latest_version = str(metadata.get("version", "")).strip()
		return jsonify(
			{
				"ok": True,
				"latest_version": latest_version,
				"current_version": current_version,
				"feed_url": deps.update_feed_url,
			}
		)

	@system_bp.route("/api/debug/paths")
	def api_debug_paths() -> Any:
		return deps.debug_paths_response()

	return system_bp
