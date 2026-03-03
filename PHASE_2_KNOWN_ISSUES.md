# Phase 2: Known Issues & Workarounds
## Electron Native Video - Single Video Playback (Part 2 - Frontend)

**Duration:** Phase 2 of 28-day roadmap  
**Status:** Phase 2 Complete  
**Last Updated:** 2026-03-02  
**Severity Guide:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## Overview

This document tracks known issues encountered during Phase 2 implementation and provides workarounds.

### Issue Stats
- **Total Issues:** 12
- **Critical:** 0
- **High:** 2
- **Medium:** 4
- **Low:** 6

---

## Issue Index

1. [Native Video Unavailable Context](#1-native-video-unavailable-context)
2. [Feature Flag Not Persisting](#2-feature-flag-not-persisting)
3. [Sync Drift > 100ms on High-Load Systems](#3-sync-drift--100ms-on-high-load-systems)
4. [Memory Leak in Long Playback Sessions](#4-memory-leak-in-long-playback-sessions)
5. [Debug Overlay Performance Impact](#5-debug-overlay-performance-impact)
6. [Seek Accuracy ±2-3 Frames](#6-seek-accuracy-23-frames)
7. [Playback Rate Change Stutter](#7-playback-rate-change-stutter)
8. [Audio Desync After Seek](#8-audio-desync-after-seek)
9. [File Path Encoding Issues](#9-file-path-encoding-issues)
10. [Cross-Platform Window Rendering Inconsistency](#10-cross-platform-window-rendering-inconsistency)
11. [Performance Metrics Inaccuracy](#11-performance-metrics-inaccuracy)
12. [localStorage Unavailable in Some Contexts](#12-localstorage-unavailable-in-some-contexts)

---

## Detailed Issues

### 1. Native Video Unavailable Context

**Severity:** 🟠 **HIGH**

**Description:**
NativeVideoContainer shows "Native video unavailable" message when running in certain Electron contexts (preload, worker thread, etc.). The `isAvailable()` check fails because native module is not accessible in that context.

**Root Cause:**
- useNativeVideo hook calls `getVideoClient().isAvailable()` which checks if `window.ipcRenderer` exists
- IPC renderer not available in all execution contexts
- Feature flag enabled but no IPC context

**Symptoms:**
```
User sees: "⚠️ Native video unavailable - Electron context required"
Debug log: "Native video not available, check Electron context"
Fallback: HTML5 video used instead
```

**Current Behavior:**
- Component gracefully falls back to showing error message
- Application continues to work
- Feature flag effectiveness reduced

**Workaround:**

**Short-term (Immediate Use):**
```javascript
// In main.ts or preload.ts, ensure IPC context is available
// Make sure ipcRenderer is properly exposed in preload

// preload.ts
const { ipcRenderer } = require('electron');
window.ipcRenderer = ipcRenderer; // Expose to renderer

// Or use contextBridge (recommended):
contextBridge.exposeInMainWorld('electronAPI', {
  videoClient: {
    invoke: (command, args) => ipcRenderer.invoke(command, args),
    on: (event, handler) => ipcRenderer.on(event, handler),
    // ... other methods
  }
});
```

**Long-term (Phase 3+):**
- Ensure preload.ts properly exposes IPC methods
- Add context validation in useNativeVideo initialization
- Provide better error messages with debugging steps
- Consider exposing via contextBridge instead of direct ipcRenderer

**Status:** ⚠️ **OPEN** - Requires main process configuration check  
**Assigned to:** Native Dev (Phase 2-3)  
**Target Fix:** Phase 2 wrap-up or early Phase 3  

---

### 2. Feature Flag Not Persisting

**Severity:** 🟡 **MEDIUM**

**Description:**
Feature flag set via `setNativeVideoEnabled(true)` doesn't persist across page reload when localStorage is unavailable or user has private browsing enabled.

**Root Cause:**
- VideoFeatureFlagManager tries to use `window.localStorage`
- localStorage throws error in private/incognito mode
- Error is silently caught, flag reverts to default

**Symptoms:**
```
1. setNativeVideoEnabled(true, true)  // Try to persist
2. Reload page
3. isNativeVideoEnabled() returns false  // Flag reverted
4. Native video disabled unexpectedly
```

**Current Behavior:**
- Flag works in current session only
- Doesn't persist across page reloads
- Console warning: "Error persisting feature flag to localStorage"

**Workaround:**

**Short-term (Current):**
```javascript
// Set flag with persist=false for private browsing:
setNativeVideoEnabled(true, false);

// Or enable via environment variable instead:
// .env.development
VITE_NATIVE_VIDEO_ENABLED=true

// Or set directly without persistence:
getVideoFeatureFlagManager().setFlag('enableNativeVideo', true, false);
```

**Long-term (Phase 3+):**
- Use server-side feature flag service (instead of localStorage)
- Implement IndexedDB fallback when localStorage unavailable
- Use sessionStorage as fallback
- Add feature flag service endpoint:
  ```typescript
  // Pseudo-code
  const flags = await fetch('/api/feature-flags').then(r => r.json());
  flagManager.loadFromServer(flags);
  ```

**Status:** ⚠️ **OPEN** - Low priority, affects edge case (private browsing)  
**Assigned to:** Frontend Dev (Phase 3+)  
**Target Fix:** Phase 3 or later  

---

### 3. Sync Drift > 100ms on High-Load Systems

**Severity:** 🟠 **HIGH**

**Description:**
On systems with high CPU load (>70%), sync drift between native and HTML5 videos can exceed 100ms, causing noticeable desync.

**Root Cause:**
- Sync tolerance set to 100ms (reasonable on normal systems)
- High system load causes playback interruptions
- Native module has priority but HTML5 can lag
- 16ms frame time (60fps) means 100ms = ~6 frame drift

**Symptoms:**
```
Debug overlay shows:
  Drift: +150ms (exceeds tolerance)
  FPS: 45-50 (drops below target)
  Voices/visuals: Noticeably out of sync
```

**Current Behavior:**
- Large drift detected
- Sync adjustment happens (pause/resume)
- Creates visible stutter
- Not ideal user experience

**Workaround:**

**Short-term (Current Session):**
```javascript
// Reduce sync tolerance from 100ms to 50ms
// In NativeVideoContainer.tsx, change:
const SYNC_TOLERANCE_MS = 100;
// To:
const SYNC_TOLERANCE_MS = 50;  // Tighter sync
```

**But:** This may cause more frequent sync corrections → more stutter

**Medium-term (Phase 2-3):**
```javascript
// Adaptive sync tolerance based on system load:
const getAdaptiveSyncTolerance = () => {
  const systemLoad = getSystemLoad();  // 0-100%
  
  if (systemLoad > 70) {
    return 150; // Allow more drift on high-load systems
  } else if (systemLoad > 50) {
    return 100; // Normal tolerance
  } else {
    return 50;  // Tight sync on idle systems
  }
};
```

**Long-term Solution (Phase 3):**
- Implement quality downsampling when CPU > 60%
- Auto-switch to lower resolution (1080p → 720p)
- Implement dynamic FPS adjustment
- Use system resource monitoring API

**Status:** 🔄 **WORKAROUND IMPLEMENTED** - Issue remains on high-load systems  
**Assigned to:** Native Dev + Frontend Dev (Phase 3)  
**Target Fix:** Phase 3 (Multi-Sync optimization)  

---

### 4. Memory Leak in Long Playback Sessions

**Severity:** 🟡 **MEDIUM**

**Description:**
Running playback for > 30 minutes shows slow memory growth (~5-10MB per 10 minutes). Eventually system memory exhausted on extended sessions.

**Root Cause:**
- Suspected: Buffer accumulation in native module
- Or: Event listeners not properly cleaned up
- Or: Frame history arrays growing unbounded (syncDriftHistoryRef, fpsHistoryRef)

**Symptoms:**
```
Memory over time:
  Start: 200 MB
  10 min: 210 MB (+10 MB)
  20 min: 220 MB (+10 MB)
  30 min: 230 MB (+10 MB)
  ...continues to grow
  
After 3+ hours: System swap exhausted, app crashes
```

**Current Behavior:**
- Memory slowly increases over long sessions
- Not critical for typical viewing (most sessions < 2 hours)
- Problematic for automated testing/QA

**Workaround:**

**Short-term (Immediate):**
```javascript
// Force cleanup periodically
setInterval(() => {
  if (window.gc) {
    window.gc();  // Force garbage collection (Node.js only)
  }
}, 5 * 60 * 1000);  // Every 5 minutes

// Or: Bound history arrays in NativeVideoContainer
if (syncDriftHistoryRef.current.length > 60) {
  syncDriftHistoryRef.current.shift();  // Remove oldest
}
// (Already implemented, but verify)
```

**Medium-term (Phase 2-3):**
```javascript
// Add memory monitoring hook
const useMemoryMonitoring = () => {
  useEffect(() => {
    const monitor = setInterval(() => {
      const mem = performance.memory?.usedJSHeapSize;
      if (mem && mem > 300 * 1024 * 1024) {  // 300MB threshold
        console.warn('High memory usage detected:', mem);
        // Trigger cleanup or warning
      }
    }, 10000);
    return () => clearInterval(monitor);
  }, []);
};

// In NativeVideoContainer:
useMemoryMonitoring();
```

**Long-term Solution (Phase 3):**
- Profile with Chromium DevTools
- Identify leak source
- Implement buffer pooling
- Add resource cleanup on component unmount

**Status:** ⚠️ **OPEN** - Workaround in place, root cause TBD  
**Assigned to:** Native Dev (Phase 3 investigation)  
**Target Fix:** Phase 3 profiling/optimization  

---

### 5. Debug Overlay Performance Impact

**Severity:** 🟢 **LOW**

**Description:**
When both `enablePerformanceMonitoring={true}` and `enableDebugOverlay={true}`, frame rate drops by 5-10% due to overlay rendering overhead.

**Root Cause:**
- Debug overlay re-renders every frame
- Performance metrics calculation happens every frame
- Extra DOM updates for display
- Monitoring interval (33ms) competes with playback

**Symptoms:**
```
With debug overlay enabled:
  FPS: 55-58 (vs target 60)
  Frame time: 17-18ms (vs target 16.67ms)
  Visible: Slight stutter

Without debug overlay:
  FPS: 59-61 (normal)
  Frame time: 16.67ms (on target)
```

**Current Behavior:**
- Debug overlay is useful but has cost
- Trade-off: Visibility vs Performance
- Acceptable for development, not for production

**Workaround:**

**Short-term (Current):**
```javascript
// Use debug overlay only when needed
<NativeVideoContainer
  enableDebugOverlay={false}  // Keep this off during performance testing
  enablePerformanceMonitoring={true}  // OK to keep on
/>

// Or: Reduce update frequency
const MONITORING_UPDATE_INTERVAL = 100;  // Instead of 33ms
```

**Long-term (Phase 3+):**
```javascript
// Implement efficient overlay rendering
const [showDetailedMetrics, setShowDetailedMetrics] = useState(false);

// Basic metrics always calculated (cheap)
// Detailed metrics only calculated when overlay shown (expensive)

return (
  <>
    {showDetailedMetrics && <DetailedMetricsOverlay />}
    {!showDetailedMetrics && <SimpleMetricsIndicator />}
  </>
);
```

**Status:** ✅ **ACCEPTABLE** - Documented trade-off, not a bug  
**Assigned to:** N/A - Expected behavior  
**Target Fix:** Phase 4 (UI optimization)  

---

### 6. Seek Accuracy ±2-3 Frames

**Severity:** 🟡 **MEDIUM**

**Description:**
Seeking to a specific frame sometimes lands ±2-3 frames off the target position instead of the target ±1 frame accuracy.

**Root Cause:**
- Binary search in seek logic may need more iterations
- Frame-stepping accuracy limited by native module precision
- Timing resolution issues

**Symptoms:**
```
Test: Seek to exact frame 1000
Expected: Frame 1000 ± 1 (999-1001)
Actual: Frame 998-1003 (±3 frame drift)
```

**Current Behavior:**
- Seek completes in correct time range
- Visual impact minimal (3 frames at 60fps = 50ms)
- Not user-visible at normal playback speed

**Workaround:**

**Short-term (Current Session):**
```javascript
// Accept ±3 frame tolerance for now
const SEEK_TOLERANCE_FRAMES = 3;

// Most users won't notice 50ms difference
// Only matters for frame-by-frame analysis
```

**Long-term (Phase 3):**
```cpp
// Improve seek binary search in native module
// Increase iteration limit or binary search precision
// Use hardware frame-stepping if available

// Current: ~5 iterations
// Target: ~10 iterations for sub-frame precision

int iterations = 0;
const int MAX_ITERATIONS = 20;
while (drift > 1 && iterations < MAX_ITERATIONS) {
  // Binary search...
  iterations++;
}
```

**Status:** ⚠️ **OPEN** - Acceptable for Phase 2, needs improvement  
**Assigned to:** Native Dev (Phase 3)  
**Target Fix:** Phase 3 seek optimization  

---

### 7. Playback Rate Change Stutter

**Severity:** 🟡 **MEDIUM**

**Description:**
Changing playback rate (e.g., 1.0x → 1.5x) causes brief audio/video stutter (~200ms).

**Root Cause:**
- Native module applies rate change to all video instances simultaneously
- Creates brief discontinuity in timing
- Audio sync interrupted during transition

**Symptoms:**
```
1. Playing at 1.0x
2. User clicks "1.5x" button
3. Video/audio stutter for ~200ms
4. Resumes at 1.5x normally
```

**Current Behavior:**
- Rate change succeeds
- Brief stutter during transition
- Continues normally after

**Workaround:**

**Short-term (Current):**
```javascript
// Pause before rate change, then resume
const handleRateChange = async (newRate) => {
  await controls.pause();
  await sleep(50);  // Let audio buffer clear
  await controls.setPlaybackRate(newRate);
  await sleep(50);
  await controls.play();
};
```

**Better: Fade out/in audio:**
```javascript
// Reduce volume briefly during rate change
const originalVolume = currentVolume;
await setVolume(0);
await setPlaybackRate(newRate);
await setVolume(originalVolume);
```

**Long-term (Phase 3+):**
- Native module should apply rate change smoothly
- Implement audio cross-fade
- Use time-warping instead of pause/resume

**Status:** ⚠️ **OPEN** - Minor issue, affects user experience  
**Assigned to:** Native Dev (Phase 3+)  
**Target Fix:** Phase 3 playback control improvements  

---

### 8. Audio Desync After Seek

**Severity:** 🟡 **MEDIUM**

**Description:**
After seeking forward > 30 seconds, audio sometimes lags behind video by 1-2 frames for a few seconds, then re-syncs.

**Root Cause:**
- Audio buffer has different seek behavior than video
- VLC audio pipeline may need different seek precision
- Buffer refill timing

**Symptoms:**
```
1. Playing normally
2. Seek to +1:00
3. Audio lags video for ~1-2 seconds
4. Audio catches up and syncs normally
```

**Current Behavior:**
- Most common on long seeks
- Self-corrects after buffer refill
- Noticeable but not critical

**Workaround:**

**Short-term (Current):**
```javascript
// Pause briefly after long seek to let audio buffer
const handleSeek = async (position) => {
  const LONG_SEEK_THRESHOLD = 30000;  // 30 seconds
  
  if (Math.abs(position - currentTime) > LONG_SEEK_THRESHOLD) {
    await controls.pause();
    await controls.seek(position);
    await sleep(200);  // Let audio buffer
    await controls.play();
  } else {
    await controls.seek(position);
  }
};
```

**Long-term (Phase 3+):**
- Implement separate audio/video seek with synchronization
- Add audio buffer pre-fill on seek
- Use VLC's audio queue management

**Status:** ⚠️ **OPEN** - Edge case, affects long seeks  
**Assigned to:** Native Dev (Phase 3+)  
**Target Fix:** Phase 3 audio sync improvement  

---

### 9. File Path Encoding Issues

**Severity:** 🟡 **MEDIUM**

**Description:**
File paths with special characters (spaces, unicode, accents) sometimes fail to load in native player, while HTML5 handles them fine.

**Root Cause:**
- File path encoding/decoding mismatch between React and native module
- URL encoding not properly reversed in C++
- Unicode handling differs between platforms

**Symptoms:**
```
File: "/Videos/My Gameplay (2026).mp4"
HTML5: Works fine
Native: Error loading - file not found

File: "/Videos/日本語.mp4"  (Japanese)
HTML5: Works fine
Native: Character encoding error
```

**Current Behavior:**
- Simple paths work fine
- Paths with spaces: Often fail
- Paths with unicode: Platform-dependent

**Workaround:**

**Short-term (Immediate):**
```javascript
// Rename files to avoid special characters
// Instead of: "My Gameplay (2026).mp4"
// Use: "My_Gameplay_2026.mp4"

// Or: Use URL encoding
const encodedPath = encodeURIComponent(filePath);
// Pass to native module, decode on C++ side
```

**Better: Fix encoding in native module:**
```cpp
// native/src/VideoPlayer.cpp
std::string DecodePath(const std::string& encodedPath) {
  // Use boost::url_decode or similar
  // Properly handle UTF-8
  return decoded;
}
```

**Status:** ⚠️ **OPEN** - Affects real-world file paths  
**Assigned to:** Native Dev (Phase 2-3)  
**Target Fix:** Phase 2 immediate fix or Phase 3  

---

### 10. Cross-Platform Window Rendering Inconsistency

**Severity:** 🟡 **MEDIUM**

**Description:**
Native window rendering differs across platforms: 
- Windows: Works well
- macOS: Sometimes renders upside-down
- Linux: Depends on X11 vs Wayland

**Root Cause:**
- Platform-specific coordinate systems
- Different graphics API conventions (DirectX vs Metal vs OpenGL)
- X11 vs Wayland differences

**Symptoms:**
```
Windows:
  ✓ Video renders correctly
  
macOS:
  ✗ Video appears upside-down (y-axis flipped)
  
Linux (X11):
  ✓ Video renders correctly
  
Linux (Wayland):
  ✗ Black screen, no video
```

**Current Behavior:**
- Windows: 100% working
- macOS: ~70% working (some configs OK)
- Linux: ~50% working (X11 OK, Wayland broken)

**Workaround:**

**Short-term (Current):**
```javascript
// macOS: Flip video rendering in CSS
if (process.platform === 'darwin') {
  nativeContainer.style.transform = 'scaleY(-1)';  // Flip vertically
}

// Linux: Try X11, fallback to HTML5 on Wayland
if (process.platform === 'linux') {
  const useWayland = process.env.WAYLAND_DISPLAY;
  if (useWayland) {
    // Force fallback to HTML5
    enableNativeVideo = false;
  }
}
```

**Long-term (Phase 3+):**
- Test and fix platform-specific rendering
- Implement proper coordinate transformation
- Add Wayland support via XDG-SHELL
- Use shader-based y-flip if needed

**Status:** ⚠️ **OPEN** - Platform coverage incomplete  
**Assigned to:** Native Dev (Phase 3 platform hardening)  
**Target Fix:** Phase 3 cross-platform fixes  

---

### 11. Performance Metrics Inaccuracy

**Severity:** 🟢 **LOW**

**Description:**
Performance metrics shown in overlay (FPS, Drift) can be inaccurate because they're calculated in JavaScript, not measured from native module telemetry.

**Root Cause:**
- FPS calculated from JavaScript update loop (not guaranteed precision)
- Sync drift calculated from React state updates (async lag)
- True metrics are in native module but not exposed

**Symptoms:**
```
Debug overlay shows:
  FPS: 60
  
But actual video playback:
  Frameskipping visible (real FPS ~45)
  
Mismatch: Overlay isn't measuring actual native playback
```

**Current Behavior:**
- Metrics are estimates only
- Close to actual values but not precise
- Useful for general debugging but not for precise benchmarking

**Workaround:**

**Short-term (Current):**
```javascript
// Use browser DevTools instead for true metrics
// Chrome DevTools > Performance tab
// Chromium DevTools will show actual frame timing

// Or: Use system-level profiling
// Windows: Task Manager (GPU tab)
// macOS: Activity Monitor (GPU section)
// Linux: nvidia-smi or similar
```

**Long-term (Phase 3+):**
```typescript
// Get metrics from native module instead
const nativeMetrics = await ipcRenderer.invoke('video:getMetrics');
// {
//   fps: 60,
//   frameDropCount: 2,
//   syncDrift: 2,  // From native clock
//   cpuPercent: 8.5,
//   memoryMb: 75
// }
```

**Status:** 🟢 **ACCEPTABLE** - Debug only, not production metric  
**Assigned to:** Phase 3+  
**Target Fix:** Phase 3 telemetry improvements  

---

### 12. localStorage Unavailable in Some Contexts

**Severity:** 🟢 **LOW**

**Description:**
Feature flags don't persist when localStorage is unavailable:
- Private/Incognito browsing
- Iframe sandboxed
- Some test environments

**Root Cause:**
- localStorage throws SecurityError in private mode
- Feature flag manager catches error silently
- Flag reverts to default on page reload

**Symptoms:**
```
Incognito window:
1. Enable native video: setNativeVideoEnabled(true)
2. Reload page
3. Native video disabled again (flag reverted)
4. User confused
```

**Current Behavior:**
- Error caught, flag not persisted
- Works in session only
- No user-facing error message

**Workaround:**

**Short-term:**
```javascript
// Use sessionStorage instead (usually available in private mode)
// Or: Use URL parameter
// Or: Disable flag persistence in private mode

if (!supportsLocalStorage()) {
  console.warn('localStorage unavailable, using session-only flags');
  // Flags work for current session only
}
```

**Long-term (Phase 3+):**
```javascript
// Implement fallback hierarchy
// 1. Try localStorage (persistent)
// 2. Fallback to sessionStorage (session-only)
// 3. Fallback to URL parameters
// 4. Fallback to server-side flags (API call)

class PersistentFlagManager {
  private useLocalStorage = false;
  private useSessionStorage = false;
  private useUrlParams = false;
  private useServerFlags = false;
  
  constructor() {
    // Detect available storage
  }
}
```

**Status:** ✅ **EXPECTED** - Expected behavior in private mode  
**Assigned to:** N/A - By design  
**Target Fix:** Phase 3+ (nice to have)  

---

## Summary Table

| Issue | Severity | Status | Phase | Owner |
|-------|----------|--------|-------|-------|
| Native Video Unavailable Context | 🟠 High | Open | 2-3 | Native Dev |
| Feature Flag Not Persisting | 🟡 Medium | Open | 3+ | Frontend Dev |
| Sync Drift > 100ms | 🟠 High | Workaround | 3 | Both |
| Memory Leak Long Sessions | 🟡 Medium | Open | 3 | Native Dev |
| Debug Overlay Performance | 🟢 Low | Acceptable | N/A | N/A |
| Seek Accuracy ±2-3 Frames | 🟡 Medium | Open | 3 | Native Dev |
| Playback Rate Stutter | 🟡 Medium | Open | 3+ | Native Dev |
| Audio Desync After Seek | 🟡 Medium | Open | 3+ | Native Dev |
| File Path Encoding | 🟡 Medium | Open | 2-3 | Native Dev |
| Cross-Platform Rendering | 🟡 Medium | Open | 3 | Native Dev |
| Performance Metrics Accuracy | 🟢 Low | Acceptable | 3+ | N/A |
| localStorage Unavailable | 🟢 Low | Expected | 3+ | N/A |

---

## Issue Resolution Process

### For Critical Issues (🔴)
1. Halt Phase 2 testing
2. Escalate to team lead
3. Create hotfix branch
4. Fix and verify
5. Merge and re-test

### For High Issues (🟠)
1. Document workaround
2. Continue Phase 2 testing with workaround
3. Add to Phase 3 backlog
4. Fix in Phase 3
5. Verify fix

### For Medium Issues (🟡)
1. Document workaround
2. Continue Phase 2 testing
3. Add to Phase 3 or Phase 4 backlog
4. Fix when time permits
5. Verify in phase after completion

### For Low Issues (🟢)
1. Document for future reference
2. Continue with normal flow
3. Add to backlog for Phase 4+
4. Fix only if resources available

---

## Testing with Known Issues

### Phase 2 Testing with Workarounds Active

**DO:**
- ✅ Test playback with first video as native
- ✅ Test feature flag toggle (enable/disable)
- ✅ Test playback controls (play/pause/seek)
- ✅ Test performance monitoring
- ✅ Test error fallback (disable feature flag manually if needed)

**DON'T:**
- ❌ Don't test on systems with >70% CPU load (expect sync drift)
- ❌ Don't test playback > 2 hours (memory will accumulate)
- ❌ Don't use files with special characters without URL encoding
- ❌ Don't test on Linux Wayland (use X11 instead)
- ❌ Don't rely on precise FPS measurements from overlay

---

## Escalation Path

**Report an issue to:**
1. **Phase 2 Lead:** Document in this file (your task)
2. **Team Lead:** Slack #video-engine-dev
3. **Product:** Slack #vod-insights if blocking
4. **External:** GitHub Issues for public bugs

**Include:**
- Severity level
- Reproducibility steps
- Screenshots/logs
- Workaround (if found)
- Estimated impact on Phase 2

---

## Success: Phase 2 Complete

Despite known issues, Phase 2 is considered **COMPLETE** when:

```
✅ First video plays natively
✅ Feature flag toggles native/HTML5
✅ All playback controls functional (with workarounds)
✅ No critical (red) blockers
✅ E2E tests pass (>80% with known issues documented)
✅ Documented workarounds for all high/medium issues
✅ Ready for Phase 3 multi-video sync
```

All issues documented here have workarounds and don't block Phase 2 completion.

---

## Appendix: Debug Commands

### Check Native Video Availability
```javascript
// In browser console
getVideoClient().isAvailable()  // true/false
```

### View Feature Flag Status
```javascript
// In browser console
logVideoFeatureFlags();
```

### Check System Performance
```javascript
// CPU and memory
performance.memory  // Chrome/Electron only
```

### Enable Debug Logging
```javascript
// localStorage
localStorage.setItem('DEBUG', '*');  // Log everything

// Environment
RUST_LOG=debug
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-03-02  
**Status:** Phase 2 Known Issues Reference
