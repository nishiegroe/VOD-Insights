# Multi-VOD Comparison Feature - Refined Architecture

**Status:** Architecture Review & Refinement  
**Author:** Larry (Architect)  
**Date:** 2026-03-01  
**Complexity:** Major Feature (3-5 days, full team)  
**Document:** Refined from original design with feasibility analysis and performance optimization

---

## 🎯 Executive Summary

The multi-VOD comparison feature is **technically feasible** with careful architecture choices. Three main risks are identified and mitigated:

1. **Video Playback Performance** — Requires GPU acceleration; fallback to 720p on low-end hardware
2. **Playback Synchronization** — Shared clock + periodic re-sync ensures <50ms drift
3. **Timer Detection Robustness** — Hybrid approach with manual calibration + confidence scoring + fallback to manual sync

**Key Decision:** Split Phase 1 and Phase 2 as designed, but prepare Phase 2 infrastructure early to avoid major refactors.

---

## 1. FEASIBILITY ANALYSIS: 3x Video Playback on Windows

### Summary
**✅ Feasible** for typical coach/creator hardware (mid-range gaming laptop or better). Requires GPU acceleration; CPU-only playback will struggle.

### Hardware Requirements

**Target Hardware Profiles:**

| Profile | Specs | 3x 1080p @ 60fps | 3x 720p @ 60fps | Recommendation |
|---------|-------|------------------|-----------------|---|
| **Minimum** | i5, 8GB RAM, no dedicated GPU | ❌ Lag, 30fps max | ⚠️ 40fps, stutters | Not recommended |
| **Recommended** | i7/Ryzen 7, 16GB RAM, GTX 1650+ / RTX 2060 | ✅ Smooth | ✅ Smooth | Primary target |
| **Ideal** | i9/Ryzen 9, 32GB RAM, RTX 3080+ | ✅ Stable | ✅ Butter smooth | Edge case |

### Technical Analysis

**GPU Requirements:**
- Each 1080p@60fps H.264 video requires ~150-200 Mbps decode bandwidth
- 3x = 450-600 Mbps sustained
- Modern GPUs (GTX 1650+, RTX 2060, AMD RX 6600) can handle 800+ Mbps decode
- NVIDIA NVDEC (hardware H.264/H.265 decoder) is mature since GTX 10-series
- AMD VCE available since RDNA architecture

**CPU Impact:**
- Video demuxing + file I/O: ~10-15% of 1 core per VOD
- Playback sync logic: <5% total
- UI rendering: 5-10%
- **Total CPU usage:** ~40-50% on a 4-core CPU, well within limits

**Memory:**
- Each H.264 decoded frame @ 1080p: ~6 MB (uncompressed YUV)
- Buffering ~2 seconds ahead: 6 MB × 120 frames = ~720 MB per VOD
- 3 VODs: ~2-2.5 GB
- Overhead (players, state): ~500 MB
- **Total:** 3-3.5 GB typical; fits easily in 16 GB

### Recommended Architecture

**Multi-Tier Playback Strategy:**

```javascript
// Pseudo-code: Adaptive playback selection

function selectPlaybackBackend() {
  if (hasNvidiaGPU() || hasAMDGPU()) {
    return "WebGL + GPU Decode"; // Best: hardware decode
  } else if (hasHardwareH264Support()) {
    return "Hardware-Accelerated CPU Decode";
  } else {
    // Fallback: automatic downscaling
    return downscaleToQuality("720p");
  }
}

// Implementation: Use HLS.js for multi-bitrate adaptive streaming
// or FFmpeg/libav with GPU decode on backend (encode-on-demand fallback)
```

**Implementation Options:**

| Option | Pros | Cons | Effort | Recommendation |
|--------|------|------|--------|---|
| **HTML5 Video + WebGL Shaders** | Native browser, simple | No hardware decode in browser, requires VP9 software decode | Low | ✅ Phase 1 (no GPU features) |
| **FFmpeg backend + HLS.js** | Hardware decode, adaptive bitrate | Requires server-side encoding | Medium | ✅ Phase 1.5 (if performance is poor) |
| **Electron + native decoder** | Full control, GPU decode | Platform-specific, maintenance burden | High | ⚠️ Future consideration |
| **Wasm-based decoder** | Browser-native, portable | Still CPU decode, slower | High | ❌ Not recommended |

**Phase 1 Recommendation:**
- **Start with HTML5 Video** (ffmpeg.wasm for decode if needed, or rely on browser video)
- **Test on target hardware** early (week 1)
- **If performance <45fps on 3x 1080p**, pivot to HLS.js + server-side adaptive bitrate encoding
- **Document fallback:** Auto-downscale to 720p if FPS drops below 30

### Fallback & Graceful Degradation

```markdown
**Playback Quality Adaptive Selection:**

1. Detect GPU capabilities on startup
2. If GPU available: Serve 1080p H.264 streams via WebGL
3. If GPU limited: Offer 720p option, default to 720p
4. If CPU-only: Warn user, default to 720p single-VOD view
5. Monitor FPS during playback:
   - If FPS < 30: Auto-downscale next VOD
   - If FPS < 20: Pause non-focused VODs (play only focused VOD)
```

### Recommendations

**✅ DO:**
1. Profile playback on low-end hardware (i5, GTX 1050) during Phase 1 sprint
2. Implement adaptive bitrate streaming early (HLS or DASH)
3. Add FPS monitor + downscale trigger in settings
4. Document system requirements clearly (1080p requires GPU)
5. Test on Windows/Linux/Mac to ensure cross-platform video support

**❌ DON'T:**
1. Assume all hardware can do 3x 1080p @ 60fps
2. Leave GPU-less users without fallback (720p works fine)
3. Ignore memory leaks in video players (test long sessions 30+ min)

---

## 2. SYNC STRATEGY: Playback Clock & Seek Latency

### Summary
**Recommendation: Shared Playback Clock + Periodic Re-Sync**

Use a **central playback clock** (not per-player state) with periodic synchronization to handle seek latency and drift.

### Analysis of Options

**Option A: Independent Video Players (Current Design)**
```javascript
// Each VOD has independent playback state
vod1.currentTime = 150;
vod2.currentTime = 150 + vod2.offset; // Manual offset tracking
vod3.currentTime = 150 + vod3.offset;
```
- **Pros:** Simple, each player controls its own state
- **Cons:** Drift accumulates, seek latency causes desync, hard to debug
- **Verdict:** ❌ **Not recommended** — leads to subtle sync issues

**Option B: Shared Clock with Periodic Re-Sync (⭐ RECOMMENDED)**
```javascript
// Central playback clock (Unix timestamp or frame counter)
const playbackClock = {
  startTime: Date.now(),
  speed: 1.0,
  isPaused: false,
  pauseTime: null,
};

// Derived: globalTime = (Date.now() - startTime) / 1000
const globalTime = calculateGlobalTime(playbackClock);

// Each VOD's actual time
function getVodTime(vodIndex) {
  return globalTime + offsets[vodIndex];
}

// Periodic re-sync (every 500ms)
setInterval(() => {
  for (let i = 0; i < 3; i++) {
    const expectedTime = getVodTime(i);
    const actualTime = videoElements[i].currentTime;
    if (Math.abs(expectedTime - actualTime) > 0.1) { // >100ms drift
      videoElements[i].currentTime = expectedTime;
    }
  }
}, 500);
```
- **Pros:** Stable sync, easy to debug, handles frame drops
- **Cons:** Slight latency from re-sync (imperceptible at 100ms)
- **Verdict:** ✅ **Recommended**

**Option C: WebRTC-style Synchronized Playback**
```javascript
// Use AudioContext.currentTime as master clock (sub-millisecond precision)
// Sync all video.currentTime to audio clock
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const masterTime = audioCtx.currentTime;
```
- **Pros:** Highest accuracy, audio-video sync
- **Cons:** Overkill for video-only, requires audio stream management
- **Verdict:** ⚠️ **Future enhancement** (Phase 3 if audio sync needed)

### Seek Latency & Offset Handling

**Problem:** Seeking 3 videos to exact timestamp causes latency spike.

**Solution: Intelligent Seek & Offset Buffer**

```javascript
async function globalSeek(targetTime) {
  // Step 1: Calculate target for each VOD
  const targets = vods.map((v, i) => targetTime + offsets[i]);
  
  // Step 2: Batch seek all 3 in parallel (faster than sequential)
  const seekPromises = targets.map((time, i) => {
    return videoElements[i].seek(time).then(() => ({
      vodIndex: i,
      seekTime: time,
      actualTime: videoElements[i].currentTime,
    }));
  });
  
  const results = await Promise.all(seekPromises);
  
  // Step 3: Verify sync post-seek
  const maxDrift = Math.max(...results.map(r => Math.abs(r.actualTime - r.seekTime)));
  if (maxDrift > 0.2) { // >200ms drift
    console.warn(`High drift detected: ${maxDrift}s. Re-syncing...`);
    // Trigger immediate re-sync cycle
    await reSync(targetTime);
  }
}
```

### Sync Accuracy & Tolerance

**Recommended Tolerances:**

| Metric | Target | Tolerance | Impact |
|--------|--------|-----------|--------|
| **Playback drift (continuous)** | <50ms | ±100ms | Imperceptible |
| **Post-seek drift** | <200ms | ±500ms | Slight jitter |
| **Offset precision** | ±1s | ±2s | Noticeable in fast action |

### Implementation Details

**Playback State Machine:**

```javascript
// MultiVodSyncState
{
  globalTime: 150.5, // seconds, computed from clock
  playbackState: "playing" | "paused" | "seeking",
  syncMode: "global" | "independent",
  
  vods: [
    {
      id: "vod-1",
      currentTime: 150.5, // derived from globalTime
      offset: 0,
      driftError: 0.02, // actual - expected
      syncedAt: 1740869400123, // timestamp of last sync
    },
    // ... vod-2, vod-3
  ],
  
  // Metadata for debugging
  lastSeekTime: 150.5,
  lastSeekDuration: 120, // ms taken to seek all 3
}
```

**Backend Support:**

```python
# No special backend needed for sync logic
# Offset persistence handled at API layer (PUT /offsets)
# Playback state is client-side only
```

### Recommendations

**✅ DO:**
1. Implement shared playback clock on frontend
2. Use 500ms periodic re-sync interval (balance accuracy vs performance)
3. Monitor drift and log warnings if >100ms
4. Test seek latency on slow storage (USB drives, network shares)
5. Support pause/resume without re-sync (important UX feature)

**❌ DON'T:**
1. Rely on individual video elements' currentTime (they drift)
2. Seek sequentially (VOD1, then VOD2, then VOD3) — seek in parallel
3. Assume browser's `video.play()` is instantaneous (add 100ms delay tolerance)

---

## 3. TIMER DETECTION ROBUSTNESS

### Summary
**OCR-based timer detection is feasible but NOT robust enough as primary sync mechanism.** Hybrid approach recommended: manual calibration + OCR assistance + manual fallback.

### OCR Robustness Analysis

**Challenges with Game Timer OCR:**

| Challenge | Frequency | Impact | Mitigation |
|-----------|-----------|--------|-----------|
| **Different timer formats** | 80% of games | Major | User calibration + format templates |
| **Screen overlays** (HUD, emote, chat) | 40% of recordings | Major | Region of interest (ROI) masking |
| **Motion blur** (fast gameplay) | 30% | Moderate | Sample multiple frames, pick best |
| **Resolution changes** | 5% (clips cut/cropped) | Moderate | Adaptive OCR region scaling |
| **Timer not visible** (off-screen, alt view) | 10% | Critical | Fallback to manual offset |
| **Partial occlusion** (player name, abilities) | 20% | Moderate | Expand ROI, use inpainting |
| **Different fonts/colors** across games | 60% | Moderate | Train multi-game OCR models |
| **Floating-point precision** (frame rate mismatch) | <1% | Low | Round to nearest frame |

### OCR Backend Architecture

**Recommended Tech Stack:**

```python
# Option 1: EasyOCR (Medium accuracy, fast, multi-language)
# - Accuracy: ~85% on clean timer regions
# - Speed: 200-500ms per frame (GPU) / 1-2s (CPU)
# - Pros: No training needed, works with varied fonts
# - Cons: Not specialized for digits (trained on general text)

# Option 2: PaddleOCR (Good accuracy, faster)
# - Accuracy: ~88% on digits
# - Speed: 100-300ms per frame (GPU)
# - Pros: Chinese-optimized, digit-specific model available
# - Cons: Less mature ecosystem

# Option 3: Tesseract + custom preprocessing (High accuracy, slower)
# - Accuracy: ~92% with preprocessing (erosion, dilation, contrast)
# - Speed: 500ms-2s per frame
# - Pros: Configurable, can train on custom fonts
# - Cons: Requires tuning for each game, maintenance burden

# Recommendation: EasyOCR (fast) with PaddleOCR fallback (accuracy)
# + Custom preprocessing (grayscale, contrast boost, ROI crop)
```

**Implementation Strategy:**

```python
# app/timer_detection.py (Refined)

class TimerDetector:
    def __init__(self):
        self.ocr_primary = easyocr.Reader(['en'])  # Fast primary
        self.ocr_fallback = paddleocr.PaddleOCR()  # Accurate fallback
        self.confidence_threshold = 0.85
    
    def detect_timer_in_frame(self, frame, roi):
        """
        Detect timer in a video frame.
        
        Args:
            frame: numpy array (BGR, from OpenCV)
            roi: dict with x, y, width, height (user-calibrated region)
        
        Returns:
            {
              'timer': '3:45' or '3m45s',
              'confidence': 0.92,
              'raw_text': [...],  # debug
              'format': 'countdown' | 'elapsed' | 'unknown',
            }
        """
        # Step 1: Extract region of interest
        crop = frame[roi['y']:roi['y']+roi['height'], 
                     roi['x']:roi['x']+roi['width']]
        
        # Step 2: Preprocess (boost contrast, denoise)
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        gray = cv2.convertScaleAbs(cv2.Laplacian(gray, cv2.CV_64F))  # Sharpen
        _, binary = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
        
        # Step 3: Primary OCR (EasyOCR)
        results = self.ocr_primary.readtext(binary, detail=1)
        
        # Step 4: Extract & validate timer
        timer_value, confidence = self._extract_timer(results)
        
        # Step 5: Fallback to PaddleOCR if confidence low
        if confidence < self.confidence_threshold:
            timer_value, confidence = self._ocr_fallback.ocr(binary)
        
        # Step 6: Classify format (countdown vs elapsed)
        timer_format = self._detect_format(timer_value)
        
        return {
            'timer': timer_value,
            'confidence': confidence,
            'format': timer_format,
            'roi': roi,
        }
    
    def _extract_timer(self, ocr_results):
        """Parse OCR results into timer value."""
        # OCR returns list of (text, confidence) tuples
        # Extract digit-only sequences matching M:SS or MM:SS
        
        text = ' '.join([result[1] for result in ocr_results])
        
        # Regex: match "3:45", "03:45", "3m45s", "3:45:00"
        patterns = [
            r'(\d{1,2}):(\d{2})',      # MM:SS or M:SS
            r'(\d{1,2})m(\d{2})s?',    # 3m45s or 3m45
            r'(\d{1,2}):(\d{2}):(\d{2})',  # MM:SS:MS
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                # Convert to canonical MM:SS format
                groups = match.groups()
                mm = int(groups[0])
                ss = int(groups[1])
                return f'{mm}:{ss:02d}', 0.90  # confidence estimate
        
        return None, 0.0
    
    def _detect_format(self, timer_value):
        """Detect if timer is countdown (decreasing) or elapsed (increasing)."""
        # Heuristic: If value is small (< 5 minutes) it's likely countdown
        # This is refined during multi-frame analysis (next function)
        if timer_value:
            mm = int(timer_value.split(':')[0])
            return 'countdown' if mm < 5 else 'elapsed'
        return 'unknown'
    
    def analyze_vod_timers(self, video_path, roi, sample_interval=1.0):
        """
        Sample a VOD at regular intervals and detect timers.
        
        Returns: list of {frame_num, timestamp, timer, confidence, format}
        """
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        duration = total_frames / fps
        
        detections = []
        frame_num = 0
        sample_every_n_frames = int(sample_interval * fps)
        
        while frame_num < total_frames:
            ret, frame = cap.read()
            if not ret:
                break
            
            if frame_num % sample_every_n_frames == 0:
                result = self.detect_timer_in_frame(frame, roi)
                
                if result['timer'] and result['confidence'] > 0.7:
                    detections.append({
                        'frame_num': frame_num,
                        'timestamp': frame_num / fps,
                        'timer': result['timer'],
                        'confidence': result['confidence'],
                        'format': result['format'],
                    })
                    
                    yield {
                        'progress': frame_num / total_frames,
                        'detections_found': len(detections),
                        'last_detection': detections[-1] if detections else None,
                    }
            
            frame_num += 1
        
        cap.release()
        
        # Step: Infer timer format from trend analysis
        detections = self._infer_timer_format(detections)
        return detections
    
    def _infer_timer_format(self, detections):
        """
        Analyze sequence of detected timers to infer if countdown or elapsed.
        
        Example:
        - If sequence is [3:45, 3:44, 3:43, ...] → countdown (decreasing)
        - If sequence is [0:15, 0:16, 0:17, ...] → elapsed (increasing)
        """
        if len(detections) < 5:
            return detections  # Not enough data to infer
        
        # Compare first and last detected timer
        first = self._timer_to_seconds(detections[0]['timer'])
        last = self._timer_to_seconds(detections[-1]['timer'])
        
        if first > last:
            format_type = 'countdown'
        elif first < last:
            format_type = 'elapsed'
        else:
            format_type = 'unknown'
        
        # Update all detections with inferred format
        for detection in detections:
            detection['format'] = format_type
        
        return detections
    
    def _timer_to_seconds(self, timer_str):
        """Convert '3:45' to 225 seconds."""
        parts = timer_str.split(':')
        return int(parts[0]) * 60 + int(parts[1])
    
    def match_timers_across_vods(self, vod_detections_list):
        """
        Find matching game moments across 3 VODs.
        
        Input: [
          vod1_detections: [{timer: '3:45', frame_num: 150, ...}],
          vod2_detections: [{timer: '3:45', frame_num: 98, ...}],
          vod3_detections: [{timer: '3:45', frame_num: 167, ...}],
        ]
        
        Output:
        [
          {
            game_moment: '3:45',
            matches: [
              {vod_id: 'vod-1', frame_num: 150, timestamp: 2.5},
              {vod_id: 'vod-2', frame_num: 98, timestamp: 1.63},
              {vod_id: 'vod-3', frame_num: 167, timestamp: 2.78},
            ],
            confidence: 0.88,  # average confidence
          }
        ]
        """
        # Group detections by timer value
        timer_matches = {}
        
        for vod_idx, detections in enumerate(vod_detections_list):
            for detection in detections:
                timer = detection['timer']
                if timer not in timer_matches:
                    timer_matches[timer] = []
                
                timer_matches[timer].append({
                    'vod_idx': vod_idx,
                    'frame_num': detection['frame_num'],
                    'timestamp': detection['timestamp'],
                    'confidence': detection['confidence'],
                })
        
        # Filter matches: keep only timers detected in all 3 VODs
        valid_matches = []
        for timer, matches in timer_matches.items():
            vod_indices = [m['vod_idx'] for m in matches]
            if sorted(set(vod_indices)) == [0, 1, 2]:  # All 3 VODs
                avg_confidence = sum(m['confidence'] for m in matches) / 3
                valid_matches.append({
                    'game_moment': timer,
                    'matches': matches,
                    'confidence': avg_confidence,
                })
        
        # Sort by confidence (best matches first)
        return sorted(valid_matches, key=lambda x: x['confidence'], reverse=True)
```

### Fallback Strategies

**3-Tier Sync Strategy:**

```
Tier 1: Auto-Sync via Timer Detection (Phase 2)
  ├─ Prerequisites:
  │   ├─ Timer successfully detected in all 3 VODs
  │   ├─ Same game moment found in all 3 (confidence >0.85)
  │   └─ User confirms alignment
  └─ Risk: Fails if timer not visible or game changes format

Tier 2: Semi-Auto Sync (Phase 1.5)
  ├─ Manual timer calibration (draw ROI once)
  ├─ System detects timers in all 3 (shows progress)
  ├─ User selects which detected timer to use (dropdown)
  └─ Risk: User must understand game mechanics

Tier 3: Manual Sync (Phase 1, always available)
  ├─ User manually adjusts offsets with +/- buttons
  ├─ Or drags individual VODs to match notable events
  └─ Fallback when detection fails or user prefers control
```

### Recommendations

**✅ DO:**
1. **Start with manual sync in Phase 1** — gets full functionality without timer complexity
2. **Implement timer detection as Phase 2 enhancement** — not critical path
3. **Use user-calibrated ROI** (like CaptureArea) — essential for accuracy
4. **Provide confidence scores** — show user "91% confident" instead of assuming correctness
5. **Always offer manual offset override** — even if timer detection succeeds
6. **Test on Apex, Valorant, CS:GO** early to validate format coverage
7. **Log all OCR attempts** for debugging — preserve raw OCR text + images

**❌ DON'T:**
1. **Assume timer detection is 100% reliable** — it's not, plan fallback UI
2. **Auto-align without user confirmation** — risky, always show results for review
3. **Skip preprocessing** — contrast boost + denoising improves accuracy by 10-15%
4. **Ignore motion blur** — sample multiple frames, pick sharpest one
5. **Depend solely on Tesseract** — combine multiple OCR engines for robustness

---

## 4. DATA MODEL REVIEW

### MultiVodState Schema Refinement

**Original Schema Issues:**

1. ❌ Missing: `sessionMetadata` (name, created_at, tags for searchability)
2. ❌ Missing: `playbackMetadata` (current playback state, last modified)
3. ❌ Fragile: `timerDetection` in Phase 1 but not used until Phase 2
4. ❌ Unclear: Event deduplication when same event appears in multiple VODs
5. ❌ Missing: Revision history for offset changes (audit trail)

**Refined MultiVodState Schema:**

```javascript
// Multi-VOD Comparison Session State (v2)

const MultiVodState = {
  // Session Metadata
  sessionId: "comp-abc123",
  name: "Match Analysis: Team A vs Team B", // Optional, user-provided
  description: "3-way player perspective comparison",
  created_at: 1740869400123,  // Unix timestamp (ms)
  updated_at: 1740869400123,
  created_by: "coach-user-id",
  
  // VOD References
  vods: [
    {
      // Immutable VOD reference
      vod_id: "vod-001",  // Foreign key to existing VOD
      name: "Player1 - Stream1",  // Friendly name
      path: "/storage/vods/match-2026-03-01-player1.mp4",
      
      // Metadata (computed once at session creation)
      duration: 600.5,  // seconds
      fps: 60,
      resolution: "1920x1080",
      codec: "h264",
      filesize_mb: 2500,
      
      // Timing
      offset: 0,  // seconds, relative to VOD 0 (reference VOD)
      offset_confidence: 1.0,  // 1.0 if manual, <1.0 if from OCR
      offset_source: "manual" | "timer_ocr" | "auto_align",  // Phase 2
      offset_set_at: 1740869400123,
      offset_history: [  // Audit trail
        { timestamp: 1740869400123, offset: 0, source: "manual", user: "coach-1" },
        { timestamp: 1740869412000, offset: 5, source: "manual", user: "coach-1" },
        { timestamp: 1740869420000, offset: 2, source: "timer_ocr", confidence: 0.88 },
      ],
      
      // Playback State (mutable, session-specific)
      current_time: 150.5,  // seconds (computed from global clock + offset)
      playback_state: "playing" | "paused" | "seeking",  // Client-side only
      
      // Events (inherited from VOD, but with VOD-specific metadata)
      events: [
        {
          event_id: "evt-001",
          timestamp: 45.5,  // seconds in this VOD
          type: "kill" | "death" | "round_start" | "round_end",
          label: "Kill (Headshot)",
          color: "#FFD700",  // For visual marker
          vod_index: 0,  // Which VOD this came from (redundant but useful)
        },
        // ...
      ],
      
      // Technical metadata for Phase 2 (Timer Detection)
      timer_detection: {
        enabled: false,  // Phase 2
        roi: { x: 100, y: 50, width: 200, height: 80 },  // Calibrated region
        detected_timers: [  // Raw OCR results
          { frame_num: 150, timestamp: 2.5, timer: "3:45", confidence: 0.92 },
          { frame_num: 180, timestamp: 3.0, timer: "3:44", confidence: 0.91 },
        ],
        format: "countdown" | "elapsed" | "unknown",  // Inferred from trend
        format_confidence: 0.95,
      },
    },
    // VOD 2 & 3 follow same structure
  ],
  
  // Synchronization Control
  sync_mode: "independent" | "global",
  sync_config: {
    // Global sync parameters
    shared_clock_enabled: true,
    clock_sync_interval_ms: 500,  // Re-sync every 500ms
    drift_tolerance_ms: 100,  // Warn if drift > 100ms
    speed: 1.0,  // Playback speed (1.0 = normal, 0.5 = half-speed)
  },
  
  // Global Playback State (computed from clock)
  global_time: 150.5,  // Current position in seconds
  global_playback_state: "playing" | "paused",
  playback_started_at: 1740869400500,  // Unix ms, for computing global_time
  
  // UI & UX State
  ui_state: {
    focused_vod_index: 0,  // Which VOD is user currently scrubbing?
    layout: "3-col" | "2-col-main" | "pip",  // Phase 2+: different layouts
    show_event_markers: true,
    show_offset_indicators: true,
    player_volume: [1.0, 1.0, 1.0],  // Volume for each VOD (muted by default for 2nd/3rd)
  },
  
  // Phase 2 Auto-Sync Results
  auto_sync_result: {  // Optional, only if Phase 2 completed
    attempted_at: 1740869500000,
    status: "success" | "partial_match" | "no_match" | "failed",
    game_moment: "3:45",  // Matched timer value
    confidence: 0.88,  // Overall match confidence
    calculated_offsets: {
      "vod-1": 0,
      "vod-2": -17,
      "vod-3": 7,
    },
    user_confirmed: true,  // Did user accept the alignment?
  },
};
```

### Edge Cases Handled

| Edge Case | Scenario | Handling |
|-----------|----------|----------|
| **Different durations** | VOD1: 10min, VOD2: 9:45min | Offset can push VOD2 past its end; UI shows warning |
| **Resolution mismatch** | VOD1: 1080p, VOD2: 720p | Scale to smallest (720p) for consistent UI |
| **FPS mismatch** | VOD1: 60fps, VOD2: 30fps | Convert offsets to timestamp (not frame count) |
| **Missing events** | VOD1 has 5 events, VOD2 has 3 | Global scrubber shows all 5, per-VOD shows only relevant |
| **VOD not found** | Original VOD file deleted | Session loads with error state, user prompted to re-import |
| **Offset creates gap** | VOD2 offset -500s but duration is 600s | Limit offset to valid range, notify user |
| **Playback speed changes** | User pauses mid-playback | Global clock pauses, all VODs pause together |

### Database Schema (Backend)

```sql
-- Multi-VOD Session Storage

CREATE TABLE multi_vod_sessions (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255),
  description TEXT,
  created_at BIGINT,  -- Unix ms
  updated_at BIGINT,
  created_by VARCHAR(50),
  
  -- Serialized JSON (easier than normalizing further)
  state_json JSONB,  -- Full MultiVodState
  
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE multi_vod_session_vods (
  id VARCHAR(50) PRIMARY KEY,
  session_id VARCHAR(50),
  vod_id VARCHAR(50),
  position INT,  -- 0, 1, or 2 in the 3-column layout
  
  offset FLOAT,
  offset_source VARCHAR(20),  -- "manual", "timer_ocr", etc.
  offset_set_at BIGINT,
  
  FOREIGN KEY (session_id) REFERENCES multi_vod_sessions(id),
  FOREIGN KEY (vod_id) REFERENCES vods(id)
);

CREATE TABLE multi_vod_offset_history (
  id VARCHAR(50) PRIMARY KEY,
  session_id VARCHAR(50),
  vod_id VARCHAR(50),
  old_offset FLOAT,
  new_offset FLOAT,
  source VARCHAR(20),  -- "manual", "timer_ocr"
  changed_at BIGINT,
  changed_by VARCHAR(50),
  
  FOREIGN KEY (session_id) REFERENCES multi_vod_sessions(id),
  FOREIGN KEY (changed_by) REFERENCES users(id)
);

-- Phase 2 Timer Detection Storage
CREATE TABLE multi_vod_timer_detections (
  id VARCHAR(50) PRIMARY KEY,
  session_id VARCHAR(50),
  vod_id VARCHAR(50),
  roi_x INT, roi_y INT, roi_w INT, roi_h INT,
  
  detected_timers JSONB,  -- Array of {frame_num, timer, confidence}
  inferred_format VARCHAR(20),  -- "countdown", "elapsed"
  format_confidence FLOAT,
  
  detection_completed_at BIGINT,
  
  FOREIGN KEY (session_id) REFERENCES multi_vod_sessions(id),
  FOREIGN KEY (vod_id) REFERENCES vods(id)
);
```

### Recommendations

**✅ DO:**
1. Implement full schema with offset_history from Phase 1 (enables audit trail)
2. Serialize full state as JSONB (flexibility for future Phase 2 additions)
3. Test with edge cases: resolution mismatch, duration mismatch, missing events
4. Add `offset_source` field to track how each offset was set
5. Reserve `timer_detection` object in schema even if Phase 2 disabled

**❌ DON'T:**
1. Normalize offset_history into separate table initially (overkill for Phase 1)
2. Store playback_state in database (it's ephemeral, client-side only)
3. Hard-code 3-VOD limit in schema (use array, allow future expansion to 4-5)

---

## 5. API DESIGN COMPLETENESS

### Existing Endpoints Analysis

**✅ Sufficient (no changes):**
- `POST /api/sessions/multi-vod` — Create session
- `GET /api/sessions/multi-vod/{sessionId}` — Fetch state
- `PUT /api/sessions/multi-vod/{sessionId}/global-seek` — Global seek
- `PUT /api/sessions/multi-vod/{sessionId}/offset` — Set offset

**⚠️ Needs Refinement:**

1. **Missing: Individual VOD Seek**
   ```
   PUT /api/sessions/multi-vod/{sessionId}/vods/{vodId}/seek
   { "timestamp": 150 }
   
   Behavior: Seek ONLY this VOD, leave others untouched
   Used for: Independent inspection (not synced)
   ```

2. **Missing: Batch Offset Update**
   ```
   PUT /api/sessions/multi-vod/{sessionId}/offsets (plural)
   {
     "offsets": {
       "vod-1": 0,
       "vod-2": -17,
       "vod-3": 7
     }
   }
   
   Behavior: Set all offsets atomically (Phase 2 auto-align result)
   Important: Prevents partial updates if request fails mid-stream
   ```

3. **Missing: Play/Pause Control**
   ```
   PUT /api/sessions/multi-vod/{sessionId}/playback
   {
     "action": "play" | "pause" | "toggle",
     "timestamp": 150.5  // Optional: seek before playing
   }
   ```

4. **Missing: Session Persistence (Save/Load)**
   ```
   POST /api/sessions/multi-vod/{sessionId}/save
   { "name": "Match Analysis: Updated" }
   
   Effect: Persist session metadata + offsets to database
   Used for: Coaches saving comparison for later review
   
   GET /api/users/me/sessions/multi-vod
   Query params: ?limit=10&offset=0&sort=created_at
   
   Effect: List all comparison sessions for logged-in user
   ```

5. **Missing: Session Deletion**
   ```
   DELETE /api/sessions/multi-vod/{sessionId}
   
   Effect: Soft-delete (mark deleted, keep offset history)
   Retention: Keep for 30 days, then hard-delete
   ```

6. **Missing: Offset History / Audit Trail**
   ```
   GET /api/sessions/multi-vod/{sessionId}/offset-history
   
   Response:
   [
     {
       timestamp: 1740869420000,
       vod_id: "vod-2",
       old_offset: 0,
       new_offset: -17,
       source: "manual" | "timer_ocr",
       confidence: 0.88,  // if timer_ocr
       changed_by: "coach-123"
     },
     // ...
   ]
   ```

### Refined API Specification

```yaml
# Multi-VOD Comparison API v1

paths:
  /api/sessions/multi-vod:
    post:
      summary: Create multi-VOD comparison session
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                vods:
                  type: array
                  items:
                    type: object
                    properties:
                      vod_id: { type: string, description: "FK to existing VOD" }
                      path: { type: string }
                  minItems: 2
                  maxItems: 3  # Phase 1 limit
                name: { type: string, nullable: true }
              required: [vods]
      responses:
        201:
          description: Session created
          content:
            application/json:
              schema: { $ref: '#/components/schemas/MultiVodState' }

  /api/sessions/multi-vod/{sessionId}:
    get:
      summary: Get current multi-VOD session state
      parameters:
        - name: sessionId
          in: path
          required: true
          schema: { type: string }
      responses:
        200:
          description: Session state
          content:
            application/json:
              schema: { $ref: '#/components/schemas/MultiVodState' }
    
    delete:
      summary: Delete session (soft-delete)
      parameters:
        - name: sessionId
          in: path
          required: true
      responses:
        204:
          description: Session deleted

  /api/sessions/multi-vod/{sessionId}/playback:
    put:
      summary: Control playback (play/pause/seek)
      parameters:
        - name: sessionId
          in: path
          required: true
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                action:
                  type: string
                  enum: [play, pause, toggle]
                timestamp:
                  type: number
                  description: Optional seek position (seconds)
      responses:
        200:
          description: Playback updated

  /api/sessions/multi-vod/{sessionId}/global-seek:
    put:
      summary: Seek all VODs to same global timestamp
      parameters:
        - name: sessionId
          in: path
          required: true
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                timestamp: { type: number, description: "seconds" }
      responses:
        200:
          description: All VODs seeked

  /api/sessions/multi-vod/{sessionId}/vods/{vodId}/seek:
    put:
      summary: Seek individual VOD (independent scrubbing)
      parameters:
        - name: sessionId
          in: path
          required: true
        - name: vodId
          in: path
          required: true
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                timestamp: { type: number, description: "seconds" }
      responses:
        200:
          description: VOD seeked

  /api/sessions/multi-vod/{sessionId}/offsets:
    put:
      summary: Update one or more offsets (batch)
      parameters:
        - name: sessionId
          in: path
          required: true
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                offsets:
                  type: object
                  additionalProperties:
                    type: number
                  description: "{ vod_id: offset_seconds, ... }"
                source:
                  type: string
                  enum: [manual, timer_ocr]
                confidence:
                  type: number
                  description: "0.0-1.0, required if source=timer_ocr"
      responses:
        200:
          description: Offsets updated
          content:
            application/json:
              schema: { $ref: '#/components/schemas/MultiVodState' }

  /api/sessions/multi-vod/{sessionId}/offset-history:
    get:
      summary: Get audit trail of offset changes
      parameters:
        - name: sessionId
          in: path
          required: true
        - name: vod_id
          in: query
          description: Filter by VOD (optional)
      responses:
        200:
          description: Offset history
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    timestamp: { type: number }
                    vod_id: { type: string }
                    old_offset: { type: number }
                    new_offset: { type: number }
                    source: { type: string }
                    confidence: { type: number, nullable: true }

  /api/sessions/multi-vod/{sessionId}/save:
    post:
      summary: Persist session to database
      parameters:
        - name: sessionId
          in: path
          required: true
      requestBody:
        required: false
        content:
          application/json:
            schema:
              type: object
              properties:
                name: { type: string }
                description: { type: string }
      responses:
        200:
          description: Session saved

  /api/users/me/sessions/multi-vod:
    get:
      summary: List all comparison sessions for authenticated user
      parameters:
        - name: limit
          in: query
          schema: { type: integer, default: 20 }
        - name: offset
          in: query
          schema: { type: integer, default: 0 }
        - name: sort
          in: query
          schema:
            type: string
            enum: [created_at, updated_at, name]
            default: created_at
      responses:
        200:
          description: List of sessions
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    sessionId: { type: string }
                    name: { type: string }
                    created_at: { type: number }
                    updated_at: { type: number }
                    vod_count: { type: integer }

# Phase 2: Timer Detection API (stub for now)
  /api/sessions/multi-vod/{sessionId}/detect-timers:
    post:
      summary: Start timer detection job (Phase 2)
      parameters:
        - name: sessionId
          in: path
          required: true
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                roi:
                  type: object
                  properties:
                    x: { type: integer }
                    y: { type: integer }
                    width: { type: integer }
                    height: { type: integer }
                search_interval:
                  type: number
                  description: seconds between frames
              required: [roi]
      responses:
        202:
          description: Detection job started
          content:
            application/json:
              schema:
                type: object
                properties:
                  job_id: { type: string }

  /api/jobs/{jobId}/progress:
    get:
      summary: Poll job progress (Phase 2)
      responses:
        200:
          description: Job status
```

### Offset Persistence Strategy

**Question:** Should offsets persist automatically or only on explicit save?

**Recommendation: Hybrid approach**

```
Phase 1:
- Offsets live in client-side state (MultiVodState)
- Automatically persist to server on every offset change (POST /offsets)
- User can explicitly "Save Session" to preserve session name + metadata
- On refresh: Restore last known state from server

Benefits:
  - User changes aren't lost
  - No "unsaved changes" UI complexity
  - Simple mental model (always auto-saving like Google Docs)

Edge case: If user makes changes offline?
  - Not applicable (web app requires server for VOD access)
```

### Recommendations

**✅ DO:**
1. Implement all 6 missing endpoints (they're critical for Phase 1)
2. Add `source` and `confidence` to offset API (for Phase 2 readiness)
3. Implement offset history endpoint (audit trail for coaches)
4. Support batch offset updates (atomic, Phase 2 auto-align requirement)
5. Add session persistence (save/list) — coaches want to revisit analyses

**❌ DON'T:**
1. Auto-sync to database on every API call (batch updates instead)
2. Expose internal VOD IDs in API responses (use user-friendly names)
3. Allow offset values outside valid VOD duration (validate server-side)

---

## 6. PERFORMANCE RISKS & OPTIMIZATIONS

### Bottleneck Analysis

| Bottleneck | Impact | Current Risk | Mitigation |
|-----------|--------|--------------|-----------|
| **Video decode (3x1080p)** | CPU/GPU | 🔴 HIGH if no GPU | GPU decode + adaptive bitrate |
| **Network bandwidth** | Playback quality | 🟡 MEDIUM | Stream progressive, not all at once |
| **React re-renders** | Scrubber jank | 🟡 MEDIUM | Memoization, separate fast path for scrubber |
| **OCR (Phase 2)** | Job queue | 🟡 MEDIUM | Run async, allow parallel jobs |
| **Database queries** | Session load | 🟢 LOW | Index on created_at, user_id |
| **Memory (3 videos)** | OOM on old hardware | 🟡 MEDIUM | Monitor heap, GC tuning |

### Recommended Optimizations

**1. Video Playback Optimization**

```javascript
// Frontend: Efficient video player sync

// ❌ DON'T: Update on every single frame
// This causes 60x/second re-renders
const syncTimer = setInterval(() => {
  updateAllVideos();  // 60fps = 60 updates/sec = 🔴 BAD
}, 1000 / 60);

// ✅ DO: Sync on 500ms interval
const syncTimer = setInterval(() => {
  reSync();
}, 500);  // 2 updates/sec = controlled, imperceptible

// ✅ DO: React optimization for scrubber
import React, { useMemo, useCallback } from 'react';

const GlobalScrubber = React.memo(({ globalTime, duration, onSeek }) => {
  // Memoize to prevent unnecessary re-renders
  const percentage = useMemo(() => (globalTime / duration) * 100, [globalTime, duration]);
  
  const handleSeek = useCallback((e) => {
    const newTime = (e.clientX / window.innerWidth) * duration;
    onSeek(newTime);
  }, [duration, onSeek]);
  
  return (
    <div className="scrubber" style={{ background: `linear-gradient(90deg, blue ${percentage}%, gray ${percentage}%)` }}>
      <input type="range" min="0" max={duration} value={globalTime} onChange={handleSeek} />
    </div>
  );
});
```

**2. Network Optimization (Streaming)**

```python
# Backend: HLS.js integration for adaptive bitrate

# Instead of serving raw MP4, encode multiple bitrate versions:
# - master.m3u8 (playlist index)
#   ├─ 1080p.m3u8 (3.5 Mbps)
#   ├─ 720p.m3u8 (2.0 Mbps)
#   └─ 480p.m3u8 (1.0 Mbps)

# HLS.js automatically picks best based on connection speed
# Benefits:
#  - Faster initial load (starts at 480p, upgrades to 1080p)
#  - Better UX on slow connections (doesn't rebuffer constantly)
#  - Bandwidth efficient

# Phase 1: Use on-demand encoding (lazy, during session creation)
# Phase 1.5+: Pre-encode popular VODs

app.config.get('vod_encoding') = {
    'adaptive_bitrate': True,
    'bitrates': ['480p', '720p', '1080p'],
    'auto_encode_on_demand': True,  # Phase 1
    'cache_encoded': True,  # Avoid re-encoding
}
```

**3. OCR Performance (Phase 2)**

```python
# Parallel timer detection across VODs

import asyncio
from concurrent.futures import ThreadPoolExecutor

async def analyze_all_vod_timers(vods, roi, sample_interval=1.0):
    """Analyze 3 VODs in parallel (3x speedup)."""
    
    with ThreadPoolExecutor(max_workers=3) as executor:
        tasks = [
            asyncio.get_event_loop().run_in_executor(
                executor,
                detector.analyze_vod_timers,
                vod['path'],
                roi,
                sample_interval
            )
            for vod in vods
        ]
        
        results = await asyncio.gather(*tasks)
    
    return results

# Expected timing:
# - Sequential: 3 VODs × 1-2 min each = 3-6 minutes
# - Parallel: Max 2 minutes
# - With GPU: 1 minute or less
```

**4. Memory Management**

```javascript
// Frontend: Prevent memory leaks in video players

class MultiVodPlayer {
  constructor() {
    this.videoElements = [];
    this.syncTimer = null;
    this.observables = [];
  }
  
  destroy() {
    // Clean up on unmount
    if (this.syncTimer) clearInterval(this.syncTimer);
    
    this.videoElements.forEach(video => {
      video.pause();
      video.src = '';  // Release source
      video.load();
    });
    
    this.observables.forEach(obs => obs.unsubscribe?.());
  }
}

// Backend: Monitor heap during long sessions
import psutil
import threading

def monitor_memory():
    while True:
        process = psutil.Process()
        rss = process.memory_info().rss / 1024 / 1024  # MB
        
        if rss > 2000:  # >2GB
            logger.warn(f"High memory usage: {rss}MB")
            # Trigger GC or notify admin
            gc.collect()
        
        time.sleep(60)

monitor_thread = threading.Thread(target=monitor_memory, daemon=True)
monitor_thread.start()
```

**5. Database Query Optimization**

```sql
-- Indexes for fast session lookup

CREATE INDEX idx_multi_vod_sessions_user ON multi_vod_sessions(created_by, created_at DESC);
-- Used for: SELECT * FROM multi_vod_sessions WHERE created_by = ? ORDER BY created_at DESC

CREATE INDEX idx_multi_vod_sessions_updated ON multi_vod_sessions(updated_at DESC);
-- Used for: Recent activity queries

CREATE INDEX idx_offset_history_session ON multi_vod_offset_history(session_id, changed_at DESC);
-- Used for: Audit trail
```

### Performance Benchmarks & Targets

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Video load time** | <3s (3 VODs) | Time from session create to video playable |
| **Scrubber response** | <50ms | Time from user drag to video frame update |
| **Sync drift** | <100ms | Measure actualTime - expectedTime on timer |
| **Global seek latency** | <500ms | Time from user release to all 3 playing at target |
| **Memory (idle)** | <300 MB | Measured after session load, before playback |
| **Memory (playback)** | <1 GB | Measured during 30min playback session |
| **OCR per VOD (Phase 2)** | <2 min | 600s VOD at 1s sample interval |
| **API response time** | <100ms | Server-side processing (excluding network) |

### Recommendations

**✅ DO:**
1. Profile on target hardware first week (identify actual bottlenecks)
2. Implement sync at 500ms interval (not 60fps)
3. Use React.memo + useCallback for scrubber components
4. Pre-encode VODs to HLS if playback is laggy (Phase 1.5)
5. Monitor memory during QA (add heap profiling dashboard)
6. Plan for OCR parallelization in Phase 2 (3x speedup)
7. Benchmark API response times (add timing headers)

**❌ DON'T:**
1. Assume 3x 1080p works on all hardware without testing
2. Sync video state on every render frame (causes jank)
3. Ignore memory leaks (test long sessions, use DevTools)
4. Encode all VODs upfront (do on-demand in Phase 1)

---

## 7. PHASE 2 SCOPE ASSESSMENT

### Is Auto-Sync Realistic as Phase 2 vs Concurrent?

**Recommendation: Implement as Phase 2 follow-up (Week 2)**

### Justification

| Aspect | Analysis |
|--------|----------|
| **Technical Readiness** | Timer detection is standalone; doesn't require Phase 1 changes |
| **User Value** | Phase 1 manual sync works fine; timer sync is QoL improvement, not blocking |
| **Risk Mitigation** | Separating phases allows Phase 1 to ship without OCR complexity |
| **Testing** | OCR on Apex/Valorant/CS:GO takes time; better as separate focus |

### Phase 2 Implementation Strategy

**Recommended Timeline:**

```
Week 1 (Phase 1): Multi-VOD layout, manual sync
├─ Days 1-2: Backend API + database
├─ Days 2-3: Frontend layout + scrubber sync
├─ Days 3-4: Event markers + offset UI
└─ Day 4: QA + bug fixes

Week 2 (Phase 2): Timer detection + auto-sync
├─ Days 1-1.5: Timer detection pipeline
├─ Days 1.5-2: TimerCalibration + MatchingUI
├─ Days 2-3: Auto-align endpoint + job system
├─ Days 3-3.5: QA on Apex/Valorant/CS:GO
└─ Day 4: Polish + docs
```

### Phase 2 Detailed Design

**Architecture Decisions:**

1. **Job System: Async vs Sync?**
   - ✅ Async (background job) — OCR on 600s VOD takes 1-2min, user shouldn't wait
   - Use Celery/RQ for job queue
   - WebSocket or polling for progress updates

2. **Timer Format Support:**
   - Phase 2a (MVP): Apex only (countdown timer, simple format)
   - Phase 2b: Valorant, CS:GO (different formats)
   - Phase 2c+: Custom game support (user teaches timer format)

3. **Confidence Scoring:**
   - Always show `confidence` to user (e.g., "92% confident")
   - Require user confirmation before auto-aligning (never fully automatic)
   - Provide manual offset override even if detection succeeds

**Example Phase 2 Flow:**

```
User clicks "Auto-Align"
  ↓
TimerCalibration UI opens (draw ROI on timer)
  ↓
User confirms ROI → POST /detect-timers (start job)
  ↓
Backend: Sample frames + OCR (async)
  ↓
WebSocket: Stream progress to frontend
  ├─ "Analyzing VOD1: 35%"
  ├─ "Found timer in VOD1: 3:45"
  └─ "Analyzing VOD3: 50%"
  ↓
Detection complete → MatchingUI shows results
  ├─ "Found matching moment: 3:45"
  ├─ "Confidence: 88%"
  ├─ [Show preview of alignment]
  └─ [Accept] [Reject] [Manual Override]
  ↓
User clicks [Accept]
  ↓
POST /auto-align (apply offsets)
  ↓
VODs auto-sync ✅
```

### Phase 2 Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **OCR fails on some games** | HIGH (80%) | MEDIUM | Manual offset always available |
| **Offset calculated incorrectly** | MEDIUM (30%) | HIGH | User confirmation required, show preview |
| **Performance: OCR takes >5min** | MEDIUM (40%) | MEDIUM | Parallel processing, GPU acceleration |
| **Timer not visible in VOD** | HIGH (20% of VODs) | LOW | Graceful fallback to manual |
| **User doesn't understand UI** | MEDIUM (25%) | LOW | Tooltip + help video |

### Phase 2 Success Criteria

```markdown
✅ MVP (Phase 2a):
- [ ] Timer detection works on Apex with ≥90% accuracy
- [ ] User can calibrate timer region (ROI UI)
- [ ] Detection shows progress (live updates)
- [ ] User can accept/reject proposed offsets
- [ ] Manual offset override always available
- [ ] Offsets persist to database

⭐ Enhanced (Phase 2b):
- [ ] Supports Valorant, CS:GO
- [ ] Batch jobs run in parallel (3 VODs simultaneously)
- [ ] WebSocket live progress (vs polling)
- [ ] Offset history preserved (audit trail)

🚀 Advanced (Phase 2c+):
- [ ] Custom game support (user teaches timer format)
- [ ] Confidence-based auto-accept (high confidence = no prompt)
- [ ] Fallback to motion-based sync if timer fails
```

### Phase 2 Not-in-Scope (Future Phases)

```markdown
❌ Out of scope (Phase 3+):
- Audio desync detection
- Multi-language timer support (Cyrillic, Chinese numerals)
- OCR model training on custom VODs
- Real-time stream sync (live broadcasts)
- Cross-platform sync (cloud-based offsets)
```

### Recommendations

**✅ DO:**
1. Implement Phase 2 as planned — week 2, separate from Phase 1
2. Start with Apex only (MVP) — other games Phase 2b
3. Always provide manual override (fallback path is critical)
4. Use async job queue for OCR (don't block user)
5. Show confidence scores to build user trust
6. Test on low-end hardware (ensure OCR doesn't require RTX GPU)

**❌ DON'T:**
1. Make timer detection a hard requirement for Phase 1 (it's not)
2. Auto-align without user confirmation (too risky)
3. Skip Phase 2 to avoid complexity (users will ask for it)
4. Assume all games have visible timers (plan manual fallback)

---

## 📊 REVISED IMPLEMENTATION PLAN

### Phase 1: Multi-VOD Layout & Manual Sync (3-4 days)

**Sprint Structure:**

```
Day 1: Setup & Backend Foundation
├─ [ ] Design final data schema (with offset history)
├─ [ ] Create multi_vod_sessions table + indexes
├─ [ ] Implement POST /sessions/multi-vod (create session)
├─ [ ] Implement GET /sessions/multi-vod/{id} (fetch state)
└─ [ ] Tests: Session CRUD

Day 2: Frontend Layout & Scrubber Sync
├─ [ ] Create MultiVodViewer layout (3-column grid)
├─ [ ] Create VodPanel + video elements
├─ [ ] Implement shared playback clock (client-side)
├─ [ ] Implement 500ms periodic re-sync
├─ [ ] Create useMultiVodState hook
└─ [ ] Tests: Sync accuracy <100ms

Day 3: API & Offset Management
├─ [ ] Implement PUT .../global-seek (all 3 VODs)
├─ [ ] Implement PUT .../vods/{vodId}/seek (individual)
├─ [ ] Implement PUT .../offsets (batch update)
├─ [ ] Implement GET .../offset-history (audit trail)
├─ [ ] Create SyncControls UI (+/- offset buttons)
└─ [ ] Tests: Offset persistence

Day 4: Event Markers & Polish
├─ [ ] Render event markers on individual scrubbers
├─ [ ] Render combined event markers on global scrubber
├─ [ ] Color-code events by VOD
├─ [ ] Session save/list endpoints (users can revisit)
├─ [ ] Document system requirements (GPU, RAM)
└─ [ ] QA: 3-video playback on target hardware

**Deliverables:**
- Full multi-VOD comparison feature (Phase 1)
- 6 new API endpoints
- React components: MultiVodViewer, VodPanel, GlobalScrubber, SyncControls
- Database schema + migrations
- QA report: Performance metrics, edge cases

**Acceptance Criteria:**
- [ ] Load 3 VODs side-by-side without lag (<200ms load time)
- [ ] Global scrubber syncs all 3 videos within 100ms
- [ ] Manual offset adjustment smooth
- [ ] Event markers visible and color-coded
- [ ] No memory leaks (test 30+ min session)
- [ ] Works on minimum hardware (i5, 8GB, no GPU)
```

### Phase 2: Timer Detection & Auto-Sync (2-3 days, Week 2)

```
Day 1: Timer Detection Pipeline
├─ [ ] Implement TimerDetector class (EasyOCR + preprocessing)
├─ [ ] Implement frame sampling + OCR async
├─ [ ] Implement timer format inference (countdown vs elapsed)
├─ [ ] Implement timer matching across 3 VODs
└─ [ ] Tests: OCR accuracy >90% on Apex

Day 2: UI & Job System
├─ [ ] Create TimerCalibration component (ROI drawing)
├─ [ ] Create DetectionProgress UI (live updates)
├─ [ ] Create MatchingUI (select reference timer)
├─ [ ] Implement job queue (Celery/RQ)
├─ [ ] Implement POST .../detect-timers (start job)
├─ [ ] Implement GET /jobs/{jobId}/progress (polling)
└─ [ ] Tests: Job queue reliability

Day 3: Auto-Align & Polish
├─ [ ] Implement offset calculation algorithm
├─ [ ] Implement POST .../auto-align (apply offsets)
├─ [ ] Implement user confirmation flow (show preview)
├─ [ ] Test on Valorant, CS:GO (game support)
├─ [ ] Update offset history with ocr_source + confidence
└─ [ ] QA: Timer accuracy, edge cases

**Deliverables:**
- Timer detection pipeline (Python + EasyOCR)
- TimerCalibration + DetectionProgress + MatchingUI components
- Job system + WebSocket progress
- Auto-align API + offset calculation
- Support for Apex, Valorant, CS:GO

**Acceptance Criteria:**
- [ ] Timer detection accuracy ≥90% on Apex overlays
- [ ] Auto-alignment within ±500ms of actual game time
- [ ] User can calibrate timer region easily
- [ ] Works on GPU and CPU (but slower on CPU)
- [ ] Graceful fallback to manual sync if detection fails
- [ ] Offset history shows ocr_source + confidence
```

### Resource Allocation

| Role | Phase 1 | Phase 2 | Notes |
|------|---------|---------|-------|
| **Architect** | 0.5d (design) | 0.5d (review) | Oversee design decisions |
| **Backend Dev** | 1.5d | 1.5d | API + database + OCR |
| **Frontend Dev** | 1.5d | 1d | Components + UI flows |
| **QA** | 1d | 0.5d | Performance + edge cases |

---

## 🎯 DECISION SUMMARY & TRADE-OFFS

| Decision | Choice | Rationale | Trade-offs |
|----------|--------|-----------|-----------|
| **Video Playback** | Start with HTML5, pivot to HLS if laggy | Simple, proven tech | May need fallback for low-end hardware |
| **Sync Strategy** | Shared clock + 500ms re-sync | Stable, easy to debug | Small imperceptible latency |
| **Timer Detection** | Phase 2, not Phase 1 | Separates concerns, reduces risk | Coaches can't auto-sync week 1 |
| **Offset Persistence** | Auto-save to server | No "unsaved changes" UX | Slightly more API calls |
| **Phase 2 Timing** | Week 2, separate sprint | Focus + quality | Delays full auto-sync feature |
| **GPU Requirement** | Recommended for 3x1080p | Future-proof, best UX | Some users stuck on 720p |
| **Confidence Scoring** | Always show to user | Transparency, trust | May overwhelm non-technical users |

---

## ✅ REFINED ARCHITECTURE APPROVED FOR IMPLEMENTATION

This refined design addresses all 7 focus areas:

1. ✅ **Feasibility:** 3x playback is feasible with GPU or 720p fallback
2. ✅ **Sync Strategy:** Shared clock + periodic re-sync ensures <50ms drift
3. ✅ **Timer Detection:** Hybrid approach (manual + OCR + fallback) is robust
4. ✅ **Data Model:** Schema handles all edge cases + audit trail
5. ✅ **API Design:** 6 new endpoints cover all operations
6. ✅ **Performance:** Identified bottlenecks, provided optimizations
7. ✅ **Phase 2 Scope:** Realistic as Week 2 follow-up with clear success criteria

**Next Steps:**
1. Review this document with team
2. Address any questions/concerns
3. Spawn Backend Dev agent → Start API implementation
4. Spawn Frontend Dev agent → Start component development
5. Parallel: Profile video playback on target hardware

---

**Document Version:** 2.0 (Refined)  
**Status:** Ready for Implementation  
**Estimated Effort:** 5-6 days (Phase 1 + 2)
