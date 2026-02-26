# Electron to Tauri v2 Migration

## TL;DR
- Frontend delivery: bundle the built React frontend into Tauri for packaged builds.
- Backend model: keep Flask as API-only service on localhost; Tauri hosts UI shell only.
- Updates: migrate desktop update flow to Tauri updater (v2 plugin path).
- Windows packaging: ship MSI as primary installer and bundle Python backend/runtime artifacts.
- Milestone 1 scope: full feature parity with current Electron release before any net-new UX.

## Execution Steps
1. Freeze baseline and define parity matrix  
   - Capture current Electron behaviors/endpoints (startup, process lifecycle, update checks, API surface, file operations, OCR/split flows).  
   - Lock milestone-1 acceptance criteria to parity-only.

2. Scaffold Tauri v2 app shell in-repo  
   - Add Tauri project structure and Windows bundling config.  
   - Keep existing frontend project and Python backend unchanged initially.

3. Switch frontend packaging to bundled static assets  
   - Build frontend artifacts and wire Tauri webview to bundled assets for packaged mode.  
   - Keep dev mode ergonomics (frontend dev server + backend API) for local iteration.

4. Convert Flask role to API-only contract  
   - Remove frontend-serving responsibility in packaged desktop path.  
   - Preserve existing endpoint paths and localhost binding semantics.

5. Implement backend supervision in Tauri  
   - Start/monitor/stop Python backend process from Tauri lifecycle.  
   - Preserve env setup semantics used today (app data dir, ports, temp dirs, install path/tool lookup).

6. Recreate desktop bridge behaviors needed by UI  
   - Port required desktop-only capabilities from Electron preload/ipc to Tauri invoke/plugin calls.  
   - Keep frontend request contract stable where possible.

7. Migrate updater workflow to Tauri updater  
   - Integrate update metadata endpoint/asset strategy with Tauri updater expectations.  
   - Support check/download/install prompts with safe restart behavior.

8. Configure MSI packaging and resources  
   - Bundle backend executable/resources, third-party notices, and tools payloads.  
   - Validate install/uninstall, user-data persistence, and runtime path assumptions.

9. Remove or retire Electron packaging path  
   - Decommission desktop Electron build scripts/config after parity validation.  
   - Keep rollback path to last Electron release artifact until rollout confidence threshold is met.

10. End-to-end verification and milestone signoff  
   - Run parity checklist across dev + packaged MSI.  
   - Sign off milestone 1 only when all parity gates pass.

## Verification Checklist
- App starts from MSI and launches UI without manual backend steps.
- Backend is reachable on localhost and all existing API endpoints used by frontend respond as expected.
- Core workflows pass: bookmark capture, VOD OCR scan, split clips, replay naming, Twitch import, logs open.
- File operations respect current allowlist/sanitization constraints and runtime directories.
- Process lifecycle is clean: no orphan backend on close/restart/update.
- Updater can check and stage/apply an update in expected channels.
- Performance is not materially worse than Electron baseline for startup and key flows.
- Crash/error paths surface actionable user feedback and preserve logs.
- Existing config and user data under appdata location remain compatible.
- Packaging artifacts include required notices/licenses/tools and install cleanly.

## Decisions (Selected)
1. Bundle frontend in desktop package (no Flask static hosting dependency for UI in packaged app).
2. Keep Flask backend as API-only localhost service.
3. Use Tauri updater as the desktop update mechanism.
4. Ship MSI as primary Windows distribution format with bundled backend artifacts.
5. Enforce full Electron feature parity in milestone 1 before any scope expansion.
