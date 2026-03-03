# Phase 2: Quick Reference Guide
## Electron Native Video - Single Video Playback

**Days:** 6-10 of 28-day roadmap  
**Status:** ✅ COMPLETE  
**Key Deliverables:** 5  

---

## 📦 Deliverables at a Glance

| # | Deliverable | File | Status |
|---|---|---|---|
| 1 | NativeVideoContainer component | `components/NativeVideoContainer.tsx` | ✅ |
| 2 | VodPanel with native support | `pages/.../VodPanelWithNativeSupport.jsx` | ✅ |
| 3 | Feature flag integration | `config/videoFeatureFlags.ts` (Phase 1) | ✅ |
| 4 | Performance monitoring UI | In NativeVideoContainer | ✅ |
| 5 | E2E test suite | `__tests__/e2e/nativeVideoPlayback.e2e.test.tsx` | ✅ |
| 6 | User testing checklist | `PHASE_2_USER_TESTING_CHECKLIST.md` | ✅ |
| 7 | Known issues documentation | `PHASE_2_KNOWN_ISSUES.md` | ✅ |

---

## 🎯 Success Criteria (All Met)

```
✅ First video plays natively (not HTML5)
✅ Plays smoothly at 30-60fps
✅ All controls responsive
✅ Feature flag toggles between native/HTML5
✅ No console errors
✅ Performance telemetry visible (debug mode)
✅ E2E tests passing
✅ Ready to add 2nd video
```

---

## 🚀 Quick Start for Testing

### Enable Native Video

```javascript
// In browser console
setNativeVideoEnabled(true);
logVideoFeatureFlags();  // Verify it's on
```

Then reload page → First video should be native!

### View Performance Metrics

In NativeVideoContainer:
```jsx
<NativeVideoContainer
  enablePerformanceMonitoring={true}
  enableDebugOverlay={true}
/>
```

Shows:
- FPS (current & average)
- Sync drift (milliseconds)
- Duration
- VOD index

### Disable for Troubleshooting

```javascript
setNativeVideoEnabled(false);
// Falls back to HTML5 for all videos
```

---

## 🔧 Component API

### NativeVideoContainer Props

```typescript
interface NativeVideoContainerProps {
  src?: string;              // Path to video file
  vodIndex: number;          // Position in grid (0, 1, 2...)
  vodId: string;            // Unique VOD identifier
  globalTime: number;        // Current playback time (seconds)
  playbackRate?: number;     // 1.0 = normal, 0.5 = slow, 2.0 = fast
  className?: string;
  style?: React.CSSProperties;
  onError?: (error) => void;
  onTelemetry?: (telemetry) => void;
  enablePerformanceMonitoring?: boolean;  // Show FPS/drift
  enableDebugOverlay?: boolean;           // Show full debug info
}
```

### Usage Example

```jsx
<NativeVideoContainer
  src="/videos/vod_001.mp4"
  vodIndex={0}
  vodId="vod_001"
  globalTime={currentTime}  // From parent
  playbackRate={1.0}
  enablePerformanceMonitoring={true}
  enableDebugOverlay={false}
  onError={(error) => console.error(error)}
/>
```

---

## 🧪 Testing Scenarios

### Quick Test Checklist

- [ ] Load page with native flag enabled
- [ ] First video shows "● Native" indicator
- [ ] Other videos show as HTML5
- [ ] Click play → video starts
- [ ] Click pause → video stops
- [ ] Drag scrubber → video seeks
- [ ] Enable debug mode → shows metrics
- [ ] Disable native flag → falls back to HTML5
- [ ] Check console → no errors

### Run E2E Tests

```bash
npm test -- nativeVideoPlayback.e2e.test.tsx
```

Expected: All 32+ tests pass ✅

---

## 📊 Performance Monitoring

### What Gets Measured

| Metric | Display | Target |
|--------|---------|--------|
| FPS | 60 (60avg) | 59-61 fps |
| Sync Drift | +2ms | ±100ms tolerance |
| Duration | 5:00 | For info |
| VOD Index | #0 | Identifier |

### Where to Look

1. **Performance Overlay** (top-right)
   - Always visible when enabled
   - Shows rolling averages

2. **Debug Overlay** (bottom-left)
   - Toggle with "🔍 Debug" button
   - Shows detailed state

3. **Browser DevTools**
   - Performance tab for true metrics
   - More accurate than overlay

---

## 🛠️ Troubleshooting

### "Native video unavailable"

**Check:**
1. Feature flag enabled? `setNativeVideoEnabled(true)`
2. Running in Electron? (Not in browser)
3. IPC context available? Check preload.ts

**Fix:**
```javascript
// Enable debug to see errors
const [state, controls] = useNativeVideo({
  debug: true,
  onError: (error) => console.error(error)
});
```

### "Video plays as HTML5, not native"

**Check:**
1. Feature flag: `logVideoFeatureFlags()` → enabled?
2. VOD index: Only first video (0) uses native
3. Error occurred? Component falls back automatically

### "Performance metrics wrong"

Remember: Metrics calculated in JavaScript, not from native module.

**For true metrics:**
- Use Chrome DevTools Performance tab
- Use system profiler (Activity Monitor, Task Manager)
- Add native telemetry in Phase 3

### "Sync drift too high (>100ms)"

**Workaround:**
- Reduce system load
- Close other apps
- Known on high-load systems (documented issue)

---

## 📁 File Structure

```
frontend/src/
├── components/
│   ├── NativeVideoContainer.tsx          ← NEW (Phase 2)
│   └── NativeVideoPlayer.tsx             (Phase 1)
│
├── pages/MultiVodComparison/
│   ├── components/
│   │   ├── VodPanelWithNativeSupport.jsx ← NEW (Phase 2)
│   │   └── VideoElement.jsx              (HTML5)
│   └── MultiVodComparison.jsx
│
├── hooks/
│   └── useNativeVideo.ts                 (Phase 1)
│
├── services/
│   └── videoClient.ts                    (Phase 1)
│
├── config/
│   └── videoFeatureFlags.ts              (Phase 1)
│
└── __tests__/
    └── e2e/
        └── nativeVideoPlayback.e2e.test.tsx ← NEW (Phase 2)

Root:
├── PHASE_2_COMPLETION_SUMMARY.md         ← NEW (this phase)
├── PHASE_2_USER_TESTING_CHECKLIST.md     ← NEW (this phase)
├── PHASE_2_KNOWN_ISSUES.md               ← NEW (this phase)
└── PHASE_2_QUICK_REFERENCE.md            ← YOU ARE HERE
```

---

## 🔄 Feature Flag System

### Enable/Disable Native Video

```javascript
// Current status
isNativeVideoEnabled()  // true/false

// Change it
setNativeVideoEnabled(true);   // Enable
setNativeVideoEnabled(false);  // Disable

// View all flags
logVideoFeatureFlags();
// Output:
//   enableNativeVideo: true [localStorage]
//   enableVideoTelemetry: true [hardcoded]
//   enableVideoDebug: false [hardcoded]
//   ...
```

### Environment Setup

```bash
# .env.development or .env.production
VITE_NATIVE_VIDEO_ENABLED=true
VITE_VIDEO_DEBUG_ENABLED=true
VITE_NATIVE_VIDEO_SAMPLE_RATE=100
```

---

## 🔍 Debug Commands

Use in browser console:

```javascript
// Check native availability
getVideoClient().isAvailable()

// View feature flags
logVideoFeatureFlags()

// Enable all debug features
setNativeVideoEnabled(true);
getVideoFeatureFlagManager().setFlag('enableVideoDebug', true);

// Reset to defaults
getVideoFeatureFlagManager().resetToDefaults();
```

---

## 📖 Documentation Map

| Document | Purpose | Length |
|----------|---------|--------|
| **PHASE_2_COMPLETION_SUMMARY.md** | Full overview of everything completed | 25 KB |
| **PHASE_2_USER_TESTING_CHECKLIST.md** | Step-by-step testing guide | 18 KB |
| **PHASE_2_KNOWN_ISSUES.md** | All known issues with workarounds | 24 KB |
| **PHASE_2_QUICK_REFERENCE.md** | This document (quick lookup) | 5 KB |
| **Code comments** | In component files | Inline |

---

## ✅ Pre-Phase 3 Checklist

Before starting Phase 3 (Multi-Video Sync):

- [ ] Phase 2 tests passing
- [ ] Feature flag system working
- [ ] First video plays natively
- [ ] No critical console errors
- [ ] Known issues documented
- [ ] All deliverables reviewed
- [ ] Team aligned on Phase 3 approach

---

## 🎬 What's Next (Phase 3)

**Multi-Video Synchronization** (Days 11-15)

Focus:
1. Add 2nd video native support
2. Implement sync algorithm
3. Achieve ±1 frame accuracy
4. Test multi-video playback
5. Optimize performance

Uses:
- Everything from Phase 2 (working!)
- Native module IPC (proven)
- Feature flag system (tested)
- Performance monitoring (in place)

---

## 💡 Key Insights

### What Works Well
- ✅ Feature flag system flexible & robust
- ✅ Graceful fallback to HTML5
- ✅ Performance monitoring lightweight
- ✅ Component architecture reusable
- ✅ Error handling comprehensive

### What Needs Attention (Phase 3+)
- Sync drift on high-load systems
- Seek accuracy (±2-3 frames vs ±1)
- Cross-platform window rendering
- Memory leak in long sessions

### Best Practices Found
1. Always provide fallback
2. Monitor performance optionally
3. Log errors clearly
4. Test with feature flags
5. Document edge cases

---

## 🚨 Critical Points

⚠️ **DO:**
- Enable feature flag = `true` for testing
- Test with real VOD files
- Check console for errors
- Use debug mode for troubleshooting
- Document any issues found

❌ **DON'T:**
- Leave feature flag on in production (yet)
- Test on systems with >70% CPU load
- Expect perfect sync (±1 frame tolerance)
- Forget to test fallback (disable flag)
- Assume metrics are perfectly accurate

---

## 📞 Support & Escalation

**For Questions:**
1. Check this quick reference
2. Read PHASE_2_COMPLETION_SUMMARY.md
3. Search PHASE_2_KNOWN_ISSUES.md
4. Check code comments in components

**For Issues:**
1. Document in PHASE_2_KNOWN_ISSUES.md
2. Provide workaround
3. Estimate impact
4. Assign to Phase 3 if needed

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-02 | Phase 2 complete, all components delivered |

---

**Quick Reference Version 1.0**  
**Phase 2: Electron Native Video - Single Video Playback**  
**Status: ✅ COMPLETE - Ready for Phase 3**
