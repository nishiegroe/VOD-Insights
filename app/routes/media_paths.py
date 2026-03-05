from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from flask import Blueprint


@dataclass(frozen=True)
class MediaPathsRouteDeps:
    media_by_path_response: Callable[[], Any]
    download_by_path_response: Callable[[], Any]
    open_folder_by_path_response: Callable[[], Any]
    delete_by_path_response: Callable[[], Any]
    media_file_response: Callable[[str], Any]
    vod_media_file_response: Callable[[str], Any]
    download_file_response: Callable[[str], Any]
    open_folder_response: Callable[[str], Any]
    delete_file_response: Callable[[str], Any]


def create_media_paths_blueprint(deps: MediaPathsRouteDeps) -> Blueprint:
    media_paths_bp = Blueprint("media_paths", __name__)

    @media_paths_bp.route("/media-path")
    def media_by_path() -> Any:
        return deps.media_by_path_response()

    @media_paths_bp.route("/download-path")
    def download_by_path() -> Any:
        return deps.download_by_path_response()

    @media_paths_bp.route("/open-folder-path", methods=["POST"])
    def open_folder_by_path() -> Any:
        return deps.open_folder_by_path_response()

    @media_paths_bp.route("/delete-path", methods=["POST"])
    def delete_by_path() -> Any:
        return deps.delete_by_path_response()

    @media_paths_bp.route("/media/<path:filename>")
    def media_file(filename: str) -> Any:
        return deps.media_file_response(filename)

    @media_paths_bp.route("/vod-media/<path:filename>")
    def vod_media_file(filename: str) -> Any:
        return deps.vod_media_file_response(filename)

    @media_paths_bp.route("/download/<path:filename>")
    def download_file(filename: str) -> Any:
        return deps.download_file_response(filename)

    @media_paths_bp.route("/open-folder/<path:filename>", methods=["POST"])
    def open_folder(filename: str) -> Any:
        return deps.open_folder_response(filename)

    @media_paths_bp.route("/delete/<path:filename>", methods=["POST"])
    def delete_file(filename: str) -> Any:
        return deps.delete_file_response(filename)

    return media_paths_bp