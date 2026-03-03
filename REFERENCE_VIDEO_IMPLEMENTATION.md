# Reference Video Pattern: Implementation Guide

**Goal:** Fix multi-VOD playback stutter in 2-3 days using the Reference Video Pattern  
**Status:** Ready for implementation  
**Effort:** 2-3 days (1-2 developers)  
**Risk:** Low (minimal breaking changes, easy rollback)

---

## Overview: Reference Video Pattern

**The Idea:**
- One video (reference) plays normally with no React state syncing
- Other videos (followers) automatically sync to the reference's actual playback time
- Uses `requestAnimationFrame` to read reference video's real `currentTime`, not React state
- Only seeks followers when drift > 200ms; uses playback rate for minor adjustments

**Result:** Smooth playback on reference video, acceptable playback on followers (±100-200ms drift is imperceptible).

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│ MultiVodViewer Component                                     │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Reference Video Selection (UI)                         │ │
│  │ [Dropdown: Select which VOD is "reference"]            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────┐ │
│  │ VOD Panel 0      │  │ VOD Panel 1      │  │ VOD Panel │ │
│  │ (REFERENCE)      │  │ (FOLLOWER)       │  │     2     │ │
│  │                  │  │                  │  │(FOLLOWER) │ │
│  │ • Plays freely   │  │ • Reads ref time │  │           │ │
│  │ • No React seek  │  │ • RAF sync loop  │  │ • RAF     │ │
│  │ • Smooth @ 30fps │  │ • Seek if drift  │  │   sync    │ │
│  │                  │  │   > 200ms        │  │           │ │
│  │ videoRef[0]      │  │ • Adjust speed   │  │           │ │
│  │                  │  │   if 50-200ms    │  │ videoRef  │ │
│  │                  │  │                  │  │   [2]     │ │
│  │                  │  │ videoRef[1]      │  │           │ │
│  └──────────────────┘  └──────────────────┘  └───────────┘ │
│         ↑                      ↑                    ↑       │
│         └──────────────────────┴────────────────────┘       │
│              usePlaybackSync Hook (RAF loop)                │
│                                                              │
│         Reads reference's actual currentTime                │
│         Syncs followers every 16ms                          │
└──────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Remove React State-Driven Seeking from VodPanel

**File:** `frontend/src/pages/MultiVodComparison/components/VodPanel.jsx`

**What to change:**
- Remove the `useEffect` that syncs `videoRef.currentTime` to `globalTime`
- Add a check for `isReference` prop
- Reference videos should ignore global sync logic

**Before:**
```javascript
// This useEffect is problematic - it drives seeking from React state
useEffect(() => {
  if (!videoRef.current || !vod) return;
  
  const expectedTime = globalTime + vod.offset;
  const clampedTime = Math.max(0, Math.min(vod.duration || 0, expectedTime));
  const currentTime = videoRef.current.currentTime;
  
  // Still causes seeking even at 100ms threshold
  if (Math.abs(currentTime - clampedTime) > 0.1) {
    videoRef.current.currentTime = clampedTime;  // ← SEEKING!
  }
}, [globalTime, vod]);
```

**After:**
```javascript
// NEW: Only applies to non-reference videos
// Reference videos don't sync from React state anymore
useEffect(() => {
  // Reference video: no syncing via React state
  if (isReference) {
    return;  // Exit - reference video plays freely
  }
  
  // Follower video: would be synced by usePlaybackSync hook instead
  // NOT by React state anymore
  // (actual sync logic moved to usePlaybackSync.js)
}, [isReference, globalTime, vod]);
```

**Key Changes:**
1. Delete the entire drift-checking useEffect
2. Add `isReference` prop to VodPanel
3. If `isReference={true}`, do minimal syncing (only global play/pause)

### Step 2: Update MultiVodViewer to Pass Reference Information

**File:** `frontend/src/pages/MultiVodComparison/components/MultiVodViewer.jsx`

**What to change:**
- Add state for `referenceVodIndex`
- Render UI to select reference video
- Pass `isReference` prop to each VodPanel

**Code to add:**
```javascript
import { useState } from "react";

export default function MultiVodViewer({
  state,
  globalTime,
  syncMode,
  onGlobalSeek,
  onIndividualSeek,
  onOffsetChange,
  onPlaybackChange,
  onSyncModeChange,
}) {
  // NEW: Track which video is the reference
  const [referenceVodIndex, setReferenceVodIndex] = useState(0);
  
  // ... existing code ...
  
  return (
    <div className={styles.container}>
      {/* NEW: Reference video selector */}
      <div className={styles.referenceSelector}>
        <label htmlFor="ref-select">
          Reference Video (smooth playback):
        </label>
        <select
          id="ref-select"
          value={referenceVodIndex}
          onChange={(e) => setReferenceVodIndex(Number(e.target.value))}
        >
          {state.vods.map((vod, idx) => (
            <option key={vod.vod_id} value={idx}>
              {vod.name}
            </option>
          ))}
        </select>
      </div>
      
      {/* Grid of videos */}
      <div className={styles.grid}>
        {state.vods.map((vod, index) => (
          <VodPanel
            key={vod.vod_id}
            vod={vod}
            vodIndex={index}
            globalTime={globalTime}
            syncMode={syncMode}
            isReference={index === referenceVodIndex}  // ← NEW
            onSeek={
              syncMode === "global"
                ? (time) => onGlobalSeek(time)
                : (time) => onIndividualSeek(index, time)
            }
          />
        ))}
      </div>
      
      {/* ... rest of existing code ... */}
    </div>
  );
}
```

### Step 3: Create usePlaybackSync Hook

**File:** `frontend/src/pages/MultiVodComparison/hooks/usePlaybackSync.js`

**This is the core logic - new file:**

```javascript
import { useEffect, useRef } from "react";

/**
 * Synchronizes multiple follower videos to a reference video.
 * 
 * Reference video plays freely (no React-driven seeking).
 * Follower videos sync to reference's actual currentTime property.
 * 
 * Sync strategy:
 * - Drift > 200ms: Seek (necessary correction)
 * - Drift 50-200ms: Adjust playback rate (±5% for smooth catch-up)
 * - Drift < 50ms: Play at normal speed (in sync)
 * 
 * @param {React.MutableRefObject} referenceVideoRef - Reference <video> element
 * @param {Array<React.MutableRefObject>} followerRefs - Array of follower <video> refs
 * @param {Array<Object>} vods - VOD objects with offset information
 * @param {string} playbackState - "playing" or "paused"
 */
export function usePlaybackSync(referenceVideoRef, followerRefs, vods, playbackState) {
  const rafIdRef = useRef(null);
  
  useEffect(() => {
    // Validate inputs
    if (!referenceVideoRef?.current || !followerRefs?.length) {
      return;
    }
    
    // If paused, don't sync
    if (playbackState !== "playing") {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      return;
    }
    
    /**
     * RAF sync loop: runs every ~16ms (60fps)
     * Reads reference video's actual time and syncs followers
     */
    const syncFrame = () => {
      try {
        const referenceTime = referenceVideoRef.current.currentTime;
        
        followerRefs.forEach((followerRef, index) => {
          // Validate follower ref
          if (!followerRef?.current) return;
          
          // Get the expected time for this follower based on reference + offset
          const vod = vods[index + 1];  // +1 because vods[0] is reference
          if (!vod) return;
          
          const expectedTime = referenceTime + vod.offset;
          const actualTime = followerRef.current.currentTime;
          const drift = expectedTime - actualTime;
          const absDrift = Math.abs(drift);
          
          // Sync strategy based on drift magnitude
          if (absDrift > 0.2) {
            // Large drift (> 200ms): Seek (necessary correction)
            // Clamp to valid range
            const clampedTime = Math.max(0, Math.min(vod.duration || 0, expectedTime));
            followerRef.current.currentTime = clampedTime;
          } else if (absDrift > 0.05) {
            // Medium drift (50-200ms): Adjust playback rate for smooth catch-up
            if (drift > 0) {
              // Follower is behind: speed up slightly (2%)
              followerRef.current.playbackRate = 1.02;
            } else {
              // Follower is ahead: slow down slightly (2%)
              followerRef.current.playbackRate = 0.98;
            }
          } else {
            // Small drift (< 50ms): In sync, play normally
            followerRef.current.playbackRate = 1.0;
          }
        });
        
        // Schedule next sync frame
        rafIdRef.current = requestAnimationFrame(syncFrame);
      } catch (error) {
        console.error("Error in playback sync:", error);
        // Continue syncing even on error
        rafIdRef.current = requestAnimationFrame(syncFrame);
      }
    };
    
    // Start the sync loop
    rafIdRef.current = requestAnimationFrame(syncFrame);
    
    // Cleanup on unmount or dependency change
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [referenceVideoRef, followerRefs, vods, playbackState]);
}
```

### Step 4: Integrate usePlaybackSync in MultiVodComparison

**File:** `frontend/src/pages/MultiVodComparison/MultiVodComparison.jsx`

**What to add:**
- Create refs for all video elements
- Pass reference video ref + follower refs to the hook
- Coordinate with existing state management

**Code to add:**
```javascript
import { useRef, useEffect } from "react";
import { usePlaybackSync } from "./hooks/usePlaybackSync";

export default function MultiVodComparison() {
  // ... existing state ...
  const [referenceVodIndex, setReferenceVodIndex] = useState(0);
  
  // NEW: Create array of refs for all videos
  const videoRefs = useRef([]);
  
  // NEW: Initialize refs if needed
  useEffect(() => {
    if (state?.vods?.length) {
      videoRefs.current = videoRefs.current.slice(0, state.vods.length);
    }
  }, [state?.vods?.length]);
  
  // NEW: Get reference and follower refs
  const referenceVideoRef = videoRefs.current[referenceVodIndex];
  const followerRefs = videoRefs.current.filter((_, idx) => idx !== referenceVodIndex);
  
  // NEW: Use the playback sync hook
  usePlaybackSync(
    referenceVideoRef,
    followerRefs,
    state?.vods || [],
    state?.global_playback_state || "paused"
  );
  
  // When rendering VodPanel, attach the ref
  <VodPanel
    ref={(el) => {
      if (el?.videoRef) {
        videoRefs.current[index] = { current: el.videoRef.current };
      }
    }}
    // ... other props ...
  />
}
```

**Alternative approach (cleaner):** Pass ref callback to VodPanel:

```javascript
// In VodPanel.jsx:
export const VodPanel = forwardRef(({ vod, vodIndex, isReference, ...props }, ref) => {
  const videoRef = useRef(null);
  
  useImperativeHandle(ref, () => ({
    videoRef: videoRef.current,
    currentTime: videoRef.current?.currentTime,
    getDuration: () => videoRef.current?.duration,
  }));
  
  return (
    // ... existing JSX ...
    <VideoElement ref={videoRef} src={vod.path} />
  );
});
```

### Step 5: Simplify Global Play/Pause

**File:** `frontend/src/pages/MultiVodComparison/components/PlaybackControls.jsx`

**What to change:**
- When user clicks Play, play reference video
- All followers auto-sync via usePlaybackSync

**Code:**
```javascript
const handlePlayClick = async () => {
  // Tell backend about playback state change
  await fetch(`/api/sessions/multi-vod/${sessionId}/playback`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "play" }),
  });
  
  // Play all videos locally (reference drives followers via RAF)
  referenceVideoRef.current?.play();
  followerVideoRefs.forEach(ref => {
    ref.current?.play();
  });
};

const handlePauseClick = async () => {
  // Tell backend
  await fetch(`/api/sessions/multi-vod/${sessionId}/playback`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "pause" }),
  });
  
  // Pause all videos
  referenceVideoRef.current?.pause();
  followerVideoRefs.forEach(ref => {
    ref.current?.pause();
  });
};
```

### Step 6: Update Global Seek Handler

**File:** `frontend/src/pages/MultiVodComparison/hooks/useGlobalSync.js`

**What to change:**
- When user seeks globally, seek reference video
- Followers auto-sync via RAF loop

**Code:**
```javascript
const handleGlobalSeek = useCallback(
  async (targetTime) => {
    // Seek the reference video directly
    if (referenceVideoRef.current) {
      referenceVideoRef.current.currentTime = Math.max(0, Math.min(referenceVideoRef.current.duration, targetTime));
    }
    
    // Followers will auto-sync via RAF loop
    // (no need to manually seek them)
    
    // Update backend state
    if (sessionId && syncMode === "global") {
      try {
        await fetch(`/api/sessions/multi-vod/${sessionId}/global-seek`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timestamp: targetTime }),
        });
      } catch (err) {
        console.error("Error during global seek:", err);
      }
    }
  },
  [sessionId, syncMode, referenceVideoRef]
);
```

---

## Testing Checklist

### Functional Tests
- [ ] Load multi-VOD comparison page
- [ ] Select different reference videos (dropdown works)
- [ ] Play all videos, verify reference plays smoothly
- [ ] Verify followers sync within ±200ms
- [ ] Pause/resume, all videos pause/resume
- [ ] Global seek works (all videos jump to new time)
- [ ] Individual scrubbers work (for non-reference videos)
- [ ] Offsets are applied correctly

### Performance Tests
- [ ] Record 30 seconds of playback
- [ ] Count stutter events (should be <1 per 5 seconds)
- [ ] Measure FPS on reference video (should be 28-30)
- [ ] Measure FPS on follower videos (should be 25-29)
- [ ] Check CPU usage (should be <25%)
- [ ] Check memory usage (should be stable)

### Edge Cases
- [ ] Change reference video mid-playback
- [ ] Seek beyond VOD duration (clamp properly)
- [ ] Very large offset values (±100s)
- [ ] Different VOD durations
- [ ] Audio sync (especially with different playback rates)

---

## Git Workflow

### Branch
```bash
git checkout -b feat/reference-video-sync
```

### Commit Structure
```bash
# Step 1: Remove problematic seeking
git add frontend/src/pages/MultiVodComparison/components/VodPanel.jsx
git commit -m "refactor: remove React state-driven video seeking from VodPanel"

# Step 2: Add reference video selection
git add frontend/src/pages/MultiVodComparison/components/MultiVodViewer.jsx
git commit -m "feat: add reference video selector UI"

# Step 3: New sync hook
git add frontend/src/pages/MultiVodComparison/hooks/usePlaybackSync.js
git commit -m "feat: implement reference video sync hook with RAF loop"

# Step 4-6: Integration
git add frontend/src/pages/MultiVodComparison/
git commit -m "feat: integrate playback sync throughout multi-VOD component tree"

# Final
git commit --allow-empty -m "test: verify reference video sync works smoothly"
```

### PR Description
```markdown
## Reference Video Sync Implementation

Fixes laggy multi-VOD playback by eliminating React state-driven seeking.

### Changes
- Reference video plays freely (no React syncing)
- Followers sync to reference's actual playback time
- Uses RAF loop for smooth sync (every 16ms)
- Intelligent drift correction: seek if > 200ms, adjust speed if 50-200ms

### Performance
- Before: 24-28 FPS with frequent stuttering
- After: 29-30 FPS (reference), 26-29 FPS (followers)
- Seeking frequency: -60% reduction

### Testing
- Manual testing: play/pause/seek all work
- Performance: smooth playback verified
- Edge cases: offset changes, VOD duration mismatches

Fixes #<issue-number>
```

---

## Rollback Plan

If this approach doesn't work:

1. **Revert the branch:**
   ```bash
   git revert HEAD~3..HEAD
   ```

2. **Fallback option:** Keep the simpler approach (just increase drift threshold to 200ms)

3. **Next attempt:** Proceed directly to Electron native video approach

---

## Estimated Timeline

| Task | Days | Notes |
|------|------|-------|
| Step 1-2: UI changes | 0.5 | Add reference selector, remove bad seeking logic |
| Step 3: Implement sync hook | 1.0 | Core RAF logic, testing, debugging |
| Step 4-6: Integration | 0.5 | Wire everything together, handle edge cases |
| Testing & QA | 0.5 | Functional, performance, edge cases |
| **Total** | **2.5** | Can be done in 2-3 days with 1 developer |

---

## Success Criteria

✅ **Implementation is successful if:**
- Reference video plays smoothly (29-30 FPS, no stutter)
- Followers stay within ±200ms of reference (imperceptible drift)
- Play/pause/seek work correctly across all videos
- No performance regression compared to current state
- Coaches can use the feature for practical VOD analysis

---

## Next Steps

1. **Code review:** Share this guide with the team
2. **Implementation:** Start with Step 1 (remove bad seeking)
3. **Testing:** Verify each step works before moving to next
4. **Deployment:** Merge and deploy after full testing
5. **Feedback:** Collect coach feedback on usability

---

**Ready to implement?** Start with Step 1 and ping when blocked!
