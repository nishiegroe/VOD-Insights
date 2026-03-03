# Streaming Performance Testing Guide

## Automated Performance Validation

### Test 1: Verify Chunk Size Configuration
```bash
# Check that 512KB chunks are being used
grep -n "CHUNK_SIZE = " app/multi_vod_api.py app/webui.py

# Expected output:
# app/multi_vod_api.py:X: CHUNK_SIZE = 512 * 1024
# app/webui.py:X: CHUNK_SIZE = 512 * 1024
```

### Test 2: Verify File Buffering
```bash
# Check that OS file buffering is configured
grep -n "buffering=" app/multi_vod_api.py app/webui.py

# Expected output:
# app/multi_vod_api.py:X: with open(file_path, 'rb', buffering=65536)
# app/webui.py:X: with open(file_path, 'rb', buffering=65536)
```

### Test 3: Verify HTTP Headers
```bash
# Check that Cache-Control and Connection headers are set
grep -A2 "Cache-Control\|Connection.*keep-alive" app/multi_vod_api.py

# Expected output:
# response.headers['Cache-Control'] = 'public, max-age=3600'
# response.headers['Connection'] = 'keep-alive'
```

### Test 4: Verify Frontend Preload
```bash
# Check video element has preload and playsinline
grep -n "preload=\|playsinline" frontend/src/pages/MultiVodComparison/components/VideoElement.jsx

# Expected output:
# preload="auto"
# playsinline
```

### Test 5: Verify Sync Configuration
```bash
# Check playback sync is tuned
grep "RESYNC_INTERVAL_MS\|DRIFT_THRESHOLD" frontend/src/pages/MultiVodComparison/hooks/usePlaybackSync.js

# Expected output:
# const DRIFT_THRESHOLD_SECONDS = 0.05; // 50ms
# const RESYNC_INTERVAL_MS = 50; // 50ms
```

## Manual Performance Testing

### Setup
1. Create 3 test VOD files (15-30 seconds each, H.264, 1080p)
2. Place in replay directory configured in app
3. Start the app: `npm run dev` (frontend) and `python app/webui.py` (backend)
4. Navigate to multi-VOD comparison

### Test Scenario 1: Smooth Playback
**Steps:**
1. Load 3 VODs with equal offset (0s)
2. Click Play
3. Watch for 10 seconds
4. Stop and note observations

**Expected Results:**
- Smooth continuous playback (no stuttering)
- 30-60 FPS consistently
- All 3 videos playing in sync
- No CPU spike (should be <15%)

**Pass Criteria:**
✓ Zero frame drops observed
✓ Playback is smooth to the eye
✓ Videos are synchronized within ±50ms

### Test Scenario 2: Seeking Performance
**Steps:**
1. Load 3 VODs
2. Click Play for 5 seconds
3. Pause
4. Scrub to 25% (seek forward)
5. Scrub to 5% (seek backward)
6. Repeat 3 times
7. Note seek responsiveness

**Expected Results:**
- Seek completes in <200ms
- No audio glitches during seek
- Videos jump to correct position
- Resume playback immediately

**Pass Criteria:**
✓ Seek response <200ms
✓ No audio artifacts
✓ Accurate positioning

### Test Scenario 3: Network Bandwidth Limits
**Setup (Chrome DevTools):**
1. Open DevTools (F12)
2. Network tab → Throttling
3. Select "Slow 3G" (1.6 Mbps)

**Steps:**
1. Load 3 VODs on slow network
2. Play for 30 seconds
3. Note: initial buffer time, playback smoothness
4. Perform 2-3 seeks
5. Observe recover time

**Expected Results:**
- Initial buffer: <2 seconds
- Playback: 20-30 FPS acceptable
- Seek: <500ms (acceptable on slow networks)
- No long stalls (>1 second)

**Pass Criteria:**
✓ Starts playing within 2 seconds
✓ Maintains playback without long stalls
✓ Seeks complete within 500ms

### Test Scenario 4: Offset Synchronization
**Steps:**
1. Load 3 VODs with different offsets:
   - VOD 1: 0s offset
   - VOD 2: -5s offset
   - VOD 3: +8s offset
2. Play for 15 seconds
3. Check each scrubber position relative to others

**Expected Results:**
- All videos stay within ±50ms of expected time
- No perceptible drift
- Scrubbers move smoothly together
- Offset visualization is accurate

**Pass Criteria:**
✓ Drift <50ms throughout playback
✓ Smooth scrubber movement
✓ Offsets reflected in timing

### Test Scenario 5: CPU & Memory Monitoring
**Setup (Chrome DevTools):**
1. Open DevTools → Performance tab
2. Open Task Manager (Shift+Esc) in parallel

**Steps:**
1. Start recording in Performance tab
2. Load 3 VODs
3. Play for 30 seconds
4. Perform 5 seeks (scrubbing)
5. Observe Task Manager CPU/Memory
6. Stop recording

**Expected Results (Performance Tab):**
- FPS consistently 30-60
- No frame drops (100% green)
- No long tasks (>50ms)
- Memory increase <50MB after playback starts

**Expected Results (Task Manager):**
- Chrome CPU: 8-15%
- Memory stable (not increasing over time)

**Pass Criteria:**
✓ 60 FPS 95% of the time
✓ <50ms maximum task duration
✓ Memory increases <50MB
✓ CPU <15% sustained

## Performance Benchmarking

### Benchmark 1: Chunk Delivery Speed
**Script** (run in browser console while playing):
```javascript
let chunks = 0;
let bytes = 0;
let lastTime = performance.now();

// Monitor fetch/XHR
const originalFetch = window.fetch;
window.fetch = function(...args) {
  return originalFetch.apply(this, args).then(r => {
    if (args[0].includes('/api/video/stream')) {
      chunks++;
      const size = r.headers.get('content-length');
      bytes += size ? parseInt(size) : 512 * 1024;
    }
    return r;
  });
};

// Run for 10 seconds, then check:
setTimeout(() => {
  const elapsed = (performance.now() - lastTime) / 1000;
  const mbps = (bytes * 8) / 1000000 / elapsed;
  console.log(`Chunks: ${chunks}, MB/s: ${mbps.toFixed(2)}, Chunk Size: ${(bytes/chunks/1024).toFixed(0)}KB`);
}, 10000);
```

**Expected Output:**
```
Chunks: 20, MB/s: 4.2, Chunk Size: 512KB
```

### Benchmark 2: Network Latency Impact
**Compare three scenarios:**

1. **Local network (LAN):**
   - Expected startup: <200ms
   - FPS: 60 (ideal)

2. **Medium latency (100ms):**
   - Expected startup: <1s
   - FPS: 45-60
   - Seek: <300ms

3. **High latency (200ms+):**
   - Expected startup: 1-2s
   - FPS: 30-45
   - Seek: 500-1000ms

## Regression Testing

Run these tests after any changes to streaming code:

### Checklist
- [ ] Chunk size remains 512KB
- [ ] File buffering enabled (65536)
- [ ] HTTP headers include Cache-Control
- [ ] Video preload attribute present
- [ ] Sync interval tuned correctly
- [ ] Drift threshold correct
- [ ] All scenarios pass performance tests
- [ ] No new console errors
- [ ] No memory leaks detected

## Debug Mode

Enable detailed logging:

### Backend
```python
# In app/multi_vod_api.py, add debug logging
import logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Add in stream_chunk():
logger.debug(f"Streaming bytes {start}-{end}, chunk_size={CHUNK_SIZE}")
```

### Frontend
```javascript
// In VideoElement.jsx, add console logging
console.log('Video stream URL:', streamUrl);
console.log('Preload strategy: auto');

// In usePlaybackSync.js
console.debug(`Drift: ${(drift * 1000).toFixed(0)}ms, Threshold: ${(DRIFT_THRESHOLD_SECONDS * 1000).toFixed(0)}ms`);
```

## Reporting Results

When submitting performance test results, include:

1. **Test Environment:**
   - Device (PC/Mac/Mobile)
   - Browser (Chrome/Safari/Firefox)
   - Network (LAN/WiFi/Throttled)
   - VOD file size and codec

2. **Metrics:**
   - FPS average and min
   - Seek response time (average of 5 seeks)
   - Initial buffer time
   - CPU usage peak and average
   - Memory increase

3. **Pass/Fail:**
   - All 5 scenarios completed
   - Any regressions noted
   - Issues encountered

4. **Notes:**
   - Any anomalies observed
   - Chunk size adjustments needed
   - Configuration changes made
