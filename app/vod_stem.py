from __future__ import annotations

import re


def sanitize_stem(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", value).strip("_")
