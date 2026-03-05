from __future__ import annotations

from flask import Flask

from app.routes.capture_area import CaptureAreaRouteDeps, create_capture_area_blueprint
from app.routes.clips import ClipsRouteDeps, create_clips_blueprint
from app.routes.gpu import GpuRouteDeps, create_gpu_blueprint
from app.routes.legacy_control import LegacyControlRouteDeps, create_legacy_control_blueprint
from app.routes.logs import LogsRouteDeps, create_logs_blueprint
from app.routes.media_paths import MediaPathsRouteDeps, create_media_paths_blueprint
from app.routes.overlay import OverlayRouteDeps, create_overlay_blueprint
from app.routes.spa import SpaRouteDeps, create_spa_blueprint
from app.routes.session import SessionRouteDeps, create_session_blueprint
from app.routes.system import SystemRouteDeps, create_system_blueprint
from app.routes.twitch_import import TwitchImportRouteDeps, create_twitch_import_blueprint
from app.routes.vod_scan import VodScanRouteDeps, create_vod_scan_blueprint
from app.routes.vod_actions import VodActionsRouteDeps, create_vod_actions_blueprint
from app.routes.vod_download import VodDownloadRouteDeps, create_vod_download_blueprint
from app.routes.vod_thumbnail import VodThumbnailRouteDeps, create_vod_thumbnail_blueprint
from app.routes.vods import VodsRouteDeps, create_vods_blueprint


def register_blueprints(
    app: Flask,
    *,
    capture_area_deps: CaptureAreaRouteDeps,
    system_deps: SystemRouteDeps,
    gpu_deps: GpuRouteDeps,
    overlay_deps: OverlayRouteDeps,
    vod_download_deps: VodDownloadRouteDeps,
    twitch_import_deps: TwitchImportRouteDeps,
    logs_deps: LogsRouteDeps,
    media_paths_deps: MediaPathsRouteDeps,
    legacy_control_deps: LegacyControlRouteDeps,
    session_deps: SessionRouteDeps,
    clips_deps: ClipsRouteDeps,
    vods_deps: VodsRouteDeps,
    vod_scan_deps: VodScanRouteDeps,
    vod_actions_deps: VodActionsRouteDeps,
    vod_thumbnail_deps: VodThumbnailRouteDeps,
    spa_deps: SpaRouteDeps,
) -> Flask:
    if "capture_area" not in app.blueprints:
        app.register_blueprint(create_capture_area_blueprint(capture_area_deps))
    if "system" not in app.blueprints:
        app.register_blueprint(create_system_blueprint(system_deps))
    if "gpu" not in app.blueprints:
        app.register_blueprint(create_gpu_blueprint(gpu_deps))
    if "overlay" not in app.blueprints:
        app.register_blueprint(create_overlay_blueprint(overlay_deps))
    if "vod_download" not in app.blueprints:
        app.register_blueprint(create_vod_download_blueprint(vod_download_deps))
    if "twitch_import" not in app.blueprints:
        app.register_blueprint(create_twitch_import_blueprint(twitch_import_deps))
    if "logs" not in app.blueprints:
        app.register_blueprint(create_logs_blueprint(logs_deps))
    if "media_paths" not in app.blueprints:
        app.register_blueprint(create_media_paths_blueprint(media_paths_deps))
    if "legacy_control" not in app.blueprints:
        app.register_blueprint(create_legacy_control_blueprint(legacy_control_deps))
    if "session" not in app.blueprints:
        app.register_blueprint(create_session_blueprint(session_deps))
    if "clips" not in app.blueprints:
        app.register_blueprint(create_clips_blueprint(clips_deps))
    if "vods" not in app.blueprints:
        app.register_blueprint(create_vods_blueprint(vods_deps))
    if "vod_scan" not in app.blueprints:
        app.register_blueprint(create_vod_scan_blueprint(vod_scan_deps))
    if "vod_actions" not in app.blueprints:
        app.register_blueprint(create_vod_actions_blueprint(vod_actions_deps))
    if "vod_thumbnail" not in app.blueprints:
        app.register_blueprint(create_vod_thumbnail_blueprint(vod_thumbnail_deps))
    if "spa" not in app.blueprints:
        app.register_blueprint(create_spa_blueprint(spa_deps))
    return app
