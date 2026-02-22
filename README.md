# VOD Insights
### Turn your Apex VODs into highlights and clips automatically.
### VOD Insights watches your killfeed, detects key moments, and saves bookmarks you can auto-clip or review later. Nearby events are intelligently merged into a single, cleaner highlight. Set a custom detection area in your recording, or download Twitch VODs and analyze them the same way.
### After the session, it can split recordings into ready-to-share clips, rename them with event details, and scan VODs for highlights. A local web UI and desktop wrapper keep the workflow fast and simple.
#### *Runs on most Windows PCs, and processing speed scales with your hardware (faster CPUs/GPU capture yield quicker scans).

### Key Features:
- Killfeed event detection with configurable capture region, OCR settings, and cooldown keywords.
- Replay/clip naming with timestamp + event text, plus kill/assist/death counts.
- Bookmarks mode: logs timestamps during long VODs (CSV/JSONL).
- Auto-splitting: FFmpeg cuts clips around bookmarks and merges nearby events into one larger clip.
- Twitch VOD support: download VODs and analyze them with your custom detection area.
- VOD tools: scan recorded VODs for events, pause/resume scans, and split from sessions.
- Web UI + desktop wrapper: manage config, clips, VODs, logs, and Twitch VOD imports.

</br>
</br></br>

# Apex Event OCR -> Bookmarks and Clips

This tool captures the Apex Legends killfeed region, runs OCR, and detects keywords
(kill/assist/knock) to create bookmarks and power automatic clip splitting.

## Requirements

- Windows 10/11
- Python 3.10+
- Tesseract OCR installed (for pytesseract)
- yt-dlp installed and available in PATH (for Twitch VOD import)

## Setup

### App name/version (single source)

Update [app_meta.json](app_meta.json) to change app name and version in one place.

- `displayName`: user-facing app name.
- `internalName`: EXE/folder name (no spaces recommended).
- `version`: release version.

Metadata is auto-synced when you run `npm run dev`, `npm run build`, `npm run build:desktop`, or `npm run build:desktop:portable`.
You can also sync manually with:

```bash
npm run sync:meta
```

1. Create a virtual environment and install dependencies:

   ```bash
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. Install Tesseract:
   - Download and install from the official Tesseract OCR project.
   - Ensure `tesseract.exe` is in PATH.

3. Calibrate the killfeed region:
   - Edit [app/config.json](app/config.json) capture coordinates.
   - Run preview:
     ```bash
     python -m app.main --preview
     ```
   - Press `q` to quit preview.

4. Run:

   ```bash
   python -m app.main
   ```

## Bookmarks Mode (Continuous Recording)

Use this if you are recording long sessions and only want timestamps.

1. Run the bookmarks logger:

   ```bash
   python -m app.bookmark_main
   ```

2. Check the session file in the bookmarks directory (e.g. `bookmarks/session_YYYYMMDD_HHMMSS.csv`).

## Auto-Split From Bookmarks

Use this after a long recording to export clips around each bookmark.

1. Set `replay.directory` (where recordings are stored) and `split.output_dir` 
   (where clips will be saved) in [app/config.json](app/config.json).
2. Run:

   ```bash
   python -m app.split_bookmarks
   ```

## VOD Library

Use the VOD Library page to select a recording and a session file to split:

- Open http://127.0.0.1:5170/vods

Clips are named using the count format in `split.count_format`, for example:
`clip_20260208_154500_01_k1_a2_d1.mp4`.

## Web UI

Run the local web UI to manage config, start/stop bookmarks, and view logs:

```bash
python -m app.webui
```

Then open http://127.0.0.1:5170 in your browser.

## Logging

- Logs are written to `app.log` next to [app/config.json](app/config.json).
- When packaged as an EXE, config/logs live under `%APPDATA%\VODInsights`.

## Launcher (EXE-ready)

Use the launcher to pick a mode from one entry point:

```bash
python -m app.launcher --mode webui
python -m app.launcher --mode main
python -m app.launcher --mode bookmarks
python -m app.launcher --mode vod --vod "path\\to\\video.mp4"
```

## Build EXE (Windows)

1. Build with the primary release flow:

   ```bash
   npm run build
   ```

   Or directly:

   ```powershell
   scripts\\build_inno.ps1
   ```

2. Place optional tools in [tools/README.txt](tools/README.txt) for bundling.

   To auto-download and bundle tools + licenses:

   ```powershell
   scripts\\download_tools.ps1
   ```

The EXE is output to `dist\VODInsights\VODInsights.exe`.
- Set `logging.log_ocr` to `false` to reduce OCR log noise.
- The build script installs PyInstaller in the venv if missing.

## Desktop EXE (Web UI Wrapper)

This wraps the local web UI in a desktop window and launches the backend
automatically.

Primary installer build (recommended):

1. Install Inno Setup 6.
2. Run:

   ```powershell
   scripts\\build_inno.ps1
   ```

   If Inno Setup is installed elsewhere, pass the path to `ISCC.exe`:

   ```powershell
   scripts\\build_inno.ps1 -ISCC "C:\\Path\\To\\ISCC.exe"
   ```

3. The installer EXE is output to `dist-desktop\\inno`.

Notes:
- The desktop app launches the backend with `APEX_WEBUI_WATCH=0`.
- If you keep a custom Tesseract install path, ensure it is in your PATH
   before launching the desktop EXE.
- The build script installs PyInstaller in the venv if missing.

## GitHub Releases (Tagged)

This project uses tagged releases in `vX.Y.Z` format.

### First-time setup

1. Install GitHub CLI (`gh`) and authenticate:

   ```powershell
   gh auth login
   ```

2. Update version metadata in [app_meta.json](app_meta.json), then sync:

   ```bash
   npm run sync:meta
   ```

### Prepare release assets

1. Create and push a version tag matching `app_meta.json`:

   ```powershell
   git tag v0.1.1
   git push origin v0.1.1
   ```

2. Build installer and generate release metadata/checksum assets:

   ```powershell
   npm run release:prep -- --tag v0.1.1
   ```

   This outputs:
   - Installer EXE in `dist-desktop\\inno`
   - `dist-desktop\\inno\\latest.json`
   - `dist-desktop\\inno\\checksums.txt`

### Publish release

Use the command printed by `npm run release:prep`, or run:

```powershell
gh release create v0.1.1 \
  dist-desktop/inno/VODInsights-Setup-0.1.1.exe \
  dist-desktop/inno/latest.json \
  dist-desktop/inno/checksums.txt \
  --title "VOD Insights v0.1.1" \
  --notes "VOD Insights v0.1.1"
```

Notes:
- `--tag` must match `app_meta.json` version (`v${version}`).
- `latest.json` is intended for desktop in-app update checks.
- `checksums.txt` provides SHA-256 verification for installer integrity.

### Desktop updater runtime options

- `AET_UPDATE_FEED_URL`: override update metadata URL (defaults to GitHub `releases/latest/download/latest.json`).
- `AET_DISABLE_UPDATER=1`: disable in-app update checks for a build/session.

## Notes

- Start with `dxcam` (fast) or `mss` (fallback). The app picks `dxcam` if available.
- Increase `scale` in config for better OCR at the cost of CPU.
- Adjust `threshold` for cleaner text.
- If `dxcam` throws `MemoryError`, set `capture.backend` to `mss` in
   [app/config.json](app/config.json).
- To reduce CPU/memory impact, increase `ocr.interval_seconds` and/or lower
   `capture.fps` in [app/config.json](app/config.json).
