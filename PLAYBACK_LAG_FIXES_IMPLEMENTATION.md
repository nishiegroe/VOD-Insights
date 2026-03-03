# Video Playback Lag - Quick Implementation Guide

**Status:** Ready to implement  
**Priority:** CRITICAL  
**Estimated Time:** 50-60 minutes total  
**Expected FPS Improvement:** 25-35fps → 55-60fps

---

## Quick Start - The Essential Fix (15 minutes)

This ONE change gives you +15-20fps immediately:

### Step 1: Remove usePlaybackSync Hook

**File:** `frontend/src/pages/MultiVodComparison/MultiVodComparison.jsx`

Find these lines (around line 11-12):
```javascript
// DELETE THESE TWO LINES:
import { usePlaybackSync } from "./hooks/usePlaybackSync";
// ... and later in the component:
usePlaybackSync(multiVodState, globalTime);
```

**Save and test.** Playback should immediately feel smoother.

---

## Phase 1: Eliminate Double-Sync (15 minutes)

### Change 1.1: Remove usePlaybackSync import

**File:** `frontend/src/pages/MultiVodComparison/MultiVodComparison.jsx`

```diff
  import React, { useEffect, useState, useRef } from "react";
  import { useSearchParams } from "react-router-dom";
  import { useMultiVodState } from "./hooks/useMultiVodState";
  import { useGlobalSync } from "./hooks/useGlobalSync";
- import { usePlaybackSync } from "./hooks/usePlaybackSync";
  import MultiVodViewer from "./components/MultiVodViewer";
```

### Change 1.2: Remove usePlaybackSync call

**File:** `frontend/src/pages/MultiVodComparison/MultiVodComparison.jsx`

Find around line 22-23 and remove:
```diff
  // Playback sync (keep videos in sync during playback)
- usePlaybackSync(multiVodState, globalTime);
```

### Change 1.3: Update VodPanel drift threshold

**File:** `frontend/src/pages/MultiVodComparison/components/VodPanel.jsx`

Find the useEffect around line 36, change drift threshold:
```diff
- if (Math.abs(currentTime - clampedTime) > 0.025) {
+ if (Math.abs(currentTime - clampedTime) > 0.1) {
    videoRef.current.currentTime = clampedTime;
  }
```

### Change 1.4: Delete the hook file

```bash
rm frontend/src/pages/MultiVodComparison/hooks/usePlaybackSync.js
```

### ✅ Test After Phase 1

```bash
# Terminal 1: Start Flask backend
cd vod-insights
python app/main.py

# Terminal 2: Start React frontend
cd vod-insights/frontend
npm run dev
```

**Expected:** Open multi-VOD comparison, playback should be noticeably smoother (40-55fps range)

---

## Phase 2: Optimize Rendering (25 minutes)

### Change 2.1: Switch to requestAnimationFrame

**File:** `frontend/src/pages/MultiVodComparison/hooks/useGlobalSync.js`

Find the useEffect around line 40, replace entire block:

**BEFORE:**
```javascript
  useEffect(() => {
    if (!state || state.global_playback_state !== "playing") return;

    const interval = setInterval(() => {
      setGlobalTime(calculateGlobalTime());
    }, 50);

    return () => clearInterval(interval);
  }, [state, calculateGlobalTime]);
```

**AFTER:**
```javascript
  useEffect(() => {
    if (!state || state.global_playback_state !== "playing") return;

    let rafId;
    const updateTime = () => {
      setGlobalTime(calculateGlobalTime());
      rafId = requestAnimationFrame(updateTime);
    };

    rafId = requestAnimationFrame(updateTime);

    return () => cancelAnimationFrame(rafId);
  }, [state, calculateGlobalTime]);
```

### Change 2.2: Memoize event markers in GlobalScrubber

**File:** `frontend/src/pages/MultiVodComparison/components/GlobalScrubber.jsx`

**Step 1:** Add useMemo to imports at the top

```diff
- import React, { useState, useRef, useEffect } from "react";
+ import React, { useState, useRef, useEffect, useMemo } from "react";
```

**Step 2:** Find the allEventMarkers calculation (around line 28)

**BEFORE:**
```javascript
  // Collect all event markers from all VODs with color-coding
  const allEventMarkers = state.vods.flatMap((vod, vodIndex) =>
    (vod.events || []).map((event) => ({
      ...event,
      vodIndex,
      vodColor: `hsl(${vodIndex * 120}, 70%, 60%)`,
      percentage: (event.timestamp / globalDuration) * 100,
    }))
  );
```

**AFTER:**
```javascript
  // Collect all event markers from all VODs with color-coding
  const allEventMarkers = useMemo(() => {
    return state.vods.flatMap((vod, vodIndex) =>
      (vod.events || []).map((event) => ({
        ...event,
        vodIndex,
        vodColor: `hsl(${vodIndex * 120}, 70%, 60%)`,
        percentage: (event.timestamp / globalDuration) * 100,
      }))
    );
  }, [state.vods, globalDuration]);
```

**Step 3:** Wrap component export with React.memo

**BEFORE:**
```javascript
export default function GlobalScrubber({ ... }) {
```

**AFTER:**
```javascript
const GlobalScrubberComponent = function GlobalScrubber({ ... }) {
  // ... component code ...
};

export default React.memo(GlobalScrubberComponent);
```

Or simpler, at the bottom of file:
```javascript
export default React.memo(GlobalScrubber);
```

### ✅ Test After Phase 2

Expected: Playback should be very smooth (55-60fps), seeking should be responsive.

---

## Phase 3: Faster VOD Loading (20 minutes)

### Change 3.1: Replace cv2 with ffprobe

**File:** `app/multi_vod_api.py`

**Step 1:** Find the `_get_vod_metadata` function (around line 140)

**REPLACE THE ENTIRE FUNCTION** with:

```python
def _get_vod_metadata(vod_path: str) -> Optional[Dict[str, Any]]:
    """
    Extract metadata using ffprobe instead of cv2.
    10x faster: 50-100ms vs 400-1000ms per file.
    """
    vod_path = Path(vod_path)
    if not vod_path.exists():
        return None
    
    try:
        # Use ffprobe to read headers (no decoding required)
        cmd = [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-show_entries", "stream=width,height,r_frame_rate,codec_name",
            "-of", "json",
            str(vod_path),
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        if result.returncode != 0:
            print(f"ffprobe failed for {vod_path}: {result.stderr}")
            return None
        
        data = json.loads(result.stdout)
        
        # Extract values from ffprobe output
        format_data = data.get("format", {})
        duration = float(format_data.get("duration", 0))
        
        streams = data.get("streams", [])
        stream = next((s for s in streams if s.get("codec_type") == "video"), {})
        
        width = stream.get("width", 0)
        height = stream.get("height", 0)
        
        # Parse frame rate (e.g., "30000/1001" → 29.97)
        r_frame_rate = stream.get("r_frame_rate", "0/1")
        try:
            num, den = map(int, r_frame_rate.split("/"))
            fps = num / den if den > 0 else 0
        except (ValueError, ZeroDivisionError):
            fps = 0
        
        codec = stream.get("codec_name", "unknown")
        
        # File size
        try:
            filesize_mb = vod_path.stat().st_size / (1024 * 1024)
        except OSError:
            filesize_mb = 0
        
        return {
            "duration": duration,
            "fps": fps,
            "resolution": f"{width}x{height}",
            "codec": codec,
            "filesize_mb": filesize_mb,
        }
    except Exception as e:
        print(f"Error getting VOD metadata with ffprobe: {e}")
        return None
```

**Step 2:** Update imports at top of file

Make sure these are imported (check around line 1-20):
```python
import subprocess
import json
```

**Step 3:** REMOVE the old cv2 implementation

Find and delete:
```python
# DELETE THIS SECTION:
def _get_vod_metadata_old(vod_path: str) -> Optional[Dict[str, Any]]:
    import cv2
    # ... entire old function ...
```

### Change 3.2: Verify ffprobe is available

```bash
# Check if ffprobe is installed
which ffprobe

# If not installed, install ffmpeg (includes ffprobe)
# Ubuntu/Debian:
sudo apt-get install ffmpeg

# macOS:
brew install ffmpeg

# Windows:
# Download from https://ffmpeg.org/download.html or use package manager
```

### ✅ Test After Phase 3

Expected: Creating a new multi-VOD comparison should be fast (< 500ms to load VOD list)

---

## Complete Testing Checklist

### Before Fixes
- [ ] Open multi-VOD comparison page
- [ ] Open DevTools → Performance tab
- [ ] Record 30-second session
- [ ] Note current FPS (should be ~30fps)
- [ ] Check "Main" thread CPU usage

### After Phase 1
- [ ] FPS should jump to 40-55fps
- [ ] Playback feel noticeably smoother
- [ ] Seeking works without major stutter
- [ ] CPU usage lower than before

### After Phase 2
- [ ] FPS should reach 55-60fps
- [ ] Main thread < 50% during playback
- [ ] Scrubber updates smooth
- [ ] Event timeline renders without lag

### After Phase 3
- [ ] VOD list loads in < 500ms (not 2-5 seconds)
- [ ] Modal opens responsively
- [ ] No hang when creating comparison

---

## Rollback Plan (If Something Breaks)

### Rollback Phase 1
```bash
# Restore usePlaybackSync
git checkout frontend/src/pages/MultiVodComparison/hooks/usePlaybackSync.js
git checkout frontend/src/pages/MultiVodComparison/MultiVodComparison.jsx
git checkout frontend/src/pages/MultiVodComparison/components/VodPanel.jsx
```

### Rollback Phase 2
```bash
git checkout frontend/src/pages/MultiVodComparison/hooks/useGlobalSync.js
git checkout frontend/src/pages/MultiVodComparison/components/GlobalScrubber.jsx
```

### Rollback Phase 3
```bash
git checkout app/multi_vod_api.py
```

---

## Troubleshooting

### "ffprobe not found" error
```bash
# Install ffmpeg
pip install ffmpeg-python
# or system-level
sudo apt-get install ffmpeg
```

### Videos still playing at 30fps after Phase 1
- Make sure you saved all files
- Clear browser cache (Ctrl+Shift+Delete)
- Restart React dev server

### "React is not defined" error in GlobalScrubber
- Make sure you have `import React` at top of file
- Check that React.memo syntax is correct

### usePlaybackSync still imported error
- Search for "usePlaybackSync" in entire project
- Remove ALL imports and usages
- Restart dev server

---

## Code Diff Summary

**Total changes across all phases:**
- Lines added: ~50
- Lines deleted: ~80
- Files modified: 5
- Files deleted: 1

**Frontend:**
- 3 files modified (useGlobalSync, GlobalScrubber, MultiVodComparison)
- 1 file deleted (usePlaybackSync)
- ~30 lines net change

**Backend:**
- 1 file modified (multi_vod_api.py)
- ~80 lines net change
- ~20 lines deleted (old cv2 code)

---

## Performance Monitoring Commands

### Monitor React renders
Open DevTools → Performance → Start recording → Play for 10 seconds → Stop recording
Look for "Main" thread activity spikes. Should be smooth, not jagged.

### Monitor video.currentTime writes
```javascript
// Paste in browser console during playback:
let updates = 0;
const video = document.querySelector('video');
const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
  set(value) {
    updates++;
    console.log(`Update ${updates}: currentTime set to ${value.toFixed(3)}`);
    descriptor.set.call(this, value);
  },
  get() {
    return descriptor.get.call(this);
  }
});
// Now play and watch console - should see ~16 updates/sec max
```

### Monitor frame rate
```javascript
// Paste in browser console during playback:
let frameCount = 0;
let lastTime = Date.now();
function countFrames() {
  frameCount++;
  const now = Date.now();
  if (now - lastTime >= 1000) {
    console.log(`FPS: ${frameCount}`);
    frameCount = 0;
    lastTime = now;
  }
  requestAnimationFrame(countFrames);
}
countFrames();
```

---

## Questions?

If you run into issues:

1. Check error messages carefully
2. Verify you've saved all files
3. Clear browser cache and restart dev server
4. Rollback one phase at a time to isolate the issue
5. Check git diff to see what changed

The fixes are low-risk and well-isolated. Start with Phase 1 (15 min) and test before moving to Phase 2.

---

**Ready to implement? Start with Phase 1 and report back! 💪**
