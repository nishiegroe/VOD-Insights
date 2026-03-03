# Multi-VOD Comparison Feature - Architecture & Design

**Status:** Architecture Planning  
**Author:** Larry (Orchestrator)  
**Date:** 2026-03-01  
**Complexity:** Major Feature (2-3 days, full team)

---

## 🎯 Overview

Enable side-by-side comparison of up to 3 VODs simultaneously with independent and global scrubbing controls. Phase 2 adds automatic time-sync via game timer OCR detection.

**Use Case:**
Coach wants to compare how 3 different players played the same match/game. Currently VOD Insights can only show 1 VOD at a time. With this feature, a coach can:
1. Load 3 VODs into a comparison session
2. Scrub each independently to review different angles
3. Use a global scrubber to sync all 3 to the same moment
4. (Phase 2) Auto-align based on in-game timer detection for perfect sync

---

## 📐 Phase 1: Multi-VOD Layout & Dual Scrubber

### Frontend Design

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│          VOD Comparison Session                      │
├──────────────┬──────────────┬──────────────┐
│   VOD 1      │   VOD 2      │   VOD 3      │ (3 equal columns)
│ (video)      │ (video)      │ (video)      │
│ 16:9 aspect  │ 16:9 aspect  │ 16:9 aspect  │
├──────────────┼──────────────┼──────────────┤
│[===>] 2:30   │[==>] 1:45    │[====>] 3:15  │ (individual scrubbers)
├──────────────┴──────────────┴──────────────┤
│ Global Scrubber: [================>]       │ (syncs all 3)
│ Position: 2:30 / Duration: 10:00           │
├────────────────────────────────────────────┤
│ [Previous Event] [Play/Pause] [Next Event] │
├────────────────────────────────────────────┤
│ VOD 1: [=====  ] offset: 0s | VOD 2: [==] │
│ VOD 3: [======>] offset: +45s              │
│                                            │
│ [Sync to VOD 1] [Sync to VOD 2] ...      │
└────────────────────────────────────────────┘
```

**Component Structure:**
```
MultiVodComparison/
├── MultiVodViewer.jsx (main container)
├── VodPanel.jsx (individual VOD + scrubber, x3)
├── GlobalScrubber.jsx (shared timeline)
├── SyncControls.jsx (sync mode buttons)
└── hooks/
    ├── useMultiVodState.js (master state)
    ├── useVodScrubber.js (individual VOD sync)
    └── useGlobalSync.js (global scrubber logic)
```

**State Management:**
```javascript
// MultiVodState
{
  sessionId: "comp-abc123",
  vods: [
    {
      id: "vod-1",
      path: "/path/to/vod1.mp4",
      duration: 600, // seconds
      currentTime: 150,
      playback: "playing" | "paused",
      offset: 0, // relative to global time
      events: [ { timestamp: 45, type: "kill" }, ... ]
    },
    // VOD 2 & 3...
  ],
  
  // Synchronization modes
  syncMode: "independent" | "global" | "timer", // Phase 2: "timer"
  globalTime: 150, // shared playback position (seconds)
  
  // Timer sync (Phase 2)
  timerDetection: {
    enabled: false,
    vod1Timer: "3:45",
    vod2Timer: "3:45",
    vod3Timer: "3:45",
    aligned: false
  }
}
```

**Key Behaviors:**

1. **Individual Scrubbing:**
   - User drags VOD 1's scrubber → only VOD 1 seeks
   - Other VODs stay at current position
   - Global scrubber reflects VOD 1's position (visual feedback)

2. **Global Scrubbing:**
   - User drags Global Scrubber → all 3 VODs seek to same time
   - Each VOD respects its offset (if sync offset exists)
   - All 3 video players play in sync

3. **Play/Pause:**
   - Single play/pause button controls all 3
   - All 3 stay in sync during playback

4. **Event Markers:**
   - Each VOD's events shown above its scrubber (colored bars like current VodViewer)
   - Global scrubber shows event markers for all 3 (combined, color-coded by VOD)

5. **Offset Display:**
   - Show VOD 2 & 3 offsets relative to VOD 1
   - E.g., "VOD 2: +30s", "VOD 3: -15s"
   - User can manually adjust offsets with +/- buttons

**Event Markers on Scrubbers:**
```
VOD 1: [██ ████     ██  ]  (yellow = kills)
       0:00        10:00

VOD 2: [ ██    ████  ██ ]  (yellow for VOD2's kills)
       0:00        10:00

Global: Y=VOD1, R=VOD2, B=VOD3
       [Y██ RY██ BY██    ] (mixed colors)
```

---

### Backend API Design

**New endpoints:**

```
POST /api/sessions/multi-vod
{
  "vods": [
    { "path": "/path/to/vod1.mp4" },
    { "path": "/path/to/vod2.mp4" },
    { "path": "/path/to/vod3.mp4" }
  ]
}
Response:
{
  "sessionId": "comp-abc123",
  "vods": [
    {
      "id": "vod-1",
      "duration": 600,
      "events": [...]
    },
    // ...
  ]
}

GET /api/sessions/multi-vod/{sessionId}
Response: Full MultiVodState

PUT /api/sessions/multi-vod/{sessionId}/vods/{vodId}/seek
{
  "timestamp": 150 // seconds
}
Response: Current state

PUT /api/sessions/multi-vod/{sessionId}/global-seek
{
  "timestamp": 150
}
Response: All VODs updated

PUT /api/sessions/multi-vod/{sessionId}/offset
{
  "vodId": "vod-2",
  "offset": 30 // seconds (positive = ahead)
}
Response: Updated offsets
```

**Database schema:**

```
MultiVodSession:
  id: string (primary)
  created_at: datetime
  name: string (optional)
  vods: [
    {
      vod_id: string (FK to existing VOD)
      path: string
      duration: number
      offset: number (seconds)
      events: [ { timestamp, type, ... } ]
    }
  ]
  sync_mode: string ("independent" | "global")
  global_time: number (seconds)
```

---

## 🧠 Phase 2: Auto-Sync via Game Timer OCR

### Feature Goals

Instead of manual scrubbing/offset adjustment, detect in-game timers and auto-align VODs.

**Example:**
- Apex match with 5:00 minute timer on screen
- VOD 1: timer shows "3:45" at 1:15 in the video
- VOD 2: timer shows "3:45" at 0:58 in the video
- VOD 3: timer shows "3:45" at 1:22 in the video
- → Auto-calculate offsets: VOD2 offset -17s, VOD3 offset +7s

### Architecture

**Timer Detection Pipeline:**

```
1. User selects "Detect Game Timer" button
2. For each VOD:
   a. Sample frames at 1-second intervals
   b. Run OCR on timer region (user calibrates region like CaptureArea)
   c. Extract timestamp/countdown (e.g., "3:45", "01:30")
   d. Store: { frame_num, time_code, confidence }
3. User selects same game/event across all 3 VODs (dropdown)
4. Find matching time codes across VODs
5. Calculate offsets to align them
6. Apply offsets automatically
```

**New components:**

```
GameTimerDetection/
├── TimerCalibration.jsx (set OCR region, like CaptureArea)
├── DetectionProgress.jsx (show progress as OCR runs)
├── MatchingUI.jsx (show detected timers, let user pick reference)
└── hooks/
    └── useTimerDetection.js
```

**New backend:**

```
POST /api/sessions/multi-vod/{sessionId}/detect-timers
{
  "timerRegion": { x, y, width, height }, // similar to CaptureArea
  "searchInterval": 1 // seconds between frames
}
Response:
{
  "job_id": "detect-abc123",
  "status": "running"
}

GET /api/jobs/{jobId}/progress
Response:
{
  "status": "running",
  "vods": {
    "vod-1": { complete: 35%, timers: [ { timestamp: 150, detected: "3:45", confidence: 0.92 } ] },
    // ...
  }
}

POST /api/sessions/multi-vod/{sessionId}/auto-align
{
  "referenceTimerValue": "3:45", // user picks which game/timer to sync to
  "vodTimers": { // user confirms which timer to use for each VOD
    "vod-1": "3:45",
    "vod-2": "3:45",
    "vod-3": "3:45"
  }
}
Response:
{
  "offsets": {
    "vod-1": 0,
    "vod-2": -17,
    "vod-3": 7
  },
  "alignment": "complete"
}
```

**Python backend (app/):**

New files:
- `timer_detection.py` — OCR pipeline for timer extraction
- `multi_vod_sync.py` — Offset calculation & alignment logic

Existing files to extend:
- `ocr.py` — Add timer-specific OCR models
- `webui.py` — Add new routes for multi-VOD sessions
- `vod_ocr.py` — Reuse frame extraction logic

---

## 📋 Implementation Tasks

### Phase 1: Multi-VOD Layout & Scrubbing (3-4 days)

**Architect:**
- [ ] Design MultiVodState schema
- [ ] Decide on video sync strategy (shared playback thread, or per-player?)
- [ ] Design offset calculation logic
- [ ] Review feasibility of 3x video playback on typical hardware

**Backend Dev:**
- [ ] Create MultiVodSession data model & database
- [ ] Implement POST /api/sessions/multi-vod (create session)
- [ ] Implement GET /api/sessions/multi-vod/{sessionId} (fetch state)
- [ ] Implement PUT /api/.../global-seek (sync all scrubbers)
- [ ] Implement PUT /api/.../offset (adjust individual offsets)
- [ ] Tests: session creation, seeking, offset application

**Frontend Dev:**
- [ ] Create MultiVodViewer.jsx layout (3-column grid)
- [ ] Create VodPanel.jsx (video + individual scrubber)
- [ ] Create GlobalScrubber.jsx (shared timeline)
- [ ] Implement useMultiVodState hook (fetch from backend)
- [ ] Implement useGlobalSync hook (scrubber → API → video sync)
- [ ] Implement playback sync (all 3 play/pause together)
- [ ] Event marker rendering (per-VOD + global)
- [ ] Tests: layout, scrubbing, state sync

**QA:**
- [ ] Test 3-video playback on target hardware (performance)
- [ ] Test scrubber sync accuracy (off by <100ms)
- [ ] Test edge cases: rapid scrubbing, offset changes mid-playback
- [ ] Test event marker display with multiple games
- [ ] Performance: CPU/memory with 3x 1080p video

---

### Phase 2: Game Timer OCR Auto-Sync (2-3 days)

**Architect:**
- [ ] Design timer detection pipeline
- [ ] Decide on OCR model (Tesseract vs EasyOCR vs custom)
- [ ] Design timer format detection (countdown vs elapsed, digits only vs "MM:SS")
- [ ] Design offset calculation algorithm (match timers across VODs)

**Backend Dev:**
- [ ] Implement timer_detection.py (frame sampling + OCR)
- [ ] Implement POST /api/.../detect-timers (start detection job)
- [ ] Implement job polling (GET /api/jobs/{jobId})
- [ ] Implement POST /api/.../auto-align (calculate & apply offsets)
- [ ] Add timer OCR to config.json (region, confidence threshold)
- [ ] Tests: timer detection accuracy, offset calculation

**Frontend Dev:**
- [ ] Create TimerCalibration component (like CaptureArea)
- [ ] Create DetectionProgress UI (show progress bar + detected timers)
- [ ] Create MatchingUI (let user select reference timer + confirm matches)
- [ ] Add "Auto-Align" button to MultiVodComparison
- [ ] Tests: UI flow, timer selection, offset application

**QA:**
- [ ] Test timer detection on various overlays (Apex, Valorant, CS:GO)
- [ ] Test accuracy of offset calculation
- [ ] Test edge cases: timer not visible in first frame, game paused, timer glitch
- [ ] Performance: OCR on 600-second VOD (should take <2 minutes total)

---

## 🔄 User Flow

### Phase 1: Create & Compare VODs

1. User navigates to **VOD Library**
2. Selects "New Comparison Session" or "Compare VODs"
3. Picks 3 VODs from library (or imports new ones)
4. System creates MultiVodSession and loads VODs side-by-side
5. User can:
   - Drag individual scrubbers to review each VOD separately
   - Drag global scrubber to sync all 3
   - Adjust offsets with +/- buttons
   - Play/pause all at once

### Phase 2: Auto-Align with Timers

6. User clicks "Auto-Align from Timer"
7. System shows TimerCalibration UI (draw box around timer on screen)
8. User confirms region → system starts OCR detection
9. ProgressUI shows detected timers (e.g., "VOD1: 3:45 (confidence 0.95)")
10. User reviews detected timers and clicks "Align"
11. System calculates offsets and applies them
12. VODs are now synced to the same in-game moment

---

## 🛠️ Technical Challenges & Mitigations

**Challenge 1: 3x Video Playback Performance**
- Risk: Playing 3x 1080p video simultaneously may struggle on low-end systems
- Mitigation:
  - Profile on target hardware (test machine specs)
  - Consider downscaling videos if needed
  - Optional: lazy-load non-focused VODs (only display, don't decode)
  - Document system requirements (e.g., "Recommend GPU acceleration")

**Challenge 2: Scrubber Sync Accuracy**
- Risk: Seeking 3 videos to exact same timestamp causes drift
- Mitigation:
  - Use shared playback clock (not individual)
  - Periodic re-sync after seeking
  - Allow ±100ms drift tolerance (imperceptible)

**Challenge 3: Timer OCR Variability**
- Risk: Different games/overlays have very different timer formats
- Mitigation:
  - Let user calibrate timer region (CaptureArea style)
  - Support multiple timer formats (countdown, elapsed, custom)
  - Require user confirmation before auto-aligning
  - Fallback: manual offset adjustment if detection fails

**Challenge 4: Database Migration**
- Risk: Adding MultiVodSession table requires DB schema update
- Mitigation:
  - Design schema to co-exist with existing VOD table
  - Migration script to add new table
  - Test on both clean install and upgraded instances

---

## 📦 Deliverables

### Phase 1 Deliverables
- [ ] MultiVodViewer React component + styling
- [ ] Multi-VOD API endpoints (create, fetch, seek, offset)
- [ ] Database schema for MultiVodSession
- [ ] Event markers on global scrubber
- [ ] Tests (unit + integration)
- [ ] Updated CLAUDE.md with component architecture

### Phase 2 Deliverables
- [ ] Timer detection pipeline (app/timer_detection.py)
- [ ] TimerCalibration + MatchingUI components
- [ ] Auto-align API endpoint
- [ ] Timer detection job system (background processing)
- [ ] Tests (timer accuracy, offset calculation)
- [ ] User guide: "How to auto-align VODs with game timers"

---

## 🎯 Success Criteria

**Phase 1:**
- [ ] Load 3 VODs side-by-side without lag
- [ ] Global scrubber syncs all 3 videos within 100ms
- [ ] Offset adjustment smooth and intuitive
- [ ] Event markers visible on all scrubbers
- [ ] No crashes or memory leaks with 3x video playback

**Phase 2:**
- [ ] Timer detection accuracy >90% on Apex overlays
- [ ] Auto-alignment within ±500ms of actual game time
- [ ] User can easily calibrate timer region
- [ ] Works with other games (Valorant, CS:GO)

---

## 📅 Timeline Estimate

- **Phase 1:** 3-4 days (Architect + Backend + Frontend + QA)
- **Phase 2:** 2-3 days (Backend + Frontend + QA, Architect as needed)

---

## 🚀 Next Steps

1. **You review this design** — Any questions? Changes?
2. **Spawn Architect agent** to refine design & answer questions
3. **Spawn Backend Dev** to start API/database work
4. **Spawn Frontend Dev** to start layout/component work
5. **Ongoing:** QA tests as features ship

Ready to move forward? I can spawn the agents to start building this.

