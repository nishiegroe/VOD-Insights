# API Contract Inventory (Phase 0 Baseline)

Last updated: 2026-03-04  
Source of truth: `app/webui.py`

## Purpose
This document freezes the current backend API surface before refactoring so route extraction can be validated for parity.

## Current Route Counts
- Total Flask routes in `app/webui.py`: 64
- `/api/*` routes: 43
- Legacy/non-`/api` routes: 21

## Core Migration-Critical Contracts
These endpoints must preserve status codes and response field compatibility during Phase 1 and Phase 2.

| Endpoint | Method | Baseline Response Shape | Notes |
|---|---|---|---|
| `/api/status` | GET | `bookmark_running`, `dev_mode`, `bootstrap_required_ready` | Used for app health + control state |
| `/api/config` | GET | Full config object | Current source from runtime config file |
| `/api/config` | POST | `ok`, `config` | Must preserve in-place config update semantics |
| `/api/vods` | GET | `vods`, `remaining_count` | Accepts `all` and `limit` query params |
| `/api/clips` | GET | `clips` | `limit` query param, defaults to 20 |
| `/api/control/start` | POST | `ok` | Starts bookmark process |
| `/api/control/stop` | POST | `ok` | Stops bookmark process |
| `/api/vod-ocr` | POST | `ok` on accepted run | VOD scan lifecycle endpoint |
| `/api/stop-vod-ocr` | POST | `ok` + message/error forms | Process control, state-sensitive |
| `/api/pause-vod-ocr` | POST | `ok` + message/error forms | Uses pause marker behavior |
| `/api/resume-vod-ocr` | POST | `ok` + message/error forms | Requires existing scan context |
| `/api/vod/download` | POST | `job_id`, `status`, `message` (202) or error body | Twitch import path |
| `/api/vod/progress/<job_id>` | GET | Job state object or error | Must preserve 404 for unknown job |
| `/api/vod/check-tools` | GET | `yt_dlp_installed`, `message` | Used by Twitch import UI |
| `/api/bootstrap/status` | GET | Bootstrap status object | Installer/runtime readiness |
| `/api/bootstrap/start` | POST | Bootstrap start object | Accepts `install_gpu_ocr` |

## Route Grouping (for Blueprint Extraction)
### Group A: System/Status/Notifications
- `/api/status`
- `/api/test-connection`
- `/api/notifications`
- `/api/update/latest`
- `/api/debug/paths`

### Group B: Config/Controls
- `/api/config` (GET, POST)
- `/api/control/start`
- `/api/control/stop`
- `/api/choose-replay-dir`
- legacy `/config`, `/choose-replay-dir`

### Group C: Media/File Access (security-sensitive)
- `/media-path`, `/download-path`, `/open-folder-path`, `/delete-path`
- `/media/<path:filename>`, `/vod-media/<path:filename>`, `/download/<path:filename>`
- `/open-folder/<path:filename>`, `/delete/<path:filename>`

### Group D: VOD and Session Operations
- `/api/vods`, `/api/vods/single`, `/api/vods/delete`, `/api/vods/stream`
- `/api/session-data`
- `/api/vod-ocr-upload`, `/api/vod-ocr`, `/api/stop-vod-ocr`, `/api/pause-vod-ocr`, `/api/resume-vod-ocr`, `/api/delete-sessions`

### Group E: Clips
- `/api/clips`, `/api/clips/days`, `/api/clips/by-day`, `/api/clips/lookup`
- `/api/clip-range`, `/api/clip-name`
- legacy `/split-selected`, `/api/split-selected`

### Group F: Bootstrap/GPU/OCR
- `/api/bootstrap/status`, `/api/bootstrap/start`
- `/api/ocr-gpu-status`, `/api/ocr-gpu-diagnostics`, `/api/install-gpu-ocr`

### Group G: Overlay and UI Assets
- `/api/overlay/upload`, `/api/overlay/image`, `/api/overlay/remove`
- `/logo.png`, `/`, `/<path:path>`

### Group H: Twitch Import/Download
- `/api/twitch-imports`, `/api/twitch-import`, `/api/twitch-import/<job_id>`
- `/api/vod/download`, `/api/vod/progress/<job_id>`, `/api/vod/check-tools`

## Parity Rules
- Preserve endpoint paths and methods unless explicitly versioned.
- Preserve success/error HTTP status codes.
- Preserve required response keys consumed by frontend and desktop code.
- Preserve local-only trust boundary assumptions (`127.0.0.1`).

## Migration Notes
- First extraction target: Group A (System) + `/api/config` only.
- Do not move security-sensitive Group C and process-control endpoints in the same PR as app factory introduction.
