# Multi-VOD Sync Test Plan

**Author:** Jordan (QA Engineer)  
**Date:** 2026-03-03  
**Status:** Draft - Ready for Review

---

## Overview

This test plan covers the Multi-VOD Synchronization feature (Phase 3), which enables synchronized playback of 2-3 video streams with frame-accurate sync (±1 frame = ±16.67ms @ 60fps).

---

## Test Scope

### In Scope
- MultiVideoComparison component sync functionality
- SyncIndicators drift visualization
- IPC contract for multi-video play/pause/seek
- Telemetry flow from native to React
- Per-video offset adjustment

### Out of Scope
- Native libvlc implementation (covered by Native team)
- Cross-platform builds
- Audio sync (handled at native layer)

---

## Test Categories

### 1. Component Tests (Unit)

#### MultiVideoComparison
| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| MC-01 | Render with 2 videos | Grid displays 2 video tiles |
| MC-02 | Render with 3 videos | Grid displays 3 video tiles |
| MC-03 | Empty videos array | Component renders header, no crash |
| MC-04 | Play button triggers isPlaying=true | State updates, IPC called |
| MC-05 | Pause button triggers isPlaying=false | State updates, IPC called |
| MC-06 | Seek updates currentTime | ProgressBar onSeek callback fires |
| MC-07 | Playback rate change | onPlaybackRateChange called |
| MC-08 | Close button calls onClose | Callback invoked when clicked |
| MC-09 | Sync indicator shows healthy when drift <16.67ms | Green indicator |
| MC-10 | Sync indicator shows warning when drift 16.67-33.34ms | Yellow indicator |
| MC-11 | Sync indicator shows critical when drift >33.34ms | Red indicator |

#### SyncIndicators
| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| SI-01 | No state - show placeholder | "Waiting for video X" displayed |
| SI-02 | Healthy drift - green LED | LED class is .green |
| SI-03 | Warning drift - yellow LED | LED class is .yellow |
| SI-04 | Critical drift - red LED | LED class is .red |
| SI-05 | Drift display shows absolute ms | Negative drift shows positive value |
| SI-06 | Drift direction indicator - ahead | Arrow shows ↑ |
| SI-07 | Drift direction indicator - behind | Arrow shows ↓ |
| SI-08 | Frame display shows current/expected | "Frame 1000 / 1000" |
| SI-09 | Offset slider range -30 to +30 | Slider min/max correct |
| SI-10 | Offset change calls onOffsetChange | Callback invoked with new value |
| SI-11 | Reset button appears when offset≠0 | Button visible |
| SI-12 | Reset button resets offset to 0 | Callback called with 0 |
| SI-13 | showDetails=true displays metrics | Detailed metrics section renders |
| SI-14 | Adjustment hint shows when drift≠0 | Hint text visible |

---

### 2. Integration Tests

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| INT-01 | VideoClient play triggers all videos | IPC invoke called with all videoIds |
| INT-02 | VideoClient pause triggers all videos | IPC invoke called with all videoIds |
| INT-03 | VideoClient seek batched for 3 videos | Single IPC call with array |
| INT-04 | Telemetry callback receives drift data | State updates with telemetry |
| INT-05 | Sync master drift calculation | Correct driftMs calculated |

---

### 3. Sync Accuracy Tests (Manual/E2E)

| ID | Test Case | Target | Method |
|----|-----------|--------|--------|
| SYNC-01 | 3 videos play 5 minutes | ±1 frame drift | Native + React telemetry |
| SYNC-02 | Seek recovery time | <200ms | Manual stopwatch |
| SYNC-03 | Pause/resume accuracy | ±1 frame | Frame count comparison |
| SYNC-04 | Different FPS videos (24/30/60) | Synced | Play mixed-FPS set |
| SYNC-05 | Frame stepping | <100ms/step | Manual timing |

---

### 4. Stress Tests

| ID | Test Case | Expected |
|----|-----------|----------|
| STR-01 | 3 videos, 10+ minutes continuous | No memory leak, sync maintained |
| STR-02 | Rapid play/pause (50x) | No crash, sync recovers |
| STR-03 | Rapid seek (50x) | No crash |

---

### 5. Edge Cases

| ID | Test Case | Expected |
|----|-----------|----------|
| EDGE-01 | Video fails to load | Error shown, other videos continue |
| EDGE-02 | One video removed mid-play | Sync continues for remaining |
| EDGE-03 | Very long video names | Label truncates gracefully |
| EDGE-04 | Network path vs local path | Both work |
| EDGE-05 | Different codecs (H264/VP9) | Both play in sync |

---

## Test Data Requirements

### Video Files
- 3x identical videos (different file paths, same content) for sync testing
- Mix of framerates: 24fps, 30fps, 60fps
- Various codecs: H.264, VP9, HEVC
- Duration: 30s (quick tests), 5min (sync tests), 10min (stress)

### Test Accounts
- Standard user (normal sync)
- Coach with multiple sessions

---

## Environment

- **Frontend:** React 18, Vitest
- **Native:** Electron with libvlc (when available)
- **Browser:** Chrome (primary), Firefox (secondary)
- **OS:** Windows 11, macOS, Linux

---

## Success Criteria

- All unit tests pass (249+ tests)
- Integration tests pass
- Manual sync tests meet accuracy targets
- No critical or high-severity bugs

---

## Known Limitations (as of 2026-03-03)

1. **Native build blocked:** Cannot run full sync tests until libvlc is installed
2. **IPC latency:** Not measured yet - target is <200ms for 3 videos
3. **Audio sync:** Not tested - handled at native layer

---

## Next Steps

1. ✅ Unit tests written and passing (249 tests)
2. ⏳ Native build to enable integration tests
3. ⏳ Manual sync accuracy testing
4. ⏳ Cross-platform validation
