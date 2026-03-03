# Technical Decision Log: Electron Native Video Solution

**Project:** VOD Insights - Multi-VOD Comparison Playback  
**Decision Date:** 2026-03-02  
**Status:** ✅ Approved  

---

## ADR-001: Choose libvlc over Windows Media Foundation

**Status:** ✅ Accepted  
**Date:** 2026-03-02

### Context
Need to decide between:
1. **libvlc** (cross-platform, proven, mature)
2. **Windows Media Foundation** (Windows-only, faster, native)
3. **Custom FFmpeg** (maximum control, high complexity)

### Decision
Use **libvlc as primary** with **optional WMF port for Windows optimization in Phase 5**.

### Rationale
- Cross-platform support from Day 1 (Windows, macOS, Linux)
- Mature, stable library used in professional media centers
- Proven for multi-stream synchronization
- Faster time to market (3-4 weeks vs 4-5 weeks WMF)
- Can pivot to WMF later without redesigning core sync algorithm
- Community support and documentation

### Consequences
- **Pro:** Ship faster, reach all platforms
- **Pro:** Fallback strategy easier (same sync logic across platforms)
- **Con:** Slightly lower performance on Windows than WMF
- **Con:** Need to bundle libvlc binaries (~15-20MB per platform)

### Trade-off Analysis
```
            | VLC | WMF | Custom FFmpeg
─────────────────────────────────────────
Time-to-ship | 3-4w | 4-5w | 6-8w
Platforms   | 3    | 1    | 3
Complexity  | Low  | Med  | Very High
Performance | Good | Better | Best
Community   | Large | Large | Small
Dev Cost    | $$   | $$   | $$$$$
```

### Alternative Considered: Hybrid Approach
Could implement WMF on Windows, libvlc on Mac/Linux. **Decision: Start with single approach (VLC) for consistency, add WMF variant later if needed.**

---

## ADR-002: Frame-Accurate Sync via Master Clock + Pause/Resume

**Status:** ✅ Accepted  
**Date:** 2026-03-02

### Context
How to maintain frame-accurate synchronization across N videos?

Options:
1. **Master clock + pause/resume** (simple, proven)
2. **Playback rate adjustment** (continuous, but more complex)
3. **Buffer-based sync** (queue frames, smooth but latency)
4. **Custom frame stepping** (maximum control, manual complexity)

### Decision
Use **master clock + pause/resume** with **tolerance of ±1 frame**.

### Implementation
```cpp
// Every 16ms:
1. Calculate expected_frame = (elapsed_time / 1000) * FPS
2. For each video:
   current_frame = video.getFrame()
   drift = current_frame - expected_frame
   
   if (drift > 1):
       pause()
       sleep(drift * frame_time)
       play()
```

### Rationale
- **Simple:** Easy to understand and debug
- **Reliable:** Proven technique in media players
- **Transparent:** User doesn't see the micro-pauses
- **Robust:** Works with any codec/framerate combo

### Consequences
- **Pro:** ±16ms accuracy achievable (1 frame @ 60fps)
- **Pro:** Minimal CPU overhead (just comparison + pause/resume)
- **Con:** Very brief pauses every 30-60 seconds (imperceptible)
- **Con:** May cause audio glitch if video paused during audio playback

### Why Not Playback Rate Adjustment?
Rate adjustment is smoother but:
- Harder to achieve frame-accurate sync
- VLC API doesn't support fine-grained rate control
- More CPU overhead

### Why Not Custom Syncing at Frame Level?
Manual frame-stepping without master clock:
- Too slow (can't sync live playback)
- Requires rebuilding entire sync logic

---

## ADR-003: Native Module Strategy: node-gyp + piscina

**Status:** ✅ Accepted  
**Date:** 2026-03-02

### Context
How to integrate libvlc into Electron + React app?

Options:
1. **node-gyp** (native modules, standard approach)
2. **node-ffi** (foreign function interface, simpler but slower)
3. **Electron preload + native code** (less standard)
4. **Separate service process** (more complexity, IPC overhead)

### Decision
Use **node-gyp for native bindings** + **piscina for worker pool**.

```
Renderer (React)
    ↓ ipcRenderer.invoke
Main Process (Electron)
    ↓ spawn worker
Worker Thread (piscina)
    ↓ native module call
Native Code (C++ / libvlc)
```

### Rationale
- **Standard:** node-gyp is de facto standard for Node.js native modules
- **Performance:** Direct function calls, no serialization overhead
- **Isolation:** Worker thread keeps video engine off main thread
- **Scalability:** piscina handles multiple videos in parallel

### Consequences
- **Pro:** Best performance
- **Pro:** Standard tooling (npm ecosystem understands node-gyp)
- **Pro:** Can use native libraries directly (libvlc C API)
- **Con:** Build complexity (requires C++ compiler on user machine)
- **Con:** Distributable is larger (bundled binaries for Win/Mac/Linux)

### Why Not node-ffi?
- ~2-3x slower (unnecessary marshaling)
- Less commonly used (harder to find help)

### Why Not Preload?
- Mixes concerns (UI + video engine in same process)
- Blocks React renders during video processing

---

## ADR-004: IPC Design: Async Commands + Telemetry Streams

**Status:** ✅ Accepted  
**Date:** 2026-03-02

### Context
How should React communicate with native video engine?

Options:
1. **Async commands + telemetry streams** (request/response + push events)
2. **Synchronous blocking calls** (simple but blocks UI)
3. **Bidirectional messaging** (more complex but flexible)
4. **Message queue** (decoupled but overkill)

### Decision
Use **async commands (ipcRenderer.invoke) + telemetry streams (ipcRenderer.on)**.

```typescript
// Command (one-shot)
await ipcRenderer.invoke('video:play', { videoIds: [1,2,3] })
  → Returns: { success: true }

// Telemetry (streaming)
ipcRenderer.on('video:telemetry', (event, data) => {
  // { states, driftMs, maxDrift }
  // Emitted every 16-33ms
})
```

### Rationale
- **Responsive:** Commands return immediately (no blocking)
- **Efficient:** Telemetry sent only when data changes
- **Clean separation:** Commands are fire-and-forget, telemetry is push-based
- **Standard:** Matches Electron's built-in IPC patterns

### Consequences
- **Pro:** Non-blocking React renders
- **Pro:** Minimal IPC overhead
- **Pro:** Easy to debug (command log + event log)
- **Con:** Telemetry volume could be high (every 16ms)

### Mitigation for Telemetry Volume
- Batch updates (send every 33ms instead of 16ms if CPU-bound)
- Compress telemetry (send only changes, not full state)
- Implement telemetry throttling in React (useCallback with dependency array)

---

## ADR-005: Sync Tolerance: ±1 Frame (not ±100ms)

**Status:** ✅ Accepted  
**Date:** 2026-03-02

### Context
What's acceptable sync accuracy for coaching VOD?

Video coaches analyzing Apex gameplay need:
- Precise frame-by-frame comparison
- No audio desync
- <30ms latency for responsive controls

Options:
1. **±1 frame** (16.67ms @ 60fps) - frame-level accuracy
2. **±100ms** - "good enough" for casual viewing
3. **±50ms** - compromise
4. **Frame-perfect (±0 frames)** - ideal but hard to sustain

### Decision
Target **±1 frame sustained** with **±0 frame accuracy on seek**.

### Rationale
- **Coaching use case:** Coaches need to see frame-by-frame differences
- **Reasonable:** ±1 frame is achievable with libvlc frame-stepping
- **Audio quality:** 16ms drift is imperceptible to human ears
- **Technical feasibility:** Proven in professional media centers

### Success Criteria
```
RMS drift (over 5-min clip): < 5ms
Sustained drift (continuous): < 16ms  ← ±1 frame
Seek accuracy: ±0 frames
Audio sync: < 16ms
```

### Why Not ±0 Frames?
- Physically impossible to sustain (hardware variance, OS jitter)
- ±1 frame is imperceptible
- Requires frame-level locking (10-20% more CPU)

### Why Not ±100ms?
- Breaks coaching use case (can't see frame-level differences)
- Audio/video clearly out of sync at that scale

---

## ADR-006: Platform Support: Windows/macOS/Linux (Tier 1)

**Status:** ✅ Accepted  
**Date:** 2026-03-02

### Context
Which platforms should Phase 1 support?

Options:
1. **Windows only** (fastest to ship, smallest audience)
2. **Windows + macOS** (coverage of most users)
3. **Windows + macOS + Linux** (full coverage, more work)

### Decision
Support all three: **Windows 10+, macOS 10.13+, Ubuntu 18.04 LTS+**

### Rationale
- Nishie's user base is likely cross-platform (content creators use Macs)
- Coaching organizations increasingly use Linux servers
- libvlc makes cross-platform trivial (same C API)
- Testing infrastructure already available (GitHub Actions matrix builds)

### Consequences
- **Pro:** Day-1 cross-platform shipping
- **Pro:** More user appeal
- **Con:** More testing burden (3 platforms × 3 architectures)
- **Con:** Larger distributable (binaries for 6 platforms)

### CI/CD Strategy
Test matrix: `[windows, macos, ubuntu] × [x64, arm64]`

---

## ADR-007: Rendering Backend: libvlc Platform Abstraction

**Status:** ✅ Accepted  
**Date:** 2026-03-02

### Context
How to render video to Electron window on different platforms?

Options:
1. **Use libvlc platform abstraction** (let VLC handle window attachment)
2. **Manually implement each platform** (more control, more code)
3. **Use Chromium's media renderer** (might conflict with Electron)
4. **Full-screen only** (simpler, but limiting)

### Decision
Use **libvlc's built-in platform support**:
- **Windows:** Attach to HWND (DirectX)
- **macOS:** Attach to NSView (Metal/OpenGL)
- **Linux:** Use XCB window ID (OpenGL/Wayland)

### Implementation
```cpp
// Windows
libvlc_set_nsobject(vlc_instance, hwnd_from_electron);

// macOS
libvlc_set_nsobject(vlc_instance, nsview_from_electron);

// Linux
libvlc_set_xwindow(vlc_instance, window_id_from_electron);
```

### Rationale
- **Proven:** libvlc handles all platform quirks
- **Maintainable:** Single code path across all platforms
- **Performant:** Uses platform-native rendering (GPU acceleration)
- **Supported:** VLC team maintains these APIs

### Consequences
- **Pro:** Minimal platform-specific code
- **Pro:** GPU acceleration automatic
- **Con:** Must understand platform window IDs (Electron BrowserWindow API)
- **Con:** Issues are VLC-specific (harder to debug)

---

## ADR-008: Testing Strategy: Unit + Integration + E2E + Performance

**Status:** ✅ Accepted  
**Date:** 2026-03-02

### Context
How to validate multi-video sync correctness?

Options:
1. **Manual testing only** (risky, slow)
2. **Unit tests only** (incomplete, doesn't catch integration issues)
3. **Comprehensive test suite** (unit + integration + E2E + perf)

### Decision
Implement **4-tier test strategy**:

```
1. Unit Tests (sync_master.test.ts)
   └─ Drift detection algorithm
   └─ Frame stepping logic
   └─ Rate adjustment

2. Integration Tests (video-engine.test.ts)
   └─ Load + play flow
   └─ Multi-video coordination
   └─ IPC message passing

3. E2E Tests (react component tests)
   └─ User clicks play button
   └─ Video renders correctly
   └─ UI updates in sync

4. Performance Tests (benchmark.ts)
   └─ CPU usage < 40%
   └─ Sync drift < 16ms RMS
   └─ Memory stable over 24h
```

### Rationale
- **Comprehensive:** Each tier catches different bugs
- **Regression prevention:** Automated tests catch regressions
- **Performance validation:** Benchmarks track degradation
- **User confidence:** E2E tests validate real user flows

### Consequences
- **Pro:** High confidence in shipping
- **Pro:** Easy to iterate (test suite catches breakage immediately)
- **Con:** Test suite takes time to write (~2 weeks)

### Test Coverage Goals
- C++ (native module): >80% line coverage
- TypeScript (IPC handlers): >90% line coverage
- React components: >70% coverage (integration + snapshot)

---

## ADR-009: Monitoring & Observability: Telemetry + Error Reporting

**Status:** ✅ Accepted  
**Date:** 2026-03-02

### Context
How to know if native video player is working in production?

Options:
1. **No monitoring** (ship blind, react to user complaints)
2. **Basic error reporting** (errors only, no metrics)
3. **Comprehensive telemetry** (metrics + errors + performance)

### Decision
Implement **comprehensive telemetry**:
- **Metrics:** Sync drift, CPU, memory, FPS
- **Errors:** Crash reports, seek failures, codec issues
- **Performance:** Latency histograms, resource usage

### Implementation
```typescript
// Record sync quality
analytics.track('video.sync', {
  maxDrift: telemetry.maxDrift,
  avgDrift: avg(telemetry.driftMs),
  timestamp: Date.now()
});

// Record errors
analytics.track('video.error', {
  errorCode: 'SEEK_FAILED',
  context: { videoId, position },
  stack: error.stack
});

// Record resource usage
analytics.track('video.resource', {
  cpuPercent,
  memoryMb,
  frameDropCount
});
```

### Rationale
- **Visibility:** Know when things break before users complain
- **Insights:** Understand real-world performance (not lab numbers)
- **Quick response:** Catch regressions early
- **Data-driven:** Make optimization decisions based on real data

### Consequences
- **Pro:** Production visibility
- **Pro:** Can identify platform-specific issues
- **Con:** Privacy consideration (telemetry sending)
- **Con:** Overhead (logging adds latency)

### Privacy Considerations
- Anonymize user IDs (no PII)
- Opt-out for privacy-conscious users
- Store telemetry locally for 7 days then delete

---

## ADR-010: Graceful Fallback: HTML5 on Native Failure

**Status:** ✅ Accepted  
**Date:** 2026-03-02

### Context
What if native video player crashes or malfunctions?

Options:
1. **Crash and burn** (terrible UX)
2. **Manual fallback button** (user has to click)
3. **Automatic fallback** (transparent recovery)

### Decision
Implement **automatic fallback to HTML5** on:
- Sync drift > 50ms sustained
- CPU > 70%
- Frame drop rate > 2%
- Unhandled exception

### Implementation
```typescript
// Monitor metrics, auto-fallback if threshold exceeded
if (maxDrift > 50 || cpuPercent > 70 || frameDropPercent > 2) {
  LOG.error(`Critical threshold exceeded, falling back to HTML5`);
  
  // Switch renderer
  setPlaybackEngine('html5');
  
  // Notify user
  showNotification(
    'Switched to HTML5 player for stability. ' +
    'Please report this issue.'
  );
  
  // Send telemetry
  analytics.track('native_player_fallback', {
    reason: 'high_drift' | 'high_cpu' | 'frame_drops',
    threshold_value: maxDrift | cpuPercent | frameDropPercent
  });
}
```

### Rationale
- **Resilience:** Service degradation instead of failure
- **UX:** User never loses video playback
- **Debugging:** Automatic fallback triggers alerts to dev team
- **Testing:** Real production data informs optimization priorities

### Consequences
- **Pro:** Users always have working playback
- **Pro:** Automatic issue detection
- **Con:** Hides bugs (might not fix if fallback works)
- **Con:** Users get degraded multi-video experience

### Mitigation for Hiding Bugs
- Telemetry alerts when fallback triggers
- Weekly review of fallback events
- Automate regression testing

---

## ADR-011: Deployment: bundled libvlc + Electron app distribution

**Status:** ✅ Accepted  
**Date:** 2026-03-02

### Context
How to distribute native video player to users?

Options:
1. **System libvlc dependency** (small download, breaks if VLC removed)
2. **Bundled libvlc** (larger app, always works)
3. **Download on first run** (complex, slow first launch)

### Decision
**Bundle libvlc** with each platform distributable.

### Size Impact
```
App size:
  Windows: +20MB (DirectX libs)
  macOS:   +15MB (Metal libs)
  Linux:   +18MB (OpenGL libs)
  
Total: ~5MB increase over baseline (manageable)
```

### Rationale
- **Reliability:** No version conflicts
- **UX:** No additional downloads or setup
- **Portability:** Works on systems without VLC installed
- **Support:** Clear dependency tree (easier to debug)

### Consequences
- **Pro:** Works immediately after installation
- **Pro:** No runtime dependency on system VLC
- **Con:** Larger distributable
- **Con:** Version updates require new app build

---

## ADR-012: Optional Phase 5: Windows Media Foundation Backend

**Status:** ✅ Accepted  
**Date:** 2026-03-02

### Context
Windows performance might be suboptimal compared to WMF. Should we port to WMF?

Decision: **Yes, but optional (Phase 5)**.

### Strategy
1. **Phase 1-4:** Use libvlc everywhere
2. **Phase 5:** If Windows performance insufficient, add WMF variant
3. **Runtime:** Auto-select best engine (WMF on Windows, libvlc elsewhere)

### Implementation
```cpp
// factory.cc
NativeVideoEngine* CreateVideoEngine(Platform p) {
  switch (p) {
    case Platform::Windows:
      return new WindowsMediaFoundationEngine();  // Phase 5
    case Platform::macOS:
    case Platform::Linux:
      return new VLCEngine();  // All phases
  }
}
```

### Rationale
- **Pragmatic:** Ship VLC first (fast), optimize Windows later (if needed)
- **Data-driven:** Benchmark Phase 4 on real hardware before deciding
- **Hedging:** If WMF breaks something, VLC fallback is available
- **Team capacity:** Spread work across 5 weeks instead of 4

### Consequences
- **Pro:** Fast initial shipping (VLC only)
- **Pro:** Windows performance optimization if needed
- **Con:** More test cases (2 backends to maintain)
- **Con:** More complex code (runtime selection logic)

### Success Criteria for Windows Optimization
- If Windows CPU < 30% for 3 videos, keep VLC
- If Windows CPU > 40% for 3 videos, port to WMF

---

## Summary Table

| ADR | Decision | Status | Trade-off |
|-----|----------|--------|-----------|
| 001 | libvlc primary | ✅ | Ship fast (VLC) vs max perf (WMF) |
| 002 | Master clock sync | ✅ | Simple logic vs continuous smoothing |
| 003 | node-gyp + piscina | ✅ | Complexity vs performance |
| 004 | Async + telemetry | ✅ | Non-blocking vs simplicity |
| 005 | ±1 frame tolerance | ✅ | Accuracy vs CPU cost |
| 006 | Windows/Mac/Linux | ✅ | Coverage vs testing burden |
| 007 | libvlc rendering | ✅ | Portability vs custom control |
| 008 | 4-tier testing | ✅ | Quality vs dev time |
| 009 | Telemetry + fallback | ✅ | Visibility vs privacy |
| 010 | Auto-fallback to HTML5 | ✅ | Resilience vs bug hiding |
| 011 | Bundled libvlc | ✅ | Reliability vs app size |
| 012 | Optional WMF Phase 5 | ✅ | Pragmatism vs scope creep |

---

## Questions & Revisits

### Q: What if sync accuracy can't hit ±1 frame?
**A:** Fallback to ±50ms (still good for coaching, less strict on frame-stepping)

### Q: What if libvlc performance is too slow on low-end hardware?
**A:** Implement quality downsampling (720p instead of 1080p) or fallback to HTML5

### Q: Should we support older macOS versions (<10.13)?
**A:** No. 10.13+ is reasonable (2017 hardware), support costs not worth it

### Q: Can we add picture-in-picture later?
**A:** Yes, but it's a future enhancement (not in Phase 1-5)

### Q: What about WebGL rendering instead of native?
**A:** Possible but defeats purpose of native player (would just reimplement HTML5 constraints)

---

## Approval & Sign-off

**Reviewed by:** Design & architecture  
**Approved for Phase 1:** 2026-03-02  
**Next review:** End of Phase 3 (after sync validation)

**Risk level:** Medium (Phase 3 is high-risk, mitigated by early phase 1-2 validation)
**Go/No-go criteria:** Phase 2 must achieve <100ms seek latency and audio sync

---

**Document version:** 1.0  
**Last updated:** 2026-03-02
