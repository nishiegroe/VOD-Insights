# Project Guidelines

## Code Style
- Python backend follows typed functions, dataclasses, and `Path`-based file handling patterns: [app/config.py](app/config.py), [app/main.py](app/main.py), [app/runtime_paths.py](app/runtime_paths.py).
- Keep backend modules composable by responsibility (capture → OCR → detect → write/split): [app/capture.py](app/capture.py), [app/ocr.py](app/ocr.py), [app/detector.py](app/detector.py), [app/bookmark_writer.py](app/bookmark_writer.py).
- Desktop code is Electron CommonJS (`require`, semicolons); match existing style: [desktop/main.js](desktop/main.js), [desktop/dev.js](desktop/dev.js).
- Frontend is React + hooks with plain CSS; do not introduce Tailwind: [frontend/src/main.jsx](frontend/src/main.jsx), [frontend/src/styles.css](frontend/src/styles.css).

## Architecture
- `app/launcher.py` is the mode entrypoint (`main`, `bookmarks`, `split`, `vod`, `webui`): [app/launcher.py](app/launcher.py).
- `app/webui.py` is the API and static-host boundary for browser and Electron clients: [app/webui.py](app/webui.py).
- Electron starts/supervises Python and then loads `http://127.0.0.1:5170`: [desktop/main.js](desktop/main.js).
- Vite dev server proxies backend/media routes to Flask on port `5170`: [frontend/vite.config.js](frontend/vite.config.js).

## Build and Test
- Install Python deps: `pip install -r requirements.txt`
- Install JS deps (root + subprojects): `npm install`, `npm --prefix frontend install`, `npm --prefix desktop install`
- Root scripts: `npm run sync:meta`, `npm run dev`, `npm run build`, `npm run build:desktop`, `npm run build:desktop:portable` ([package.json](package.json)).
- Python entrypoints: `python -m app.webui`, `python -m app.main`, `python -m app.bookmark_main`, `python -m app.vod_ocr --vod <file>`, `python -m app.split_bookmarks`, `python -m app.launcher --mode <mode>` ([README.md](README.md)).
- Installer build helper: `powershell -ExecutionPolicy Bypass -File .\scripts\build_inno.ps1` ([scripts/build_inno.ps1](scripts/build_inno.ps1)).
- No first-party automated test suite is configured; run targeted smoke checks for touched areas (for example `GET /api/status`, `GET /api/config` after starting `app.webui`).

## Project Conventions
- Treat `app_meta.json` as single-source metadata; run `npm run sync:meta` after app name/version changes: [scripts/sync_app_meta.cjs](scripts/sync_app_meta.cjs), [README.md](README.md).
- Runtime user data/config is under `%APPDATA%/VODInsights` (overrides include `AET_APPDATA_DIR` and `AET_APPDATA_BASE`): [app/runtime_paths.py](app/runtime_paths.py).
- Preserve path rebasing to runtime dirs for bookmarks/replays/media APIs: [app/webui.py](app/webui.py), [app/vod_ocr.py](app/vod_ocr.py), [app/split_bookmarks.py](app/split_bookmarks.py).
- Clip naming embeds timestamp + stats fields; keep generated filenames compatible: [app/split_bookmarks.py](app/split_bookmarks.py), [app/config.json](app/config.json).

## Integration Points
- OCR backends: Tesseract (`pytesseract`) and optional EasyOCR/Torch path via config: [app/ocr.py](app/ocr.py), [app/config.json](app/config.json).
- Capture stack: `dxcam` preferred with `mss` fallback; VOD scans use OpenCV frame reads: [app/capture.py](app/capture.py), [app/vod_ocr.py](app/vod_ocr.py).
- Clip splitting depends on FFmpeg discovery from PATH/bundled tools: [app/split_bookmarks.py](app/split_bookmarks.py), [app/runtime_paths.py](app/runtime_paths.py), [tools/README.txt](tools/README.txt).
- Twitch import depends on yt-dlp flows handled in web API jobs: [app/webui.py](app/webui.py).
- Dependency bootstrap and optional runtime installs are handled by desktop startup and web API bootstrap routes: [desktop/main.js](desktop/main.js), [app/webui.py](app/webui.py), [app/dependency_bootstrap.py](app/dependency_bootstrap.py).

## Security
- For file-serving/deletion endpoints, always keep path allowlist checks (`resolve_allowed_path`) before file access: [app/webui.py](app/webui.py).
- Keep upload filename sanitization and avoid introducing unsanitized user path usage: [app/webui.py](app/webui.py).
- Keep dependency download host allowlist behavior when changing bootstrap logic: [app/dependency_bootstrap.py](app/dependency_bootstrap.py).
- Review external process execution changes carefully (FFmpeg, yt-dlp, subprocess, pip): [app/webui.py](app/webui.py), [app/split_bookmarks.py](app/split_bookmarks.py), [app/dependency_bootstrap.py](app/dependency_bootstrap.py).
- Keep backend binding local (`127.0.0.1`) unless explicitly changing trust boundaries: [app/webui.py](app/webui.py), [desktop/main.js](desktop/main.js).
