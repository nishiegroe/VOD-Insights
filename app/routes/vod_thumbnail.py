from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from flask import Blueprint


@dataclass(frozen=True)
class VodThumbnailRouteDeps:
    vod_thumbnail_response: Callable[[], Any]


def create_vod_thumbnail_blueprint(deps: VodThumbnailRouteDeps) -> Blueprint:
    vod_thumbnail_bp = Blueprint("vod_thumbnail", __name__)

    @vod_thumbnail_bp.route("/vod-thumbnail")
    def vod_thumbnail() -> Any:
        return deps.vod_thumbnail_response()

    return vod_thumbnail_bp