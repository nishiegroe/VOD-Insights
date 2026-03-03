# VOD Insights Development Backlog

Quick reference of tasks you can spawn agents to work on. Organized by size and type.

---

## 🚀 Quick Wins (1-2 hours each)

These are small, scoped features or bugs good for getting momentum.

- [ ] **Keyboard shortcuts in VOD Viewer**
  - Space = play/pause
  - Left/Right = previous/next event
  - Skip N seconds (J/L for -10s/+10s)
  - Agent needed: Frontend Dev only
  - File: `frontend/src/pages/VodViewer.jsx`

- [ ] **Add "Jump to first kill" button**
  - Skip to the first event in a VOD
  - Agent needed: Frontend Dev + Backend Dev
  - Files: `frontend/src/pages/VodViewer.jsx`, `app/webui.py`

- [ ] **Dark mode toggle**
  - Basic CSS variables for light/dark theme
  - Agent needed: Frontend Dev only
  - File: `frontend/src/App.jsx` (add context/provider)

- [ ] **Export event log as CSV**
  - Already partially done; expose /api endpoint for download
  - Agent needed: Backend Dev only
  - File: `app/split_bookmarks.py`, `app/webui.py`

- [ ] **Settings UI: "Reset to defaults" button**
  - Clear config and restart
  - Agent needed: Frontend Dev + Backend Dev
  - Files: `frontend/src/pages/Settings.jsx`, `app/webui.py`

---

## 📦 Medium Features (4-8 hours each)

Moderate scope, touches multiple files, worth doing with full team.

- [ ] **Custom event types** (not just kill/assist/knock)
  - Users can define what keywords = custom events
  - Agent needed: Architect, Backend Dev, Frontend Dev, QA
  - Ripple: Config schema changes, UI for custom keywords, OCR logic

- [ ] **Event filtering in VOD Viewer**
  - Show only kills, or only assists, etc.
  - Agent needed: Frontend Dev, Backend Dev
  - Files: `frontend/src/pages/VodViewer.jsx`, `app/webui.py` (filter API)

- [ ] **Clip preview before export**
  - Show a 5-second preview of the clip before saving
  - Agent needed: Frontend Dev, Backend Dev
  - Files: `frontend/src/pages/Clips.jsx`, `app/split_bookmarks.py`

- [ ] **Batch analysis of multiple VODs**
  - Queue up multiple VODs, process them serially
  - Agent needed: Backend Dev, QA, Frontend Dev
  - Files: `app/webui.py` (queue logic), `frontend/src/pages/Vods.jsx` (queue UI)

- [ ] **Performance optimization: GPU OCR as option**
  - Use PyTorch/ONNX for faster OCR on NVIDIA GPUs
  - Agent needed: Architect, Backend Dev, QA
  - Files: `app/ocr.py`, `app/config.py`, dependencies

- [ ] **Fix: OCR accuracy on low-contrast overlays**
  - Current: ~70% accuracy on dark/transparent killfeed
  - Target: >95%
  - Agent needed: Backend Dev, QA
  - Files: `app/ocr.py` (threshold tuning, maybe contrast enhancement)

---

## 🏗️ Major Features (2-3 days each)

Large scope, full team involvement, architectural decisions needed.

- [ ] **Multi-region OCR detection**
  - Detect killfeed + minimap + damage numbers simultaneously
  - Currently: single killfeed region only
  - Agent needed: Architect, Backend Dev, Frontend Dev, QA, Docs
  - Ripple: Config refactor, new UI components, detection pipeline rewrite

- [ ] **AI-powered play evaluation**
  - Instead of just detecting kills, analyze decision quality
  - E.g., "This rotation was suboptimal (should have played ring)"
  - Agent needed: Architect, Backend Dev, QA
  - Ripple: New ML model integration, API design

- [ ] **Valorant/CS:GO support**
  - Extend beyond Apex Legends
  - Different killfeed layouts per game
  - Agent needed: Architect, Backend Dev, QA, Docs
  - Ripple: Killfeed layout registry, per-game config profiles

- [ ] **Cloud sync & collaboration**
  - Save VOD analysis to cloud (optional)
  - Share clips/reports with team
  - Agent needed: Architect, Backend Dev (API redesign), Frontend Dev, QA, Docs
  - Ripple: Authentication, database, file storage, sharing permissions

- [ ] **Refactor config system**
  - Current: JSON file in APPDATA
  - Target: Structured config with validation, profiles, presets
  - Agent needed: Architect, Backend Dev, Frontend Dev, QA, Docs
  - Ripple: All code that touches config.py

---

## 🐛 Known Issues

Minor bugs and polish items (spawn on demand when you hit them):

- [ ] **Twitch import sometimes fails silently** (yt-dlp network errors)
  - Backend: Add better error messages
  - Frontend: Show retry UI

- [ ] **VOD Viewer: seek bar is choppy on 4K videos**
  - Performance optimization in video playback

- [ ] **Clip names don't always match event counts**
  - Edge case in clip merging logic (app/split_bookmarks.py)

- [ ] **OCR skips events if cooldown too long**
  - Event detector fires too slowly on rapid kills

---

## 🎯 How to Pick Your First Task

1. **Want to ship fast?** Pick a Quick Win (Frontend dev 1-2 hours)
2. **Want to see agents collaborate?** Pick a Medium Feature (full team)
3. **Want to make a big impact?** Pick a Major Feature (2-3 days, architectural)

**Pick one, tell me the task, and I'll:**
1. Spawn Architect (if needed) for design
2. Spawn Backend/Frontend in parallel
3. Spawn QA to review & test
4. Merge and ship

**Example command to get started:**
```
"Let's do the custom event types feature. Pick the task from BACKLOG.md, I'll orchestrate."
```

