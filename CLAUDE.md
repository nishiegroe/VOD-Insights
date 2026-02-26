# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**VOD Insights** – a Windows desktop app for Apex Legends VOD analysis. It captures the killfeed region via OCR, detects kill/assist/knock events, creates bookmarks, and auto-splits recordings into clips. Distributed as a Windows installer.

Stack:
- **Python backend** (`app/`) – Flask web server (`webui.py`), OCR pipeline, clip-splitting logic
- **React frontend** (`frontend/`) – Vite + React 18 SPA, served by Flask in production
- **Electron desktop wrapper** (`desktop/`) – wraps the local web UI in a native window, launches the Python backend
- **Build tooling** (root `package.json`, `scripts/`) – Node.js scripts orchestrate PyInstaller + Inno Setup + GitHub releases

## Development Commands

### Python backend
```bash
# Create and activate venv
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Run the web UI (Flask on port 5170)
python -m app.webui

# Run OCR capture directly
python -m app.main

# Preview capture region calibration
python -m app.main --preview

# Run bookmarks logger
python -m app.bookmark_main
```

### Frontend (React/Vite)
```bash
cd frontend
npm install
npm run dev       # dev server on port 5173, proxies /api to Flask on 5170
npm run build     # build to frontend/dist (required before packaging)
```

### Desktop (Electron)
```bash
cd desktop
npm install
npm run dev       # launches Electron pointing at the running Flask server
```

### Root-level orchestration
```bash
npm run sync:meta              # sync version/name from app_meta.json into all packages
npm run dev                    # sync:meta + ensure venv + build frontend + run Electron dev
npm run build                  # full installer build (sync:meta + build_inno.ps1)
npm run build:desktop          # electron-builder NSIS installer only
npm run build:desktop:portable # electron-builder portable EXE only
```

### Release
```bash
npm run release:prep -- --tag v1.0.7   # build installer + generate latest.json + checksums.txt
npm run release:github                  # full flow: build + tag + gh release create
npm run release:github -- --dry-run    # preview without publishing
```

## Architecture

### Python backend (`app/`)

| File | Purpose |
|------|---------|
| `webui.py` | Flask app; all `/api/*` routes; spawns subprocesses for OCR/bookmarks/VOD scan |
| `main.py` | Live OCR capture loop (dxcam/mss → Tesseract/EasyOCR → event detection) |
| `capture.py` | Screen capture abstraction (dxcam preferred, mss fallback) |
| `ocr.py` | OCR engine wrapper (Tesseract default, EasyOCR optional GPU) |
| `detector.py` | Keyword matching and event cooldown logic |
| `config.py` | Dataclass config model (`AppConfig` and sub-configs) |
| `runtime_paths.py` | Path resolution for frozen EXE vs dev; tool lookup; Torch DLL setup |
| `split_bookmarks.py` | FFmpeg-based clip splitting from bookmark CSV/JSONL |
| `vod_ocr.py` | VOD file scanning – frame extraction + OCR pipeline |
| `bookmark_main.py` | Standalone bookmark logging mode |
| `dependency_bootstrap.py` | First-run download of ffmpeg, yt-dlp, optional GPU OCR deps |
| `launcher.py` | CLI entry point (`--mode webui|main|bookmarks|vod`) |

Config lives at `%APPDATA%\VODInsights\config.json` in production; `app/config.json` is the bundled default.

### Frontend (`frontend/src/`)

React Router SPA. Pages:
- `Home` – status + start/stop controls
- `Vods` / `VodViewer` – VOD library and in-browser video player with event markers
- `Clips` / `ClipsViewer` – clip library and playback
- `Settings` – section-based config editor (autosaves to `/api/config`)
- `CaptureArea` – visual killfeed region calibration
- `TwitchImport` – queue Twitch VOD downloads via yt-dlp

In dev, Vite proxies all `/api`, `/media`, `/vod-media`, etc. requests to Flask on `http://127.0.0.1:5170`. In production, Flask serves the built `frontend/dist` directly.

### Desktop wrapper (`desktop/`)

Electron app (`main.js`) that:
1. Launches the PyInstaller-packaged backend EXE from `resources/backend/`
2. Opens a `BrowserWindow` pointing at `http://127.0.0.1:5170`
3. Handles in-app update checks via `latest.json` from GitHub Releases (`AET_UPDATE_FEED_URL`)

### Versioning

Single source of truth: **`app_meta.json`** (`internalName`, `displayName`, `version`, `patchNotes`).
Running `npm run sync:meta` propagates version to `frontend/package.json`, `desktop/package.json`, and the Inno Setup script.

### Build pipeline

`npm run build` → `scripts/build_inno.ps1`:
1. Syncs meta
2. Builds React (`frontend/dist`)
3. Runs PyInstaller to produce `dist/VODInsights/`
4. Copies tools (ffmpeg, yt-dlp) into the bundle
5. Runs Inno Setup → `dist-desktop/inno/VODInsights-Setup-{version}.exe`

### Environment variables

| Variable | Effect |
|----------|--------|
| `APEX_WEBUI_WATCH=0` | Disables file-watch restart in webui (set by desktop launcher) |
| `AET_UPDATE_FEED_URL` | Override update metadata URL |
| `AET_DISABLE_UPDATER=1` | Disable in-app update checks |
| `AET_DISABLE_BOOTSTRAP=1` | Skip first-run tool download |
| `AET_DISABLE_GPU_OCR=1` | Skip GPU OCR installation |
| `AET_APPDATA_DIR` | Override `%APPDATA%\VODInsights` data directory |
| `AET_INSTALL_DIR` | Override installation directory |
