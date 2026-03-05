from __future__ import annotations

from flask import Flask

from app.routes.clips import ClipsRouteDeps, create_clips_blueprint
from app.routes.gpu import GpuRouteDeps, create_gpu_blueprint
from app.routes.logs import LogsRouteDeps, create_logs_blueprint
from app.routes.overlay import OverlayRouteDeps, create_overlay_blueprint
from app.routes.session import SessionRouteDeps, create_session_blueprint
from app.routes.system import SystemRouteDeps, create_system_blueprint
from app.routes.twitch_import import TwitchImportRouteDeps, create_twitch_import_blueprint
from app.routes.vod_scan import VodScanRouteDeps, create_vod_scan_blueprint
from app.routes.vod_download import VodDownloadRouteDeps, create_vod_download_blueprint
from app.routes.vods import VodsRouteDeps, create_vods_blueprint


def register_blueprints(
    app: Flask,
    *,
    system_deps: SystemRouteDeps,
    gpu_deps: GpuRouteDeps,
    overlay_deps: OverlayRouteDeps,
    vod_download_deps: VodDownloadRouteDeps,
    twitch_import_deps: TwitchImportRouteDeps,
    logs_deps: LogsRouteDeps,
    session_deps: SessionRouteDeps,
    clips_deps: ClipsRouteDeps,
    vods_deps: VodsRouteDeps,
    vod_scan_deps: VodScanRouteDeps,
) -> Flask:
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
    if "session" not in app.blueprints:
        app.register_blueprint(create_session_blueprint(session_deps))
    if "clips" not in app.blueprints:
        app.register_blueprint(create_clips_blueprint(clips_deps))
    if "vods" not in app.blueprints:
        app.register_blueprint(create_vods_blueprint(vods_deps))
    if "vod_scan" not in app.blueprints:
        app.register_blueprint(create_vod_scan_blueprint(vod_scan_deps))
    return app
