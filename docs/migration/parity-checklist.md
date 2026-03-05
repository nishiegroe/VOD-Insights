# Parity Checklist (Phase 0)

Last updated: 2026-03-04

## How to Use
Run this checklist before and after each migration PR that moves routes, process management, or config logic.

## Prerequisites
- Python environment active
- Dependencies installed (`pip install -r requirements.txt`)
- Backend starts locally: `python -m app.webui`

## Automated Baseline
- [ ] `python tests/test_vod_api.py`
- [ ] `python -m pytest tests/test_vod_download.py -v`

## API Smoke (PowerShell)
- [ ] `Invoke-RestMethod http://127.0.0.1:5170/api/status`
- [ ] `Invoke-RestMethod http://127.0.0.1:5170/api/config`
- [ ] `Invoke-RestMethod http://127.0.0.1:5170/api/vods`
- [ ] `Invoke-RestMethod http://127.0.0.1:5170/api/clips`
- [ ] `Invoke-RestMethod http://127.0.0.1:5170/api/bootstrap/status`
- [ ] `Invoke-RestMethod http://127.0.0.1:5170/api/vod/check-tools`

## Process Lifecycle Checks
- [ ] `POST /api/control/start` returns `{ ok: true }`
- [ ] `POST /api/control/stop` returns `{ ok: true }`
- [ ] `POST /api/vod-ocr` accepts valid request and reports run state
- [ ] `POST /api/stop-vod-ocr` handles active and inactive states correctly

## Security Checks
- [ ] Path traversal payloads (`..`) against file endpoints return 4xx and do not access files
- [ ] Upload endpoint rejects unsupported image types for overlay
- [ ] Delete/open-folder endpoints reject out-of-allowlist paths

## Frontend/Desktop Checks
- [ ] Home page status loads
- [ ] Settings GET/POST still works
- [ ] VOD list and Clips list render
- [ ] Electron launches backend once and exits without orphan backend process

## Sign-off Block
- PR/Change:
- Date:
- Checker:
- Result: Pass / Fail
- Notes:
