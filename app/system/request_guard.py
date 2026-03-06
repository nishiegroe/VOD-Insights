from __future__ import annotations

import os
import hmac
import threading
import time
from collections import deque
from dataclasses import dataclass
from urllib.parse import urlparse

from flask import Request


def _parse_bool_env(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


def _parse_int_env(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        value = int(str(raw).strip())
    except ValueError:
        return default
    return max(1, value)


def _is_loopback_host(host: str) -> bool:
    value = str(host or "").strip().lower().strip("[]")
    return value in {"127.0.0.1", "localhost", "::1"}


def _extract_host(url_value: str) -> str:
    try:
        parsed = urlparse(url_value)
    except Exception:
        return ""
    return (parsed.hostname or "").strip().lower()


@dataclass(frozen=True)
class RequestGuardConfig:
    require_api_token: bool
    api_token: str
    rate_limit_enabled: bool
    default_limit_count: int
    default_limit_window_seconds: int
    heavy_limit_count: int
    heavy_limit_window_seconds: int
    rate_state_max_keys: int
    rate_state_idle_ttl_seconds: int


class RequestGuard:
    def __init__(self, config: RequestGuardConfig) -> None:
        self._config = config
        self._mutating_methods = {"POST", "PUT", "PATCH", "DELETE"}
        self._token_header = "X-AET-API-Token"
        self._rate_lock = threading.Lock()
        self._rate_state: dict[str, deque[float]] = {}
        self._heavy_paths = (
            "/api/vod/download",
            "/api/vod-ocr",
            "/api/stop-vod-ocr",
            "/api/pause-vod-ocr",
            "/api/resume-vod-ocr",
            "/api/bootstrap/start",
            "/api/vod-ocr-upload",
            "/api/twitch-import",
            "/api/clip-range",
            "/api/split-selected",
        )
        self._public_safe_api_paths = (
            "/api/health",
            "/api/healthz",
        )

    def _is_public_safe_api_path(self, path: str) -> bool:
        return path in self._public_safe_api_paths

    def _is_sensitive_path(self, path: str, method: str) -> bool:
        if method in self._mutating_methods:
            return True
        sensitive_get_prefixes = (
            "/api/logs",
            "/api/debug/paths",
            "/api/session-data",
            "/api/clips/lookup",
            "/api/config",
            "/media-path",
            "/download-path",
            "/media/",
            "/vod-media/",
            "/download/",
        )
        return path.startswith(sensitive_get_prefixes)

    def _is_token_protected_path(self, path: str, method: str) -> bool:
        if self._config.require_api_token and path.startswith("/api/"):
            return not self._is_public_safe_api_path(path)

        if self._is_sensitive_path(path, method):
            return True
        return False

    def _is_heavy_path(self, path: str) -> bool:
        return path.startswith(self._heavy_paths)

    def _has_valid_api_token(self, request: Request) -> bool:
        expected = self._config.api_token
        if not expected:
            return False
        actual = str(request.headers.get(self._token_header, ""))
        return hmac.compare_digest(actual, expected)

    def _has_trusted_origin(self, request: Request) -> bool:
        origin = str(request.headers.get("Origin", "")).strip()
        referer = str(request.headers.get("Referer", "")).strip()
        if origin:
            return _is_loopback_host(_extract_host(origin))
        if referer:
            return _is_loopback_host(_extract_host(referer))
        return False

    def _rate_limit_key(self, request: Request, path: str) -> str:
        remote_addr = str(getattr(request, "remote_addr", "") or "local")
        token_hint = str(request.headers.get(self._token_header, ""))
        actor = token_hint[:12] if token_hint else remote_addr
        return f"{actor}:{path}"

    def _allow_rate(self, request: Request, path: str) -> tuple[bool, str, int]:
        if not self._config.rate_limit_enabled:
            return True, "", 200

        now = time.time()
        is_heavy = self._is_heavy_path(path)
        max_count = self._config.heavy_limit_count if is_heavy else self._config.default_limit_count
        window = (
            self._config.heavy_limit_window_seconds
            if is_heavy
            else self._config.default_limit_window_seconds
        )
        key = self._rate_limit_key(request, path)

        with self._rate_lock:
            self._evict_rate_state(now)
            bucket = self._rate_state.setdefault(key, deque())
            cutoff = now - float(window)
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if len(bucket) >= max_count:
                retry_after = max(1, int(bucket[0] + window - now)) if bucket else window
                return False, f"Rate limit exceeded. Retry in {retry_after}s.", 429
            bucket.append(now)
            self._evict_rate_state(now)

        return True, "", 200

    def _evict_rate_state(self, now: float) -> None:
        if not self._rate_state:
            return

        idle_cutoff = now - float(self._config.rate_state_idle_ttl_seconds)
        stale_keys = [
            key
            for key, bucket in self._rate_state.items()
            if (not bucket) or (bucket[-1] < idle_cutoff)
        ]
        for key in stale_keys:
            self._rate_state.pop(key, None)

        overflow = len(self._rate_state) - self._config.rate_state_max_keys
        if overflow <= 0:
            return

        # Keep the most recently active actors and discard oldest buckets first.
        oldest_first = sorted(
            self._rate_state.items(),
            key=lambda item: item[1][-1] if item[1] else 0.0,
        )
        for key, _bucket in oldest_first[:overflow]:
            self._rate_state.pop(key, None)

    def validate(self, request: Request) -> tuple[bool, str, int]:
        path = request.path or ""
        method = (request.method or "GET").upper()
        token_protected = self._is_token_protected_path(path, method)

        if not token_protected:
            return True, "", 200

        if self._config.require_api_token:
            if not self._has_valid_api_token(request):
                return False, "Missing or invalid API token.", 401
            if method in self._mutating_methods:
                allowed, message, status_code = self._allow_rate(request, path)
                if not allowed:
                    return False, message, status_code
            return True, "", 200

        # When token auth is not enforced (development/browser mode), require
        # same-origin loopback context for sensitive routes.
        if not self._has_trusted_origin(request):
            return False, "Untrusted request origin.", 403

        if method in self._mutating_methods:
            allowed, message, status_code = self._allow_rate(request, path)
            if not allowed:
                return False, message, status_code

        return True, "", 200


def load_request_guard_from_env() -> RequestGuard:
    return RequestGuard(
        RequestGuardConfig(
            require_api_token=_parse_bool_env("AET_REQUIRE_API_TOKEN", default=False),
            api_token=os.environ.get("AET_API_TOKEN", "").strip(),
            rate_limit_enabled=_parse_bool_env("AET_RATE_LIMIT_ENABLED", default=True),
            default_limit_count=_parse_int_env("AET_RATE_LIMIT_COUNT", 120),
            default_limit_window_seconds=_parse_int_env("AET_RATE_LIMIT_WINDOW_SECONDS", 60),
            heavy_limit_count=_parse_int_env("AET_HEAVY_RATE_LIMIT_COUNT", 10),
            heavy_limit_window_seconds=_parse_int_env("AET_HEAVY_RATE_LIMIT_WINDOW_SECONDS", 60),
            rate_state_max_keys=_parse_int_env("AET_RATE_STATE_MAX_KEYS", 4096),
            rate_state_idle_ttl_seconds=_parse_int_env("AET_RATE_STATE_IDLE_TTL_SECONDS", 600),
        )
    )
