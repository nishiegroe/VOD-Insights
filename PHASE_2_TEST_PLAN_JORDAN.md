# Phase 2 Comprehensive Test Plan - Jordan QA

**Phase:** Phase 2 - Single Native Video Playback  
**Tester:** Jordan (QA Engineer)  
**Date Started:** 2026-03-02  
**Expected Duration:** 5-6 hours across multiple sessions  
**Status:** In Progress

---

## Test Overview

### Scope
Test native video playback for the first video in multi-VOD comparison view (VOD index 0).
Verify React components, hooks, API integration, and performance characteristics.

### Test Environment Requirements
- ✅ NativeVideoPlayer.tsx - 5.8KB React component
- ✅ NativeVideoContainer.tsx - 12.5KB wrapper component  
- ✅ useNativeVideo.ts - Hook for IPC-based playback control
- ✅ VideoClient service - IPC communication
- ✅ Test infrastructure in place (vitest, 136 passing tests)

### Key Components Under Test
```
VideoPlayer Component Tree:
  ├─ NativeVideoPlayer.tsx (wrapper, error handling)
  │   ├─ useNativeVideo hook
  │   ├─ Debug overlay
  │   └─ Fallback to HTML5
  │
  ├─ NativeVideoContainer.tsx (comparison view integration)
  │   ├─ Sync with global playback state
  │   ├─ Performance monitoring
  │   ├─ Debug overlay (performance metrics)
  │   └─ Error boundary
  │
  └─ useNativeVideo.ts (state management)
      ├─ IPC communication
      ├─ Playback state management
      ├─ Command execution (play/pause/seek)
      └─ Telemetry & error handling
```

---

## Test Sessions

### SESSION 1: Basic Playback & Navigation (Target: 1-2 hours)

#### 1.1 Component Rendering & Initialization
**Test:** Verify components render without crashing  
**Priority:** P0 - CRITICAL

```typescript
Test Cases:
□ TC1.1.1: NativeVideoPlayer renders with valid src
  - Load component with /path/to/test.mp4
  - Verify DOM contains #native-video-container
  - Verify no console errors
  - Expected: Component renders, isAvailable=true, isInitialized=true

□ TC1.1.2: NativeVideoContainer renders in comparison view
  - Load with vodIndex=0, vodId="vod_001"
  - Verify renders alongside HTML5 videos (indices 1,2)
  - Check for "● Native" indicator badge
  - Expected: Only video 0 shows Native badge

□ TC1.1.3: Fallback behavior when native unavailable
  - Simulate native video unavailable
  - Verify fallback to HTML5 message
  - Check error message displays: "Native video not available"
  - Expected: Graceful fallback, user informed

□ TC1.1.4: Debug overlay rendering
  - Enable enableDebugOverlay={true}
  - Verify debug panel appears at bottom
  - Check for: VOD ID, Available, Initialized, State, Time, Speed
  - Expected: All fields visible and updating
```

**Manual Verification:**
```bash
cd /home/owner/.openclaw/workspace/vod-insights/frontend
npm run dev &
# Navigate to multi-VOD comparison page
# Verify first video renders with "● Native" badge
# Open DevTools console - should be clean (no errors)
```

---

#### 1.2 Play / Pause Control
**Test:** Basic playback control  
**Priority:** P0 - CRITICAL

```typescript
Test Cases:
□ TC1.2.1: Play button initiates playback
  - Click play button
  - Measure latency (should be < 100ms)
  - Verify state transitions: isStopped=false, isPlaying=true, isPaused=false
  - Verify time advances
  - Expected: Video plays smoothly

□ TC1.2.2: Pause button pauses playback
  - From playing state, click pause
  - Verify state: isPaused=true, isPlaying=false
  - Verify time stops advancing
  - Expected: Video pauses immediately

□ TC1.2.3: Play/pause toggle
  - Start playing, pause, play again
  - Repeat 5 times
  - Check for any artifacts or state corruption
  - Expected: Toggle works reliably

□ TC1.2.4: Initial state is stopped
  - Load video without autoplaying
  - Verify isStopped=true, isPlaying=false
  - Verify time=0
  - Expected: Video doesn't auto-start
```

**Performance Metrics:**
```
Target Latency:
  - Play button click → playback starts: < 100ms
  - Pause button click → playback stops: < 100ms

Measure Using:
  - Performance.now() in onStateChange callback
  - DevTools Performance tab
  - Debug overlay update frequency
```

---

#### 1.3 Time Display Accuracy
**Test:** Verify time display matches actual playback position  
**Priority:** P1 - HIGH

```typescript
Test Cases:
□ TC1.3.1: Time display at start (0:00)
  - Load video, pause immediately
  - Verify currentTime = 0
  - Verify time format: "0:00 / 5:00" (MM:SS format)
  - Expected: Accurate time display

□ TC1.3.2: Time increments during playback
  - Play video
  - Record time at T=0s, T=1s, T=2s, T=5s
  - Verify time increases monotonically
  - Verify time = actual elapsed time
  - Expected: Time matches playback position

□ TC1.3.3: Time display format edge cases
  - Test at 0:00 (start)
  - Test at 9:59 (MM:SS rollover area)
  - Test at 59:59 (near hour boundary)
  - Test at actual end time
  - Expected: All formats correct

□ TC1.3.4: Time matches across all videos
  - Play all 3 videos simultaneously
  - Record time displays from videos 0, 1, 2
  - Times should all be equal (global sync)
  - Expected: Synchronized time display
```

**Accuracy Test:**
```javascript
// In debug overlay, record times
const times = [];
setInterval(() => {
  times.push({
    videoTime: state.currentTime,
    wallClockTime: performance.now(),
  });
}, 1000);

// After 5 seconds, verify:
// videoTime should be ~5000ms (±100ms tolerance)
```

---

### SESSION 2: Seek & Scrubbing (Target: 1.5-2 hours)

#### 2.1 Click-to-Seek Functionality
**Test:** Jump to position by clicking timeline  
**Priority:** P0 - CRITICAL

```typescript
Test Cases:
□ TC2.1.1: Seek to 25% position
  - Play 5-minute video
  - Click timeline at 25% (1:15 position)
  - Verify seek completes in < 100ms
  - Verify all videos jump to same position
  - Expected: Accurate seek to ~1:15

□ TC2.1.2: Seek to 50% position
  - From playing, seek to 50% (2:30)
  - Verify latency < 100ms
  - Verify time display updates to 2:30
  - Expected: Seek to middle of video

□ TC2.1.3: Seek to 75% position
  - Seek to 75% (3:45)
  - Verify playback resumes from new position
  - Expected: Smooth resume from new position

□ TC2.1.4: Seek to end
  - Click timeline at 100% (end)
  - Verify seeks to duration (5:00)
  - Verify video stops or loops behavior
  - Expected: Handled gracefully

□ TC2.1.5: Seek to start
  - From middle of video, seek to 0:00
  - Verify time resets to start
  - Verify can resume playback
  - Expected: Seek to start works

□ TC2.1.6: Seek accuracy tolerance
  - Seek to specific frames (30fps video = 33.33ms/frame)
  - Record actual landed position
  - Verify accuracy within ±1 frame
  - Expected: Frame-accurate seeking
```

**Seek Accuracy Measurement:**
```javascript
// Method 1: Visual inspection
// At 60fps, display current frame number
// Seek target: frame 1800 (30s at 60fps)
// Verify landed within frame 1799-1801

// Method 2: Telemetry
// Record timestamp before/after seek
const seekStart = performance.now();
controls.seek(30000); // seek to 30 seconds
const seekEnd = performance.now();
const seekLatency = seekEnd - seekStart; // should be < 100ms
```

---

#### 2.2 Scrubber Drag (Timeline Scrubbing)
**Test:** Drag timeline thumb to change position  
**Priority:** P1 - HIGH

```typescript
Test Cases:
□ TC2.2.1: Drag scrubber from 0% to 50%
  - Play video
  - Click and drag timeline thumb to 50%
  - Verify video previews in real-time
  - Verify video updates during drag (not after release)
  - Expected: Responsive scrubbing

□ TC2.2.2: Release scrubber and resume
  - During scrubbing, verify video pauses
  - Release scrubber
  - Verify playback resumes from new position
  - Expected: Smooth scrub-and-resume

□ TC2.2.3: Drag speed handling
  - Drag slowly (5 seconds over 5 seconds)
  - Verify video updates smoothly
  - Verify no stuttering during drag
  - Expected: Smooth interactive scrubbing

□ TC2.2.4: Multi-video sync during scrub
  - Drag scrubber in comparison view
  - Verify all 3 videos update together
  - Verify time stays synchronized
  - Expected: All videos scrub in sync
```

---

#### 2.3 Seek Edge Cases
**Test:** Boundary conditions and invalid seeks  
**Priority:** P1 - HIGH

```typescript
Test Cases:
□ TC2.3.1: Seek beyond duration (clamping)
  - Try to seek to duration + 5 seconds
  - Verify seeks to duration instead
  - Expected: Graceful clamping to valid range

□ TC2.3.2: Seek to negative time (clamping)
  - Try to seek to -5 seconds
  - Verify seeks to 0 instead
  - Expected: Clamped to start

□ TC2.3.3: Rapid consecutive seeks
  - Issue 5 seeks rapidly (queue them)
  - Verify all complete or final seek is honored
  - Expected: No corruption or undefined behavior

□ TC2.3.4: Seek during loading
  - Load video file
  - Before initialization complete, try to seek
  - Verify either queues seek or shows error
  - Expected: Graceful handling
```

---

### SESSION 3: Synchronization & Performance (Target: 2-3 hours)

#### 3.1 Multi-Video Synchronization
**Test:** All 3 videos stay synchronized  
**Priority:** P0 - CRITICAL

```typescript
Test Cases:
□ TC3.1.1: Sync at start (0:00)
  - Load 3 videos into comparison
  - Verify all 3 show 0:00 time
  - Expected: Start synced

□ TC3.1.2: Sync during playback (5 seconds)
  - Play all 3 videos together
  - Record times after 5 seconds of playback
  - Video 0: ~5000ms
  - Video 1: ~5000ms
  - Video 2: ~5000ms
  - Tolerance: ±100ms
  - Expected: All videos within 100ms of each other

□ TC3.1.3: Sync after seek
  - Play all 3 videos
  - Seek to 2:00 (global timeline)
  - Verify all 3 videos jump to 2:00
  - Expected: All videos at same position

□ TC3.1.4: Sustained sync over long playback
  - Play video for 5 minutes continuously
  - Measure sync drift at: 1min, 2min, 3min, 4min, 5min
  - Acceptable drift: < ±1 frame (16.67ms @ 60fps)
  - Expected: Sync holds throughout

□ TC3.1.5: Sync with rate changes
  - Play at 1.0x
  - Change to 0.5x (slow motion)
  - Verify all 3 videos slow down together
  - Verify sync maintained
  - Expected: Rate change syncs to all videos
```

**Sync Measurement:**
```javascript
// Record time from each video simultaneously
const times = {
  video0: videoState[0].currentTime,
  video1: videoState[1].currentTime,
  video2: videoState[2].currentTime,
};

// Calculate drift from video 0
const drift1 = Math.abs(times.video1 - times.video0);
const drift2 = Math.abs(times.video2 - times.video0);

// Both should be < 16.67ms (1 frame @ 60fps)
```

---

#### 3.2 Playback Rate Synchronization
**Test:** All videos play at same rate  
**Priority:** P1 - HIGH

```typescript
Test Cases:
□ TC3.2.1: Rate 0.5x (slow motion)
  - Set playback rate to 0.5x
  - Verify all 3 videos play at half speed
  - Expected: Slow motion effect works

□ TC3.2.2: Rate 1.0x (normal speed)
  - Set to 1.0x
  - Verify normal speed playback
  - Expected: Normal speed

□ TC3.2.3: Rate 1.5x (fast)
  - Set to 1.5x
  - Verify all videos play at 1.5x
  - Expected: Fast playback

□ TC3.2.4: Rate 2.0x (double speed)
  - Set to 2.0x
  - Verify double speed
  - Expected: Fast playback

□ TC3.2.5: Rate change during playback
  - Play at 1.0x
  - Change to 1.5x mid-playback
  - Verify smooth transition (no stutter)
  - Verify all videos change rate together
  - Expected: Instant rate change, synced across videos
```

---

#### 3.3 Performance Metrics
**Test:** CPU, memory, FPS usage  
**Priority:** P1 - HIGH

```typescript
Test Cases:
□ TC3.3.1: CPU Usage (Single Native Video)
  - Open Activity Monitor / Task Manager
  - Load comparison with 1 native, 2 HTML5 videos
  - Play for 1 minute
  - Measure average CPU %
  - Expected: < 15% (target for native video)
  - Acceptable: 8-20%

□ TC3.3.2: CPU Usage (All Three Videos)
  - Play all 3 videos together for 1 minute
  - Measure CPU usage
  - Expected: < 25%
  - This is: native (8-15%) + HTML5 (3-5%) + HTML5 (3-5%) = 14-25%

□ TC3.3.3: Memory Usage Baseline
  - Start app (no videos)
  - Record memory usage
  - Expected baseline: ~150-200 MB

□ TC3.3.4: Memory Usage with Videos Loaded
  - Load comparison view (don't play)
  - Record memory usage
  - Increase: ~60-80 MB per native, 40-50 MB per HTML5
  - Expected total: < 350 MB

□ TC3.3.5: Memory Stability (No Leak)
  - Play video for 10 minutes
  - Record memory every minute
  - Verify memory stays stable (±50MB variance)
  - Expected: No memory growth trend

□ TC3.3.6: FPS Measurement
  - Enable debug overlay (shows FPS)
  - Play 60fps video
  - Measure FPS in overlay
  - Expected: 59-61 FPS maintained
  - Tolerance: ±2 frames
```

**Performance Data Collection:**
```bash
# macOS: Activity Monitor
# Windows: Task Manager (Details tab)
# Linux: top -p $(pgrep electron)

# Record at T=0s, T=30s, T=60s, T=300s
# Track: CPU %, Mem (MB), FPS (from debug overlay)
```

---

#### 3.4 Frame Drop Detection
**Test:** Monitor for frame drops/stuttering  
**Priority:** P2 - MEDIUM

```typescript
Test Cases:
□ TC3.4.1: Frame rate consistency (60fps video)
  - Record FPS from debug overlay every 100ms
  - Count frames < 30fps (these are drops)
  - Expected: < 1 drop per 1000 frames
  - In 5 minutes @ 60fps = 18,000 frames
  - Acceptable drops: < 18 frames

□ TC3.4.2: Visual inspection for stuttering
  - Play video for 5 minutes
  - Watch for visible stuttering/jank
  - Look for: smooth playback, consistent motion
  - Expected: No visible stuttering

□ TC3.4.3: Seek performance
  - Issue 10 seeks over 1 minute
  - Measure each seek latency
  - Expected: All < 100ms
```

---

### SESSION 4: Feature Flags & Debug (Target: 1-1.5 hours)

#### 4.1 Feature Flag Control
**Test:** Enable/disable native video via feature flag  
**Priority:** P1 - HIGH

```typescript
Test Cases:
□ TC4.1.1: Flag disabled = HTML5 only
  - Set VITE_NATIVE_VIDEO_ENABLED=false
  - Load comparison view
  - Verify all 3 videos show as "HTML5"
  - Verify no "● Native" badge on video 0
  - Expected: Pure HTML5 fallback

□ TC4.1.2: Flag enabled = First video native
  - Set VITE_NATIVE_VIDEO_ENABLED=true
  - Load comparison view
  - Verify video 0 shows "● Native"
  - Verify videos 1, 2 show as "HTML5"
  - Expected: First video is native

□ TC4.1.3: Toggle without restart
  - Enable flag via localStorage or config
  - Reload page (not full app restart)
  - Verify flag toggle works
  - Expected: No full app restart needed

□ TC4.1.4: Sample rate testing (A/B rollout)
  - Set sample rate to 0% (no users get native)
  - Verify all HTML5
  - Set sample rate to 100% (all users get native)
  - Verify first video is native
  - Expected: Sample rate controls rollout
```

---

#### 4.2 Debug Mode & Overlays
**Test:** Debug information visibility and accuracy  
**Priority:** P2 - MEDIUM

```typescript
Test Cases:
□ TC4.2.1: Debug overlay content
  - Enable debug mode
  - Verify shows:
    ✓ VOD ID (should be "vod_001" etc)
    ✓ Available: ✓ (checkmark)
    ✓ Initialized: ✓
    ✓ State: "playing" / "paused" / "stopped"
    ✓ Time: "0:00 / 5:00"
    ✓ Speed: "1.00x"
    ✓ Error (if present)
  - Expected: All fields present and correct

□ TC4.2.2: Performance metrics overlay
  - Enable performance monitoring
  - Verify shows:
    ✓ FPS (instantaneous)
    ✓ FPS avg (10-frame average)
    ✓ Sync drift (milliseconds)
    ✓ Duration
    ✓ VOD index
  - Expected: Real-time metrics updating

□ TC4.2.3: Debug overlay toggle
  - Click overlay to hide
  - Verify "🔍 Debug" button appears
  - Click button to show overlay again
  - Expected: Toggle works smoothly

□ TC4.2.4: Debug overlay performance impact
  - Measure FPS with overlay on: F1
  - Measure FPS with overlay off: F2
  - Verify difference < 2 FPS
  - Expected: Minimal performance impact
```

---

#### 4.3 Error Handling
**Test:** Graceful error handling  
**Priority:** P1 - HIGH

```typescript
Test Cases:
□ TC4.3.1: File not found error
  - Try to load non-existent video path
  - Verify error message displays
  - Verify app doesn't crash
  - Verify can retry with different file
  - Expected: Graceful error handling

□ TC4.3.2: Codec not supported
  - Try to play unsupported codec (e.g., VP9)
  - Verify error is logged
  - Verify fallback to HTML5 (if available)
  - Expected: Handled gracefully

□ TC4.3.3: No native video available (Electron context)
  - Simulate native video unavailable
  - Verify shows "Native video not available"
  - Verify fallback message visible
  - Expected: User informed of fallback

□ TC4.3.4: Network/IPC failure during playback
  - Simulate IPC communication failure
  - Verify error callback fires
  - Verify error message displayed
  - Expected: Graceful error handling
```

---

### SESSION 5: Cross-Platform Verification (Target: 2-3 hours per platform)

#### 5.1 Windows Testing
**Test:** Native video on Windows (DirectX)  
**Priority:** P0 - CRITICAL

```typescript
Test Cases:
□ TC5.1.1: Windows 10/11 rendering
  - Run on Windows 10 or Windows 11
  - Load native video
  - Verify renders without artifacts
  - Verify no black bars or distortion
  - Expected: Clean video rendering

□ TC5.1.2: DirectX acceleration
  - Verify uses DirectX rendering
  - Check Performance Monitor for GPU usage
  - Expected: GPU acceleration working

□ TC5.1.3: All playback features
  - Play/pause works
  - Seek responsive
  - Sync accurate
  - Expected: Feature parity with other platforms

□ TC5.1.4: Performance on Windows
  - Measure CPU < 15%
  - Memory stable
  - FPS 59-61 for 60fps video
  - Expected: Meets performance targets
```

---

#### 5.2 macOS Testing
**Test:** Native video on macOS (Metal)  
**Priority:** P0 - CRITICAL

```typescript
Test Cases:
□ TC5.2.1: macOS rendering (Metal)
  - Run on Intel Mac or Apple Silicon Mac
  - Load native video
  - Verify renders cleanly
  - Check System Information for GPU
  - Expected: Metal rendering working

□ TC5.2.2: Apple Silicon support
  - Run on M1/M2/M3 Mac (if available)
  - Verify native compilation for ARM64
  - Verify playback works smoothly
  - Expected: ARM64 support working

□ TC5.2.3: macOS performance
  - CPU < 15% (single video)
  - Memory stable
  - FPS 59-61
  - Expected: Performance targets met
```

---

#### 5.3 Linux Testing
**Test:** Native video on Linux (OpenGL/Vulkan)  
**Priority:** P1 - HIGH

```typescript
Test Cases:
□ TC5.3.1: X11 rendering
  - Run on Linux with X11 display server
  - Load native video
  - Verify renders correctly
  - Expected: X11 rendering works

□ TC5.3.2: Wayland support
  - Run on Linux with Wayland (if available)
  - Load native video
  - Verify renders correctly
  - Expected: Wayland compatibility

□ TC5.3.3: GPU driver compatibility
  - Check available OpenGL/Vulkan drivers
  - Run on system with minimal GPU support
  - Verify still works or gracefully falls back
  - Expected: Handles driver variations
```

---

## Test Execution Log

### Session 1: Basic Playback & Navigation
**Status:** READY  
**Start Time:** (To be filled)  
**Estimated Duration:** 1.5 hours

- [ ] TC1.1.1-1.1.4: Component rendering
- [ ] TC1.2.1-1.2.4: Play/pause control
- [ ] TC1.3.1-1.3.4: Time display accuracy

**Issues Found:**
(None yet)

**Notes:**
(To be filled)

---

### Session 2: Seek & Scrubbing
**Status:** PENDING  
**Start Time:** (To be filled)  
**Estimated Duration:** 2 hours

- [ ] TC2.1.1-2.1.6: Click-to-seek
- [ ] TC2.2.1-2.2.4: Scrubber drag
- [ ] TC2.3.1-2.3.4: Edge cases

---

### Session 3: Sync & Performance
**Status:** PENDING  
**Start Time:** (To be filled)  
**Estimated Duration:** 3 hours

- [ ] TC3.1.1-3.1.5: Multi-video sync
- [ ] TC3.2.1-3.2.5: Playback rate sync
- [ ] TC3.3.1-3.3.6: Performance metrics
- [ ] TC3.4.1-3.4.3: Frame drops

---

### Session 4: Feature Flags & Debug
**Status:** PENDING  
**Start Time:** (To be filled)  
**Estimated Duration:** 1.5 hours

- [ ] TC4.1.1-4.1.4: Feature flags
- [ ] TC4.2.1-4.2.4: Debug overlays
- [ ] TC4.3.1-4.3.4: Error handling

---

### Session 5: Cross-Platform
**Status:** PENDING  
**Start Time:** (To be filled)  
**Estimated Duration:** 2-3 hours per platform

- [ ] TC5.1: Windows
- [ ] TC5.2: macOS
- [ ] TC5.3: Linux

---

## Bugs & Issues Log

### Critical (Blocks Phase 2)
(None found yet)

### High (Must fix before Phase 2 complete)
(None found yet)

### Medium (Should fix before Phase 3)
(None found yet)

### Low (Nice to have)
(None found yet)

---

## Test Summary Template

**Session:** [Session number]  
**Date:** [Date]  
**Tester:** Jordan  
**Duration:** [Time spent]  
**Tests Completed:** [X/Y]  
**Passing:** [X]  
**Failing:** [Y]  
**Blocked:** [Z]  

### Issues Found
- [List of issues with severity]

### Performance Metrics
- CPU Usage: [value] (target: < 15%)
- Memory: [value] MB
- FPS: [value] (target: 59-61)
- Sync Drift: [value] ms (target: < 16.67ms)

### Notes
[Any observations or findings]

---

## Phase 2 Sign-Off Criteria

All of the following must be TRUE for Phase 2 to be complete:

```
✅ CRITICAL ISSUES
  ✓ TC1.1.1: Component renders without crash
  ✓ TC1.2.1: Play/pause latency < 100ms
  ✓ TC3.1.1: Sync at start (0:00)
  ✓ TC5.1/5.2: Core platforms working

✅ FUNCTIONALITY
  ✓ All playback controls responsive (< 100ms)
  ✓ Seeking accurate (±1 frame)
  ✓ Synchronization maintained (< 16.67ms drift)
  ✓ All 3 videos play in sync
  ✓ Feature flag toggle works
  ✓ Error handling graceful

✅ PERFORMANCE
  ✓ CPU < 15% (single native video)
  ✓ CPU < 25% (all 3 videos)
  ✓ Memory stable (no leaks)
  ✓ FPS 59-61 (no drops)
  ✓ Frame drop rate < 0.1%

✅ DEBUG & MONITORING
  ✓ Debug overlay shows correct info
  ✓ Performance metrics display
  ✓ Error logging works
  ✓ Telemetry captured

✅ QUALITY
  ✓ No console errors (CRITICAL level)
  ✓ No uncaught exceptions
  ✓ Test coverage maintained at 85%+
  ✓ No flaky tests
```

---

## Next Steps (Phase 3)

After Phase 2 completion:
- [ ] Add support for 2nd native video
- [ ] Implement frame-accurate sync for N videos
- [ ] Advanced offset handling
- [ ] Performance optimization for 3+ videos

---

**Document Version:** 1.0  
**Last Updated:** 2026-03-02  
**Status:** QA Test Plan - Ready for Execution
