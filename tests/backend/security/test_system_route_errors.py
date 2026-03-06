from __future__ import annotations

from flask import Flask

from app.routes.system import SystemRouteDeps, create_system_blueprint


def _deps_with_update_error() -> SystemRouteDeps:
    def _raise_update_error() -> dict:
        raise RuntimeError("sensitive upstream error")

    return SystemRouteDeps(
        get_status=lambda: {"ok": True},
        load_config=lambda: {},
        save_config=lambda _cfg: None,
        update_config_from_payload=lambda _cfg, _payload: None,
        get_bootstrap_status=lambda: {"ok": True},
        start_bootstrap=lambda _install_gpu_ocr: {"ok": True},
        get_notifications=lambda: {},
        get_current_app_version=lambda: "1.0.0",
        fetch_latest_update_metadata=_raise_update_error,
        update_feed_url="https://example.test/latest.json",
        debug_paths_response=lambda: {"ok": True},
    )


def test_api_update_latest_hides_internal_exception_details() -> None:
    app = Flask(__name__)
    app.register_blueprint(create_system_blueprint(_deps_with_update_error()))

    with app.test_client() as client:
        response = client.get("/api/update/latest")

    assert response.status_code == 502
    payload = response.get_json() or {}
    assert payload.get("ok") is False
    assert payload.get("error") == "Unable to fetch update metadata"
    assert "sensitive upstream error" not in str(payload)
