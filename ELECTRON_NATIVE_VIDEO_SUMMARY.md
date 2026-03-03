# Electron Native Video - Executive Summary

**Status:** ✅ Design Complete  
**Timeline:** 28 days (4 weeks)  
**Effort:** ~225 hours (1-2 developers)  
**Recommendation:** VLC + Native IPC

---

## The Plan in 60 Seconds

1. **Replace** HTML5 `<video>` with native libvlc playback
2. **Sync** multiple videos frame-accurately (±16ms tolerance)
3. **Control** playback from React via Electron IPC
4. **Optimize** for CPU/memory efficiency
5. **Deploy** cross-platform (Win/Mac/Linux)

---

## Technology Stack

| Component | Choice | Why |
|-----------|--------|-----|
| **Video Engine** | libvlc | Mature, cross-platform, codec-flexible |
| **Native Bindings** | node-gyp | Standard for Node.js C++ modules |
| **IPC** | Electron ipcMain/ipcRenderer | Native Electron communication |
| **Worker Pool** | piscina | Background video processing |
| **Optional** | Windows Media Foundation | Later optimization (Windows only) |

---

## 5-Phase Roadmap

```
Phase 1: Infrastructure (Days 1-5)         [40h]
   ├─ node-gyp build setup
   ├─ Basic libvlc wrapper
   └─ Electron IPC routing

Phase 2: Single Video (Days 6-10)          [45h]
   ├─ Video rendering
   ├─ Play/Pause/Seek
   └─ React integration

Phase 3: Multi-Sync (Days 11-15)           [50h]  ⭐ HARDEST
   ├─ Frame-accurate sync master
   ├─ Drift detection & correction
   └─ Telemetry streaming

Phase 4: Controls & UI (Days 16-20)        [40h]
   ├─ Playback rate control
   ├─ Audio track selection
   ├─ Frame stepping
   └─ HUD overlay

Phase 5: Testing & Optimization (Days 21-28) [50h]
   ├─ Unit + integration tests
   ├─ Performance benchmarking
   ├─ Cross-platform validation
   └─ Optional WMF backend (Windows)
```

---

## Architecture Overview

```
React UI (Play, Pause, Seek)
        ↓ IPC
Electron Main (Routes commands)
        ↓ Worker Thread
Native libvlc Engine (Sync master, frame control)
        ↓ Platform APIs
Windows (DirectX) / macOS (Metal) / Linux (OpenGL)
```

**Data Flow Example:**
```
User clicks Play
  → React sends { action: 'play', videoIds: [1, 2, 3] }
  → Main process forwards to worker
  → libvlc plays all 3 videos
  → Every 16ms: sync loop checks frame drift
  → If drift > 1 frame: pause/adjust that video
  → Telemetry sent back to React (UI updates)
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| **Sync Accuracy** | ±1 frame (±16.67ms @ 60fps) |
| **CPU per video** | <10% (3 videos = <40%) |
| **Memory** | <80MB per video instance |
| **Frame drops** | <0.1% |
| **Seek precision** | ±0 frames (exact) |
| **Playback FPS** | 59-61 fps (stable @ 60fps) |

---

## Key Technical Challenges

### 1. Frame-Accurate Synchronization ⭐ CRITICAL

**Problem:** Multiple videos must play in perfect sync, with no audio drift.

**Solution:**
- Master clock (system time) as reference
- Calculate expected frame for each video
- Detect drift (frame count comparison)
- Micro-adjust by pausing individual videos

**Code:**
```cpp
if (current_frame > expected_frame + 1) {
  // Video ahead, pause briefly then resume
  pause();
  sleep(drift_ms);
  play();
}
```

### 2. Platform-Specific Rendering

**Windows:** Attach VLC to HWND (DirectX)
**macOS:** Attach to NSView (Metal)
**Linux:** Use XCB window ID (OpenGL)

### 3. Seeking with Frame Accuracy

**Challenge:** libvlc seeks to milliseconds, not frames.

**Solution:** Binary search for exact frame using frame-stepping APIs

---

## Migration Path (No Breaking Changes)

**Week 1-2:** Run HTML5 and native side-by-side (feature flag)
```typescript
useNativePlayer={process.env.REACT_APP_NATIVE === 'true'}
```

**Week 3-4:** Gradual rollout (10% → 25% → 50% → 100%)

**Fallback:** If native player fails, automatically revert to HTML5

---

## Risk Assessment

| Risk | Probability | Mitigation |
|------|-------------|-----------|
| Sync drift > 50ms | Medium | Pre-test; monitor + auto-adjust |
| VLC library issues | Low | Use stable LTS version; fallback to HTML5 |
| CPU overload | Medium | Quality downsampling on low-end hardware |
| Cross-platform bugs | Medium | Test Win/Mac/Linux in Phase 1-2 |
| Memory leaks | Low | Valgrind testing; 24h continuous playback test |

**Rollback Plan:** Auto-switch to HTML5 if:
- Sync drift > 50ms sustained
- CPU > 70%
- Frame drop rate > 2%
- Crash or unhandled exception

---

## File Layout

```
vod-insights/
├── native/                          # C++ code
│   ├── src/
│   │   ├── video_engine.cc         # Main engine
│   │   ├── sync_master.cc          # Sync algorithm ⭐
│   │   ├── seek_controller.cc      # Seeking logic
│   │   └── vlc_wrapper.cc          # libvlc bindings
│   └── binding.gyp                 # Build config
│
├── src/                             # React + Electron
│   ├── ipc/
│   │   └── handlers/video.ts       # IPC handlers
│   ├── workers/
│   │   └── video-worker.ts         # Worker thread
│   ├── hooks/
│   │   └── useVideoPlayback.ts     # React hook
│   └── components/
│       ├── VideoPlayer.tsx
│       └── MultiVideoComparison.tsx
│
└── test/                            # Tests
    ├── video-engine.test.ts
    ├── sync.test.ts
    └── integration/
```

---

## Quick IPC API

```typescript
// Load video
await ipcRenderer.invoke('video:load', { 
  id: 1, 
  filePath: '/path/video.mp4' 
});

// Play/Pause
await ipcRenderer.invoke('video:play', { videoIds: [1, 2, 3] });
await ipcRenderer.invoke('video:pause', { videoIds: [1, 2, 3] });

// Seek (all videos at same position)
await ipcRenderer.invoke('video:seek', { 
  videoId: 1, 
  position: 15.5  // seconds
});

// Playback rate
await ipcRenderer.invoke('video:setPlaybackRate', { 
  videoIds: [1, 2, 3], 
  rate: 1.5 
});

// Telemetry (emitted every 16ms)
ipcRenderer.on('video:telemetry', (event, { 
  states,      // [{ videoId, currentFrame, status, ... }]
  driftMs,     // Sync drift for each video
  maxDrift     // Maximum drift across all videos
}) => {
  // Update React UI
});
```

---

## Dependencies

```json
{
  "dependencies": {
    "electron": "^27.0.0",
    "react": "^18.2.0",
    "piscina": "^4.0.0"
  },
  "devDependencies": {
    "node-gyp": "^9.4.0",
    "typescript": "^5.0.0",
    "jest": "^29.0.0"
  },
  "system": {
    "libvlc": "4.0.0+",
    "node": "18.0.0+"
  }
}
```

---

## Build Commands

```bash
# Install dependencies
npm install

# Build native module
npm run build:native

# Run in development
npm run dev

# Run tests
npm test

# Package distributable
npm run package
```

---

## Why VLC vs Windows Media Foundation?

### VLC
✅ Cross-platform (Day 1)
✅ Mature & stable
✅ Proven for multi-stream
✅ 3-4 weeks to ship
❌ Slightly slower on Windows

### WMF
✅ Best Windows performance
✅ Native codec support
❌ Windows-only
❌ 4-5 weeks to ship
❌ Steeper learning curve

**Recommendation:** Start with VLC. Add WMF as optional optimization in Phase 5 if needed.

---

## Implementation Order (Priority)

1. **Phase 1 (Infrastructure)** - Must-have: Get native module + IPC working
2. **Phase 2 (Single video)** - Must-have: Replace one HTML5 player
3. **Phase 3 (Multi-sync)** ⭐ **HARDEST** - Must-have: The whole point of native
4. **Phase 4 (Controls)** - Nice-to-have: Full feature parity
5. **Phase 5 (Testing)** - Must-have: Validate quality & performance

---

## Timeline Estimate

- **Best case:** 3 weeks (everything goes smoothly, team experienced)
- **Realistic:** 4 weeks (typical debugging, platform issues)
- **Conservative:** 5-6 weeks (scope creep, major issues)

**Critical path:** Phase 3 (multi-sync) - this is where complexity explodes.

---

## Next Steps

1. ✅ **Complete:** Design & architecture (this document)
2. ⏭️  **Phase 1:** Infrastructure setup + build tools
3. ⏭️  **Phase 2:** Single video playback
4. ⏭️  **Phase 3:** Multi-video sync (the main challenge)
5. ⏭️  **Phase 4:** Controls & UI
6. ⏭️  **Phase 5:** Testing & optimization

---

## Key Contacts & Resources

- **libvlc Docs:** https://www.videolan.org/developers/vlc/doc/
- **node-gyp Guide:** https://github.com/nodejs/node-gyp
- **Electron IPC:** https://www.electronjs.org/docs/latest/api/ipc-main
- **VLC LTS:** v4.0.x (stable)

---

## Document Reference

For full details, see: `IMPLEMENTATION_PLAN_ELECTRON_NATIVE_VIDEO.md`

Sections covered:
1. Architecture Design ✅
2. Implementation Phases (5 phases, day-by-day) ✅
3. Technical Specs (code examples, APIs) ✅
4. Migration Strategy (feature flags, rollback) ✅
5. Success Criteria (metrics & benchmarks) ✅
6. Risk Assessment (mitigation strategies) ✅
7. Detailed Phase Breakdown ✅
8. Code Structure ✅
9. Build & Deployment ✅
10. Quick Reference ✅
11. Known Challenges ✅
12. Final Recommendations ✅

---

**Design Status:** ✅ Complete & Ready for Phase 1
**Last Updated:** 2026-03-02
