# Path Policy Matrix (MOD-BE-003 Baseline)

Last updated: 2026-03-04  
Source: `app/webui.py`

## Purpose
Document path-sensitive endpoints and their intended allowlist roots before centralizing policy helpers.

## Endpoint Matrix
| Endpoint | Method | Path Input | Current Guard | Intended Allowed Roots |
|---|---|---|---|---|
| `/media-path` | GET | `path` query | `resolve_allowed_path` | media dirs from config + app data dirs |
| `/download-path` | GET | `path` query | `resolve_allowed_path` | media dirs from config + app data dirs |
| `/open-folder-path` | POST | `path` JSON | `resolve_allowed_path` | media dirs from config + app data dirs |
| `/delete-path` | POST | `path` JSON | `resolve_allowed_path` | media dirs from config + app data dirs |
| `/media/<path:filename>` | GET | route path | `resolve_allowed_path` | media dirs from config + app data dirs |
| `/vod-media/<path:filename>` | GET | route path | `resolve_allowed_path` | VOD directories |
| `/download/<path:filename>` | GET | route path | `resolve_allowed_path` | media dirs from config + app data dirs |
| `/open-folder/<path:filename>` | POST | route path | `resolve_allowed_path` | media dirs from config + app data dirs |
| `/delete/<path:filename>` | POST | route path | `resolve_allowed_path` | media dirs from config + app data dirs |
| `/api/vods/single` | GET | `path` query | `resolve_vod_path` + existence check | VOD directories |
| `/api/vods/delete` | POST | `path` JSON | `resolve_vod_path` + existence check | VOD directories |
| `/api/overlay/image` | GET | config path value | `resolve_allowed_path` | app data `overlay/` |
| `/api/overlay/remove` | POST | config path value | `resolve_allowed_path` | app data `overlay/` |
| `/api/session-data` | GET | multiple query params | path resolution helpers + checks | bookmarks dir, VOD dirs |
| `/api/clip-range` | POST | `path` JSON | `resolve_allowed_path` | media dirs from config + app data dirs |
| `/api/clip-name` | POST | `path` JSON | `resolve_allowed_path` | media dirs from config + app data dirs |

## Consolidation Target
- Centralize all path validation through a reusable path policy service.
- Keep the same rejection behavior (4xx) for traversal and out-of-allowlist paths.
- Keep overlay isolation strict to app data `overlay/`.

## Validation Checklist
- Traversal attempts (`..`, absolute external paths) rejected consistently.
- Existing valid media/VOD operations continue to work.
- Overlay upload/image/remove still limited to `overlay/`.
