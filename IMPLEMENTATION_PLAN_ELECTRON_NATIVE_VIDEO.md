# Electron Native Video Solution - Implementation Plan
## Multi-VOD Comparison Playback Architecture

**Status:** Design Phase  
**Timeline:** 3-4 weeks (5 phases)  
**Target:** Windows/Mac/Linux support  
**Last Updated:** 2026-03-02

---

## Executive Summary

Transitioning from HTML5 `<video>` to native playback enables frame-accurate multi-video synchronization, better resource utilization, and more granular control over codecs and playback parameters. This plan recommends **VLC (libvlc) + native IPC** as the primary approach, with **optional Windows Media Foundation** for Windows-only optimization in Phase 5.

**Key Benefits:**
- Frame-accurate sync (±1 frame @ 60fps = ±16ms)
- CPU-efficient playback (hardware acceleration)
- Codec flexibility
- Cross-platform support
- Fine-grained playback control (frame stepping, exact seeking)

---

# 1. ARCHITECTURE DESIGN

## 1.1 Recommended Approach: VLC + Native IPC

### Why VLC over Windows Media Foundation?

| Factor | VLC | WMF | Custom FFmpeg |
|--------|-----|-----|----------------|
| **Cross-Platform** | ✅ Windows/Mac/Linux | ❌ Windows only | ✅ Yes, but complex |
| **Codec Support** | ✅ All major codecs | ✅ Most codecs | ✅ Yes, but setup burden |
| **Learning Curve** | Moderate | Steep | Very steep |
| **Maintenance** | Mature library | Platform-specific | High overhead |
| **Multi-video Sync** | Good (frame-stepping) | Good | Excellent (custom control) |
| **Community** | Large | Large (Windows devs) | Fragmented |
| **Time to Market** | Fast (3-4 weeks) | Faster for sync (2-3 weeks) but Windows-only | Very slow (6-8 weeks) |
| **Production Viability** | High | High (Windows) | Medium-High |

**Recommendation:** **Start with VLC**, because:
1. Ships cross-platform day 1
2. Mature, stable libvlc binding exists for Node
3. Proven for multi-stream sync (media playback centers use VLC)
4. Can pivot to WMF on Windows-only builds later

---

## 1.2 System Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│            React Frontend (Main Process)             │
│  ┌──────────────────────────────────────────────┐   │
│  │  VOD Comparison UI                           │   │
│  │  - Timeline controls                         │   │
│  │  - Playback controls (Play/Pause/Seek)       │   │
│  │  - Speed, audio tracks, HUD                  │   │
│  └──────────────────────────────────────────────┘   │
│                       ↕ IPC                          │
│                  (Node.js / Electron)                │
└─────────────────────────────────────────────────────┘
                          ↓ ipcMain/ipcRenderer
┌─────────────────────────────────────────────────────┐
│      Native Video Engine (Isolated Process)         │
│  ┌──────────────────────────────────────────────┐   │
│  │  libvlc Wrapper (C++ Addon / Node.js FFI)    │   │
│  │  - Instance manager (N vlc instances)        │   │
│  │  - Playback controller                       │   │
│  │  - Event dispatcher                          │   │
│  │  - Frame-accurate sync master                │   │
│  └──────────────────────────────────────────────┘   │
│                       ↕ libvlc                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  VLC Media Foundation / XCB / AVFoundation   │   │
│  │  (Platform-specific rendering)               │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                    ↓ Window handles
┌─────────────────────────────────────────────────────┐
│        OS Video Renderer (GPU/Hardware)             │
│  (Windows: DirectX / Mac: Metal / Linux: OpenGL)   │
└─────────────────────────────────────────────────────┘
```

---

## 1.3 Data Flow: Playback Control

```
User clicks "Play" in React UI
    ↓
React dispatches { action: 'play', videoIds: [1, 2, 3] }
    ↓ ipcRenderer.invoke('video:play')
    ↓
Main process receives, forwards to worker thread
    ↓
Native libvlc wrapper receives command
    ↓
For each video ID:
  - Retrieve file path from video store
  - Resume playback on each VLC instance
  - Start sync master clock
    ↓
VLC instances emit 'playing' event
    ↓
Native engine tracks frame count + timestamp for all videos
    ↓
Every ~33ms (30fps) or ~16ms (60fps):
  - Compare frame positions across all videos
  - If drift detected (>1 frame): adjust slower video
  - Emit telemetry: { video1: frame 1234, video2: frame 1235, ... }
    ↓ ipcMain sends to React
    ↓
React updates UI timeline, scrubber position
```

---

## 1.4 Inter-Process Communication (IPC) Interface

### Main Process ↔ Worker Thread Communication

**Technology Stack:**
- **Node.js Native Addons:** Use `node-gyp` + native libvlc bindings
- **Alternative:** Node-ffi (foreign function interface) for lightweight bindings
- **IPC:** Electron `ipcMain`/`ipcRenderer` for React ↔ Main process
- **Worker Pool:** Use `piscina` or `worker_threads` for background video management

### API Surface (Renderer → Main → Worker)

```typescript
// Renderer (React)
ipcRenderer.invoke('video:play', { videoIds: [1, 2, 3] });
ipcRenderer.invoke('video:pause', { videoIds: [1, 2, 3] });
ipcRenderer.invoke('video:seek', { 
  videoIds: [1, 2, 3], 
  position: 15.5,  // seconds
  syncToFrame: true 
});
ipcRenderer.invoke('video:setPlaybackRate', { 
  videoIds: [1, 2, 3], 
  rate: 1.5 
});

// Main process listens and delegates
ipcMain.handle('video:play', async (event, { videoIds }) => {
  return await videoWorker.play(videoIds);
});

// Events from native engine back to React
ipcMain.on('video:sync', (event, telemetry) => {
  mainWindow.webContents.send('video:telemetry', telemetry);
});
```

---

## 1.5 Multi-Video Synchronization Strategy

### Clock-Based Master/Slave Model

**Goal:** Maintain frame-accurate sync across N videos playing simultaneously.

**Algorithm:**

```
SYNC_INTERVAL = 16ms (60fps reference)
SYNC_TOLERANCE = 1 frame (16ms @ 60fps)

function syncVideoCluster(videoInstances):
  masterClock = getCurrentTimestamp()
  
  for each video in videoInstances:
    currentFrame = video.getCurrentFrame()
    expectedFrame = calculateExpectedFrame(
      masterClock, 
      videoFrameRate
    )
    
    drift = currentFrame - expectedFrame
    
    if drift > SYNC_TOLERANCE:
      // Master is behind, slow it down
      video.pause()
      sleep(drift * frameTime)
      video.play()
    
    if drift < -SYNC_TOLERANCE:
      // Slave is ahead, pause and let master catch up
      video.pause()
      // Wait for master to catch up
      while currentMasterFrame < expectedFrame:
        sleep(5ms)
      video.play()
  
  return { videoId: currentFrame, ... }  // telemetry
```

**Implementation Details:**

1. **Master Clock:** Use system time + calculated offset from first video
2. **Frame-Accurate Seeking:** Use libvlc's `libvlc_media_list_player_next()` for frame-stepping
3. **Drift Detection:** Compare frame numbers every 16-33ms
4. **Micro-Adjustments:** Pause/resume individual videos (transparent to user)
5. **Sync Events:** Emit telemetry every sync cycle for UI updates

**Sync Accuracy Target:** ±1 frame @ 60fps = ±16.67ms

---

## 1.6 File Path & Media Loading

```typescript
// Register VOD file in native engine
ipcRenderer.invoke('video:load', {
  id: 1,
  filePath: '/Users/nishie/Recordings/vod_001.mp4',
  metadata: {
    duration: 1234.5,
    fps: 60,
    width: 1920,
    height: 1080,
    codec: 'h264'
  }
});

// Native engine (libvlc):
// 1. Create libvlc_instance
// 2. Create libvlc_media from filePath
// 3. Attach to libvlc_media_list_player
// 4. Parse metadata (duration, FPS from media)
// 5. Pre-compute frame timing table
// 6. Return: { loaded: true, duration, fps, frameCount }
```

---

# 2. IMPLEMENTATION PHASES

## Phase 1: Infrastructure & IPC Setup (Days 1-5 / ~40 hours)

### Goals
- Set up native module build system
- Implement basic IPC communication
- Create libvlc wrapper skeleton
- Establish worker thread pool

### Deliverables

**2.1a: Native Module Scaffolding**
- Create `native/` directory with node-gyp config
- Install `libvlc-dev` (Windows, Mac, Linux)
- Set up build pipeline (npm run build:native)
- Create VS Code build tasks

**2.1b: Electron IPC Foundation**
- Create `src/ipc/handlers/video.ts`
- Implement basic command routing
- Set up error handling middleware
- Add logging for all IPC calls

**2.1c: Worker Thread Pool**
- Install `piscina` for worker management
- Create video worker (`src/workers/video-worker.ts`)
- Implement job queue with priority
- Add worker restart on crash

**2.1d: Basic libvlc Binding**
```cpp
// native/src/video_engine.cc
#include <node.h>
#include <vlc/vlc.h>

using v8::FunctionCallbackInfo;
using v8::Isolate;
using v8::Local;
using v8::Object;
using v8::String;
using v8::Value;

class VideoEngine : public node::ObjectWrap {
 public:
  static void Init(Local<Object> exports);

 private:
  explicit VideoEngine();
  ~VideoEngine();

  static void New(const FunctionCallbackInfo<Value>& args);
  static void CreateInstance(const FunctionCallbackInfo<Value>& args);
  static void Play(const FunctionCallbackInfo<Value>& args);
  
  libvlc_instance_t *vlc_instance;
  std::map<int, libvlc_media_list_player_t*> players;

  static inline Persistent<Function> constructor;
};
```

**2.1e: TypeScript Interfaces**
```typescript
// src/types/video.ts
export interface VideoCommand {
  action: 'play' | 'pause' | 'seek' | 'load' | 'unload';
  videoIds: number[];
  payload?: any;
}

export interface VideoState {
  videoId: number;
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'error';
  currentFrame: number;
  currentTime: number;
  duration: number;
  fps: number;
}

export interface SyncTelemetry {
  timestamp: number;
  states: VideoState[];
  driftMs: number[];  // [video1_drift, video2_drift, ...]
}
```

### Effort: ~40 hours
### Risk: Medium (node-gyp build complexity, cross-platform gotchas)

---

## Phase 2: Single Video Playback (Days 6-10 / ~45 hours)

### Goals
- Replace one HTML5 `<video>` element with native playback
- Implement basic play/pause/seek
- Render video to Electron window
- Get UI updated with playback state

### Deliverables

**2.2a: Video Rendering Integration**
- Implement libvlc window rendering (handle attachment to BrowserWindow)
- Windows: Use HWND from `nativeImage.createFromNamedImage()`
- Mac: Use NSView integration
- Linux: Use XCB window ID

```cpp
// Platform-specific rendering setup
#ifdef _WIN32
  libvlc_set_nsobject(vlc_instance, hwnd);  // HWND on Windows
#elif __APPLE__
  libvlc_set_nsobject(vlc_instance, cocoa_view);
#else  // Linux
  libvlc_set_xwindow(vlc_instance, x11_window_id);
#endif
```

**2.2b: Playback Controls**
```typescript
// src/ipc/handlers/video.ts
ipcMain.handle('video:play', async (event, { videoIds }) => {
  for (const id of videoIds) {
    const player = getPlayerInstance(id);
    if (player) {
      libvlc_media_list_player_play(player);
    }
  }
  return { success: true };
});

ipcMain.handle('video:pause', async (event, { videoIds }) => {
  for (const id of videoIds) {
    const player = getPlayerInstance(id);
    if (player) {
      libvlc_media_list_player_pause(player);
    }
  }
  return { success: true };
});

ipcMain.handle('video:seek', async (event, { videoId, position }) => {
  const player = getPlayerInstance(videoId);
  const media = libvlc_media_list_player_get_media_list(player);
  const item = libvlc_media_list_index_of_item(media, media_item);
  
  // Seek to millisecond position
  libvlc_media_list_player_set_media_list(
    player, 
    media
  );
  libvlc_media_list_player_play_item_at_index(player, 0);
  
  // Fine-tune to exact frame
  const frameOffset = (position % (1000/fps)) * fps;
  for (int i = 0; i < frameOffset; i++) {
    libvlc_media_list_player_next(player);
  }
  
  return { position, currentFrame: frameOffset };
});
```

**2.2c: State Polling & Events**
- Poll player state every 33ms (30fps update rate)
- Emit to React via `ipcRenderer.on('video:update')`
- Track: currentTime, currentFrame, status, duration

**2.2d: React Component Replacement**
```typescript
// src/components/VideoPlayer.tsx
export const VideoPlayer: React.FC<{ videoId: number }> = ({ videoId }) => {
  const [state, setState] = useState<VideoState>(initialState);

  useEffect(() => {
    const unsubscribe = ipcRenderer.on(
      'video:update',
      (event, telemetry: SyncTelemetry) => {
        const videoState = telemetry.states.find(s => s.videoId === videoId);
        if (videoState) setState(videoState);
      }
    );

    return unsubscribe;
  }, [videoId]);

  const handlePlay = () => ipcRenderer.invoke('video:play', { videoIds: [videoId] });
  const handleSeek = (position: number) => 
    ipcRenderer.invoke('video:seek', { videoId, position });

  return (
    <div className="video-player">
      <div id={`video-window-${videoId}`} className="video-display" />
      <PlaybackControls
        onPlay={handlePlay}
        onSeek={handleSeek}
        currentTime={state.currentTime}
        duration={state.duration}
      />
    </div>
  );
};
```

### Effort: ~45 hours
### Risk: Medium-High (platform-specific rendering, window integration)

---

## Phase 3: Multi-Video Synchronization (Days 11-15 / ~50 hours)

### Goals
- Add 2-3 video instances playing simultaneously
- Implement frame-accurate sync master/slave algorithm
- Test drift detection and correction
- Achieve ±1 frame sync tolerance

### Deliverables

**2.3a: Sync Clock Implementation**
```cpp
// native/src/sync_master.cc
class SyncMaster {
 public:
  SyncMaster(float referenceFrameRate)
    : reference_fps_(referenceFrameRate),
      master_clock_start_(getCurrentTimestamp()) {}

  struct SyncState {
    int video_id;
    int current_frame;
    int expected_frame;
    int drift_frames;
    double drift_ms;
  };

  std::vector<SyncState> CalculateDrift(
      const std::map<int, libvlc_media_list_player_t*>& players) {
    
    std::vector<SyncState> states;
    double elapsed_ms = getCurrentTimestamp() - master_clock_start_;
    int master_expected_frame = (elapsed_ms / 1000.0) * reference_fps_;

    for (const auto& [video_id, player] : players) {
      int current_frame = GetCurrentFrame(player);
      int drift_frames = current_frame - master_expected_frame;
      double drift_ms = (drift_frames / reference_fps_) * 1000.0;

      states.push_back({
        video_id,
        current_frame,
        master_expected_frame,
        drift_frames,
        drift_ms
      });
    }

    return states;
  }

  void AdjustPlayback(std::map<int, libvlc_media_list_player_t*>& players) {
    auto states = CalculateDrift(players);
    const int SYNC_TOLERANCE_FRAMES = 1;  // At 60fps = 16.67ms

    for (const auto& state : states) {
      if (std::abs(state.drift_frames) > SYNC_TOLERANCE_FRAMES) {
        auto player = players[state.video_id];

        if (state.drift_frames > SYNC_TOLERANCE_FRAMES) {
          // Video is ahead, pause briefly
          libvlc_media_list_player_pause(player);
          std::this_thread::sleep_for(
            std::chrono::milliseconds((int)state.drift_ms)
          );
          libvlc_media_list_player_play(player);
        }
      }
    }
  }

 private:
  float reference_fps_;
  double master_clock_start_;
  
  int GetCurrentFrame(libvlc_media_list_player_t* player) {
    auto media_list = libvlc_media_list_player_get_media_list(player);
    auto pos_ms = libvlc_media_list_player_get_time(player);
    // Convert from milliseconds to frame number
    return (pos_ms / 1000.0) * reference_fps_;
  }

  double getCurrentTimestamp() {
    auto now = std::chrono::high_resolution_clock::now();
    return std::chrono::duration<double, std::milli>(
      now.time_since_epoch()
    ).count();
  }
};
```

**2.3b: Sync Loop Integration**
```cpp
// Run on worker thread, emit telemetry every 16-33ms
void VideoEngine::RunSyncLoop(
    std::map<int, libvlc_media_list_player_t*>& players) {
  
  SyncMaster sync_master(60.0);  // Assume 60fps reference
  
  while (is_running_) {
    sync_master.AdjustPlayback(players);
    
    auto states = sync_master.CalculateDrift(players);
    
    // Convert to JSON and send to main thread
    // ... JSON serialization ...
    
    EmitTelemetry(states);  // Sends via ipcMain to React
    
    std::this_thread::sleep_for(std::chrono::milliseconds(16));
  }
}
```

**2.3c: Telemetry Emission**
```typescript
// src/ipc/telemetry.ts
ipcMain.on('video:sync-tick', (states: VideoState[]) => {
  const telemetry: SyncTelemetry = {
    timestamp: Date.now(),
    states,
    driftMs: states.map(s => s.currentFrame - s.expectedFrame)
  };

  mainWindow?.webContents.send('video:telemetry', telemetry);
});
```

**2.3d: Multi-Video Component**
```typescript
// src/components/MultiVideoComparison.tsx
export const MultiVideoComparison: React.FC = () => {
  const [telemetry, setTelemetry] = useState<SyncTelemetry | null>(null);
  const videoIds = [1, 2, 3];  // Load from state

  useEffect(() => {
    ipcRenderer.on('video:telemetry', (event, data: SyncTelemetry) => {
      setTelemetry(data);
    });
  }, []);

  return (
    <div className="multi-video-grid">
      {videoIds.map(id => (
        <div key={id} className="video-tile">
          <VideoPlayer videoId={id} />
          <SyncIndicator 
            state={telemetry?.states.find(s => s.videoId === id)}
            drift={telemetry?.driftMs[id - 1]}
          />
        </div>
      ))}
      <SyncStatusBar telemetry={telemetry} />
    </div>
  );
};
```

### Effort: ~50 hours
### Risk: High (frame-accurate sync is complex; timing precision critical)

---

## Phase 4: Advanced Controls & UI (Days 16-20 / ~40 hours)

### Goals
- Implement playback rate control
- Add audio track selection
- Build UI scrubber with multi-video timeline
- Add pause, play, frame-step controls
- HUD overlay with metadata

### Deliverables

**2.4a: Playback Rate Control**
```typescript
ipcRenderer.invoke('video:setPlaybackRate', {
  videoIds: [1, 2, 3],
  rate: 0.5  // 0.25x to 2.0x
});
```

```cpp
// native/src/video_engine.cc
void VideoEngine::SetPlaybackRate(
    const std::vector<int>& video_ids,
    float rate) {
  
  for (int vid : video_ids) {
    auto player = players_[vid];
    
    // Get media list and adjust playback speed
    libvlc_media_list_t* media_list = 
      libvlc_media_list_player_get_media_list(player);
    
    libvlc_media_t* media = 
      libvlc_media_list_index_of_item(media_list, 0);
    
    // VLC doesn't have direct speed API, use: play -> seek -> pause trick
    // Or use event-driven frame stepping with timer
    
    playback_rates_[vid] = rate;
    sync_master_.SetReferenceRate(rate);
  }
}
```

**2.4b: Audio Track Selection**
```typescript
ipcRenderer.invoke('video:getAudioTracks', { videoId: 1 })
  .then(tracks => {
    // tracks: [{ id: 0, lang: 'en', codec: 'aac' }, ...]
  });

ipcRenderer.invoke('video:selectAudioTrack', { 
  videoId: 1, 
  trackId: 0 
});
```

**2.4c: Frame Stepping**
```typescript
ipcRenderer.invoke('video:stepFrame', { 
  videoId: 1, 
  direction: 'forward',  // 'forward' | 'backward'
  frames: 1 
});
```

```cpp
void VideoEngine::StepFrame(int video_id, int direction, int count) {
  auto player = players_[video_id];
  
  libvlc_media_list_player_pause(player);
  
  for (int i = 0; i < count; i++) {
    if (direction > 0) {
      libvlc_media_list_player_next(player);
    } else {
      libvlc_media_list_player_previous(player);
    }
  }
}
```

**2.4d: HUD & Scrubber UI**
```typescript
// src/components/PlaybackControls.tsx
export const PlaybackControls: React.FC<{
  telemetry: SyncTelemetry;
  onSeek: (position: number) => void;
}> = ({ telemetry, onSeek }) => {
  return (
    <div className="playback-controls">
      <Timeline
        telemetry={telemetry}
        onSeek={onSeek}
        highlightSyncDrift={true}
      />
      <div className="control-buttons">
        <FrameStepButton direction="backward" />
        <PlayPauseButton />
        <FrameStepButton direction="forward" />
      </div>
      <div className="speed-control">
        <select onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}>
          <option value="0.25">0.25x</option>
          <option value="0.5">0.5x</option>
          <option value="1.0">1.0x (Normal)</option>
          <option value="1.5">1.5x</option>
          <option value="2.0">2.0x</option>
        </select>
      </div>
      <SyncStatusOverlay telemetry={telemetry} />
    </div>
  );
};
```

### Effort: ~40 hours
### Risk: Low-Medium (mostly UI/API wrapping)

---

## Phase 5: Testing & Optimization (Days 21-28 / ~50 hours)

### Goals
- Comprehensive testing (unit, integration, E2E)
- Performance optimization
- Optional Windows Media Foundation port
- Cross-platform verification

### Deliverables

**2.5a: Test Suite**
```typescript
// test/video-engine.test.ts
describe('VideoEngine', () => {
  describe('Playback', () => {
    it('should load and play a single video', async () => {
      const engine = new VideoEngine();
      await engine.load({
        id: 1,
        filePath: './fixtures/test_video.mp4'
      });
      
      engine.play([1]);
      await wait(100);
      
      const state = engine.getState(1);
      expect(state.status).toBe('playing');
      expect(state.currentFrame).toBeGreaterThan(0);
    });

    it('should maintain frame-accurate sync across 3 videos', async () => {
      const engine = new VideoEngine();
      
      for (let i = 1; i <= 3; i++) {
        await engine.load({
          id: i,
          filePath: `./fixtures/test_video_${i}.mp4`
        });
      }
      
      engine.play([1, 2, 3]);
      
      // Sample sync drift over 10 seconds
      const driftSamples = [];
      for (let i = 0; i < 100; i++) {
        await wait(100);
        const states = engine.getSyncTelemetry();
        driftSamples.push(states.driftMs);
      }
      
      // All drifts should be within ±16ms (1 frame @ 60fps)
      const maxDrift = Math.max(...driftSamples.map(Math.abs));
      expect(maxDrift).toBeLessThan(16);
    });

    it('should handle seek with frame accuracy', async () => {
      const engine = new VideoEngine();
      await engine.load({
        id: 1,
        filePath: './fixtures/test_video.mp4'
      });
      
      engine.seek(1, 5.5);  // 5.5 seconds
      
      const state = engine.getState(1);
      const expectedFrame = 5.5 * 60;  // @ 60fps
      expect(state.currentFrame).toBeCloseTo(expectedFrame, -1);
    });
  });

  describe('Synchronization', () => {
    it('should correct positive drift (video ahead)', async () => {
      // Simulate drift and verify correction
    });

    it('should correct negative drift (video behind)', async () => {
      // Simulate drift and verify correction
    });
  });
});
```

**2.5b: Performance Benchmarks**
```cpp
// native/src/benchmark.cc
struct BenchmarkResult {
  double avg_cpu_percent;
  double peak_memory_mb;
  double avg_sync_drift_ms;
  double frame_drop_percent;
};

BenchmarkResult RunBenchmark() {
  // Load 3x 1080p60 videos
  // Play for 5 minutes
  // Measure:
  //   - CPU usage (task manager / top)
  //   - Memory (RSS)
  //   - Sync drift (frame count differential)
  //   - Frame drops (monitor event logs)
  
  return results;
}

// Expected results:
// - CPU: <15% per video (3 videos = <45%)
// - Memory: <100MB per video instance
// - Sync drift: <5ms RMS over 5min
// - Frame drops: <0.1%
```

**2.5c: Optional Windows Media Foundation Backend**
```cpp
// native/src/wmf_engine.cc (optional)
// Only for Windows, for better performance
// Implement same interface as VLC backend
// Uses IMFMediaEngine instead of libvlc

#include <mfapi.h>
#include <mfidl.h>
#include <mfplay.h>

class WindowsMediaFoundationEngine {
 public:
  // Same public interface as VideoEngine
  // Faster sync, native codec support
};
```

**2.5d: Cross-Platform Validation**
- Windows 10/11 (native + WMF paths)
- macOS 11+ (Intel + Apple Silicon)
- Ubuntu 20.04 LTS (X11)

### Effort: ~50 hours
### Risk: Low-Medium (testing + optimization, mostly validation)

---

## Phase Timeline Summary

| Phase | Name | Duration | Effort | Risk |
|-------|------|----------|--------|------|
| 1 | Infrastructure | Days 1-5 | 40h | Medium |
| 2 | Single Video | Days 6-10 | 45h | Medium-High |
| 3 | Multi-Sync | Days 11-15 | 50h | High |
| 4 | Controls | Days 16-20 | 40h | Low-Medium |
| 5 | Testing | Days 21-28 | 50h | Low-Medium |
| **Total** | | **28 days** | **225h** | |

**Realistic Schedule:** 4-5 weeks (accounting for debugging, iteration)

---

# 3. TECHNICAL SPECIFICATIONS

## 3.1 Dependencies & Build Tools

### Core Dependencies
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
  "native": {
    "libvlc": "4.0.0 or later",
    "libvlc-dev": "for building"
  }
}
```

### System Requirements
```
Windows 10+ / macOS 10.13+ / Ubuntu 18.04+
Node.js 18.0.0 or later
Python 3.7+ (for node-gyp)
C++ compiler (MSVC on Windows, clang on macOS, g++ on Linux)
```

---

## 3.2 Key Components & Code Examples

### A. Video Engine Core (Native Module)

```cpp
// native/src/video_engine.h
#pragma once

#include <node.h>
#include <vlc/vlc.h>
#include <map>
#include <memory>
#include <thread>

class VideoEngine : public node::ObjectWrap {
 public:
  explicit VideoEngine();
  ~VideoEngine();

  // Async wrapper for Node.js
  static void Init(v8::Local<v8::Object> exports);

  // Public methods
  bool LoadVideo(int video_id, const std::string& file_path);
  void Play(const std::vector<int>& video_ids);
  void Pause(const std::vector<int>& video_ids);
  void Seek(int video_id, double position_ms);
  void SetPlaybackRate(const std::vector<int>& video_ids, float rate);
  
  struct VideoState {
    int video_id;
    int current_frame;
    double current_time_ms;
    double duration_ms;
    double fps;
    std::string status;  // 'idle', 'playing', 'paused', 'error'
  };

  std::vector<VideoState> GetTelemetry();

 private:
  // VLC instances
  libvlc_instance_t* vlc_instance_;
  std::map<int, libvlc_media_list_player_t*> players_;
  std::map<int, VideoState> states_;

  // Sync thread
  std::thread sync_thread_;
  std::atomic<bool> is_running_;
  
  // Callbacks for VLC events
  static void OnMediaStateChanged(const libvlc_event_t* event, void* user_data);

  // Sync algorithm
  void RunSyncLoop();
  void UpdateSyncOffsets();
};
```

### B. IPC Handler (Main Process)

```typescript
// src/ipc/video-handler.ts
import { ipcMain, app } from 'electron';
import VideoWorker from '../workers/video-worker';

const videoWorker = new VideoWorker();

export function RegisterVideoHandlers() {
  ipcMain.handle('video:load', async (event, payload) => {
    return await videoWorker.load(payload);
  });

  ipcMain.handle('video:play', async (event, { videoIds }) => {
    return await videoWorker.play(videoIds);
  });

  ipcMain.handle('video:pause', async (event, { videoIds }) => {
    return await videoWorker.pause(videoIds);
  });

  ipcMain.handle('video:seek', async (event, { videoId, position }) => {
    return await videoWorker.seek(videoId, position);
  });

  ipcMain.handle('video:setPlaybackRate', async (event, { videoIds, rate }) => {
    return await videoWorker.setPlaybackRate(videoIds, rate);
  });

  ipcMain.handle('video:getState', async (event, { videoId }) => {
    return videoWorker.getState(videoId);
  });

  // Continuous telemetry stream
  videoWorker.on('telemetry', (telemetry) => {
    if (event.sender) {
      event.sender.send('video:telemetry', telemetry);
    }
  });
}
```

### C. React Integration Hook

```typescript
// src/hooks/useVideoPlayback.ts
import { useEffect, useState, useCallback } from 'react';
import { ipcRenderer } from 'electron';

export interface UseVideoPlaybackOptions {
  videoIds: number[];
  onTelemetry?: (telemetry: SyncTelemetry) => void;
}

export function useVideoPlayback({ videoIds, onTelemetry }: UseVideoPlaybackOptions) {
  const [state, setState] = useState<Map<number, VideoState>>(new Map());
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const unsubscribe = ipcRenderer.on('video:telemetry', (event, telemetry) => {
      const newState = new Map(state);
      
      telemetry.states.forEach((videoState: VideoState) => {
        newState.set(videoState.videoId, videoState);
      });
      
      setState(newState);
      onTelemetry?.(telemetry);
    });

    return unsubscribe;
  }, [state, onTelemetry]);

  const play = useCallback(async () => {
    await ipcRenderer.invoke('video:play', { videoIds });
    setIsPlaying(true);
  }, [videoIds]);

  const pause = useCallback(async () => {
    await ipcRenderer.invoke('video:pause', { videoIds });
    setIsPlaying(false);
  }, [videoIds]);

  const seek = useCallback(async (position: number) => {
    await Promise.all(
      videoIds.map(id => 
        ipcRenderer.invoke('video:seek', { videoId: id, position })
      )
    );
  }, [videoIds]);

  const setPlaybackRate = useCallback(async (rate: number) => {
    await ipcRenderer.invoke('video:setPlaybackRate', { videoIds, rate });
  }, [videoIds]);

  return {
    state,
    isPlaying,
    play,
    pause,
    seek,
    setPlaybackRate
  };
}
```

### D. Seeking & Frame-Accurate Positioning

```cpp
// native/src/seek_controller.cc
void SeekController::SeekToFrame(int video_id, int target_frame) {
  auto player = engine_->GetPlayer(video_id);
  const double fps = engine_->GetFPS(video_id);
  
  // Convert frame to milliseconds
  double target_ms = (target_frame / fps) * 1000.0;
  
  // Coarse seek to approximate position
  libvlc_media_list_player_set_media_list(player, media_list_);
  libvlc_media_list_player_play_item_at_index(player, 0);
  
  // Use binary search to find exact frame
  int current_frame = GetCurrentFrame(player);
  int max_iterations = 100;
  int iterations = 0;
  
  while (std::abs(current_frame - target_frame) > 0 && iterations < max_iterations) {
    if (current_frame < target_frame) {
      // Step forward
      libvlc_media_list_player_next(player);
      current_frame++;
    } else {
      // Step backward - requires pause + previous
      libvlc_media_list_player_pause(player);
      libvlc_media_list_player_previous(player);
      current_frame--;
      libvlc_media_list_player_play(player);
    }
    
    iterations++;
  }
  
  VLOG(1) << "Seek complete: target_frame=" << target_frame 
          << " current_frame=" << current_frame 
          << " iterations=" << iterations;
}
```

---

## 3.3 Playback Control API Reference

```typescript
// Complete API surface
interface VideoPlaybackAPI {
  // Load & Manage
  load(config: {
    id: number;
    filePath: string;
    metadata?: VideoMetadata;
  }): Promise<{ success: boolean; duration: number; fps: number }>;

  unload(videoId: number): Promise<{ success: boolean }>;

  // Playback Control
  play(videoIds: number[]): Promise<{ success: boolean }>;
  pause(videoIds: number[]): Promise<{ success: boolean }>;
  stop(videoIds: number[]): Promise<{ success: boolean }>;

  // Seeking
  seek(videoId: number, position: number): Promise<VideoState>;
  seekToFrame(videoId: number, frame: number): Promise<VideoState>;

  // Speed & Rate
  setPlaybackRate(videoIds: number[], rate: number): Promise<void>;
  getPlaybackRate(videoId: number): Promise<number>;

  // Frame Control
  stepFrame(videoId: number, direction: 'forward' | 'backward', frames: number): Promise<VideoState>;

  // Audio
  getAudioTracks(videoId: number): Promise<AudioTrack[]>;
  selectAudioTrack(videoId: number, trackId: number): Promise<void>;
  setVolume(videoId: number, level: number): Promise<void>;

  // State & Telemetry
  getState(videoId: number): Promise<VideoState>;
  getSyncTelemetry(): Promise<SyncTelemetry>;
}
```

---

## 3.4 Frame Synchronization Algorithm (Detailed)

```typescript
/**
 * Frame-Accurate Synchronization Algorithm
 * 
 * Goal: Keep N videos playing in perfect sync
 * Tolerance: ±1 frame (16.67ms @ 60fps)
 * Update Rate: Every 16-33ms
 */

class FrameSyncController {
  private masterClockStart: number = Date.now();
  private referenceFps: number = 60;
  private syncTolerance: number = 1; // frames
  private videoFrameRates: Map<number, number> = new Map();

  /**
   * Calculate expected frame for master clock
   */
  private getMasterExpectedFrame(): number {
    const elapsedMs = Date.now() - this.masterClockStart;
    return (elapsedMs / 1000) * this.referenceFps;
  }

  /**
   * Main sync loop - run every 16ms on worker thread
   */
  async synchronizeVideos(
    videoInstances: Map<number, NativeVideoInstance>
  ): Promise<SyncTelemetry> {
    
    const masterExpectedFrame = this.getMasterExpectedFrame();
    const states: VideoState[] = [];
    const drifts: number[] = [];

    // Calculate drift for each video
    for (const [videoId, instance] of videoInstances) {
      const currentFrame = instance.getCurrentFrame();
      const fps = this.videoFrameRates.get(videoId) || 60;
      
      // Adjust expected frame for this video's FPS
      const expectedFrame = (masterExpectedFrame / this.referenceFps) * fps;
      const driftFrames = currentFrame - expectedFrame;
      const driftMs = (driftFrames / fps) * 1000;

      states.push({
        videoId,
        currentFrame,
        expectedFrame: Math.round(expectedFrame),
        driftFrames,
        status: 'playing'
      });

      drifts.push(driftMs);

      // Micro-adjust if drift exceeds tolerance
      if (Math.abs(driftFrames) > this.syncTolerance) {
        await this.adjustPlayback(instance, driftFrames);
      }
    }

    return {
      timestamp: Date.now(),
      states,
      driftMs: drifts,
      maxDrift: Math.max(...drifts.map(Math.abs))
    };
  }

  /**
   * Adjust individual video playback to reduce drift
   */
  private async adjustPlayback(
    instance: NativeVideoInstance,
    driftFrames: number
  ): Promise<void> {
    if (driftFrames > this.syncTolerance) {
      // Video is ahead - pause briefly
      instance.pause();
      
      // Calculate sleep time
      const fps = instance.getFps();
      const sleepMs = (driftFrames / fps) * 1000;
      
      await this.sleep(sleepMs);
      instance.play();
      
      LOG.debug(`Adjusted video (ahead): paused for ${sleepMs.toFixed(1)}ms`);
    } else if (driftFrames < -this.syncTolerance) {
      // Video is behind - step forward
      const framesToStep = Math.abs(Math.ceil(driftFrames));
      
      instance.pause();
      for (let i = 0; i < framesToStep; i++) {
        instance.stepFrame(1);
      }
      instance.play();
      
      LOG.debug(`Adjusted video (behind): stepped ${framesToStep} frames`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

# 4. MIGRATION STRATEGY

## 4.1 Transition Plan (No Breaking Changes)

### Phase 1: Parallel Operation (Week 1-2)

**Goal:** Run both HTML5 and native players side-by-side

```typescript
// src/components/VideoPlayer.tsx
interface VideoPlayerProps {
  videoId: number;
  useNativePlayer?: boolean;  // Feature flag
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  videoId, 
  useNativePlayer = false 
}) => {
  if (useNativePlayer) {
    return <NativeVideoPlayer videoId={videoId} />;
  }
  
  return <HTMLVideoElement videoId={videoId} />;
};
```

**Testing:**
- Load same video in both players
- Compare output quality (visual + audio sync)
- Measure resource usage
- Validate feature parity

### Phase 2: Gradual Rollout (Week 3-4)

**Feature flags:**
```typescript
const NATIVE_PLAYER_ENABLED = {
  single_video: process.env.REACT_APP_NATIVE_SINGLE === 'true',
  multi_video: process.env.REACT_APP_NATIVE_MULTI === 'true',
  frame_controls: process.env.REACT_APP_NATIVE_FRAMES === 'true'
};
```

**Rollout stages:**
1. 10% of users → Single video playback
2. 25% of users → Single video + controls
3. 50% of users → Multi-video comparison
4. 100% → Full native player

---

## 4.2 Rollback Plan

**Triggers for rollback:**
- Sync drift > 50ms (tolerance: ±16ms)
- CPU usage > 70% (tolerance: <45% for 3 videos)
- Frame drop rate > 2% (tolerance: <0.1%)
- Crashes or unhandled exceptions

**Rollback mechanism:**
```typescript
// src/ipc/error-handling.ts
ipcMain.on('video:critical-error', (event, { errorCode, metric }) => {
  if (shouldRollback(errorCode, metric)) {
    LOG.error(`Critical error detected: ${errorCode}`);
    
    // Revert to HTML5 player
    mainWindow?.webContents.send('rollback:use-html5-player', {
      reason: errorCode,
      failedVideoId: metric.videoId
    });

    // Notify monitoring service
    reportMetric('native_player_rollback', {
      errorCode,
      timestamp: Date.now()
    });
  }
});
```

---

## 4.3 Feature Parity Checklist

| Feature | HTML5 | Native | Status |
|---------|-------|--------|--------|
| Play/Pause | ✅ | ✅ | Ready |
| Seek (position slider) | ✅ | ✅ | Ready |
| Playback rate (0.5x-2x) | ✅ | ✅ | Phase 4 |
| Audio track selection | ✅ | ✅ | Phase 4 |
| Volume control | ✅ | ✅ | Phase 4 |
| Keyboard shortcuts | ✅ | ⚠️ | Phase 4 |
| Fullscreen | ✅ | ⚠️ | Phase 5 |
| Picture-in-Picture | ✅ | ❌ | Future |
| Multi-video sync | ❌ | ✅ | Phase 3 |
| Frame stepping | ❌ | ✅ | Phase 4 |

---

## 4.4 Testing Strategy per Phase

### Phase 1: Infrastructure
- ✅ IPC message routing
- ✅ Worker thread communication
- ✅ Native module loads without crash

### Phase 2: Single Video
- ✅ Video loads and plays
- ✅ Seek works accurately
- ✅ Play/pause responsive
- ✅ Video renders without corruption
- ✅ Audio is synced to video

### Phase 3: Multi-Sync
- ✅ Sync accuracy within ±16ms
- ✅ No audio drift over 5 minutes
- ✅ CPU usage < 45%
- ✅ Memory stable (no leaks)

### Phase 4: Controls
- ✅ Playback rate works (0.5x-2x)
- ✅ Audio tracks selectable
- ✅ Frame stepping accurate

### Phase 5: Testing
- ✅ E2E test suite passes
- ✅ Performance benchmarks met
- ✅ Cross-platform compatibility verified

---

# 5. SUCCESS CRITERIA

## 5.1 Performance Targets

```
┌─────────────────────────────────────────────────────┐
│             Success Metrics (Per Video)              │
├──────────────────────────────┬──────────────────────┤
│ Metric                       │ Target               │
├──────────────────────────────┼──────────────────────┤
│ Playback FPS (reference)     │ 59-61 fps @ 60fps    │
│ Frame drop rate              │ < 0.1%               │
│ Sync accuracy (multi-video)  │ ±1 frame (±16.67ms)  │
│ Seeking precision            │ ±1 frame             │
│ CPU per video (single)       │ < 10%                │
│ CPU for 3 videos             │ < 40% (total system) │
│ Memory per instance          │ < 80 MB              │
│ Memory for 3 videos          │ < 250 MB (total)     │
│ Seek latency                 │ < 100ms              │
│ UI responsiveness            │ < 50ms input lag     │
└──────────────────────────────┴──────────────────────┘
```

## 5.2 Sync Accuracy Deep-Dive

```cpp
// Measure RMS (root mean square) drift over time
struct SyncMetrics {
  double rms_drift_ms;      // Root mean square
  double max_drift_ms;      // Peak drift
  double sustained_drift_ms; // Drift > 10ms duration
  int drift_events;          // Count of correction events
};

// Target: RMS < 5ms (over 5-minute clip)
// Sustained drift should be < 1 second
```

## 5.3 Resource Usage Goals

**Single 1080p60 video:**
- CPU: 8-10%
- Memory: 60-80 MB
- GPU: 5-15% (hardware decoded)

**Three 1080p60 videos in sync:**
- CPU: 30-40% (shared overhead)
- Memory: 200-250 MB
- GPU: 20-40%

---

# 6. RISK ASSESSMENT & MITIGATION

## 6.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| **Frame sync drift > 50ms** | High | Critical | Pre-test with varied codecs; implement drift monitoring + auto-adjustment |
| **VLC library stability** | Medium | High | Use LTS version (4.0.x); have fallback to HTML5 |
| **Cross-platform rendering issues** | Medium | High | Test on Windows/Mac/Linux early (Phase 1-2) |
| **CPU overload (3+ videos)** | Medium | High | Implement quality downsampling; test on low-end hardware |
| **Memory leaks in native code** | Medium | High | Use Valgrind/Address Sanitizer; test for 24h continuous playback |
| **Audio sync drift** | Low | High | Implement per-frame audio validation |
| **Codec incompatibility** | Low | Medium | Test with Apex VOD formats (H264, H265, AV1) |

## 6.2 Mitigation Strategies

### A. VLC Library Management
```bash
# Use stable, pinned version
libvlc >= 4.0.0, < 5.0.0

# Build VLC as dependency (not system library)
./scripts/build-vlc.sh --version 4.0.18

# Fallback gracefully if VLC unavailable
if (!VLC_AVAILABLE) {
  USE_HTML5_PLAYER = true
  WARN("Native player unavailable, falling back to HTML5")
}
```

### B. Monitoring & Telemetry
```typescript
// src/telemetry/metrics.ts
export const VideoMetrics = {
  // Track sync quality
  recordSyncDrift: (videoIds: number[], driftMs: number[]) => {
    analytics.track('video.sync.drift', {
      videoCount: videoIds.length,
      maxDrift: Math.max(...driftMs),
      avgDrift: avg(driftMs),
      timestamp: Date.now()
    });
  },

  // Track resource usage
  recordResourceUsage: (cpu: number, memory: number) => {
    if (cpu > 50 || memory > 300) {
      LOG.warn(`High resource usage: CPU=${cpu}%, MEM=${memory}MB`);
      analytics.track('video.resource.high', { cpu, memory });
    }
  },

  // Track errors
  recordNativeError: (errorCode: string, context: any) => {
    analytics.track('video.native.error', { errorCode, context });
    // Trigger rollback if needed
  }
};
```

### C. Graceful Degradation
```typescript
// src/components/VideoPlayer.tsx
const [playbackEngine, setPlaybackEngine] = useState<'native' | 'html5'>('native');

// If native player has too many errors, fall back
if (errorCount > 3) {
  setPlaybackEngine('html5');
  showNotification('Switched to HTML5 player for stability');
}

// Render appropriate player
return playbackEngine === 'native' 
  ? <NativeVideoPlayer {...props} />
  : <HTMLVideoElement {...props} />;
```

---

## 6.3 Dependency Risks

| Dependency | Risk | Mitigation |
|------------|------|-----------|
| **libvlc** | Outdated version, security patches | Use NPM/Conan for versioning; monitor CVEs |
| **Electron** | Major version breaks | Pin version; test upgrades in CI before shipping |
| **node-gyp** | Build failures on new Node versions | Test build matrix: Node 18, 20, 22 |
| **FFmpeg** | Codec licensing issues | Use VLC's bundled FFmpeg; avoid custom builds |

---

## 6.4 Platform-Specific Risks

### Windows (WMF + VLC)
- **Risk:** WMF codec issues (rare codecs may not decode)
- **Mitigation:** Use VLC as fallback; test with all Apex VOD codecs

### macOS (Metal rendering)
- **Risk:** Metal compatibility on Intel vs Apple Silicon
- **Mitigation:** Test on both architectures; use libvlc's abstractions

### Linux (X11/Wayland)
- **Risk:** X11 window ID handling, Wayland compatibility
- **Mitigation:** Support both X11 and Wayland; test on Ubuntu 20.04 LTS

---

# 7. DETAILED PHASE BREAKDOWN

## Phase 1: Infrastructure (Days 1-5)

**Daily Breakdown:**
- **Day 1:** node-gyp setup, VLC discovery, build environment
- **Day 2:** Basic libvlc C++ wrapper skeleton
- **Day 3:** IPC routing, Electron integration
- **Day 4:** Worker thread pool setup
- **Day 5:** End-to-end test: React → IPC → Worker → libvlc

**Acceptance Criteria:**
```
✅ native module builds without errors
✅ IPC message round-trips work
✅ Worker thread pool initializes
✅ Can create VLC instance and destroy it
✅ Logs show no memory leaks (first pass)
```

---

## Phase 2: Single Video (Days 6-10)

**Daily Breakdown:**
- **Day 6:** Video rendering (window attachment)
- **Day 7:** Play/pause implementation
- **Day 8:** Seek implementation + frame accuracy
- **Day 9:** State polling + React component
- **Day 10:** End-to-end: Load file → Play → Seek → Update UI

**Acceptance Criteria:**
```
✅ Video renders in window without artifacts
✅ Play/pause latency < 100ms
✅ Seek accuracy ±1 frame
✅ React UI updates follow playback
✅ Audio and video in sync
```

---

## Phase 3: Multi-Sync (Days 11-15)

**Daily Breakdown:**
- **Day 11:** Sync master clock implementation
- **Day 12:** Drift detection algorithm
- **Day 13:** Micro-adjustment logic (pause/resume)
- **Day 14:** Telemetry emission + React component
- **Day 15:** Tuning sync tolerance, end-to-end testing

**Acceptance Criteria:**
```
✅ 3 videos play simultaneously without crash
✅ Sync drift < 16ms (±1 frame) sustained
✅ No audio desync after 5 minutes
✅ CPU < 40% for 3 videos
✅ Sync adjustment transparent to user
```

---

## Phase 4: Controls (Days 16-20)

**Daily Breakdown:**
- **Day 16:** Playback rate control
- **Day 17:** Audio track selection
- **Day 18:** Frame stepping
- **Day 19:** UI controls (scrubber, speed selector, HUD)
- **Day 20:** Integration testing

**Acceptance Criteria:**
```
✅ Playback rate works (0.25x - 2.0x)
✅ Audio tracks selectable and switch cleanly
✅ Frame stepping accurate (±0 frames)
✅ All UI controls responsive
✅ HUD displays correct metadata
```

---

## Phase 5: Testing & Optimization (Days 21-28)

**Daily Breakdown:**
- **Day 21-22:** Unit test suite (50+ tests)
- **Day 23-24:** Integration & E2E tests
- **Day 25:** Performance benchmarking
- **Day 26:** Cross-platform testing (Win/Mac/Linux)
- **Day 27:** Optional Windows Media Foundation port
- **Day 28:** Documentation, release prep

**Acceptance Criteria:**
```
✅ All unit tests passing (>90% coverage)
✅ All integration tests passing
✅ Performance benchmarks met (see section 5.1)
✅ Cross-platform tests pass
✅ Documentation complete
```

---

# 8. CODE STRUCTURE & FILE LAYOUT

```
vod-insights/
├── native/
│   ├── binding.gyp              # node-gyp config
│   ├── build/                   # Compiled binaries
│   └── src/
│       ├── video_engine.cc       # Main engine
│       ├── video_engine.h
│       ├── sync_master.cc        # Sync algorithm
│       ├── sync_master.h
│       ├── seek_controller.cc    # Seeking logic
│       ├── seek_controller.h
│       ├── vlc_wrapper.cc        # libvlc C++ wrapper
│       ├── vlc_wrapper.h
│       ├── wmf_engine.cc         # Windows Media Foundation (optional)
│       └── wmf_engine.h
│
├── src/
│   ├── main.ts                  # Electron main process
│   ├── workers/
│   │   └── video-worker.ts       # Video handling worker
│   ├── ipc/
│   │   ├── handlers/
│   │   │   └── video.ts          # Video IPC handlers
│   │   └── error-handling.ts     # Error/rollback logic
│   ├── hooks/
│   │   └── useVideoPlayback.ts   # React hook
│   ├── components/
│   │   ├── VideoPlayer.tsx       # Main player component
│   │   ├── MultiVideoComparison.tsx
│   │   └── PlaybackControls.tsx
│   └── telemetry/
│       └── metrics.ts            # Analytics/monitoring
│
├── test/
│   ├── video-engine.test.ts      # Native module tests
│   ├── sync.test.ts              # Sync algorithm tests
│   └── integration/
│       ├── e2e.test.ts
│       └── performance.test.ts
│
├── scripts/
│   ├── build-vlc.sh              # Build VLC dependency
│   ├── benchmark.sh              # Performance tests
│   └── ci/
│       ├── build.yml             # GitHub Actions
│       └── test.yml
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── TESTING.md
│   └── TROUBLESHOOTING.md
│
├── package.json
├── binding.gyp
└── README.md
```

---

# 9. BUILD & DEPLOYMENT

## 9.1 Build Command

```bash
# Install dependencies
npm install

# Build native module (libvlc bindings)
npm run build:native

# Build Electron app + React frontend
npm run build

# Package distribution
npm run package
  # Output:
  # - vod-insights-win-x64.exe
  # - vod-insights-mac-arm64.dmg
  # - vod-insights-linux-x64.AppImage
```

## 9.2 CI/CD Pipeline

```yaml
# .github/workflows/build.yml
name: Build & Release

on:
  push:
    branches: [main, dev]
    tags: ['v*']

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
        node: [18, 20, 22]

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node }}
      
      - name: Install VLC dependencies
        run: |
          if [ "$RUNNER_OS" = "Windows" ]; then
            choco install vlc-dev
          elif [ "$RUNNER_OS" = "macOS" ]; then
            brew install vlc
          else
            sudo apt-get install libvlc-dev
          fi
      
      - name: Build native module
        run: npm run build:native
      
      - name: Run tests
        run: npm test
      
      - name: Package app
        run: npm run package
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          path: dist/
```

---

# 10. QUICK REFERENCE: Commands & APIs

## Terminal Commands
```bash
# Development
npm run dev                    # Watch mode (React + native)
npm run build:native          # Build C++ module
npm test                       # Run test suite
npm run benchmark             # Performance tests

# Production
npm run build                 # Full production build
npm run package               # Package distributable
npm run release               # Tag + publish (CI)
```

## IPC API (from React)
```typescript
// Playback
await ipcRenderer.invoke('video:play', { videoIds: [1,2,3] });
await ipcRenderer.invoke('video:pause', { videoIds: [1,2,3] });
await ipcRenderer.invoke('video:seek', { videoId: 1, position: 15.5 });

// Rate
await ipcRenderer.invoke('video:setPlaybackRate', { videoIds: [1,2,3], rate: 1.5 });

// Frame control
await ipcRenderer.invoke('video:stepFrame', { videoId: 1, direction: 'forward', frames: 1 });

// Audio
await ipcRenderer.invoke('video:getAudioTracks', { videoId: 1 });
await ipcRenderer.invoke('video:selectAudioTrack', { videoId: 1, trackId: 0 });

// Telemetry
ipcRenderer.on('video:telemetry', (event, data) => { ... });
```

## C++ API (Native Module)
```cpp
VideoEngine engine;
engine.LoadVideo(1, "/path/to/video.mp4");
engine.Play({1, 2, 3});
engine.Seek(1, 5000);  // 5 seconds in milliseconds
engine.SetPlaybackRate({1, 2, 3}, 1.5);
auto state = engine.GetTelemetry();
```

---

# 11. KNOWN CHALLENGES & SOLUTIONS

| Challenge | Solution |
|-----------|----------|
| **VLC window rendering on Electron** | Use platform-specific window ID attachment (HWND/NSView/XCB) |
| **Frame-accurate seeking** | Binary search + frame stepping; accept ±1 frame tolerance |
| **Audio sync with 3+ videos** | Use video as master clock; sync audio to video |
| **CPU high on low-end systems** | Implement quality downsampling (720p instead of 1080p) |
| **Memory growth over time** | Use Valgrind; implement explicit cleanup in native destructor |
| **Cross-platform codec support** | Bundle FFmpeg via VLC; test all Apex VOD codecs upfront |

---

# 12. FINAL RECOMMENDATIONS

## Recommended Approach: VLC + Native IPC

✅ **Pros:**
- Cross-platform support (Day 1)
- Mature, stable library
- Proven for multi-stream playback
- Fast path to production (3-4 weeks)
- Can pivot to WMF later (Windows-only optimization)

❌ **Cons:**
- Slightly slower than WMF on Windows
- Requires bundling libvlc binary

## Alternative: Windows Media Foundation (Windows-only)

✅ **Pros:**
- Better performance on Windows
- Native codec support
- Excellent multi-stream sync

❌ **Cons:**
- Windows only (requires separate Mac/Linux paths)
- Steeper learning curve
- Longer development time (4-5 weeks)

## Recommendation
**Start with VLC** for speed to market and cross-platform support. If Windows performance is insufficient in Phase 5, add WMF backend as optimization.

---

# SUMMARY

This roadmap provides a complete path to native Electron video playback with frame-accurate multi-video synchronization.

**Key Numbers:**
- **Timeline:** 28 days (3-4 weeks realistic)
- **Effort:** ~225 engineering hours
- **Team:** 1-2 developers
- **Success Rate:** High (proven with libvlc)

**Deliverables:** Production-ready native video engine supporting:
- Single & multi-video playback
- Frame-accurate sync (±1 frame)
- Full playback controls (play, pause, seek, rate)
- <40% CPU for 3 videos
- Cross-platform (Win/Mac/Linux)

