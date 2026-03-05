# Monolith-to-Modular Migration Plan (Living Document)

Last updated: 2026-03-05  
Status: Execution started (Phase 0)

## Purpose
Turn this repository into a reusable, maintainable, and testable system with clear module boundaries and incremental, low-risk rollout.

## Scope and Constraints
- Preserve current user-visible behavior during migration (parity-first).
- Keep backend binding local (`127.0.0.1`) unless explicitly changed.
- Preserve path security checks and upload sanitization semantics.
- Avoid simultaneous deep rewrites across all domains; migrate in phased slices.
- Keep `app_meta.json` as version/name source of truth.

## Success Criteria
- Core flows remain functional: status/config, bookmark logging, VOD scan, splitting, Twitch import, desktop launch.
- `app/webui.py` is no longer a monolithic route/process hub.
- OCR/capture/detection loop is testable with deterministic seams.
- Frontend uses service/hook boundaries instead of inline API sprawl.
- Build/bootstrap/release security checks are explicit and automated.
- Test coverage and smoke checks are reliable enough to guard refactors.

## Delivery Model (Delegated Tracks)
- Orchestrator-Triage-Agent: sequencing, cross-track dependencies, integration gates.
- Backend-WebUI-Agent: API decomposition, services layer, process orchestration boundaries.
- OCR-Detection-Agent: capture/OCR/detection interfaces and deterministic pipeline tests.
- Frontend-Desktop-Agent: API client abstraction, React separation, Electron modularization.
- Build-Release-Security-Agent: bootstrap hardening, artifact verification, CI/release modernization.

## Master Roadmap

### Phase 0 — Baseline and Contracts (1-2 weeks)
**Goal:** freeze behavior before refactor.

#### Deliverables
- Endpoint/behavior inventory from `app/webui.py`.
- Parity checklist for core API + desktop flows.
- Baseline smoke commands documented (status/config/vods/clips/download endpoints).
- Baseline performance notes for startup and scan flows.

#### Validation
- `python tests/test_vod_api.py`
- `python -m pytest tests/test_vod_download.py -v`
- `python -m app.webui` and manual checks:
  - `GET /api/status`
  - `GET /api/config`
  - `GET /api/vods`

#### Status
- State: Not started
- Owner: Orchestrator + Backend/WebUI

---

### Phase 1 — Extract Stable Boundaries (2-3 weeks)
**Goal:** isolate interfaces without changing behavior.

#### Backend/WebUI
- Introduce app factory (`create_app`) and route blueprints under `app/routes/`.
- Keep `app/webui.py` as thin launcher/composition layer.
- Centralize config and path-policy helpers to remove duplication.

#### OCR/Detection
- Define interfaces/protocols for frame source, OCR engine, detector, clock.
- Keep existing entrypoints as compatibility facades.

#### Frontend/Desktop
- Add shared `apiClient`; migrate Home/Settings/App polling first.
- Keep request/response contracts unchanged.
- Split `desktop/main.js` responsibilities into modules with identical startup behavior.

#### Build/Security
- Draft build/dependency manifest and policy docs.
- Define bootstrap verification contract (`download -> verify -> install`).

#### Validation
- Endpoint response parity snapshots.
- No regression in process lifecycle (start/stop/pause flows).
- Frontend route parity for Home + Settings.

#### Status
- State: Not started
- Owner: All domain agents (parallel track)

---

### Phase 2 — Move Logic into Testable Services (2-4 weeks)
**Goal:** reduce controller/page complexity and enable unit-level testing.

#### Backend/WebUI
- Add services (`ConfigService`, `PathPolicyService`, `VodService`, `ClipService`, `ProcessManager`).
- Route handlers become thin adapters.

#### OCR/Detection
- Extract deterministic pipeline function (input frame+time+config -> OCR+detection output).
- Unify duplicated detection logic across live/bookmark/VOD modes.

#### Frontend/Desktop
- Move page orchestration to hooks (`useVodsPage`, `useVodViewer`, etc.).
- Keep pages largely presentational.

#### Build/Security
- Add safe subprocess/path wrappers and enforce them in sensitive paths.
- Harden bootstrap path traversal and artifact verification.

#### Validation
- Service unit tests for config/path/process wrappers.
- Deterministic OCR/detection unit tests with fake clock/frame sources.
- Frontend service/hook tests for state transitions.

#### Status
- State: Not started
- Owner: All domain agents (parallel track)

---

### Phase 3 — Hardening, CI, and Cleanup (2-3 weeks)
**Goal:** enforce quality gates and retire legacy paths.

#### Deliverables
- CI pipelines for lint/type/test/smoke and release checks.
- Security checks for allowed hosts, checksums, subprocess policies.
- Remove deprecated duplicate endpoints and dead legacy code after parity confidence.
- Update architecture docs and contributor onboarding docs.

#### Validation
- Green CI on PR for target checks.
- Manual packaged smoke (desktop startup + backend health + core flows).
- Regression/security checklist signed off.

#### Status
- State: Not started
- Owner: Orchestrator + Build/Security

---

## Cross-Track Dependency Order
1. Phase 0 baseline first (all tracks consume).
2. Backend app factory/route boundaries before major frontend API client migration.
3. OCR interface extraction before deep loop unification.
4. Build/security gates before large cleanup/removal tasks.
5. Remove legacy only after 2 consecutive parity-green runs.

## Risk Register
- Behavior drift during route moves -> mitigate with contract snapshots and parity smoke runs.
- Hidden coupling via globals/process state -> introduce `ProcessManager` early.
- Security regression in file/path handling -> centralize allowlist policy and test traversal cases.
- Packaging/update regressions -> stage rollout and keep rollback artifacts.
- Performance regressions in OCR loop -> baseline + threshold checks before cleanup.

## Execution Backlog Template (Use for each task)
- ID:
- Track:
- Objective:
- Inputs/Files:
- Deliverable:
- Validation:
- Risk:
- Status: Not started | In progress | Blocked | Done
- Owner:
- Updated:

## Kickoff Backlog (First 10 Tickets)

### ORCH-001
- Track: Orchestration
- Objective: Create migration execution docs and baseline guardrails.
- Inputs/Files: `MONOLITH_MODULARIZATION_PLAN.md`, `docs/migration/*`, `docs/release-baseline-checklist.md`, `docs/build-release-security-guardrails.md`
- Deliverable: Living plan + parity checklist + API inventory + release/security kickoff docs.
- Validation: Docs exist and link to migration workflow.
- Risk: Low (documentation drift only).
- Status: Done
- Owner: Orchestrator-Triage-Agent
- Updated: 2026-03-04

### MOD-BE-001
- Track: Backend/API
- Objective: Freeze backend API contract inventory for parity-first route extraction.
- Inputs/Files: `app/webui.py`, `docs/migration/api-contract-inventory.md`
- Deliverable: Route inventory with grouped extraction plan and parity rules.
- Validation: Route counts and critical contract table captured.
- Risk: Medium (missed endpoint could cause drift).
- Status: Done
- Owner: Backend-WebUI-Agent
- Updated: 2026-03-04

### MOD-BE-002
- Track: Backend/API
- Objective: Introduce `create_app` and first blueprint scaffold without response changes.
- Inputs/Files: `app/webui.py`, `app/routes/__init__.py`, `app/routes/system.py`
- Deliverable: App factory + one migrated low-risk route group.
- Validation: `python tests/test_vod_api.py` and `/api/status` + `/api/config` parity.
- Risk: Medium (contract drift).
- Status: Done
- Owner: Backend-WebUI-Agent
- Updated: 2026-03-04

### MOD-BE-003
- Track: Backend/API + Security
- Objective: Centralize allowlist path policy usage before route extraction of file endpoints.
- Inputs/Files: `app/webui.py`, `app/runtime_paths.py`, `docs/migration/path-policy-matrix.md`
- Deliverable: Reused path-policy helper and endpoint-to-root matrix.
- Validation: Traversal negative checks + file endpoint smoke.
- Risk: High (security-sensitive behavior).
- Status: Done
- Owner: Build-Release-Security-Agent (review: Backend-WebUI-Agent)
- Updated: 2026-03-04

### OCR-MOD-001
- Track: OCR/Detection
- Objective: Add `FrameSource` seam with default adapter preserving `dxcam -> mss` behavior.
- Inputs/Files: `app/capture.py`, `app/main.py`, `app/vod_ocr.py`, `tests/test_capture_frame_source.py`
- Deliverable: Injectable frame source abstraction + fake source for tests.
- Validation: Preview smoke + fallback parity checks.
- Risk: Medium (timing assumptions).
- Status: Done
- Owner: OCR-Detection-Agent
- Updated: 2026-03-04

### OCR-MOD-002
- Track: OCR/Detection
- Objective: Extract pure detection entrypoint and parity fixtures for cooldown/event logic.
- Inputs/Files: `app/detector.py`, `app/main.py`, `app/vod_ocr.py`, `tests/test_detector_parity.py`
- Deliverable: Deterministic detector interface and fixture tests.
- Validation: Legacy-vs-new output parity on baseline fixtures.
- Risk: Medium (cooldown edge regressions).
- Status: Done
- Owner: OCR-Detection-Agent
- Updated: 2026-03-04

### MIG-FD-001
- Track: Frontend/Desktop
- Objective: Introduce shared frontend `apiClient` and migrate Home/Settings core calls.
- Inputs/Files: `frontend/src/api/client.js`, `frontend/src/pages/Home.jsx`, `frontend/src/pages/Settings.jsx`, `frontend/src/App.jsx`
- Deliverable: Centralized API call wrapper used in first pages.
- Validation: Home + Settings parity smoke, same endpoints/payloads.
- Risk: Medium (request option mismatch).
- Status: Done
- Owner: Frontend-Desktop-Agent
- Updated: 2026-03-04

### MIG-FD-002
- Track: Frontend/Desktop
- Objective: Extract Electron backend lifecycle handling into `backendSupervisor` module.
- Inputs/Files: `desktop/main.js`, `desktop/backendSupervisor.js`, `desktop/dev.js`
- Deliverable: Modularized startup/supervision with no lifecycle regressions.
- Validation: Desktop dev launch/close smoke; no orphan backend process.
- Risk: Medium (double-spawn/orphan process).
- Status: Done
- Owner: Frontend-Desktop-Agent
- Updated: 2026-03-04

### BRS-KICK-001
- Track: Build/Release/Security
- Objective: Capture baseline release behavior and artifacts before refactors.
- Inputs/Files: `docs/release-baseline-checklist.md`, `package.json`, `scripts/*`
- Deliverable: Filled baseline report from dry-run release flow.
- Validation: `npm run sync:meta` and `npm run release:prep -- --dry-run`.
- Risk: Low (metadata churn).
- Status: Done
- Owner: Build-Release-Security-Agent
- Updated: 2026-03-04

### BRS-KICK-002
- Track: Build/Release/Security
- Objective: Define and enforce build/release/security guardrails for migration PRs.
- Inputs/Files: `docs/build-release-security-guardrails.md`, `app/dependency_bootstrap.py`, `app/webui.py`
- Deliverable: Guardrail policy linked in migration docs and used in PR review.
- Validation: Policy cross-checked against current trust-boundary code paths.
- Risk: Low (policy not applied consistently).
- Status: Done
- Owner: Build-Release-Security-Agent
- Updated: 2026-03-04

## Status Board

### Current Snapshot
- Overall phase: 0 (Baseline/contracts)
- Overall status: Execution started
- Active track(s): Orchestration, Backend/API, Build/Security

### Track Status
| Track | Owner | Current State | Next Milestone |
|---|---|---|---|
| Orchestration | Orchestrator-Triage-Agent | In progress | Baseline inventory approved |
| Backend/API | Backend-WebUI-Agent | In progress | Next low-risk blueprint extraction |
| OCR/Detection | OCR-Detection-Agent | In progress | Main/bookmark adoption of deterministic detector seam |
| Frontend/Desktop | Frontend-Desktop-Agent | In progress | Begin desktop backend supervisor extraction |
| Build/Security | Build-Release-Security-Agent | In progress | Wire preflight checks into CI |

## Change Log
- 2026-03-04: Initial master migration plan created from delegated domain planning outputs.
- 2026-03-04: Kickoff execution started with first 10 tickets and baseline docs under `docs/migration/`.
- 2026-03-04: Completed MOD-BE-001, MOD-BE-002, and OCR-MOD-001; started MIG-FD-001 and BRS-KICK-001.
- 2026-03-04: Completed MIG-FD-001 and started MOD-BE-003 with path policy matrix baseline.
- 2026-03-04: Completed OCR-MOD-002 detector seam and BRS-KICK-001 dry-run baseline closure.
- 2026-03-04: Advanced MOD-BE-003 with centralized existing-path helper on first endpoint subset.
- 2026-03-04: Started MIG-FD-002 by extracting desktop backend lifecycle into `desktop/backendSupervisor.js`.
- 2026-03-04: Expanded MOD-BE-003 helper usage across legacy clip/media and overlay path endpoints.
- 2026-03-04: Added initial migration CI workflow for targeted Python tests and build-security/frontend guardrails.
- 2026-03-04: Extracted path policy helpers into reusable backend module `app/path_policy.py`.
- 2026-03-04: Expanded system blueprint extraction to include bootstrap status/start routes.
- 2026-03-04: Expanded system blueprint extraction to include notifications and update metadata routes.
- 2026-03-04: Completed MIG-FD-002 with `desktop/backendSupervisor.js` extraction and successful desktop build.
- 2026-03-04: Completed MOD-BE-003 with shared `app/path_policy.py` and migrated endpoint usage.
- 2026-03-04: Continued frontend API-client adoption by migrating `TwitchImport` network calls.
- 2026-03-04: Unblocked API regression coverage (`tests/test_vod_api.py`) and fixed `/api/vod/download` missing-JSON handling.
- 2026-03-04: Extracted OCR GPU route registration into dedicated `app/routes/gpu.py` blueprint.
- 2026-03-04: Extracted overlay route registration into dedicated `app/routes/overlay.py` blueprint.
- 2026-03-04: Extracted VOD download route registration into dedicated `app/routes/vod_download.py` blueprint.
- 2026-03-04: Extracted Twitch import route registration into dedicated `app/routes/twitch_import.py` blueprint.
- 2026-03-04: Extracted log route registration into dedicated `app/routes/logs.py` blueprint.
- 2026-03-04: Moved `/api/debug/paths` into the system blueprint dependency surface.
- 2026-03-04: Extracted session-data route registration into dedicated `app/routes/session.py` blueprint.
- 2026-03-05: Extracted clip API route registration into dedicated `app/routes/clips.py` blueprint.
- 2026-03-05: Extracted VOD list/single/delete/stream route registration into dedicated `app/routes/vods.py` blueprint.
- 2026-03-05: Extracted VOD scan control API route registration into dedicated `app/routes/vod_scan.py` blueprint.
- 2026-03-05: Extracted `/capture-area/save` registration into dedicated `app/routes/capture_area.py` blueprint.
- 2026-03-05: Added path-policy and API traversal regression tests (`tests/test_path_policy.py`, `tests/test_webui_path_security.py`).
- 2026-03-05: Hardened desktop supervisor command resolution for PATH commands and ensured `backendSupervisor.js` is packaged.
- 2026-03-05: Extracted legacy control/config route registration into `app/routes/legacy_control.py` blueprint.
- 2026-03-05: Extracted `/vod-thumbnail` registration into dedicated `app/routes/vod_thumbnail.py` blueprint.
- 2026-03-05: Added desktop updater URL-policy helper + tests (`desktop/updateUrlPolicy.js`, `desktop/tests/updateUrlPolicy.test.js`) and integrated installer/redirect validation.
- 2026-03-05: Extracted media/file-serving route registration into dedicated `app/routes/media_paths.py` blueprint.
- 2026-03-05: Added migration CI guardrail to run desktop updater URL policy tests (`npm --prefix desktop test`).
- 2026-03-05: Updated `app/vod_download.py` UTC timestamp generation to timezone-aware UTC (`datetime.now(timezone.utc)`).
- 2026-03-05: Started React de-monolithing by extracting VOD page API orchestration into `frontend/src/api/vods.js` and refactoring `frontend/src/pages/Vods.jsx` to consume it.
- 2026-03-05: Extracted Settings page API/service calls into `frontend/src/api/settings.js` and refactored `frontend/src/pages/Settings.jsx` to consume shared settings service functions.
- 2026-03-05: Extracted shared app chrome into `frontend/src/components/AppHeader.jsx` and refactored `frontend/src/App.jsx` to consume it.
- 2026-03-05: Added reusable `frontend/src/components/SectionHeader.jsx` and adopted it for repeated title/action rows on `frontend/src/pages/Home.jsx`.
- 2026-03-05: Added reusable `frontend/src/components/BrandTitle.jsx` and adopted it in app/header + welcome states (`Home`, `Vods`).
- 2026-03-05: Consolidated duplicated duration formatting into `frontend/src/utils/formatDuration.js` and adopted it across `Home`, `Vods`, `Clips`, and `ClipsViewer`.
- 2026-03-05: Extracted VOD page orchestration/state into `frontend/src/hooks/useVodsPage.js` and simplified `frontend/src/pages/Vods.jsx` to consume the hook.
- 2026-03-05: Extracted Settings page orchestration/state into `frontend/src/hooks/useSettingsPage.js` and simplified `frontend/src/pages/Settings.jsx` to consume the hook.
- 2026-03-05: Reduced `frontend/src/pages/VodViewer.jsx` complexity by extracting pure viewer constants/helpers to `frontend/src/utils/vodViewer.js`.
- 2026-03-05: Added shared `frontend/src/components/WelcomeSetupCard.jsx` and reused it across `Home` and `Vods` empty-directory onboarding states.
- 2026-03-05: Extracted Home page orchestration/data loading into `frontend/src/hooks/useHomePage.js` with API helpers in `frontend/src/api/home.js`.
- 2026-03-05: Extracted root app status/notifications polling and persistence logic into `frontend/src/hooks/useAppShell.js`, simplifying `frontend/src/App.jsx`.
- 2026-03-05: Extracted `VodViewer` API calls into `frontend/src/api/vodViewer.js` and refactored `frontend/src/pages/VodViewer.jsx` to consume service functions.
- 2026-03-05: Split app header notifications UI into `frontend/src/components/NotificationPanel.jsx`, reducing `frontend/src/components/AppHeader.jsx` complexity.
- 2026-03-05: Split `VodViewer` clip creation UI into `frontend/src/components/VodClipControls.jsx`, reducing inline control/action complexity in `frontend/src/pages/VodViewer.jsx`.
- 2026-03-05: Reduced `Settings` page structural duplication by adding `frontend/src/components/SettingsPanel.jsx` and `frontend/src/components/SettingsSectionNav.jsx` and refactoring `frontend/src/pages/Settings.jsx` to use them.
- 2026-03-05: Extracted `VodViewer` bookmark panel UI into `frontend/src/components/VodBookmarkList.jsx` and refactored `frontend/src/pages/VodViewer.jsx` to use it.
- 2026-03-05: Extracted `VodViewer` overview heatmap/timeline UI into `frontend/src/components/VodOverviewTimeline.jsx` and refactored `frontend/src/pages/VodViewer.jsx` to use it.
- 2026-03-05: Extracted `VodViewer` scrub timeline/range UI into `frontend/src/components/VodScrubTimeline.jsx` and refactored `frontend/src/pages/VodViewer.jsx` to use component-level pointer handlers.
- 2026-03-05: Extracted `VodViewer` playback/zoom/events/volume controls into `frontend/src/components/VodPlaybackControlsPanel.jsx` and refactored `frontend/src/pages/VodViewer.jsx` to use explicit callback props.
- 2026-03-05: Extracted `VodViewer` video/overlay/loading container into `frontend/src/components/VodVideoPlayer.jsx` and refactored `frontend/src/pages/VodViewer.jsx` to compose it.
- 2026-03-05: Extracted `VodViewer` header/action cluster into `frontend/src/components/VodViewerHeader.jsx` and refactored `frontend/src/pages/VodViewer.jsx` to use it.
- 2026-03-05: Extracted `/vod-ocr-upload`, `/api/vod-ocr-upload`, `/split-selected`, `/api/split-selected`, and `/vod-ocr` registrations into `app/routes/vod_actions.py` and wired them via dependency callbacks in `app/routes/__init__.py` + `app/webui.py`.
- 2026-03-05: Extracted `/logo.png`, `/`, and `/<path:path>` registrations into `app/routes/spa.py`, removing all remaining direct `@app.route` decorators from `app/webui.py`.
- 2026-03-05: Extracted desktop window state/lifecycle logic (`loadWindowState`, `saveWindowState`, `createWindow`) from `desktop/main.js` into `desktop/windowManager.js` and delegated main process window creation through the new module.
- 2026-03-05: Extracted splash UI + dependency bootstrap progress orchestration from `desktop/main.js` into `desktop/splashScreen.js`, keeping startup behavior unchanged.
- 2026-03-05: Updated `scripts/sync_app_meta.cjs` to sync splash title metadata in either `desktop/main.js` or `desktop/splashScreen.js`, preserving build-time metadata sync after desktop modularization.
- 2026-03-05: Extracted desktop semver/version comparison helpers from `desktop/main.js` into `desktop/versionUtils.js` and updated update-check flow to consume the shared utility.
- 2026-03-05: Extracted desktop updater orchestration (feed fetch, download/verify, install launch, persisted updater state, and IPC update handlers) from `desktop/main.js` into `desktop/updaterManager.js`.
- 2026-03-05: Extracted desktop backend API request helpers from `desktop/main.js` into `desktop/backendApiClient.js` and rewired splash/bootstrap status calls to consume the client.
- 2026-03-05: Extracted desktop app startup/shutdown lifecycle event wiring from `desktop/main.js` into `desktop/appLifecycle.js` and delegated lifecycle registration from the main entrypoint.
- 2026-03-05: Updated `scripts/sync_app_meta.cjs` to sync desktop dialog-title metadata in either `desktop/main.js` or `desktop/appLifecycle.js` after lifecycle extraction.
- 2026-03-05: Extracted Settings page updates section UI into `frontend/src/components/SettingsUpdatesPanel.jsx` and refactored `frontend/src/pages/Settings.jsx` to compose it.
- 2026-03-05: Extracted desktop asset/icon resolver helpers from `desktop/main.js` into `desktop/assetPaths.js` and delegated icon path lookup through the new utility.
- 2026-03-05: Extracted Settings page overlay section UI into `frontend/src/components/SettingsOverlayPanel.jsx` and refactored `frontend/src/pages/Settings.jsx` to compose it.
- 2026-03-05: Extracted desktop update IPC handler registration from `desktop/main.js` into `desktop/ipcHandlers.js`.
- 2026-03-05: Extracted Settings page detection section UI into `frontend/src/components/SettingsDetectionPanel.jsx` and refactored `frontend/src/pages/Settings.jsx` to compose it.
- 2026-03-05: Extracted desktop backend runtime wrappers (`startBackend`, `waitForPort`, `stopBackend`) from `desktop/main.js` into `desktop/backendRuntime.js`.
- 2026-03-05: Extracted Settings page OCR section UI into `frontend/src/components/SettingsOcrPanel.jsx` and refactored `frontend/src/pages/Settings.jsx` to compose it.

## Immediate Next Actions (Week 1)
1. Create and approve Phase 0 parity checklist and endpoint inventory.
2. Define first 10 implementation tickets across tracks (small, mergeable slices).
3. Start Backend Phase 1 skeleton (`create_app` + first blueprint) behind parity checks.
4. Start Frontend Phase 1 with shared `apiClient` used by Home + Settings.
5. Add baseline CI job running existing Python tests and basic API smoke.
