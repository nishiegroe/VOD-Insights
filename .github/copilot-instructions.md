# Project Guidelines

## Code Style
- Python backend code uses typed functions, `Path` objects, dataclasses, and `from __future__ import annotations` patterns: [app/main.py](app/main.py), [app/config.py](app/config.py), [app/capture.py](app/capture.py).
- Keep backend modules focused and composable (capture, OCR, detect, write): [app/capture.py](app/capture.py), [app/ocr.py](app/ocr.py), [app/detector.py](app/detector.py), [app/bookmark_writer.py](app/bookmark_writer.py).
- Desktop code is Electron + CommonJS (`require`, semicolons): [desktop/main.js](desktop/main.js), [desktop/dev.js](desktop/dev.js).
- Frontend code is React (ESM + hooks) with plain CSS tokens; avoid introducing Tailwind: [frontend/src/main.jsx](frontend/src/main.jsx), [frontend/src/styles.css](frontend/src/styles.css).
- Match existing local style; no repo-wide formatter/linter config is currently enforced.

## Architecture
- Runtime flow is modular: frame capture -> OCR -> keyword detection -> bookmark output. Preserve this pipeline boundary when adding features: [app/main.py](app/main.py), [app/ocr.py](app/ocr.py), [app/detector.py](app/detector.py), [app/bookmark_writer.py](app/bookmark_writer.py).
- `app/launcher.py` is the mode entrypoint (`main`, `bookmarks`, `split`, `vod`, `webui`): [app/launcher.py](app/launcher.py).
- `app/webui.py` is the Flask API + static host boundary used by both browser and desktop shell: [app/webui.py](app/webui.py).
- Electron starts and supervises the Python backend on localhost, then loads the UI: [desktop/main.js](desktop/main.js).
- Frontend talks to backend HTTP endpoints directly; dev proxy is defined in Vite config: [frontend/vite.config.js](frontend/vite.config.js).

## Build and Test
- Install Python deps: `pip install -r requirements.txt`
- Install JS deps (root + subprojects): `npm install`, `npm --prefix frontend install`, `npm --prefix desktop install`
- Root workflows: `npm run sync:meta`, `npm run dev`, `npm run build`, `npm run build:desktop`, `npm run build:desktop:portable` ([package.json](package.json)).
- Python entrypoints: `python -m app.main`, `python -m app.bookmark_main`, `python -m app.split_bookmarks`, `python -m app.webui`, `python -m app.launcher --mode <mode>` ([README.md](README.md)).
- Packaging helpers: `scripts\build_inno.ps1`, `scripts\download_tools.ps1` ([README.md](README.md), [scripts/build_inno.ps1](scripts/build_inno.ps1)).
- There is no first-party automated test suite configured yet; do targeted runtime/build checks for changed areas.

## Project Conventions
- Treat `app_meta.json` as single-source metadata; run `npm run sync:meta` after app name/version changes: [scripts/sync_app_meta.cjs](scripts/sync_app_meta.cjs), [README.md](README.md).
- Runtime user data/config is under `%APPDATA%/VODInsights` (or `AET_APPDATA_DIR` override): [app/runtime_paths.py](app/runtime_paths.py).
- Many relative bookmark/replay/media paths are resolved against runtime directories; preserve this behavior in file APIs: [app/webui.py](app/webui.py), [app/vod_ocr.py](app/vod_ocr.py), [app/split_bookmarks.py](app/split_bookmarks.py).
- Clip naming embeds timestamp + stats fields; keep generated filenames compatible: [app/split_bookmarks.py](app/split_bookmarks.py), [app/config.json](app/config.json).

## Integration Points
- OCR backends: Tesseract (`pytesseract`) and optional EasyOCR/Torch path via config: [app/ocr.py](app/ocr.py), [app/config.json](app/config.json).
- Capture stack: `dxcam` preferred with `mss` fallback; VOD processing uses OpenCV video reads: [app/capture.py](app/capture.py), [app/vod_ocr.py](app/vod_ocr.py).
- Clip splitting depends on FFmpeg discovery from PATH/bundled tools: [app/split_bookmarks.py](app/split_bookmarks.py), [app/runtime_paths.py](app/runtime_paths.py), [tools/README.txt](tools/README.txt).
- Twitch import depends on yt-dlp flows handled in web API jobs: [app/webui.py](app/webui.py).

## Security
- For file-serving/deletion endpoints, always keep path allowlist checks (`resolve_allowed_path`) before file access: [app/webui.py](app/webui.py).
- Keep upload filename sanitization and avoid introducing unsanitized user path usage: [app/webui.py](app/webui.py).
- Review any external process execution changes carefully (FFmpeg, yt-dlp, subprocess launches, pip installs): [app/webui.py](app/webui.py), [app/split_bookmarks.py](app/split_bookmarks.py).
- Keep backend binding local (`127.0.0.1`) unless explicitly changing trust boundaries: [app/webui.py](app/webui.py), [desktop/main.js](desktop/main.js).
