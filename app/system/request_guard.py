from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import urlparse

from flask import Request


def _parse_bool_env(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


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


class RequestGuard:
    def __init__(self, config: RequestGuardConfig) -> None:
        self._config = config
        self._mutating_methods = {"POST", "PUT", "PATCH", "DELETE"}
        self._token_header = "X-AET-API-Token"

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
        )
        return path.startswith(sensitive_get_prefixes)

    def _has_valid_api_token(self, request: Request) -> bool:
        expected = self._config.api_token
        if not expected:
            return False
        actual = str(request.headers.get(self._token_header, ""))
        return actual == expected

    def _has_trusted_origin(self, request: Request) -> bool:
        origin = str(request.headers.get("Origin", "")).strip()
        referer = str(request.headers.get("Referer", "")).strip()
        if origin:
            return _is_loopback_host(_extract_host(origin))
        if referer:
            return _is_loopback_host(_extract_host(referer))
        return False

    def validate(self, request: Request) -> tuple[bool, str, int]:
        path = request.path or ""
        method = (request.method or "GET").upper()

        if not self._is_sensitive_path(path, method):
            return True, "", 200

        if self._config.require_api_token:
            if not self._has_valid_api_token(request):
                return False, "Missing or invalid API token.", 401
            return True, "", 200

        # When token auth is not enforced (development/browser mode), require
        # same-origin loopback context for sensitive routes.
        if not self._has_trusted_origin(request):
            return False, "Untrusted request origin.", 403

        return True, "", 200


def load_request_guard_from_env() -> RequestGuard:
    return RequestGuard(
        RequestGuardConfig(
            require_api_token=_parse_bool_env("AET_REQUIRE_API_TOKEN", default=False),
            api_token=os.environ.get("AET_API_TOKEN", "").strip(),
        )
    )
