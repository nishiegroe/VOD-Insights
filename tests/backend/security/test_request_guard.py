from __future__ import annotations

from types import SimpleNamespace

from app.system.request_guard import RequestGuard, RequestGuardConfig


def _request(
    path: str,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    remote_addr: str = "127.0.0.1",
):
    return SimpleNamespace(
        path=path,
        method=method,
        headers=headers or {},
        remote_addr=remote_addr,
    )


def _guard(**overrides):
    config = RequestGuardConfig(
        require_api_token=False,
        api_token="",
        rate_limit_enabled=True,
        default_limit_count=120,
        default_limit_window_seconds=60,
        heavy_limit_count=2,
        heavy_limit_window_seconds=60,
    )
    config = RequestGuardConfig(**{**config.__dict__, **overrides})
    return RequestGuard(config)


def test_non_sensitive_path_allowed() -> None:
    guard = _guard()
    allowed, message, status = guard.validate(_request("/", "GET"))
    assert allowed is True
    assert message == ""
    assert status == 200


def test_sensitive_get_requires_trusted_origin_without_token() -> None:
    guard = _guard()

    blocked = guard.validate(_request("/api/config", "GET"))
    assert blocked == (False, "Untrusted request origin.", 403)

    allowed = guard.validate(
        _request("/api/config", "GET", headers={"Origin": "http://127.0.0.1:5173"})
    )
    assert allowed == (True, "", 200)


def test_token_mode_blocks_without_token() -> None:
    guard = _guard(require_api_token=True, api_token="secret-token")
    allowed, message, status = guard.validate(_request("/api/config", "GET"))
    assert allowed is False
    assert status == 401
    assert "invalid API token" in message


def test_token_mode_allows_with_token() -> None:
    guard = _guard(require_api_token=True, api_token="secret-token")
    allowed, message, status = guard.validate(
        _request("/api/config", "GET", headers={"X-AET-API-Token": "secret-token"})
    )
    assert (allowed, message, status) == (True, "", 200)


def test_rate_limit_applies_to_heavy_mutations() -> None:
    guard = _guard()
    headers = {"Origin": "http://localhost:5173"}

    first = guard.validate(_request("/api/vod/download", "POST", headers=headers))
    second = guard.validate(_request("/api/vod/download", "POST", headers=headers))
    third = guard.validate(_request("/api/vod/download", "POST", headers=headers))

    assert first == (True, "", 200)
    assert second == (True, "", 200)
    assert third[0] is False
    assert third[2] == 429
    assert "Rate limit exceeded" in third[1]


def test_rate_limit_can_be_disabled() -> None:
    guard = _guard(rate_limit_enabled=False, heavy_limit_count=1)
    headers = {"Origin": "http://localhost:5173"}

    first = guard.validate(_request("/api/vod/download", "POST", headers=headers))
    second = guard.validate(_request("/api/vod/download", "POST", headers=headers))

    assert first == (True, "", 200)
    assert second == (True, "", 200)
