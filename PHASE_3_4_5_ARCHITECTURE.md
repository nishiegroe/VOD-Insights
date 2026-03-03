# Phases 3-5 Architecture Plan: Native Video + Multi-VOD Sync

**Author:** Sam (Architect)  
**Date:** 2026-03-02  
**Status:** Ready for Implementation  
**Target Timeline:** Days 11-28 (18 days, ~140 hours)

---

## Executive Summary

Phase 2 completed the frontend UI components (149 tests, 95%+ coverage). Phases 3-5 will implement the native video playback backend and multi-video synchronization architecture.

**Key Goals:**
- Phase 3: Frame-accurate synchronization for 3+ videos
- Phase 4: Advanced playback controls and UI
- Phase 5: Comprehensive testing and optimization

**Architecture:** libvlc + IPC + Master Clock Sync Algorithm

---

# Phase 3: Multi-Video Synchronization (Days 11-15 / 50 hours)

## Scope

Assuming Phase 1 (infrastructure) and Phase 2 (single video playback) are complete, Phase 3 adds the core synchronization logic.

### Deliverables

1. **Sync Master Implementation** (C++)
   - Master clock tracking
   - Frame drift calculation every 16ms
   - Pause/resume-based micro-adjustments
   - Telemetry emission

2. **Multi-Video State Management** (React)
   - Consume sync telemetry
   - Display drift indicators
   - Track state for 3+ videos
   - Handle out-of-sync errors

3. **Synchronized Frontend Components**
   - MultiVideoComparison: main container
   - VideoGrid: 3-column layout
   - VideoTile: individual video wrapper
   - SyncIndicators: visual drift feedback

4. **Sync Tests**
   - Unit tests: drift calculation accuracy
   - Integration tests: multi-video sync over 5 minutes
   - Edge cases: codec mismatches, frame rate variations

### IPC Contract Changes

**New IPC Calls:**
```typescript
// Start synchronized playback
ipcRenderer.invoke('video:sync-start', { videoIds: [1, 2, 3] });

// Manually adjust drift (for advanced users)
ipcRenderer.invoke('video:adjust-drift', { videoId: 1, driftMs: 50 });

// Get current sync status
ipcRenderer.invoke('video:get-sync-status', { videoIds: [1, 2, 3] })
  .then(status => {
    // { videoId: 1, drift: -5ms, frame: 1234, status: 'synced' }
  });
```

**Enhanced Telemetry:**
```typescript
// Existing event, but with new format
ipcRenderer.on('video:telemetry', (event, {
  timestamp,
  states: [
    { videoId: 1, currentFrame: 1000, expectedFrame: 1000, drift: 0 },
    { videoId: 2, currentFrame: 999, expectedFrame: 1000, drift: -1 },
    { videoId: 3, currentFrame: 1001, expectedFrame: 1000, drift: 1 }
  ],
  maxDrift: 1,  // max drift in frames
  syncStatus: 'synced'  // 'syncing' | 'synced' | 'out-of-sync'
}));
```

### Architecture Diagram: Sync Loop

```
┌─────────────────────────────────────────────┐
│      Sync Master Thread (16-33ms cycle)     │
└─────────────────────────────────────────────┘
         │
         ├─ 1. Get elapsed time from master clock
         │
         ├─ 2. For each video in cluster:
         │    ├─ Get current_frame
         │    ├─ Calculate expected_frame
         │    └─ Calculate drift
         │
         ├─ 3. Drift Analysis:
         │    ├─ If drift > +1 frame: pause, sleep, resume (slow down)
         │    ├─ If drift < -1 frame: pause until master catches up
         │    └─ If within tolerance: do nothing
         │
         ├─ 4. Emit Telemetry:
         │    └─ Send { states, maxDrift, syncStatus } to React
         │
         └─ 5. Sleep(16ms) → repeat
```

### Code Example: Sync Master

```cpp
// Phase 3: Sync Master Implementation
class SyncMaster {
 public:
  struct SyncState {
    int video_id;
    int current_frame;
    int expected_frame;
    int drift_frames;
    double drift_ms;
  };

  SyncMaster(float reference_fps, int sync_interval_ms = 16)
    : reference_fps_(reference_fps),
      sync_interval_ms_(sync_interval_ms),
      master_clock_start_(GetCurrentTimeMs()) {}

  // Called every sync_interval_ms by sync thread
  std::vector<SyncState> CalculateDrift(
      const std::map<int, VLCPlayer*>& players) {
    
    std::vector<SyncState> states;
    double elapsed_ms = GetCurrentTimeMs() - master_clock_start_;
    
    // Expected frame at this point in time
    int master_expected_frame = (elapsed_ms / 1000.0) * reference_fps_;

    for (const auto& [video_id, player] : players) {
      int current_frame = player->GetCurrentFrame();
      int drift_frames = current_frame - master_expected_frame;
      double drift_ms = (drift_frames / reference_fps_) * 1000.0;

      states.push_back({
        video_id,
        current_frame,
        master_expected_frame,
        drift_frames,
        drift_ms
      });
    }

    return states;
  }

  void AdjustPlayback(std::map<int, VLCPlayer*>& players) {
    const int SYNC_TOLERANCE_FRAMES = 1;  // ±16.67ms @ 60fps

    auto states = CalculateDrift(players);

    for (const auto& state : states) {
      auto player = players[state.video_id];
      
      if (state.drift_frames > SYNC_TOLERANCE_FRAMES) {
        // Video is ahead of master, pause and wait
        player->Pause();
        
        // Sleep for drift amount
        int sleep_ms = (state.drift_ms);
        std::this_thread::sleep_for(
          std::chrono::milliseconds(sleep_ms)
        );
        
        player->Play();
        
        // Log adjustment
        LOG(INFO) << "Adjusted video " << state.video_id 
                  << " down by " << sleep_ms << "ms";
      }
      
      if (state.drift_frames < -SYNC_TOLERANCE_FRAMES) {
        // Video is behind, let it catch up
        // Don't pause; wait for sync thread to continue
      }
    }
  }

  void Reset() {
    master_clock_start_ = GetCurrentTimeMs();
  }

 private:
  float reference_fps_;
  int sync_interval_ms_;
  double master_clock_start_;
  
  double GetCurrentTimeMs() {
    auto now = std::chrono::high_resolution_clock::now();
    return std::chrono::duration<double, std::milli>(
      now.time_since_epoch()
    ).count();
  }
};
```

### React Component: Sync Indicators

```tsx
// src/components/SyncIndicators.tsx
interface SyncIndicatorsProps {
  telemetry: SyncTelemetry | null;
  videoId: number;
}

export const SyncIndicators: React.FC<SyncIndicatorsProps> = ({
  telemetry,
  videoId
}) => {
  const state = telemetry?.states.find(s => s.videoId === videoId);
  if (!state) return null;

  const driftMs = state.drift * (1000 / state.fps);  // Convert frames to ms
  const isDrifted = Math.abs(state.drift) > 1;

  return (
    <div className={`sync-indicator ${isDrifted ? 'warning' : 'synced'}`}>
      <span className="drift-amount">
        {isDrifted ? `${driftMs.toFixed(1)}ms` : 'Synced'}
      </span>
      
      <div className="drift-visualizer">
        {/* Show visual bar of drift */}
        <div 
          className="drift-bar"
          style={{
            left: `${50 + (driftMs / 50) * 50}%`,  // -50ms to +50ms scale
            backgroundColor: isDrifted ? '#ff6b6b' : '#51cf66'
          }}
        />
      </div>

      {isDrifted && (
        <span className="drift-warning">
          {driftMs > 0 ? 'Ahead' : 'Behind'} by {Math.abs(driftMs).toFixed(1)}ms
        </span>
      )}
    </div>
  );
};
```

## Blockers for Phase 3

### 1. **IPC Latency for Multiple Videos** (Medium Risk)
- **Issue:** Seek commands for 3+ videos might exceed latency budget
- **Impact:** Sync drift could exceed tolerance during seeks
- **Mitigation:** 
  - Batch seek commands: send `{ videoIds: [1,2,3], position }` once
  - Debounce user scrubber: only send seek every 100ms
  - Verify Phase 1 sends all seeks in parallel (not sequential)
- **Resolution:** Test with 3x 1080p60 video before Phase 3 starts

### 2. **Frame-Accurate Seeking** (Medium-High Risk)
- **Issue:** libvlc doesn't have direct frame API; need to use `next()`/`previous()`
- **Impact:** Seeking to exact frame might take 10-100ms per video
- **Mitigation:**
  - Use binary search for faster frame seeking
  - Verify frame count accuracy after seek (within ±1)
  - Profile seek times in Phase 1
- **Resolution:** Implement frame seeking in Phase 1 infrastructure

### 3. **Codec Frame Rate Detection** (Low-Medium Risk)
- **Issue:** Different videos might have different FPS (24fps, 30fps, 60fps)
- **Impact:** Expected frame calculation differs per video
- **Mitigation:**
  - Parse FPS from metadata in Phase 2 (single video)
  - Extend sync master to handle per-video FPS
  - Store FPS in VideoState struct
- **Resolution:** Add FPS field to Phase 1 metadata parsing

### 4. **Audio Sync Issues** (Low Risk)
- **Issue:** Pausing video doesn't pause audio; causes lip-sync problems
- **Impact:** User sees video pause but hears continuous audio
- **Mitigation:**
  - In micro-pause scenarios (16ms), audio gap is imperceptible
  - For larger adjustments, also pause audio stream
  - Verify Phase 1 has audio control API
- **Resolution:** Extend audio handling in Phase 1

---

# Phase 4: Advanced Controls & UI (Days 16-20 / 40 hours)

## Scope

Build on Phase 3's sync to add user-facing controls and advanced features.

### Deliverables

1. **Playback Rate Control**
   - Dropdown: 0.25x, 0.5x, 1.0x, 1.5x, 2.0x
   - Applied to all videos in sync
   - Updates expected frame calculation

2. **Audio Track Selection**
   - List available tracks per video
   - Select track per video independently
   - Mute/unmute individual videos

3. **Frame Stepping**
   - Keyboard: arrow keys (single frame)
   - UI buttons: ±1 frame, ±10 frames
   - Works while paused

4. **HUD Overlay**
   - Video title / file name
   - Timecode (HH:MM:SS.FF format)
   - FPS indicator
   - Sync drift indicator
   - Codec info

5. **Synchronized Scrubber**
   - Single timeline shared by all videos
   - Shows current position for each video
   - Dragging scrubber seeks all in parallel

### New Components

```typescript
// src/pages/MultiVodComparison/components/
├── MultiVideoComparison.tsx     // main container
├── VideoGrid.tsx                // 3-column layout
├── VideoTile.tsx                // single video wrapper
├── SyncIndicators.tsx           // drift visualization (from Phase 3)
├── HudOverlay.tsx               // metadata display
├── FrameStepControls.tsx        // ±1, ±10 frame buttons
├── PlaybackRateControl.tsx      // speed dropdown
├── AudioTrackSelector.tsx       // audio selection
└── SyncStatus.tsx               // overall sync status
```

### Code Example: Playback Rate Control

```tsx
// src/components/PlaybackRateControl.tsx
export const PlaybackRateControl: React.FC<{
  currentRate: number;
  onRateChange: (rate: number) => void;
}> = ({ currentRate, onRateChange }) => {
  const rates = [0.25, 0.5, 1.0, 1.5, 2.0];

  return (
    <div className="playback-rate-control">
      <label htmlFor="rate-select">Speed:</label>
      <select
        id="rate-select"
        value={currentRate}
        onChange={(e) => onRateChange(parseFloat(e.target.value))}
      >
        {rates.map(rate => (
          <option key={rate} value={rate}>
            {rate === 1.0 ? `${rate}x (Normal)` : `${rate}x`}
          </option>
        ))}
      </select>
    </div>
  );
};
```

```cpp
// native/src/video_engine.cc
void VideoEngine::SetPlaybackRate(
    const std::vector<int>& video_ids,
    float rate) {
  
  for (int vid : video_ids) {
    auto player = players_[vid];
    
    // VLC doesn't have native playback rate API
    // Instead, adjust sync master's reference clock
    sync_master_->SetPlaybackRate(rate);
    
    // If rate != 1.0, we need frame-skipping logic
    // Skip frames if rate > 1.0, duplicate if rate < 1.0
  }
}
```

## Blockers for Phase 4

### 1. **Playback Rate Accuracy** (Low-Medium Risk)
- **Issue:** libvlc doesn't expose playback rate control
- **Impact:** Can't change speed without frame-skipping tricks
- **Mitigation:**
  - Use frame-stepping to simulate rate changes
  - Adjust sync master reference clock instead
  - Pre-compute skipped/duplicated frames
- **Resolution:** Implement in Phase 1 as feature flag

### 2. **Audio Track Enumeration** (Low Risk)
- **Issue:** Need to enumerate all audio tracks in file
- **Impact:** API might not exist in libvlc
- **Mitigation:**
  - Check libvlc docs for track APIs
  - Use FFmpeg to query tracks if needed
  - Cache track list on load
- **Resolution:** Test in Phase 1 spike

### 3. **Scrubber Synchronization** (Medium Risk)
- **Issue:** User dragging scrubber should seek all videos simultaneously
- **Impact:** Seeking 3+ videos might have staggered timing
- **Mitigation:**
  - Send all seeks as single batch IPC call
  - Debounce scrubber updates to 100ms intervals
  - Show "Syncing..." UI during seeks
- **Resolution:** Batch IPC in Phase 1 infrastructure

---

# Phase 5: Testing & Optimization (Days 21-28 / 50 hours)

## Scope

Comprehensive testing, benchmarking, and performance optimization.

### Deliverables

1. **Unit Tests**
   - Sync master drift calculation (100+ tests)
   - Frame seeking accuracy
   - Playback rate adjustments
   - Audio track selection

2. **Integration Tests**
   - 3-video 5-minute sync test (±5ms RMS drift)
   - Cross-codec playback (H.264, H.265, VP9)
   - Rate changes while playing
   - User seek recovery

3. **Cross-Platform Tests**
   - Windows 10/11 (native + WMF variant)
   - macOS 11+ (Intel + Apple Silicon)
   - Ubuntu 20.04 (X11)
   - Ubuntu 22.04 (Wayland)

4. **Performance Optimization**
   - CPU profiling
   - Memory usage profiling
   - Seek latency optimization
   - Telemetry overhead reduction

5. **Optional: Windows Media Foundation Backend**
   - Windows-only implementation (Phase 5 stretch goal)
   - Same public API as VLC backend
   - Better hardware acceleration on Windows

### Performance Targets

```
Metric                  | Target  | Acceptable | At Risk
─────────────────────────────────────────────────────
CPU per video           | <12%    | <15%       | >15%
Total CPU (3 videos)    | <36%    | <45%       | >45%
Memory per instance     | <80MB   | <100MB     | >100MB
Sync drift (RMS/5min)   | <2ms    | <5ms       | >5ms
Max drift (transient)   | <16ms   | <33ms      | >33ms
Frame drops             | 0%      | <0.1%      | >0.1%
Seek latency            | <200ms  | <500ms     | >500ms
```

### Test Coverage Requirements

```
Module                  | Target  | Status
────────────────────────────────────────
Sync Master             | 90%     | TBD
Video Playback          | 85%     | TBD
IPC Handlers            | 85%     | TBD
React Components        | 80%     | (Already 95% from Phase 2)
E2E Tests               | 8 scenarios
```

### Code Example: Sync Test

```typescript
// test/sync-master.test.ts
describe('SyncMaster', () => {
  it('should maintain frame-accurate sync across 3 videos for 5 minutes', async () => {
    const engine = new VideoEngine();
    const videoIds = [1, 2, 3];

    // Load three 5-minute test videos @ 60fps
    for (const id of videoIds) {
      await engine.load({
        id,
        filePath: `./fixtures/test_video_${id}.mp4`,
        metadata: { duration: 300, fps: 60 }
      });
    }

    engine.play(videoIds);

    // Sample sync drift every 1 second for 5 minutes
    const driftSamples: number[] = [];
    
    for (let i = 0; i < 300; i++) {
      await new Promise(r => setTimeout(r, 1000));
      
      const telemetry = engine.getSyncTelemetry();
      const maxDrift = Math.max(...telemetry.states.map(s => Math.abs(s.drift)));
      driftSamples.push(maxDrift);
    }

    // Calculate statistics
    const avgDrift = driftSamples.reduce((a, b) => a + b) / driftSamples.length;
    const maxDrift = Math.max(...driftSamples);
    const rmsDrift = Math.sqrt(
      driftSamples.reduce((sum, d) => sum + d * d) / driftSamples.length
    );

    // Assertions
    expect(avgDrift).toBeLessThan(1);      // < 1 frame on average
    expect(rmsDrift).toBeLessThan(5);      // < 5ms RMS
    expect(maxDrift).toBeLessThan(16);     // < 16ms max (1 frame @ 60fps)
  });

  it('should recover from codec drift mismatch', async () => {
    // Video 1: H.264
    // Video 2: H.265
    // Video 3: VP9
    // Should all sync within tolerance despite codec differences
  });

  it('should handle variable framerate videos', async () => {
    // Video 1: 24fps
    // Video 2: 30fps
    // Video 3: 60fps
    // Should all stay synced
  });
});
```

## Blockers for Phase 5

### 1. **Benchmark Environment** (Low Risk)
- **Issue:** Performance targets depend on hardware
- **Impact:** May need to adjust targets per platform
- **Mitigation:**
  - Establish baseline on "reference hardware"
  - Test on low-end and high-end machines
  - Document hardware specs with results
- **Resolution:** Define reference specs in Phase 5 kickoff

### 2. **Windows Media Foundation Implementation** (Medium Risk)
- **Issue:** WMF has different API than libvlc
- **Impact:** May not be able to ship WMF in Phase 5
- **Mitigation:**
  - Make it a Phase 5 stretch goal (not blocking)
  - Keep libvlc as primary for Windows
  - Plan WMF as future optimization
- **Resolution:** Prioritize based on time remaining

### 3. **Cross-Platform Audio Codec Support** (Low-Medium Risk)
- **Issue:** Audio codecs differ across platforms
- **Impact:** Some files might not play audio on all platforms
- **Mitigation:**
  - Document supported codecs per platform
  - Provide transcoding guidance for users
  - Log codec info for debugging
- **Resolution:** Create codec matrix in Phase 5

---

# Summary: Architecture Decisions

## Chosen Approach: libvlc + Master Clock Sync

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Native Backend | libvlc (VLC) | Cross-platform, proven for multi-stream, mature |
| Sync Algorithm | Master Clock + Pause/Resume | Simple, transparent, ±1 frame accurate |
| Sync Interval | 16ms (60fps) | Matches typical display refresh rate |
| Drift Tolerance | ±1 frame | 16.67ms @ 60fps, imperceptible to user |
| IPC Transport | Electron ipcMain/ipcRenderer | Native to Electron, proven, low latency |
| Telemetry Rate | 16-33ms | Real-time feedback without overwhelming UI |
| Platform Strategy | Start with VLC, optional WMF later | Ship faster, optimize Windows later |

## Why This Architecture Works

1. **Scalable:** Can extend to 4+ videos with same algorithm
2. **Observable:** Telemetry tells us exactly what's happening
3. **Recoverable:** If sync fails, UI shows it, user can manually adjust
4. **Testable:** Each component (sync, seek, rate) can be tested independently
5. **Maintainable:** Simple algorithm easier to debug than complex alternatives

## Risks & Mitigations

| Risk | Severity | Mitigation | Owner |
|------|----------|-----------|-------|
| Frame-accurate seeking | Medium | Test API in Phase 1 spike | Native |
| IPC latency for 3+ videos | Medium | Batch commands, debounce | Both |
| Codec incompatibility | Low-Medium | Fallback mode, test matrix | QA |
| Audio desync on micro-pauses | Low | Audio pause logic in Phase 1 | Native |
| Performance on weak hardware | Low-Medium | Benchmark, optimize, document | Both |

---

# Appendix: Integration Checklist

## Before Phase 3 Starts
- [ ] Phase 1 infrastructure 100% complete
- [ ] Phase 2 single-video playback working
- [ ] IPC contract validated
- [ ] Frame seeking API verified
- [ ] Audio control API verified

## Phase 3 Exit Criteria
- [ ] 3-video sync working for 5 minutes
- [ ] Drift stays within ±1 frame
- [ ] Telemetry flowing to React correctly
- [ ] MultiVideoComparison component renders
- [ ] SyncIndicators show correct drift values
- [ ] All Phase 3 tests passing (90%+ coverage)

## Phase 4 Exit Criteria
- [ ] Playback rate control working
- [ ] Audio track selection per video
- [ ] Frame stepping responsive
- [ ] HUD overlay displaying correctly
- [ ] Synchronized scrubber seeking all videos
- [ ] All Phase 4 tests passing (85%+ coverage)

## Phase 5 Exit Criteria
- [ ] 5-minute stress test: <5ms RMS drift
- [ ] All codecs working on all platforms
- [ ] Performance benchmarks met (or documented exceptions)
- [ ] 80%+ test coverage across all modules
- [ ] Documentation complete
- [ ] Ready for production release

---

**Status:** Ready for Phase 3 Implementation  
**Next Milestone:** Phase 3 complete (Days 11-15)  
**Approver:** Nishie (Product Owner)

---

*Last updated: 2026-03-02 21:10 CST*  
*All phases assume Phase 1 & 2 complete*
