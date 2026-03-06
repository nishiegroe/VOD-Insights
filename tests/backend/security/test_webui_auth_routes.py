from __future__ import annotations

import pytest

import app.webui as webui_module
from app.system.request_guard import RequestGuard, RequestGuardConfig


@pytest.fixture
def token_guard(monkeypatch: pytest.MonkeyPatch) -> RequestGuard:
    guard = RequestGuard(
        RequestGuardConfig(
            require_api_token=True,
            api_token="secret-token",
            rate_limit_enabled=True,
            default_limit_count=120,
            default_limit_window_seconds=60,
            heavy_limit_count=10,
            heavy_limit_window_seconds=60,
            rate_state_max_keys=128,
            rate_state_idle_ttl_seconds=300,
        )
    )
    monkeypatch.setattr(webui_module, "_request_guard", guard)
    return guard


@pytest.mark.parametrize(
    "path,query_string,authorized_statuses",
    [
        ("/media/example.mp4", None, {404}),
        ("/vod-media/example.mp4", None, {404}),
        ("/download/example.mp4", None, {404}),
        ("/api/vods", None, {200}),
        ("/api/vods/single", {"path": "missing.mp4"}, {404}),
    ],
)
def test_sensitive_get_routes_require_token(
    token_guard: RequestGuard,
    path: str,
    query_string: dict[str, str] | None,
    authorized_statuses: set[int],
) -> None:
    with webui_module.app.test_client() as client:
        blocked = client.get(path, query_string=query_string)
        assert blocked.status_code == 401
        assert (blocked.get_json() or {}).get("error") == "Missing or invalid API token."

        allowed = client.get(
            path,
            query_string=query_string,
            headers={"X-AET-API-Token": "secret-token"},
        )
        assert allowed.status_code in authorized_statuses


def test_vods_stream_requires_token_and_returns_sse_with_token(token_guard: RequestGuard) -> None:
    with webui_module.app.test_client() as client:
        blocked = client.get("/api/vods/stream")
        assert blocked.status_code == 401
        assert (blocked.get_json() or {}).get("error") == "Missing or invalid API token."

        allowed = client.get(
            "/api/vods/stream",
            headers={"X-AET-API-Token": "secret-token"},
        )
        assert allowed.status_code == 200
        assert allowed.mimetype == "text/event-stream"
