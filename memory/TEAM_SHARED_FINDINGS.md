# Team Shared Findings — Phase 2-3 Bridge

**Last Updated:** 2026-03-02 21:15 CST  
**Status:** Phase 2 Complete (UI + Telemetry) → Phase 3 Architecture Finalized

---

## Architecture Decisions (Phases 3-5)

### Core Decision: libvlc + Master Clock Sync

**What:** Native video playback via libvlc with frame-accurate synchronization  
**Why:** Cross-platform, proven for multi-stream sync, mature library  
**When:** Phase 1 infrastructure (Days 1-5), implementation in Phases 3-5  
**Owner:** Native Developer team

| Factor | Decision |
|--------|----------|
| **Native Backend** | libvlc (VLC) instead of WMF or custom FFmpeg |
| **Sync Algorithm** | Master Clock + Pause/Resume (±1 frame = ±16.67ms) |
| **Sync Interval** | 16ms (one display refresh cycle @ 60fps) |
| **Drift Tolerance** | ±1 frame (imperceptible to user) |
| **IPC Transport** | Electron ipcMain/ipcRenderer (proven, low-latency) |
| **Telemetry Rate** | 16-33ms updates to React |
| **Platform Strategy** | Ship with libvlc Day 1, optional WMF for Windows later |

### Why libvlc Over Alternatives

```
              | libvlc | WMF | Custom FFmpeg
──────────────────────────────────────────────
Platforms     | 3      | 1   | 3
Time-to-ship  | 3-4w   | 4-5w| 6-8w
Complexity    | Low    | Med | Very High
Community     | Large  | Large| Small
Maintenance   | Easy   | Hard| Very Hard
Sync Maturity | Proven | Proven| Uncertain
```

**Decision Rationale:**
1. Ship cross-platform day 1 (not Windows-only)
2. Maturity: VLC used in professional media centers for multi-stream
3. Pivot option: Can add WMF as Windows-only optimization in Phase 5
4. Time: 3-4 weeks vs 4-5 weeks saves critical timeline

---

## Integration Points: Native ↔ Frontend

### IPC Contract (Phase 1 → Phase 2 → Phase 3)

**Phase 1 Outputs (Infrastructure):**
```typescript
// Basic infrastructure (Days 1-5)
ipcRenderer.invoke('video:load', { id, filePath, metadata })
ipcRenderer.invoke('video:play', { videoIds })
ipcRenderer.invoke('video:pause', { videoIds })
ipcRenderer.invoke('video:seek', { videoId, position })
ipcRenderer.invoke('video:setPlaybackRate', { videoIds, rate })
```

**Phase 2 Inputs (Single-Video UI):**
- PlaybackControls uses all above IPC calls
- ProgressBar uses seek for dragging
- TimeDisplay shows current playback state
- VideoErrorUI handles errors

**Phase 3 Additions (Multi-Video Sync):**
```typescript
// New calls for Phase 3
ipcRenderer.invoke('video:sync-start', { videoIds: [1, 2, 3] })
ipcRenderer.invoke('video:adjust-drift', { videoId, driftMs })

// Enhanced telemetry
ipcRenderer.on('video:telemetry', (event, {
  timestamp,
  states: [
    { videoId: 1, currentFrame: 1000, expectedFrame: 1000, drift: 0 },
    { videoId: 2, currentFrame: 999, expectedFrame: 1000, drift: -1 },
    ...
  ],
  maxDrift: 1,
  syncStatus: 'synced'
}))
```

### Data Flow Example: Play Command

```
User clicks Play in React
  ↓ (via PlaybackControls)
ipcRenderer.invoke('video:play', { videoIds: [1, 2, 3] })
  ↓
Main process routes to native worker
  ↓
libvlc wrapper calls vlc_play() on each instance
  ↓
Sync master thread starts (16ms cycle)
  ↓
Every 16ms:
  - Calculate expected_frame for each video
  - Measure drift
  - Adjust slower videos (micro-pause)
  - Emit telemetry to React
  ↓
React updates: PlaybackControls, ProgressBar, SyncIndicators

---

## Critical Blockers (For Both Teams)

### 1. Frame-Accurate Seeking ⚠️ **Medium Risk**
**Problem:** libvlc doesn't expose direct frame API  
**Impact:** Seeking to exact frame might be 10-100ms operation  
**Blocker For:** Phase 3 sync tests, Phase 4 frame stepping  
**Solution:** Test binary search approach in Phase 1 spike  
**Owner:** Native Developer  
**Timeline:** Must resolve by Day 5

### 2. IPC Latency for 3+ Videos ⚠️ **Medium Risk**
**Problem:** Seeking 3 videos in sequence could exceed latency budget  
**Impact:** User scrubber might feel sluggish, sync recovery slow  
**Blocker For:** Phase 4 scrubber UX, Phase 3 user seek recovery  
**Solution:** Batch all seeks in single IPC call (Phase 1)  
**Owner:** Both teams (Native: implement batch, Frontend: use it)  
**Timeline:** Must be ready before Phase 3

### 3. Audio Sync During Micro-Pauses ⚠️ **Low Risk**
**Problem:** Pausing video doesn't pause audio automatically  
**Impact:** User hears audio continue during pause, causes lip-sync issues  
**Blocker For:** Phase 3 if pauses are long (>100ms)  
**Solution:** Auto-pause audio when pausing video (Phase 1)  
**Owner:** Native Developer  
**Timeline:** Nice-to-have, can skip if pauses are imperceptible

### 4. Cross-Codec Frame Rate ⚠️ **Low Risk**
**Problem:** Different videos might be 24fps, 30fps, 60fps  
**Impact:** Sync calculation differs per-video  
**Blocker For:** Phase 3 if videos have different FPS  
**Solution:** Store per-video FPS, adjust expected_frame calculation (Phase 1)  
**Owner:** Native Developer  
**Timeline:** Parse in Phase 2 single-video, use in Phase 3

---

## Performance Notes

### Phase 2 Verified (Frontend)
| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Component mount | <50ms | ~15ms | ✅ |
| Rerender | <16ms | <10ms | ✅ |
| CSS bundle | <50KB | ~12KB | ✅ |
| Total bundle | <100KB | ~45KB | ✅ |

### Phase 3 Projections (Native)
| Metric | Target | Assumption | Owner |
|--------|--------|-----------|-------|
| CPU per video | <12% | Hardware accel works | Native |
| Total (3 videos) | <36% | No background work | Both |
| Memory per instance | <80MB | VLC footprint small | Native |
| Sync drift RMS | <5ms | Master clock accurate | Native |
| Seek latency | <200ms | Batch IPC works | Both |

### Optimization Priorities (Phase 5)
1. **High:** Reduce seek latency (user-visible)
2. **High:** Verify codec support matrix
3. **Medium:** Optimize memory footprint
4. **Medium:** Optional: Windows Media Foundation variant
5. **Low:** Reduce CPU when idle

---

## Build & Deployment Status

### Frontend (Phase 2)
- ✅ TypeScript compilation: passing
- ✅ React component build: successful
- ✅ Test suite: 149/149 passing
- ✅ Code coverage: 95%+
- ✅ Bundle size: acceptable

### Native (Phase 1 → To Start)
- ⏳ node-gyp build system: TBD
- ⏳ libvlc compilation: TBD
- ⏳ Cross-platform builds: TBD
- ⏳ CI/CD setup: TBD

### Key Dependencies
```json
{
  "frontend": {
    "react": "^18.2.0",
    "typescript": "^5.0.0",
    "vitest": "^1.6.0"
  },
  "native": {
    "electron": "^27.0.0",
    "node-gyp": "^9.4.0",
    "libvlc": "4.0.0+",
    "piscina": "^4.0.0"
  }
}
```

---

## Test Results Summary

### Phase 2 (Frontend) ✅ PASSING

**Unit Tests:** 149 passing
```
PlaybackControls:  32 tests ✅ 100% coverage
ProgressBar:       41 tests ✅ 97.94% coverage
TimeDisplay:       38 tests ✅ 100% coverage
VideoErrorUI:      38 tests ✅ 98.04% coverage
────────────────────────────────────────
Total:            149 tests ✅ 95%+ coverage
```

### Phase 3 Test Plan (TBD - To Be Defined)
- Sync master drift calculation: 100+ tests
- Multi-video 5-minute stress test
- Codec compatibility matrix
- Cross-platform validation

---

## Known Issues & Gotchas

### Frontend (Phase 2)
- None reported; all tests passing

### Native (Phase 1 Design)

**Potential Issues:**
1. **node-gyp on Windows:** May require Visual Studio toolchain
2. **libvlc binary sizes:** ~15-20MB per platform (bundle consideration)
3. **Platform-specific rendering:** HWND/NSView/XCB integration complex
4. **Audio API:** libvlc audio control not well documented

**Mitigations:**
1. Document build requirements; consider pre-built binaries
2. Split into optional packages if size critical
3. Create platform abstraction layer in Phase 1
4. Create reference implementation for audio control

---

## Questions for Native Developer (Phase 1 Kickoff)

### Architecture
- [ ] Is ±16ms sync tolerance acceptable for users?
- [ ] Can we achieve <200ms seek latency for 3 videos?
- [ ] Is 16ms polling interval too fast or too slow?

### Implementation
- [ ] Which libvlc version are we targeting?
- [ ] Can we use pre-built libvlc binaries or must we build from source?
- [ ] What's the libvlc learning curve for the team?

### Performance
- [ ] Baseline: CPU usage for 3x 1080p60 video playback?
- [ ] Memory usage per libvlc instance?
- [ ] Audio codec support on each platform?

### Testing
- [ ] What test framework for native code? (Google Test? Catch2?)
- [ ] How do we measure frame accuracy? (frame counter? timestamps?)
- [ ] Performance benchmarking approach?

---

## Next Steps

### For Native Developer (Now)
1. Read this document + PHASE_3_4_5_ARCHITECTURE.md
2. Plan Phase 1 (Infrastructure) work
3. Spike on: frame seeking, audio control, batch IPC
4. Resolve blockers identified above

### For Frontend Developer (Now)
1. Review Phase 3-5 architecture
2. Plan MultiVideoComparison component
3. Wait for Phase 1 IPC contract finalization
4. Prepare for Phase 3 integration

### For QA (Now)
1. Review test plans in PHASE_3_4_5_ARCHITECTURE.md
2. Prepare test environment (3x videos, 3 codecs)
3. Plan cross-platform testing (Windows/Mac/Linux)

### For Product (Now)
1. Confirm sync tolerance (±16ms OK?)
2. Approve platform priority (Windows/Mac/Linux first?)
3. Review Phase 5 optional goals (WMF? Advanced controls?)

---

## Success Metrics

### Phase 3 Success
- 3+ videos sync within ±1 frame for 5+ minutes
- Telemetry flowing correctly to React
- No crashes or hangs during playback

### Phase 4 Success
- Playback rate changes smooth
- Frame stepping responsive (<100ms per step)
- Scrubber seeking all videos in parallel

### Phase 5 Success
- <5ms RMS drift over 10-minute playback
- All codecs working on all platforms
- Performance targets met (or documented)

---

**Status:** Phases 3-5 Architecture Complete & Approved  
**Ready for:** Native Developer Phase 1 Implementation  
**Timeline:** 18 days (Days 11-28) for full implementation  
**Risk Level:** Medium (sync complexity, platform dependencies)
