# Phase 2: User Testing Checklist
## Electron Native Video - Single Video Playback (Part 2 - Frontend)

**Duration:** Days 6-10 of 28-day roadmap  
**Date Range:** Week 2 of implementation  
**Test Focus:** First video in multi-VOD comparison view  
**Status:** Phase 2 Complete  
**Last Updated:** 2026-03-02

---

## Pre-Testing Setup

### Environment Requirements
- [ ] Electron app running (npm run dev)
- [ ] Native module compiled (npm run build:native)
- [ ] Feature flag enabled: `VITE_NATIVE_VIDEO_ENABLED=true`
- [ ] Debug mode enabled: `VITE_VIDEO_DEBUG_ENABLED=true`
- [ ] Performance monitoring enabled: `enablePerformanceMonitoring={true}`
- [ ] Test VOD file available: `/path/to/test_video.mp4` (1080p, 60fps, H.264)

### Test VOD Specifications
| Property | Value | Notes |
|----------|-------|-------|
| Resolution | 1920×1080 | Standard HD |
| Framerate | 60 fps | Typical for esports |
| Codec | H.264 or H.265 | Common VOD formats |
| Duration | 5-10 minutes | Long enough for testing |
| File Size | < 500MB | Reasonable for testing |
| Audio | Stereo AAC | Standard format |

### Known Test VOD Files
```
Windows:
  C:\test_videos\apex_gameplay_60fps.mp4
  C:\test_videos\valorant_match_1080p.mp4

macOS:
  ~/Videos/test_gameplay_60fps.mp4

Linux:
  ~/Videos/test_gameplay_1080p.mp4
```

---

## Test Scenarios

### 1. **Basic Playback**

#### 1.1 Load and Display
- [ ] Navigate to Multi-VOD Comparison page
- [ ] Load 3 VOD files for comparison
- [ ] Verify first video shows "● Native" indicator
- [ ] Verify second/third videos show as HTML5
- [ ] **Expected:** First video has green "● Native" badge

**Success Criteria:**
```
✅ First video renders in native container
✅ Second/third videos render as HTML5
✅ All three videos visible simultaneously
✅ No visual artifacts (black borders, distortion, etc.)
✅ No console errors
```

**Failure Handling:**
```
❌ Native video unavailable:
   → Check feature flag: VITE_NATIVE_VIDEO_ENABLED=true
   → Check Electron context (main/preload process)
   → Fallback to HTML5 video

❌ Video not rendering:
   → Check file path exists
   → Verify codec support (H.264/H.265)
   → Check native module loaded (console.log in DevTools)

❌ Garbled video:
   → Windows: Check DirectX version
   → macOS: Check Metal support
   → Linux: Check OpenGL/X11 support
```

#### 1.2 Play and Pause
- [ ] Click play button - first video starts playing
- [ ] Verify playback controls responsive (< 50ms latency)
- [ ] Click pause button - video pauses immediately
- [ ] Other videos respond to same play/pause command
- [ ] **Expected:** All videos start/stop together

**Success Criteria:**
```
✅ Play button responsive (< 100ms)
✅ Pause button responsive (< 100ms)
✅ No lag or stutter during playback
✅ Audio plays (if available)
✅ Video plays smoothly at 30-60fps
```

**Performance Targets:**
```
Target FPS: 59-61 fps (@ 60fps video)
Actual FPS: Measure in debug overlay
Tolerance: ±2 frames acceptable

If FPS drops below 30:
→ Reduce to 720p or lower
→ Check system load (Activity Monitor / Task Manager)
→ Profile native module for bottlenecks
```

#### 1.3 Time Display
- [ ] Verify time display shows "0:00 / 5:00" (example)
- [ ] Time advances during playback
- [ ] Time formatted as MM:SS or H:MM:SS
- [ ] **Expected:** Accurate, synchronized time display

**Success Criteria:**
```
✅ Time format correct (MM:SS)
✅ Time updates every frame
✅ Time matches native playback position
✅ No time jumping/skipping
```

---

### 2. **Seek and Scrubbing**

#### 2.1 Click-to-Seek
- [ ] Click on timeline at 25% mark (1:15 on 5:00 video)
- [ ] Video seeks to position instantly
- [ ] Time display updates to new position
- [ ] Other videos seek to same global time
- [ ] **Expected:** Seek completes in < 100ms

**Success Criteria:**
```
✅ Seek latency < 100ms
✅ Seek accuracy ±1 frame (16.67ms @ 60fps)
✅ All videos seek to same time
✅ Playback resumes at new position
✅ No audio/video desync after seek
```

**Frame Accuracy Test:**
```
1. Play to frame N
2. Record exact frame number
3. Pause and seek backwards 10 frames
4. Verify landed on frame N-10 (±1)
5. Repeat for different positions
```

#### 2.2 Scrubber Drag
- [ ] Click and drag scrubber to 50% position
- [ ] Video updates in real-time during drag
- [ ] Release scrubber - video seeks and resumes
- [ ] Other videos follow the same scrubber position
- [ ] **Expected:** Smooth, responsive scrubbing

**Success Criteria:**
```
✅ Scrubber drag responsive
✅ Video previews update during drag
✅ No stutter during scrub
✅ Sync maintained across all videos
```

#### 2.3 Seek Tolerance Testing
- [ ] Seek to 0:00 (start)
- [ ] Seek to duration (end)
- [ ] Seek to middle (2:30 on 5:00 video)
- [ ] Seek beyond duration (should clamp to end)
- [ ] Seek to negative time (should clamp to start)
- [ ] **Expected:** All seeks handled gracefully

**Success Criteria:**
```
✅ Start seek (0:00) successful
✅ End seek (duration) successful
✅ Mid-video seeks accurate
✅ Out-of-bounds seeks clamped
✅ No crashes or console errors
```

---

### 3. **Synchronization**

#### 3.1 Multi-Video Sync
- [ ] Play all 3 videos together
- [ ] Watch for audio/video drift after 30 seconds
- [ ] Check time displays (should show same global time)
- [ ] Seek to 2:00 on global timeline
- [ ] All videos should jump to 2:00
- [ ] **Expected:** Perfect sync, no drift

**Success Criteria:**
```
✅ Sync drift < ±1 frame (16.67ms @ 60fps) sustained
✅ No audio desync (sync drifts < 5 frames)
✅ Videos stay locked to global timeline
✅ Seek synchronizes all videos instantly

Performance Metrics:
- RMS Drift: < 5ms (over 5 minutes)
- Max Drift: < 16.67ms
- Sustained Drift: < 1 second
```

**Drift Monitoring:**
```
Use debug overlay to monitor:
  FPS: 60 (target for 60fps video)
  Drift: Should be within ±10ms range
  Frame Position: Compare across videos

If drift > 50ms:
→ Log error and fallback to HTML5
→ Record system specs for debugging
→ Check for system load issues
```

#### 3.2 Offset Handling
- [ ] Set offset on video 2: +2 seconds
- [ ] Set offset on video 3: -1 second
- [ ] Play all videos together
- [ ] Verify offsets applied correctly:
  - Video 1 at 0:10 → global time 0:10
  - Video 2 at 0:10 → global time -1:50 (or clamped to start)
  - Video 3 at 0:10 → global time 0:11
- [ ] **Expected:** Offsets correctly applied

**Success Criteria:**
```
✅ Positive offset works (video starts later)
✅ Negative offset works (video starts earlier)
✅ Offset doesn't break sync
✅ Changing offset updates sync correctly
```

#### 3.3 Playback Rate Sync
- [ ] Set playback rate to 0.5x (slow motion)
- [ ] All videos should play at 0.5x together
- [ ] Change to 1.5x (fast)
- [ ] All videos follow rate change
- [ ] **Expected:** Unified playback rate across all videos

**Success Criteria:**
```
✅ Rate 0.5x works (all videos slow down)
✅ Rate 1.0x works (normal speed)
✅ Rate 1.5x works (speed up)
✅ Rate 2.0x works (double speed)
✅ Rate changes apply to all videos instantly
```

---

### 4. **Performance & Resource Usage**

#### 4.1 CPU Usage
- [ ] Open Activity Monitor (macOS) / Task Manager (Windows) / top (Linux)
- [ ] Launch app with all 3 VODs loaded
- [ ] Play first video natively, others as HTML5
- [ ] Measure CPU usage after 1 minute of playback
- [ ] **Expected:** Single video: < 15% CPU

**CPU Targets:**
```
Native first video only:     8-15% CPU
+ HTML5 video 2:             +3-5% CPU
+ HTML5 video 3:             +3-5% CPU
Total for all 3:             14-25% CPU (acceptable)

If > 40% CPU: 
→ Profile native module
→ Check for busy loops
→ Consider quality downsampling
```

**Measurement:**
```
1. Record baseline (app idle): X%
2. Start playback: Y%
3. CPU usage = Y - X

Target for single native video: < 15%
```

#### 4.2 Memory Usage
- [ ] Measure memory at startup
- [ ] Load 3 VODs (don't play)
- [ ] Start playback for 5 minutes
- [ ] Measure memory after 5 minutes
- [ ] **Expected:** Total < 300MB increase

**Memory Targets:**
```
App baseline:                 ~100-150 MB
Per native video instance:    ~60-80 MB
Per HTML5 video instance:     ~40-50 MB
All 3 videos + app:           < 350 MB

If growing over time:
→ Possible memory leak
→ Check buffer management
→ Run for 30 min sustained test
```

**Sustained Test (Long Playback):**
```
1. Start playback of 5+ minute video
2. Record memory every minute for 30 minutes
3. Verify memory stays stable (< 50MB variance)
4. Stop and verify cleanup
5. If memory grows: investigate leak
```

#### 4.3 Frame Drops
- [ ] Play at 1080p 60fps for 5 minutes
- [ ] Monitor FPS in debug overlay
- [ ] Count frames where FPS drops significantly
- [ ] **Expected:** < 0.1% frame drop rate

**Frame Drop Monitoring:**
```
Using debug overlay:
  FPS: Should stay 59-61 (for 60fps video)
  Any frame < 30fps: Log as potential drop

Target: < 1 frame drop per 1000 frames
At 60fps over 5 minutes = 18000 frames
Acceptable drops: < 18 frames

If drops > 50:
→ System may be underpowered
→ Try 720p or lower
→ Check for background processes
```

---

### 5. **Feature Flag Testing**

#### 5.1 Enable/Disable Toggle
- [ ] Start with flag disabled (HTML5 only)
- [ ] Verify all 3 videos are HTML5
- [ ] Enable native flag: `setNativeVideoEnabled(true)`
- [ ] Reload page
- [ ] Verify first video is native
- [ ] **Expected:** Toggle works without restart

**Success Criteria:**
```
✅ Flag disabled: All HTML5 videos
✅ Flag enabled: First video native
✅ Toggle persists to localStorage
✅ Works without full app restart
```

#### 5.2 Sample Rate Testing (A/B Testing)
- [ ] Set sample rate to 0% (no native)
- [ ] Verify only HTML5 videos render
- [ ] Set sample rate to 100% (all native for user)
- [ ] Verify first video is native
- [ ] **Expected:** Sample rate controls rollout

**Success Criteria:**
```
✅ 0% sample: No native videos
✅ 50% sample: ~50% of users get native (deterministic)
✅ 100% sample: All users get native
✅ Consistent for same user (hash-based)
```

#### 5.3 Debug Mode Toggle
- [ ] Enable debug mode: `VITE_VIDEO_DEBUG_ENABLED=true`
- [ ] Verify debug overlay visible
- [ ] Click debug overlay to hide
- [ ] Click "🔍 Debug" button to show again
- [ ] **Expected:** Debug overlay toggles

**Success Criteria:**
```
✅ Debug overlay shows when enabled
✅ Debug overlay hides on click
✅ Shows all relevant state info:
   - Video ID
   - Current state (playing/paused/stopped)
   - Time position
   - Playback rate
   - Errors (if any)
```

---

### 6. **Error Handling & Fallback**

#### 6.1 Unavailable Native Video
- [ ] Disable native video support (simulate)
- [ ] Attempt to load comparison view
- [ ] **Expected:** Graceful fallback to HTML5

**Success Criteria:**
```
✅ Shows "Native video unavailable" message
✅ Falls back to HTML5 automatically
✅ No crash or frozen UI
✅ All functionality works with HTML5
```

#### 6.2 File Not Found Error
- [ ] Try to load non-existent video file
- [ ] **Expected:** Error message, graceful handling

**Success Criteria:**
```
✅ Shows error message
✅ Doesn't crash application
✅ Can retry with different file
✅ Other videos continue to work
```

#### 6.3 Codec Not Supported
- [ ] Try to play unsupported codec (e.g., VP9)
- [ ] **Expected:** Error logged, fallback attempted

**Success Criteria:**
```
✅ Error is logged
✅ Fallback to HTML5 (if available)
✅ User is informed
✅ App remains stable
```

---

### 7. **Debug Overlay & Monitoring**

#### 7.1 Debug Overlay Information
- [ ] Enable debug overlay
- [ ] Verify all fields displayed:
  - [ ] VOD ID
  - [ ] Available status
  - [ ] Initialized status
  - [ ] Current state (playing/paused/stopped)
  - [ ] Time position (current / total)
  - [ ] Playback rate
  - [ ] Loading indicator (if applicable)
  - [ ] Error (if applicable)
- [ ] **Expected:** All fields accurate and updating

**Debug Info Should Show:**
```
🎬 NativeVideoContainer #0
vodId: vod_001
Available: ✓
Initialized: ✓
State: ▶ playing
Time: 1:23 / 5:00
Speed: 1.00x
⏳ Loading... (if loading)
Error: INIT_FAILED (if error)
```

#### 7.2 Performance Monitoring Overlay
- [ ] Enable `enablePerformanceMonitoring={true}`
- [ ] Verify performance metrics displayed:
  - [ ] FPS (instantaneous)
  - [ ] FPS (average over 10 frames)
  - [ ] Sync drift in milliseconds
  - [ ] Duration
  - [ ] VOD index
- [ ] **Expected:** Real-time metrics updating

**Performance Overlay Should Show:**
```
📊 Performance
FPS: 60 (60avg)
Drift: +2ms
Duration: 5:00
VOD #0
```

#### 7.3 Overlay Toggle
- [ ] Debug overlay visible by default (if enabled)
- [ ] Click overlay to hide
- [ ] "🔍 Debug" button appears
- [ ] Click button to show overlay again
- [ ] **Expected:** Toggles smoothly

**Success Criteria:**
```
✅ Overlay toggles on click
✅ Button appears when overlay hidden
✅ Overlay reappears on button click
✅ No visual artifacts
✅ Performance not impacted by overlay
```

---

### 8. **Cross-Platform Testing**

#### 8.1 Windows Testing
- [ ] Test on Windows 10 / Windows 11
- [ ] Verify native video renders
- [ ] Check performance metrics
- [ ] Test all playback controls
- [ ] **Expected:** Smooth playback at 60fps

**Windows Checklist:**
```
✅ Native window renders (DirectX)
✅ Audio plays correctly
✅ No artifacts or black bars
✅ CPU < 15% for single video
✅ Memory stable
✅ Seek responsive
✅ Sync accurate
```

#### 8.2 macOS Testing
- [ ] Test on Intel Mac and/or Apple Silicon Mac
- [ ] Verify native video renders (Metal)
- [ ] Check performance metrics
- [ ] Test all playback controls
- [ ] **Expected:** Smooth playback at 60fps

**macOS Checklist:**
```
✅ Native window renders (Metal)
✅ Audio plays correctly
✅ Intel + Apple Silicon both work
✅ CPU < 15% for single video
✅ Memory stable
✅ Seek responsive
✅ Sync accurate
```

#### 8.3 Linux Testing
- [ ] Test on Ubuntu 20.04+ (X11 or Wayland)
- [ ] Verify native video renders (OpenGL/Vulkan)
- [ ] Check performance metrics
- [ ] Test all playback controls
- [ ] **Expected:** Smooth playback at 60fps

**Linux Checklist:**
```
✅ Native window renders (X11/Wayland)
✅ Audio plays correctly
✅ No artifacts or black bars
✅ CPU < 15% for single video
✅ Memory stable
✅ Seek responsive
✅ Sync accurate
```

---

## Success Criteria - Phase 2 EOD Friday

### Primary Success Metrics

```
✅ First video plays natively (not HTML5)
   - Visible "● Native" indicator
   - Renders in native window container
   - HTML5 used for videos 2 & 3

✅ Plays smoothly at 30-60fps
   - FPS shown in debug overlay
   - No stuttering or frame drops
   - Consistent 59-61 fps for 60fps video

✅ All controls responsive
   - Play/Pause: < 100ms latency
   - Seek: < 100ms latency
   - Rate change: instant
   - No UI lag or unresponsiveness

✅ Feature flag toggles between native/HTML5
   - Enable flag: Use native for first video
   - Disable flag: Use HTML5 for all videos
   - No app restart required

✅ No console errors
   - No CRITICAL level logs
   - No uncaught exceptions
   - No memory warnings

✅ Performance telemetry visible (debug mode)
   - FPS counter
   - Sync drift display
   - Memory usage (if available)
   - Frame position tracking

✅ E2E tests passing
   - All 7 test suites pass
   - >80% code coverage
   - No flaky tests

✅ Ready to add 2nd video
   - Architecture supports multiple native videos
   - No hardcoded assumptions about video count
   - Sync algorithm handles N videos
```

### Secondary Metrics (Nice to Have)

```
⭐ Performance beyond targets
   - CPU < 10% (vs target 15%)
   - Memory < 70MB per video (vs target 80MB)
   - Frame drops < 0.01% (vs target 0.1%)

⭐ Smooth scrolling & UI responsiveness
   - Timeline scrolls smoothly
   - Offset adjustments responsive
   - Layout switches responsive

⭐ Beautiful debug overlays
   - Color-coded status (green = good)
   - Clear formatting
   - Non-intrusive positioning
```

---

## Testing Timeline

### Session 1: Playback & Seeking (1-2 hours)
- [ ] Load and display (15 min)
- [ ] Play/pause (15 min)
- [ ] Seek operations (30 min)
- [ ] Time display accuracy (15 min)

### Session 2: Sync & Performance (2-3 hours)
- [ ] Multi-video sync (30 min)
- [ ] Offset handling (30 min)
- [ ] Playback rate sync (20 min)
- [ ] CPU/memory profiling (45 min)
- [ ] Frame drop measurement (15 min)

### Session 3: Feature Flags & Errors (1-2 hours)
- [ ] Feature flag toggle (15 min)
- [ ] Sample rate testing (15 min)
- [ ] Debug mode toggle (15 min)
- [ ] Error handling (30 min)
- [ ] Fallback testing (15 min)

### Session 4: Cross-Platform (2-3 hours per platform)
- [ ] Windows testing (2-3 hours)
- [ ] macOS testing (2-3 hours)
- [ ] Linux testing (2-3 hours)

### Session 5: Final Verification (1 hour)
- [ ] Run full E2E test suite
- [ ] Verify all success criteria
- [ ] Document any known issues
- [ ] Sign-off

---

## Issue Reporting Template

When you find an issue during testing:

```
**Title:** [Brief description of issue]

**Severity:** Critical / High / Medium / Low

**Environment:**
- OS: Windows 10 / macOS / Linux
- VOD Format: [codec, resolution, fps]
- Test Case: [Which test scenario]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happened]

**Screenshots/Logs:**
[Attach debug output or screenshot]

**Estimated Impact:**
- Blocks Phase 2 completion: Yes / No
- Affects production rollout: Yes / No
```

---

## Sign-Off

**Tester Name:** ________________  
**Date:** ________________  
**Platform:** ________________  
**Result:** ✅ PASS / ❌ FAIL  

**Comments:**
```
[Any additional notes or observations]
```

**Phase 2 Sign-Off (All Scenarios Passed):**
```
✅ All test scenarios completed
✅ All success criteria met
✅ All critical issues resolved
✅ Ready for Phase 3 (Multi-Sync)

Signed: ________________  
Date: ________________
```

---

## Next Steps (Phase 3)

After Phase 2 completion, proceed to:
- Phase 3: Multi-Video Synchronization (Days 11-15)
- Add support for second native video
- Implement frame-accurate sync algorithm
- Test 3-video synchronization
- Target: ±1 frame sync tolerance

---

**Document Version:** 1.0  
**Last Updated:** 2026-03-02  
**Status:** Phase 2 Testing Guide
