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

## Implementation-Ready Slice (<= 1 day)

### Slice Goal
Centralize repeated allowlist+existence checks for the first low-risk subset of endpoints in `app/webui.py` without changing response behavior.

### Exact Helper (add in `app/webui.py` near `resolve_allowed_path`)
```python
def resolve_existing_allowed_path(path_value: str, allowed_dirs: List[Path]) -> Optional[Path]:
	file_path = resolve_allowed_path(path_value, allowed_dirs)
	if file_path is None or not file_path.exists():
		return None
	return file_path
```

Rationale:
- Reuses existing traversal/allowlist semantics from `resolve_allowed_path`.
- Only centralizes the duplicated `None or not exists` check.
- Keeps status code/body behavior in each endpoint unchanged.

### First Endpoints to Migrate
1. `GET /media-path`
2. `GET /download-path`
3. `POST /open-folder-path`
4. `POST /delete-path`

All four currently duplicate this pattern:
- load config
- build media allowlist via `get_allowed_media_dirs(config)`
- resolve path via `resolve_allowed_path(...)`
- 404 when `None` or missing file

### Exact Migration Pattern (no behavior change)
From:
```python
allowed_dirs = get_allowed_media_dirs(config)
file_path = resolve_allowed_path(request.args.get("path", ""), allowed_dirs)
if file_path is None or not file_path.exists():
	abort(404)
```

To:
```python
allowed_dirs = get_allowed_media_dirs(config)
file_path = resolve_existing_allowed_path(request.args.get("path", ""), allowed_dirs)
if file_path is None:
	abort(404)
```

### Explicit Non-Goals for this Slice
- Do not change `resolve_allowed_path` behavior.
- Do not change response schemas/status codes.
- Do not migrate route-path endpoints (`/media/<path:filename>`, `/download/<path:filename>`, etc.) yet.
- Do not move helpers out of `app/webui.py` in this slice.

### Estimated Effort
- Helper addition: 10 minutes
- 4 endpoint edits: 20-30 minutes
- Smoke validation: 20-30 minutes
- Total: ~1 hour

### Smoke Validation (manual)
1. Start app: `python -m app.webui`
2. Valid file under replay/download root:
   - `GET /media-path?path=<valid>` returns file
   - `GET /download-path?path=<valid>` returns attachment
   - `POST /open-folder-path?path=<valid>` returns `{ "ok": true }`
   - `POST /delete-path?path=<valid>` deletes file and returns `{ "ok": true }`
3. Invalid/outside allowlist path for each endpoint returns 404 exactly as before.

### Follow-up Slice (next)
After parity confirmation, migrate these to the same helper style:
- `POST /api/clip-name` (keep JSON 404 body)
- `/api/overlay/image` and `/api/overlay/remove` (overlay-root allowlist)

## Validation Checklist
- Traversal attempts (`..`, absolute external paths) rejected consistently.
- Existing valid media/VOD operations continue to work.
- Overlay upload/image/remove still limited to `overlay/`.
