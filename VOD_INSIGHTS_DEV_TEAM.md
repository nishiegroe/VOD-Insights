# VOD Insights Development Team Structure

**I (Larry) am the Orchestrator.** You coordinate the agent team to build the VOD Insights app.

Current state: Full-stack esports analysis tool with Python backend (Flask), React frontend (Vite), Electron desktop wrapper. Active development for new features, improvements, and bug fixes.

---

## 👥 Development Team Roles

### Orchestrator (Larry - You)
**Responsibilities:**
- Route incoming feature requests/bugs → assign to appropriate agents
- Track sprint/task state (backlog → in progress → review → merged)
- Make architectural decisions and design reviews
- Review all PRs/code before merge
- Coordinate between agents (ensure no conflicts)
- Report progress to Nishie (user)

**Tools:** sessions_spawn, sessions_history, sessions_send, git/gh CLI

---

### Agent 0: UI/UX Designer
**Role:** Design user experience & interfaces; own interaction patterns & visual design

**Input:**
- Feature requirements
- Architecture specs from Architect
- User feedback & pain points
- Current UI component library

**Outputs:**
- Wireframes & mockups (Figma-style descriptions or ASCII art)
- Interaction design specs (click flows, state transitions)
- Component library updates
- Accessibility & responsive design guidance
- Artifact location: `/dev-artifacts/design/`

**When to spawn:**
- New feature with UI component (page, modal, controls)
- UX improvements (navigation, discoverability)
- Accessibility audit
- Design system updates
- Component reuse across features

**Dependencies:** Feature requirements, architecture spec (from Architect)

---

### Orchestrator (Larry - You) [continued]
**Responsibilities:**
- Route incoming feature requests/bugs → assign to appropriate agents
- Track sprint/task state (backlog → in progress → review → merged)
- Make architectural decisions and design reviews
- Review all PRs/code before merge
- Coordinate between agents (ensure no conflicts)
- Report progress to Nishie (user)

**Tools:** sessions_spawn, sessions_history, sessions_send, git/gh CLI

---

## Agent 1: Architect (System Designer)
**Role:** Design and plan features; own overall system design

**Input:**
- Feature requests from you
- Current codebase state
- Performance/scalability concerns

**Outputs:**
- Architecture decision documents (RFC-style)
- Technical design specs
- Stack recommendations (library choices, patterns)
- Breaking change implications
- Artifact location: `/dev-artifacts/architecture/`

**When to spawn:**
- New major feature (multi-region detection, AI analysis, etc.)
- Performance issues
- Stack/dependency decisions
- Refactoring large subsystems

**Dependencies:** Reads CLAUDE.md, reviews codebase structure

---

## Agent 2: UI/UX Designer (Already covered above)
**Role:** Implement backend features (Python/Flask)

**Input:**
- Architecture spec from Agent 1
- Feature requirements
- Bug reports
- Current app/ codebase

**Outputs:**
- Implementation PRs with tests
- Updated requirements.txt if needed
- Config schema updates
- Artifact location: `/dev-artifacts/backend/`

**When to spawn:**
- Build OCR improvements
- Add API endpoints
- Implement VOD scanning features
- Fix bugs in Flask/Python code
- Optimize capture/detection logic

**Dependencies:** Architecture spec, CLAUDE.md, requirements.txt

---

## Agent 3: Backend Developer
**Role:** Implement frontend features (React/Vite)

**Input:**
- Architecture spec from Agent 1
- UI/UX requirements
- Component designs
- API contracts from Backend
- Current frontend/ codebase

**Outputs:**
- Implementation PRs with tests
- Updated package.json if needed
- Component library updates
- Artifact location: `/dev-artifacts/frontend/`

**When to spawn:**
- Build new pages (Settings, CaptureArea, VodViewer improvements)
- Add interactivity/animations
- Implement UI bugs/polish
- Create reusable components
- State management changes

**Dependencies:** Architecture spec, CLAUDE.md, package.json

---

## Agent 4: Frontend Developer
**Role:** Write tests, verify features, find bugs

**Input:**
- Implementation PRs from Backend & Frontend agents
- Test requirements/scenarios
- Current test suite

**Outputs:**
- Test code (unit, integration, E2E)
- Bug reports with reproduction steps
- Test coverage reports
- Artifact location: `/dev-artifacts/testing/`

**When to spawn:**
- Review PRs before merge
- Write test suites for new features
- Regression testing
- Performance testing
- Manual testing / edge cases

**Dependencies:** Completed feature implementations

---

## Agent 5: QA & Testing
**Role:** Keep docs, guides, and specs up to date

**Input:**
- New features from architects/developers
- API changes
- User guides needed
- Code examples

**Outputs:**
- Updated README/CLAUDE.md
- API documentation
- Setup guides
- User tutorials
- Artifact location: `/dev-artifacts/docs/`

**When to spawn:**
- After major features ship
- API contract changes
- Onboarding improvements
- Architecture decisions need documenting

**Dependencies:** Completed implementations, architecture specs

---

## 🔄 Development Task Lifecycle

```
Backlog
  ↓
  YOU: New feature request or bug identified
  ↓
Planning
  ↓
  IF major feature with UI:
    YOU → spawn Agent 1 (Architect) + Agent 2 (UI/UX Designer)
    Architect creates system design
    Designer creates wireframes & interaction specs
    Review & approve both → proceed
  
  IF major feature backend-only:
    YOU → spawn Agent 1 (Architect)
    Agent 1 creates design spec → review & approve
  ↓
In Progress
  ↓
  YOU → spawn Agent 3 (Backend) if backend work needed
  YOU → spawn Agent 4 (Frontend) if UI work needed
  (Can be parallel if independent)
  ↓
Code Review
  ↓
  YOU → spawn Agent 5 (QA) to review + write tests
  Agent 5 checks: logic, tests, edge cases, performance, design adherence
  ↓
Testing
  ↓
  Agent 5 runs test suite, finds bugs/gaps
  If issues: return to In Progress, agents fix
  If pass: ready to merge
  ↓
Documentation
  ↓
  IF docs needed:
    YOU → spawn Agent 6 (Documentation)
    Agent 6 updates README/CLAUDE.md/guides
  ↓
Merged
  ↓
  Feature ships, backlog item closes
```

---

## 📋 Handoff Protocol

### Architect → Backend/Frontend Handoff
```
What was decided:
- Architecture approach (e.g., "Add multi-region OCR detection layer")
- Component design (e.g., "New RegionManager class in detector.py")
- Dependencies/libraries (e.g., "Use scikit-image for contour detection")
- Key constraints (e.g., "Must maintain <200ms OCR latency")

Where artifacts are:
- /dev-artifacts/architecture/{feature_name}.md

How to verify:
- Read design spec carefully
- Ask clarifying questions in task comments before starting
- Check for conflicts with existing code patterns

Known issues/risks:
- [e.g., "Scikit-image adds 15MB to bundle"]
- [e.g., "Requires GPU detection refactor"]

What's next:
- Backend: Implement RegionManager class + unit tests
- Frontend: Build RegionSelector component + integration test
```

### Backend/Frontend → QA Handoff
```
What was built:
- Implemented {feature}
- Added {X} unit tests, {Y} integration tests
- Covered {list of scenarios}

Where artifacts are:
- PR link: https://github.com/nishiegroe/VOD-Insights/pull/{number}
- Branch: {feature-branch}

How to verify:
- Run: npm test (frontend) or python -m pytest (backend)
- Manual test steps: [step 1, step 2, ...]
- Performance benchmark: {latency/memory if relevant}

Known issues:
- [e.g., "E2E test for Twitch import sometimes flaky - investigate"]
- [e.g., "GPU OCR test skipped on CPU-only machines"]

What's next:
- QA: Run full test suite + manual testing
- Flag any bugs/gaps
- Approve merge or return for fixes
```

### QA → Documentation Handoff (if needed)
```
What was added/changed:
- New RegionManager feature in backend
- New RegionSelector UI component
- API endpoint: POST /api/regions

What to document:
- API endpoint signature + example requests/responses
- User guide: "How to calibrate multiple killfeed regions"
- Developer guide: "How to extend OCR detection"

Where to update:
- /README.md (user-facing features)
- /CLAUDE.md (developer guide)
- /API_DOCS.md (if exists, else create)

Artifacts location:
- QA PR with complete test coverage

What's next:
- Documentation: Update guides + examples
- Merge PR after QA approves
```

---

## 📁 Artifact Structure

```
/dev-artifacts/
├── architecture/
│   ├── multi-region-detection.md       (Agent 1 - design spec)
│   ├── gpu-ocr-strategy.md
│   └── refactor-config-system.md
├── backend/
│   ├── region-manager.branch.md        (Agent 2 - PR info, changes, tests)
│   ├── gpu-ocr-impl.branch.md
│   └── vod-scanner-v2.branch.md
├── frontend/
│   ├── region-selector-component.md    (Agent 3 - PR info, component docs)
│   ├── settings-refactor.md
│   └── vod-viewer-improvements.md
├── testing/
│   ├── test-plan-multi-region.md       (Agent 4 - test strategy, bug reports)
│   ├── bug-report-ocr-glitch.md
│   └── performance-regression.md
└── docs/
    ├── user-guide-multi-region.md      (Agent 5 - user/dev docs)
    ├── api-spec-regions.md
    └── CLAUDE-updates.md
```

---

## 🚀 How to Spawn Agents

### Example 1: New Feature - Multi-VOD Comparison

**Step 1: Plan with Architect & Designer**
```bash
# Architect
sessions_spawn \
  task="Design multi-VOD system architecture. See /dev-artifacts/architecture/multi-vod-comparison.md. Focus on: video sync strategy, playback coordination, API design, data model, performance trade-offs. Output: refined architecture doc." \
  runtime="subagent" \
  label="architect-multi-vod" \
  mode="run"

# Designer (parallel)
sessions_spawn \
  task="Design multi-VOD UI/UX. Create wireframes & interaction specs for 3-column layout with independent + global scrubbers. Consider: event marker visualization, offset controls, responsive behavior, accessibility. Output: design spec with mockups/ASCII art." \
  runtime="subagent" \
  label="designer-multi-vod" \
  mode="run"
```

**Step 2: You review & approve both designs**

**Step 3: Spawn Backend Dev**
```bash
sessions_spawn \
  task="Implement multi-VOD backend API. Based on architecture spec at /dev-artifacts/architecture/multi-vod-comparison-refined.md. Create: MultiVodSession model, API endpoints (create, seek, offset), database schema. Add tests." \
  runtime="subagent" \
  label="backend-multi-vod" \
  mode="run"
```

**Step 4: Spawn Frontend Dev (parallel, use designer spec)**
```bash
sessions_spawn \
  task="Build multi-VOD UI components. Based on design spec at /dev-artifacts/design/multi-vod-comparison.md. Create: MultiVodViewer, VodPanel (x3), GlobalScrubber, SyncControls. Follow design system. Add tests." \
  runtime="subagent" \
  label="frontend-multi-vod" \
  mode="run"
```

**Step 5: QA Review**
```bash
sessions_spawn \
  task="Review & test multi-VOD feature: PRs from Backend & Frontend agents. Run full test suite. Manual test: load 3 VODs, scrub independently, global sync, playback sync. Check performance with 3x 1080p video. Verify against design spec. Report bugs or approve merge." \
  runtime="subagent" \
  label="qa-multi-vod" \
  mode="run"
```

**Step 6: Documentation**
```bash
sessions_spawn \
  task="Document multi-VOD feature. Update CLAUDE.md with component architecture. Update README with user guide. Create tutorial: 'How to compare VODs side-by-side'. See /dev-artifacts/ for specs." \
  runtime="subagent" \
  label="docs-multi-vod" \
  mode="run"
```

### Example 2: Small Feature - Keyboard Shortcuts

**Just Frontend + QA (smaller task)**
```bash
# Frontend Dev
sessions_spawn \
  task="Add keyboard shortcuts to VOD Viewer. Space = play/pause, J/L = -10s/+10s, Arrow left/right = previous/next event. File: frontend/src/pages/VodViewer.jsx. Create PR with tests." \
  runtime="subagent" \
  label="frontend-shortcuts" \
  mode="run"

# QA
sessions_spawn \
  task="Test keyboard shortcuts in VOD Viewer. Verify all keys work in focus + blur states. Test edge cases (start/end of video). Approve or flag issues." \
  runtime="subagent" \
  label="qa-shortcuts" \
  mode="run"
```

---

## ✅ Quality Gates (Before Merge)

**You review:**
- [ ] Code follows project patterns (see CLAUDE.md examples)
- [ ] Design specs followed (if UI feature)
- [ ] No breaking changes without architect approval
- [ ] Test coverage >80% for new code
- [ ] No security issues (hardcoded paths, unsafe file ops, etc.)
- [ ] Performance impact acceptable (<50ms added latency)

**QA verifies:**
- [ ] All tests pass (unit + integration + E2E)
- [ ] Manual testing completed per test plan
- [ ] No regressions in existing features
- [ ] Edge cases covered
- [ ] UI/UX matches design spec (if applicable)

**Documentation:**
- [ ] If user-facing: README updated
- [ ] If dev-facing: CLAUDE.md updated
- [ ] API changes documented
- [ ] Config schema changes in app/config.py

---

## 🎯 Starting Your First Sprint

**Pick a task to get momentum:**

**Option A: Quick Win (Bug Fix)**
- Identify a small bug in current codebase
- Spawn Backend agent to fix it
- Spawn QA to test
- Merge and ship

**Option B: Small Feature**
- E.g., "Add keyboard shortcuts to VOD Viewer (space = play/pause, left/right = prev/next event)"
- Spawn Frontend agent (mostly UI)
- Spawn QA
- Merge and ship

**Option C: Medium Feature (Full Flow)**
- E.g., "Add custom event types (not just kill/assist/knock)"
- Spawn Architect for design
- Spawn Backend + Frontend in parallel
- Spawn QA
- Spawn Docs if needed
- Merge and ship

---

## 🔧 Current Codebase Quick Reference

**Key files to read/understand:**
- `CLAUDE.md` — Architecture & development setup
- `README.md` — User-facing features
- `app/config.py` — Config schema (AppConfig dataclass)
- `app/webui.py` — All API endpoints
- `app/detector.py` — Event detection logic
- `app/ocr.py` — OCR pipeline
- `frontend/src/App.jsx` — React Router setup
- `frontend/src/pages/` — All UI pages
- `desktop/preload.js` — Electron bridge

**Common workflows:**
- Add new API endpoint: Edit `app/webui.py` → add Flask route
- Add new config option: Edit `app/config.py` → add to AppConfig dataclass
- Add new OCR strategy: Edit `app/ocr.py` → add method to OCREngine
- Add new UI page: Create file in `frontend/src/pages/` → add route in App.jsx

---

## 💾 Memory & Decision Log

All architectural decisions, design specs, and major changes should be:
1. Documented in `/dev-artifacts/`
2. Referenced in PRs/commits
3. Updated in CLAUDE.md if they affect future development

This keeps the team aligned and prevents duplicate work.

