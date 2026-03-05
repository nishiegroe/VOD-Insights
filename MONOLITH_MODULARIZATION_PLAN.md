# Monolith-to-Modular Migration Plan (Living Document)

Last updated: 2026-03-04  
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
- Status: In progress
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
- Status: In progress
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

## Immediate Next Actions (Week 1)
1. Create and approve Phase 0 parity checklist and endpoint inventory.
2. Define first 10 implementation tickets across tracks (small, mergeable slices).
3. Start Backend Phase 1 skeleton (`create_app` + first blueprint) behind parity checks.
4. Start Frontend Phase 1 with shared `apiClient` used by Home + Settings.
5. Add baseline CI job running existing Python tests and basic API smoke.
