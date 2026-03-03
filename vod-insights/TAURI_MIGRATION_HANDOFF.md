# Tauri Migration Handoff

## Current State Summary
- Planning and research are complete.
- Migration implementation has not started.
- Decision set is finalized for milestone 1 and should be treated as scope guardrails.

## Key Architecture Facts (Current Electron App)
- Electron main process supervises Python backend lifecycle and logs backend output.
- Backend is expected on localhost 127.0.0.1:5170 (configurable by env), and desktop window loads that URL.
- In packaged mode today, Flask serves both API routes and built frontend static assets/catch-all route.
- In dev, frontend Vite server proxies API/media requests to backend on 127.0.0.1:5170.
- Desktop currently sets runtime env flags for backend (watch off, appdata/install dirs, temp dirs, port).
- Existing desktop update behavior is custom feed-driven and integrated in Electron layer.

## Critical Files Map for Migration

### Add (Expected)
- src-tauri/Cargo.toml
- src-tauri/tauri.conf.json
- src-tauri/src/main.rs
- src-tauri/src/backend_supervisor.rs (or equivalent)
- src-tauri/src/updater.rs (or equivalent)
- Optional Tauri capability/permissions files as needed

### Modify (High Probability)
- package.json (root scripts for tauri dev/build/release)
- frontend build integration points (if output path/wiring changes)
- app/webui.py (API-only mode for packaged desktop path)
- app/runtime_paths.py (if packaged resource resolution assumptions need Tauri-aware adjustments)
- Release/update metadata preparation scripts
- Installer/resource mapping scripts and docs

### Remove or Deprioritize After Parity
- desktop/main.js
- desktop/preload.js
- desktop/dev.js
- desktop/package.json
- desktop/installer.nsh (if no longer needed in MSI path)
- Electron-specific build/release wiring in root scripts

## Risks and Mitigations
- Backend process lifecycle mismatch in new shell  
  - Mitigation: implement explicit start/health-check/stop with timeout and forced cleanup fallback.
- Resource/path regressions in packaged mode  
  - Mitigation: parity tests for tools, models, config, logs, and appdata persistence.
- Updater behavior drift (metadata/signing/channel differences)  
  - Mitigation: stage updater in controlled channel and verify rollback/restart paths before broad rollout.
- Security regressions around file APIs  
  - Mitigation: preserve existing allowlist/sanitize behavior unchanged and retest path traversal protections.
- Performance/startup regressions  
  - Mitigation: baseline startup timing and key workflow timings before/after migration.

## Assumptions

### Resolved
- Frontend will be bundled in desktop package.
- Flask remains API-only backend service for desktop runtime.
- Tauri updater is the update mechanism.
- MSI is the primary Windows installer target.
- Milestone 1 is parity-only (no feature expansion).

### Still Open Operational Choices
- Code signing and certificate handling workflow for MSI and updater artifacts.
- Update channel strategy (stable/prerelease), feed hosting details, and rollout cadence.
- Final backend bundling strategy details (single-file exe vs packaged runtime layout) inside Tauri bundle.
- CI/CD ownership split between Python build, frontend build, and Tauri packaging stages.

## Suggested Phased Rollout with Rollback Points
- Phase 0: Scaffold Tauri and keep Electron as production default  
  - Rollback: continue shipping Electron artifacts only.
- Phase 1: Tauri + backend supervision + bundled frontend in internal builds  
  - Rollback: disable Tauri release channel; ship Electron.
- Phase 2: Updater + MSI packaging validated in staging  
  - Rollback: keep updater disabled for Tauri while retaining manual install path.
- Phase 3: Limited production rollout (small cohort)  
  - Rollback: freeze Tauri channel, direct users to last known-good Electron installer.
- Phase 4: Full rollout and Electron retirement  
  - Rollback: preserve one release window of Electron artifacts for emergency reversion.

## Quick Start Checklist (Next Engineer/Session)
- Prereqs
  - Rust toolchain + Tauri v2 prerequisites on Windows.
  - Existing Python build chain and frontend/node toolchain already used by this repo.
  - Access to release/update metadata pipeline and signing materials.
- First implementation targets
  - Create Tauri scaffold.
  - Implement backend supervisor (start, wait-for-port, graceful/forced stop).
  - Serve bundled frontend in Tauri webview and keep API calls against localhost backend.
- First validation targets
  - App opens and reaches healthy backend on expected localhost port.
  - API status/config endpoints and one end-to-end user flow succeed in packaged build.
  - Close/reopen behavior leaves no orphan backend process.

## Definition of Done (Milestone 1)
- Tauri MSI build is installable and launches successfully on supported Windows environments.
- All Electron user-visible workflows are functionally equivalent.
- Backend lifecycle management is stable across start/stop/restart/update paths.
- Updater check and install flow works in target release channel.
- Existing user config/data compatibility is preserved.
- Security-sensitive file endpoint behavior remains intact.
- Release documentation/build scripts are updated enough for repeatable team execution.
