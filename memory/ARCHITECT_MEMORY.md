# Sam's Memory — Architect
**Updated:** 2026-03-03 09:35 CST

## Current Status: Phase 3-5 Planning Complete ✅

### Phase Completion Summary
- **Phase 2:** COMPLETE ✅ (Frontend UI + IPC)
- **Phase 3:** ARCHITECTURE COMPLETE (Multi-Video Sync Design)
- **Phase 4:** PLANNED (Advanced Controls & UI)
- **Phase 5:** PLANNED (Testing & Optimization)

---

## Phase 4: Advanced Controls & UI (Days 16-20)

### Architecture Refinements

**MultiVideoComparison Container:**
- Acts as state manager for all video tiles
- Handles sync state distribution to children
- Manages global playback controls

**VideoGrid Layout:**
- Fixed 3-column (expandable to 4)
- Responsive: stacks on mobile (<768px)
- Gap: 16px between tiles

**SyncControlPanel:**
- Manual offset adjustment: -500ms to +500ms per video
- Visual drift meters (green/yellow/red indicators)
- Sync lock toggle per video

### Integration with Phase 3
- Uses same sync telemetry from Phase 3
- Extends IPC: `video:set-offset` for manual adjustment
- Reuses ProgressBar component with multi-video context

### Blockers & Mitigations
1. **Offset storage:** How to persist per-video offsets?
   - Solution: Add to session config, save to localStorage
   
2. **UI clutter:** Too many controls if 4+ videos
   - Solution: Collapsible control panel, hover

---

## Phase reveals 5: Testing & Optimization (Days 21-28)

### Test Strategy

**Unit Tests (Native):**
- SyncMaster drift calculation: 50+ tests
- Frame-accurate seek: 30+ tests
- IPC error handling: 20+ tests

**Integration Tests:**
- 3 videos @ 60fps for 10 minutes
- Seek stress test: 100 rapid seeks
- Codec matrix: H.264, H.265, VP9, AV1

**Performance Targets:**
| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| Sync drift RMS | <5ms | <15ms |
| Seek latency | <200ms | <500ms |
| CPU (3 videos) | <40% | <60% |
| Memory | <300MB | <500MB |
| Frame drops | <0.1% | <1% |

### Optimization Priorities

**P0 (Must Fix):**
- Seek latency reduction
- Sync recovery speed

**P1 (Should Fix):**
- Memory optimization
- CPU usage reduction

**P2 (Nice to Have):**
- Windows Media Foundation backend
- Hardware decode optimization

---

## Critical Blockers (Refined)

### High Priority

| Blocker | Impact | Mitigation | Owner |
|---------|--------|------------|-------|
| Build environment missing | Can't compile native | Document prerequisites, use CI | Native |
| libvlc not installed | Can't test | Pre-built binaries or install script | Native |
| Frame-accurate seeking | Sync precision | Binary search approach + timestamp | Native |

### Medium Priority

| Blocker | Impact | Mitigation | Owner |
|---------|--------|------------|-------|
| IPC latency (3+ videos) | Seek sluggishness | Batch IPC calls | Both |
| Cross-platform rendering | Platform bugs | Abstraction layer | Native |
| Audio sync | Lip-sync issues | Auto-pause audio with video | Native |

### Low Priority

| Blocker | Impact | Mitigation | Owner |
|---------|--------|------------|-------|
| Different FPS videos | Complex sync math | Per-video FPS in metadata | Native |
| Codec compatibility | Playback failures | Fallback to HTML5 | Frontend |

---

## Architecture Decisions (Locked)

### 1. Sync Algorithm: Master Clock ✅
- Simple, robust, proven
- Micro-pauses (<16ms) imperceptible

### 2. Native Backend: libvlc ✅
- Cross-platform Day 1
- Mature, well-documented
- Can add WMF later if needed

### 3. IPC Strategy ✅
- Extend Phase 2 contracts
- Batch seek commands
- 16ms telemetry interval

### 4. UI Architecture ✅
- Props-based (no Redux)
- Colocated CSS
- Component composition

---

## Action Items (Completed 2026-03-03)

- [x] Refine Phase 4-5 blocker mitigations
- [x] Document architecture decisions
- [x] Update memory files
- [x] Commit to feature/multi-vod-complete

---

## Next Steps

**For Native Developer:**
1. Set up build environment (make, libvlc-dev)
2. Spike on frame-accurate seeking
3. Verify IPC batch handling

**For Frontend:**
1. Create MultiVideoComparison mock
2. Design SyncControlPanel UI
3. Plan component tests

---

**Status:** Architecture Documentation Complete  
**Branch:** feature/multi-vod-complete  
**Ready for:** Implementation kickoff
