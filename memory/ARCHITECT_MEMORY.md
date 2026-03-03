# Sam's Memory — Architect
**Updated:** 2026-03-02 21:10 CST

## Phase 2 Status: COMPLETE ✅
- Frontend UI components: 100% complete (149 tests, 95%+ coverage)
- IPC contract established: VideoClient service ready
- Components ready for native integration: PlaybackControls, ProgressBar, TimeDisplay, VideoErrorUI

## Phase 3 Plan: Multi-Video Synchronization (Days 11-15)

### Architecture Decisions
1. **Sync Algorithm:** Master Clock + Pause/Resume (±1 frame tolerance)
   - Simple, proven, transparent to user
   - Micro-pauses every 30-60 seconds (imperceptible)
   - Works with any codec/framerate

2. **Native Backend:** libvlc (VLC) instead of Windows Media Foundation
   - Chosen for cross-platform support (Windows/Mac/Linux Day 1)
   - Can pivot to WMF on Windows-only builds later
   - Mature library, proven for multi-stream sync

3. **IPC Contract:** Extend from Phase 2
   - New calls: `video:sync-start`, `video:adjust-drift`
   - Enhanced telemetry: drift data for each video
   - Polling: 16-33ms intervals for sync checks

### Implementation Flow
```
Master Clock Thread (33ms cycles):
  1. Calculate expected_frame = (elapsed_time / 1000) * FPS
  2. For each video:
     - Get current_frame
     - Calculate drift = current_frame - expected_frame
     - If drift > 1 frame: pause, sleep(drift_time), resume
  3. Emit telemetry to React
```

### Integration Points with Phase 2 Frontend
- PlaybackControls: Can trigger `video:sync-start` on play
- ProgressBar: Can scrub all videos in parallel
- TimeDisplay: Can show drift indicators
- VideoErrorUI: Reusable for multi-video errors

## Phase 4 Plan: Advanced Controls & UI (Days 16-20)

### New Components
- MultiVideoComparison (main container)
- VideoGrid (3-column layout)
- VideoTile (single video wrapper)
- SyncIndicators (drift visualization)
- SyncControlPanel (manual offset adjustment)

### Features
- Playback rate control (0.25x - 2.0x)
- Audio track selection per video
- Frame stepping (forward/backward)
- HUD overlay with metadata
- Synchronized scrubber for all videos
- Drift indicators in TimeDisplay

## Phase 5 Plan: Testing & Optimization (Days 21-28)

### Test Coverage
- Frame-accurate seek tests (±1 frame tolerance)
- Multi-video sync tests (3 videos @ 60fps for 5min)
- Playback rate sync tests
- Cross-platform validation (Windows/Mac/Linux)

### Performance Targets
- CPU: <15% per video (~45% for 3 videos)
- Memory: <100MB per instance
- Sync drift: <5ms RMS over 5+ minutes
- Frame drops: <0.1%

### Optional: Windows Media Foundation Backend
- For Windows-only optimization in Phase 5
- Same public API as VLC backend
- Can be gradual migration

## Critical Blockers for Phases 3-5

### For Frontend Team (Post Phase 2)
1. **IPC Latency:** Seeking 3+ videos might have network overhead
   - Mitigation: Batch seek commands, debounce slider (already done)
   
2. **Codec Compatibility:** Some codecs might not work cross-platform
   - Mitigation: Fallback to HTML5 player (already in VideoErrorUI)

3. **Sync Tolerance:** If drift > 1 frame @ 60fps acceptable?
   - Need confirmation from native team

### For Native Developer (Phase 1 Infrastructure)
1. **libvlc Compilation:** Cross-platform native module build
   - Risk: Medium (node-gyp complexity, platform-specific gotchas)
   - Mitigation: Dedicated build expert, comprehensive testing

2. **Window Rendering Integration:** Attach libvlc to Electron window
   - Windows: HWND integration with DirectX
   - Mac: NSView integration with Metal
   - Linux: XCB/Wayland window ID
   - Risk: High (platform-specific rendering)

3. **Frame-Accurate Seeking:** libvlc frame-stepping API
   - Risk: Medium (VLC doesn't expose direct frame API)
   - Mitigation: Use `libvlc_media_list_player_next()` + timestamp verification

### Shared Blockers (Blocking Multiple Phases)
1. **Codec Test Coverage:** Need to verify H.264, H.265, VP9 work cross-platform
2. **Performance Benchmarking:** Establish baseline before optimization phase
3. **CI/CD for Native Builds:** Need reproducible builds on Windows/Mac/Linux

## Decisions Made (Phase 2)

### Component Design
- **Props-based control** (no Redux/Context) → simpler, more testable
- **Colocated CSS** (not CSS-in-JS) → easier to maintain
- **Comprehensive tests** (>85% coverage) → fewer future bugs

### Testing Strategy
- **Vitest + React Testing Library** → fast, modern, good DX
- **Accessibility first** (WCAG 2.1 AA) → not an afterthought
- **Mock everything** (no E2E in unit tests) → faster iteration

### Accessibility
- **WCAG 2.1 Level AA** verified on all components
- **Keyboard navigation** (arrow keys, space, enter)
- **Screen reader** compatible with semantic HTML

## Known Issues & Gotchas

### IPC Contract Limitations
- TypeScript interfaces defined, but need native validation
- No automatic retry on IPC failure (add in Phase 3)
- Large file paths might exceed IPC buffer (test limits in Phase 1)

### Performance Notes
- Component mount time: ~15ms (target: <50ms) ✅
- Rerender time: <10ms (target: <16ms) ✅
- CSS bundle: ~12KB (target: <50KB) ✅
- Total overhead: ~45KB (target: <100KB) ✅

## Dependencies Status
- React 18.2.0 ✅
- TypeScript 5.0 ✅
- Vitest 1.6.0 ✅
- No new dependencies needed for Phase 3-5

## Communication Requirements

### For Native Developer
1. **Questions before Phase 1:**
   - Sync tolerance: 16ms (±1 frame @ 60fps) acceptable?
   - Polling frequency: 16-33ms updates OK?
   - Max videos: Testing with 3, can we go to 4+?

2. **What we're using from Phase 1:**
   - VideoClient service (solid foundation)
   - IPC handlers (all working)
   - useNativeVideo hook (ready for Phase 3)

3. **What we need for Phase 3:**
   - Multi-video sync telemetry (drift per video)
   - Frame-accurate seeking API
   - Playback rate sync support
   - Error recovery with fallback

### For QA Team
1. **Phase 2 validation:**
   - Verify all components on Windows/Mac/Linux
   - Test keyboard navigation
   - Test screen reader compatibility
   - Test multiple browsers (Chrome/Firefox/Safari)

2. **Phase 3 focus:**
   - Frame-accurate sync tests
   - Codec compatibility matrix
   - Multi-platform playback tests

## Action Items

### Now (Phase 2 Completion)
- [ ] Commit Phase 2 components to feature/multi-vod-complete
- [ ] Create Phase 3-5 architecture docs (this file + blockers)
- [ ] Update TEAM_SHARED_FINDINGS.md with architecture decisions
- [ ] Notify native developer of Phase 1 blockers

### For Phase 3 (Native Developer)
- [ ] Implement libvlc wrapper (Phase 1)
- [ ] Set up worker thread pool (Phase 1)
- [ ] Verify IPC contracts are compatible (Phase 1)
- [ ] Plan sync telemetry format (Phase 1)

### For Frontend Developer (Phase 3)
- [ ] Create MultiVideoComparison component
- [ ] Implement synchronized ProgressBar
- [ ] Add SyncIndicators to UI
- [ ] Integrate with Phase 1 IPC

## Links & References
- **Phase 2 Components:** `PHASE_2_COMPONENTS.md`
- **Phase 2 Report:** `PHASE_2_COMPLETION_REPORT.md`
- **Native Video Plan:** `IMPLEMENTATION_PLAN_ELECTRON_NATIVE_VIDEO.md` (Days 6-10)
- **Architecture Decisions:** `DECISION_LOG_NATIVE_VIDEO.md`
- **Frontend Tests:** `vod-insights/frontend/src/components/*.test.tsx`

---

**Status:** Phase 2 Complete → Phase 3 Ready  
**Next Update:** Phase 3 progress milestone  
**Team:** Frontend Complete, Native Team Ready to Start Phase 1
