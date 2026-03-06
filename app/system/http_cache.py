from __future__ import annotations

from typing import Any


def set_no_cache_headers(
    response: Any,
    *,
    cache_control: str = "no-cache, no-store, must-revalidate",
    include_pragma: bool = False,
) -> Any:
    response.headers["Cache-Control"] = cache_control
    if include_pragma:
        response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response