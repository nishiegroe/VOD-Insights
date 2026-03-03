# Phase 3-5 Critical Blockers & Analysis

**Author:** Sam (Architect)  
**Date:** 2026-03-02  
**Status:** Ready for Phase 1 Native Developer Review

---

## Overview

Four critical blockers have been identified across Phases 1-5. All have documented mitigations and timelines. **None are showstoppers**, but they must be resolved during Phase 1 (Days 1-5) to keep the full 28-day timeline on track.

---

## Blocker 1: Frame-Accurate Seeking ⚠️ Medium Risk

### Problem Statement

libvlc does not expose a direct "seek to frame N" API. Instead, it provides:
- `libvlc_media_list_player_set_time()` - seek to milliseconds
- `libvlc_media_list_player_next()` / `previous()` - step one frame

For frame-accurate seeking, we need to:
1. Seek to approximate millisecond position
2. Then frame-step to exact frame
3. This operation can take 10-100ms per video

### Impact

**Severity:** Medium  
**Blocks:** Phase 3 (sync tests), Phase 4 (frame stepping UI), Phase 5 (E2E tests)

**Timeline Impact:** If unresolved, Phase 3 starts with incomplete sync logic.

### Current Approach (Designed in Phase 1)

```cpp
// Pseudo-code: frame-accurate seeking strategy
int TargetFrame = desiredFrameCount;
double TargetTimeMs = (TargetFrame / FPS) * 1000.0;

// 1. Coarse seek to approximate time
libvlc_media_list_player_set_time(player, TargetTimeMs);
std::this_thread::sleep_for(100ms);  // Let decoder catch up

// 2. Fine-tune with frame stepping
int CurrentFrame = GetCurrentFrame(player);
int Remaining = TargetFrame - CurrentFrame;

if (Remaining > 0) {
  for (int i = 0; i < Remaining; i++) {
    libvlc_media_list_player_next(player);
  }
} else if (Remaining < 0) {
  for (int i = 0; i < -Remaining; i++) {
    libvlc_media_list_player_previous(player);
  }
}

// 3. Verify accuracy
int FinalFrame = GetCurrentFrame(player);
assert(FinalFrame == TargetFrame);  // Within ±1 frame tolerance
```

### Mitigation Strategies

#### Strategy A: Binary Search (Recommended)
```cpp
int BinarySearchFrame(VLCPlayer* player, int targetFrame) {
  // Instead of stepping 1000+ frames, use binary search
  // Reduces worst-case from 100ms to ~2ms per step
  
  int low = 0, high = TotalFrames;
  
  while (low < high) {
    int mid = low + (high - low) / 2;
    double timeMs = (mid / FPS) * 1000.0;
    
    libvlc_media_list_player_set_time(player, timeMs);
    std::this_thread::sleep_for(10ms);
    
    int currentFrame = GetCurrentFrame(player);
    
    if (currentFrame < targetFrame) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  
  // Final frame-stepping if needed
  int currentFrame = GetCurrentFrame(player);
  while (currentFrame != targetFrame) {
    if (currentFrame < targetFrame) {
      libvlc_media_list_player_next(player);
    } else {
      libvlc_media_list_player_previous(player);
    }
    currentFrame = GetCurrentFrame(player);
  }
  
  return currentFrame;
}
```

**Advantages:**
- O(log N) instead of O(N) seeking steps
- For 1800 frame seek: ~10 steps instead of 1800
- Reduces latency from 100ms to ~20-30ms

#### Strategy B: Cached Keyframes
- Pre-parse video to build keyframe index
- Seek to nearest keyframe, then frame-step
- Reduces seeking overhead

#### Strategy C: Accept Millisecond Accuracy
- Don't guarantee frame-perfect seeks
- Allow ±1-2 frame tolerance
- Reduces complexity, accepts minor sync drift

### Resolution Plan

**Phase 1 Spike (Days 1-2):**
1. Test all three strategies on sample videos
2. Measure actual seek times on real hardware
3. Choose approach based on performance results

**Phase 1 Implementation (Days 3-5):**
4. Implement chosen strategy
5. Create unit tests for frame seeking
6. Document frame accuracy guarantees

**Success Criteria:**
- Frame seeking: <200ms for 1-1800 frame jumps
- Accuracy: ±0 (exact) or ±1 frame at worst
- No hangs or decoder crashes

### Owner & Timeline

**Owner:** Native Developer  
**Critical Path:** Must resolve by Day 5 (Phase 1 completion)  
**Type:** Technical spike + implementation  
**Effort:** 8-12 hours

---

## Blocker 2: IPC Latency for 3+ Videos ⚠️ Medium Risk

### Problem Statement

Current IPC design sends commands one-at-a-time:

```typescript
// Current (Phase 2)
await ipcRenderer.invoke('video:play', { videoIds: [1] });
await ipcRenderer.invoke('video:play', { videoIds: [2] });
await ipcRenderer.invoke('video:play', { videoIds: [3] });
// Each command: ~10-50ms (depending on OS scheduler)
// Total: 30-150ms for all three to start
```

Problem: If we send seeks sequentially instead of in parallel:

```typescript
// Bad approach (sequential)
await ipcRenderer.invoke('video:seek', { videoId: 1, position });
await ipcRenderer.invoke('video:seek', { videoId: 2, position });
await ipcRenderer.invoke('video:seek', { videoId: 3, position });
// Total latency: 3 * (10-100ms) = 30-300ms
```

This violates our < 200ms seek latency target.

### Impact

**Severity:** Medium  
**Blocks:** Phase 3 (recovery from user seeks), Phase 4 (scrubber responsiveness), Phase 5 (performance benchmarks)

**User Experience:** Scrubber drag would feel "laggy" or "jerky"

### Current Solution (Designed in Phase 1)

**Batch IPC Calls:**

```typescript
// Good approach (batch)
await ipcRenderer.invoke('video:seek', { 
  videoIds: [1, 2, 3], 
  position 
});
// Single IPC call, native engine parallelizes seeks
// Total latency: ~30-100ms (one call instead of three)
```

### Implementation

**Frontend:**
```typescript
// src/ipc/video-handler.ts
const batchSeek = async (videoIds: number[], position: number) => {
  return await ipcRenderer.invoke('video:seek', {
    videoIds,  // Send all in one call
    position
  });
};

// src/components/ProgressBar.tsx
const handleScrubberDrag = debounce((position: number) => {
  batchSeek([1, 2, 3], position);  // All at once
}, 100);
```

**Native:**
```cpp
// native/src/ipc_handlers.cc
void VideoEngine::OnSeekBatch(
    const std::vector<int>& video_ids,
    double position_ms) {
  
  // Seek all videos in parallel (using thread pool)
  for (int vid : video_ids) {
    executor_.submit([this, vid, position_ms]() {
      auto player = players_[vid];
      libvlc_media_list_player_set_time(player, position_ms);
    });
  }
  
  // Wait for all seeks to complete
  executor_.wait();
}
```

### Mitigation Strategies

#### Strategy A: Batch All Commands (Recommended)
- Group related video IDs in single IPC call
- Let native engine parallelize within worker thread pool
- Applied to: play, pause, seek, rate changes

#### Strategy B: Worker Thread Pool
- Pre-allocate thread pool with N workers
- Each worker handles one video stream
- Commands auto-distributed across workers
- Ensures parallel execution

#### Strategy C: Debounce User Input
- Scrubber: only send seek every 100ms (not every frame)
- Already implemented in Phase 2's ProgressBar
- Reduces IPC call frequency

### Resolution Plan

**Phase 1 Implementation (Days 1-5):**
1. Design batch IPC interface
2. Implement worker thread pool (piscina or worker_threads)
3. Modify all IPC handlers to accept video arrays
4. Test parallel execution

**Phase 2 Update:**
5. Modify PlaybackControls to use batch calls
6. Modify ProgressBar scrubber to use batch seek + debounce

**Success Criteria:**
- Single IPC call for all operations
- Seek latency: <100ms for 3 videos
- Debounced scrubber: smooth drag without lag

### Owner & Timeline

**Owner:** Both teams (Native: implement, Frontend: adopt)  
**Critical Path:** Must complete Phase 1 (by Day 5)  
**Type:** Architecture + implementation  
**Effort:** 12-16 hours (native) + 4-6 hours (frontend)

---

## Blocker 3: Audio Sync During Micro-Pauses ⚠️ Low Risk

### Problem Statement

Phase 3 synchronization uses micro-pauses to correct drift:

```
Video is 10ms ahead of master → pause for 10ms → resume
```

Problem: Pausing video doesn't pause audio. The audio continues playing while video is paused, causing lip-sync issues.

### Example Scenario

```
Master expects: Frame 1000 @ T=1000ms
Video 1 is at: Frame 1001 @ T=1016ms (16ms ahead)
→ Pause video 1 for 16ms
→ User sees: black frame (paused)
→ User hears: audio continuing uninterrupted
→ Result: Audio-video sync broken for 16ms
```

### Impact

**Severity:** Low (16ms micro-pauses are generally imperceptible)  
**Blocks:** Phase 3 if micro-pauses are frequent/long  
**User Experience:** Occasional brief audio pops or lip-sync blips

### Current Solution (Designed)

**Auto-Pause Audio:**

```cpp
// native/src/video_engine.cc
void VideoEngine::PauseWithAudio(int video_id) {
  auto player = players_[video_id];
  
  // Pause video stream
  libvlc_media_list_player_pause(player);
  
  // Also pause audio stream (if exists)
  auto media_list = libvlc_media_list_player_get_media_list(player);
  auto media = libvlc_media_list_index_of_item(media_list, 0);
  
  // Get audio track and mute/pause it
  libvlc_audio_set_mute(media, true);  // Or use libvlc_audio_set_volume(0)
  
  // Store mute state for resume
  audio_was_playing_[video_id] = true;
}

void VideoEngine::ResumeWithAudio(int video_id) {
  auto player = players_[video_id];
  
  // Resume video
  libvlc_media_list_player_play(player);
  
  // Resume audio
  if (audio_was_playing_[video_id]) {
    auto media_list = libvlc_media_list_player_get_media_list(player);
    auto media = libvlc_media_list_index_of_item(media_list, 0);
    libvlc_audio_set_mute(media, false);  // Or restore volume
  }
}
```

### Mitigation Strategies

#### Strategy A: Mute During Pause (Recommended)
- Mute audio when pausing video
- Unmute when resuming
- Simple, reliable, unnoticeable

#### Strategy B: Pause Only if > 50ms
- Only apply audio muting for longer pauses
- For 16ms pauses, accept brief audio glitch (imperceptible)
- Simpler implementation

#### Strategy C: Accept Skew
- Don't pause at all; let slight audio skew happen
- A-V sync tolerates ±40-80ms
- Much simpler, acceptable trade-off

### Resolution Plan

**Phase 1 Implementation (Days 2-3):**
1. Implement auto-mute strategy
2. Test on sample videos
3. Verify audio pause/resume works correctly

**Phase 3 Verification:**
4. Run 5-minute sync test with audio
5. Measure audio-video sync quality
6. Adjust strategy if needed

**Success Criteria:**
- No noticeable audio pops during micro-pauses
- Audio remains in sync with video
- Mute/unmute timing accurate within 10ms

### Owner & Timeline

**Owner:** Native Developer  
**Critical Path:** Should complete in Phase 1, but nice-to-have  
**Type:** Implementation  
**Effort:** 4-6 hours

---

## Blocker 4: Cross-Codec Frame Rate Handling ⚠️ Low Risk

### Problem Statement

Different videos can have different frame rates:
- Video 1: 24fps (film)
- Video 2: 30fps (legacy video)
- Video 3: 60fps (modern)

When syncing 3 different videos, our expected frame calculation must account for per-video FPS:

```cpp
// Wrong (assumes all videos are 60fps)
int expected_frame = (elapsed_ms / 1000.0) * 60.0;

// Right (uses per-video FPS)
int expected_frame_v1 = (elapsed_ms / 1000.0) * 24.0;
int expected_frame_v2 = (elapsed_ms / 1000.0) * 30.0;
int expected_frame_v3 = (elapsed_ms / 1000.0) * 60.0;
```

### Impact

**Severity:** Low (only matters if you mix framerates)  
**Blocks:** Phase 3 if content has mixed FPS  
**User Experience:** Potential sync drift if different FPS not handled

### Current Solution (Designed)

**Store Per-Video FPS:**

```cpp
struct VideoState {
  int video_id;
  double fps;  // ← Store FPS for each video
  int current_frame;
  int expected_frame;
  int drift_frames;
};

// Phase 2: Parse FPS from file
void VideoEngine::Load(int video_id, const std::string& file_path) {
  auto player = CreateVLCPlayer(file_path);
  
  // Query metadata
  double fps = GetFrameRateFromMedia(player);  // Parse from file
  double duration_ms = GetDurationFromMedia(player);
  
  states_[video_id].fps = fps;  // Store it
  states_[video_id].duration = duration_ms;
}

// Phase 3: Use per-video FPS in sync calculation
void SyncMaster::UpdateExpectedFrames(double elapsed_ms) {
  for (auto& [video_id, state] : states_) {
    state.expected_frame = (elapsed_ms / 1000.0) * state.fps;
    state.drift_frames = state.current_frame - state.expected_frame;
  }
}
```

### Mitigation Strategies

#### Strategy A: Per-Video FPS (Recommended)
- Parse FPS from file metadata during load
- Store in VideoState struct
- Use per-video FPS in sync calculation

#### Strategy B: Normalize to Lowest FPS
- Use lowest FPS as reference (24fps)
- All videos sync to 24fps master
- Simpler, acceptable trade-off

#### Strategy C: User-Specified FPS
- Allow user to specify/override FPS
- Handle edge cases manually

### Resolution Plan

**Phase 1 Implementation (Days 3-4):**
1. Add FPS parsing to media loading
2. Store FPS in VideoState
3. Update sync calculation to use per-video FPS
4. Test with mixed-FPS videos

**Phase 3 Testing:**
5. Run sync tests with 24fps + 30fps + 60fps combo
6. Verify drift stays within tolerance

**Success Criteria:**
- FPS correctly parsed from all test files
- Sync calculation uses per-video FPS
- Mixed-FPS videos stay synced

### Owner & Timeline

**Owner:** Native Developer  
**Critical Path:** Should complete in Phase 1, non-blocking  
**Type:** Implementation  
**Effort:** 4-6 hours

---

## Summary: Blocker Resolution Timeline

| Blocker | Risk | Phase 1 Owner | Hours | Days |
|---------|------|--------------|-------|------|
| 1. Frame seeking | Medium | Native Dev | 10h | 1-2 |
| 2. IPC latency | Medium | Both | 16h | 1-5 |
| 3. Audio sync | Low | Native Dev | 5h | 2-3 |
| 4. Codec FPS | Low | Native Dev | 5h | 3-4 |
| **TOTAL** | | | **36h** | **1-5** |

**Critical Path:** Blockers 1 & 2 (must complete by Day 5)  
**Non-Critical:** Blockers 3 & 4 (nice-to-have, can slip)

---

## Dependencies Between Blockers

```
Blocker 1 (Frame Seeking)
  ↓ needed by
Blocker 2 (IPC Latency) ← both needed before Phase 3
  ↓
Phase 3: Sync Tests can start

Blocker 3 (Audio) + Blocker 4 (FPS) are independent
  → Can be done in parallel with 1 & 2
  → Don't block Phase 3 if skipped
```

---

## Risk Mitigation Summary

### If Blocker 1 Fails (Frame Seeking)
- **Fallback:** Accept ±2-5 frame sync tolerance instead of ±1
- **Impact:** Slightly visible (user might notice 30-80ms drift)
- **Timeline:** Phase 3-5 proceed with degraded accuracy

### If Blocker 2 Fails (IPC Latency)
- **Fallback:** Use sequential seeks, accept laggy scrubber
- **Impact:** Bad user experience (scrubber feels unresponsive)
- **Timeline:** Phase 4-5 UI work may suffer, but sync works

### If Blocker 3 Fails (Audio Sync)
- **Fallback:** Accept brief audio-video skew during pauses
- **Impact:** Low (16ms glitch is imperceptible to most users)
- **Timeline:** No blocking impact on Phases 3-5

### If Blocker 4 Fails (Codec FPS)
- **Fallback:** Require all videos to be same FPS
- **Impact:** Feature limitation (user can't mix framerates)
- **Timeline:** No blocking impact on Phases 3-5

---

## Escalation Points

If any critical blocker (1 or 2) cannot be resolved by Day 5:
1. Immediate meeting with Nishie (product owner)
2. Evaluate alternative architectures
3. Consider timeline extension or scope reduction
4. Pivot to Phase 5 Windows Media Foundation backend (WMF)

---

## Sign-Off

**Sam (Architect):** All blockers analyzed, mitigations designed  
**Ready for:** Native Developer Phase 1 Implementation  
**Approval Status:** ✅ Pending Nishie review

---

*Last updated: 2026-03-02 21:10 CST*  
*All blockers are manageable with no showstoppers*
