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
        rate_state_max_keys=128,
        rate_state_idle_ttl_seconds=300,
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


def test_token_mode_default_protects_api_routes() -> None:
    guard = _guard(require_api_token=True, api_token="secret-token")

    blocked = guard.validate(_request("/api/vods", "GET"))
    assert blocked == (False, "Missing or invalid API token.", 401)

    allowed = guard.validate(
        _request("/api/vods", "GET", headers={"X-AET-API-Token": "secret-token"})
    )
    assert allowed == (True, "", 200)


def test_token_mode_only_allows_exact_public_health_paths() -> None:
    guard = _guard(require_api_token=True, api_token="secret-token")

    assert guard.validate(_request("/api/health", "GET")) == (True, "", 200)
    assert guard.validate(_request("/api/healthz", "GET")) == (True, "", 200)
    assert guard.validate(_request("/api/health/details", "GET")) == (
        False,
        "Missing or invalid API token.",
        401,
    )


def test_token_mode_protects_vod_read_routes() -> None:
    guard = _guard(require_api_token=True, api_token="secret-token")

    for path in ("/api/vods", "/api/vods/single", "/api/vods/stream"):
        blocked = guard.validate(_request(path, "GET"))
        assert blocked == (False, "Missing or invalid API token.", 401)

        allowed = guard.validate(
            _request(path, "GET", headers={"X-AET-API-Token": "secret-token"})
        )
        assert allowed == (True, "", 200)


def test_token_mode_protects_media_get_prefixes() -> None:
    guard = _guard(require_api_token=True, api_token="secret-token")

    for path in ("/media/example.mp4", "/vod-media/example.mp4", "/download/example.mp4"):
        blocked = guard.validate(_request(path, "GET"))
        assert blocked == (False, "Missing or invalid API token.", 401)

        allowed = guard.validate(
            _request(path, "GET", headers={"X-AET-API-Token": "secret-token"})
        )
        assert allowed == (True, "", 200)


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


def test_rate_state_evicts_oldest_when_over_max_keys() -> None:
    guard = _guard(rate_state_max_keys=2, rate_state_idle_ttl_seconds=3600)
    headers_a = {"Origin": "http://localhost:5173", "X-AET-API-Token": "a-token"}
    headers_b = {"Origin": "http://localhost:5173", "X-AET-API-Token": "b-token"}
    headers_c = {"Origin": "http://localhost:5173", "X-AET-API-Token": "c-token"}

    guard.validate(_request("/api/vod/download", "POST", headers=headers_a))
    guard.validate(_request("/api/vod/download", "POST", headers=headers_b))
    guard.validate(_request("/api/vod/download", "POST", headers=headers_c))

    assert len(guard._rate_state) == 2
    assert all("a-token" not in key for key in guard._rate_state.keys())


def test_rate_state_evicts_idle_keys() -> None:
    guard = _guard(rate_state_max_keys=8, rate_state_idle_ttl_seconds=2)
    headers = {"Origin": "http://localhost:5173", "X-AET-API-Token": "idle-token"}

    guard.validate(_request("/api/vod/download", "POST", headers=headers))
    only_key = next(iter(guard._rate_state.keys()))
    guard._evict_rate_state(guard._rate_state[only_key][-1] + 3.0)

    assert not guard._rate_state
