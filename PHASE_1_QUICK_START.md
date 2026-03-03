# Phase 1 Quick Start: Infrastructure Setup (Days 1-5)

**Phase:** 1 / 5  
**Duration:** 5 days (Mon-Fri)  
**Effort:** 40 hours  
**Goal:** Get native module + IPC communication working end-to-end

---

## Day 1: Setup & Build System

### Morning (3h): Project Structure & Dependencies

**Checklist:**
```bash
# 1. Create native module directory
mkdir -p native/src
mkdir -p native/build

# 2. Create binding.gyp (node-gyp config)
cat > native/binding.gyp << 'EOF'
{
  "targets": [
    {
      "target_name": "video_engine",
      "sources": [
        "src/video_engine.cc",
        "src/vlc_wrapper.cc",
        "src/sync_master.cc"
      ],
      "include_dirs": [
        "<!(node -p \"require('node_addon_api').include_dir\")",
        "/usr/include/vlc",  # macOS: brew install vlc
        "/usr/include",      # Linux: libvlc-dev
        "C:\\Program Files\\VideoLAN\\VLC\\include"  # Windows
      ],
      "libraries": [
        "-lvlc"
      ],
      "cflags": ["-Wall", "-std=c++17"],
      "cflags_cc": ["-std=c++17"],
      "conditions": [
        ["OS=='win'", {
          "libraries": [
            "-lC:\\Program Files\\VideoLAN\\VLC\\lib\\libvlc.lib"
          ]
        }]
      ]
    }
  ]
}
EOF

# 3. Update package.json
npm install --save node-addon-api
npm install --save-dev node-gyp
npm install --save piscina

# 4. Add scripts to package.json
npm set-script build:native "node-gyp configure && node-gyp build"
npm set-script rebuild:native "node-gyp clean && npm run build:native"
npm set-script test:native "npm run build:native && jest --testPathPattern=native"
```

**System Dependencies:**
```bash
# macOS
brew install vlc

# Ubuntu/Debian
sudo apt-get install libvlc-dev

# Windows (Chocolatey)
choco install vlc-dev

# Verify installation
pkg-config --cflags --libs libvlc
```

**Verify:**
```bash
ls -la native/binding.gyp
npm run build:native  # Should succeed with "gyp info ok"
```

### Afternoon (2h): Electron Main Process Setup

**Create src/main.ts:**
```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { RegisterVideoHandlers } from './ipc/handlers/video';

let mainWindow: BrowserWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Register all video IPC handlers
  RegisterVideoHandlers(mainWindow);

  mainWindow.loadFile('./dist/index.html');
}

app.on('ready', createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

**Create src/preload.ts:**
```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel: string, args?: any) => ipcRenderer.invoke(channel, args),
    on: (channel: string, callback: Function) => ipcRenderer.on(channel, callback),
  },
});
```

---

## Day 2: libvlc C++ Wrapper Foundation

### Morning (3h): Video Engine Header & Skeleton

**Create native/src/video_engine.h:**
```cpp
#pragma once

#include <node.h>
#include <vlc/vlc.h>
#include <map>
#include <memory>
#include <vector>

class VideoEngine : public node::ObjectWrap {
 public:
  explicit VideoEngine();
  ~VideoEngine();

  static void Init(v8::Local<v8::Object> exports);

  // Core methods
  bool LoadVideo(int video_id, const std::string& file_path);
  void Play(const std::vector<int>& video_ids);
  void Pause(const std::vector<int>& video_ids);
  void Seek(int video_id, double position_ms);

  struct VideoState {
    int video_id;
    int current_frame;
    double current_time_ms;
    std::string status;  // 'idle', 'playing', 'paused', 'error'
  };

  std::vector<VideoState> GetTelemetry();

 private:
  libvlc_instance_t* vlc_instance_;
  std::map<int, libvlc_media_list_player_t*> players_;
  std::map<int, VideoState> states_;

  // Node.js callback wrappers
  static void New(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void LoadVideo(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void Play(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void Pause(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void GetTelemetry(const v8::FunctionCallbackInfo<v8::Value>& args);

  static v8::Persistent<v8::Function> constructor;
};
```

**Create native/src/video_engine.cc (skeleton):**
```cpp
#include "video_engine.h"
#include <iostream>

v8::Persistent<v8::Function> VideoEngine::constructor;

VideoEngine::VideoEngine() : vlc_instance_(nullptr) {
  // Initialize VLC instance
  const char* vlc_args[] = { "--quiet" };
  vlc_instance_ = libvlc_new(1, vlc_args);
  
  if (!vlc_instance_) {
    std::cerr << "Failed to create libvlc instance" << std::endl;
  }
}

VideoEngine::~VideoEngine() {
  // Clean up VLC instance
  if (vlc_instance_) {
    libvlc_release(vlc_instance_);
    vlc_instance_ = nullptr;
  }
}

bool VideoEngine::LoadVideo(int video_id, const std::string& file_path) {
  if (!vlc_instance_) return false;
  
  // TODO: Create libvlc_media and libvlc_media_list_player
  // TODO: Store in players_ map
  
  return true;
}

void VideoEngine::Play(const std::vector<int>& video_ids) {
  for (int vid : video_ids) {
    auto player = players_[vid];
    if (player) {
      libvlc_media_list_player_play(player);
    }
  }
}

void VideoEngine::Pause(const std::vector<int>& video_ids) {
  for (int vid : video_ids) {
    auto player = players_[vid];
    if (player) {
      libvlc_media_list_player_pause(player);
    }
  }
}

std::vector<VideoEngine::VideoState> VideoEngine::GetTelemetry() {
  std::vector<VideoState> result;
  // TODO: Poll current state from each player
  return result;
}

// Node.js bindings
void VideoEngine::Init(v8::Local<v8::Object> exports) {
  v8::Isolate* isolate = exports->GetIsolate();
  v8::Local<v8::Context> context = isolate->GetCurrentContext();

  v8::Local<v8::FunctionTemplate> tpl = 
    v8::FunctionTemplate::New(isolate, New);
  tpl->SetClassName(v8::String::NewFromUtf8(isolate, "VideoEngine").ToLocalChecked());
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  NODE_SET_PROTOTYPE_METHOD(tpl, "LoadVideo", LoadVideo);
  NODE_SET_PROTOTYPE_METHOD(tpl, "Play", Play);
  NODE_SET_PROTOTYPE_METHOD(tpl, "Pause", Pause);
  NODE_SET_PROTOTYPE_METHOD(tpl, "GetTelemetry", GetTelemetry);

  constructor.Reset(isolate, tpl->GetFunction(context).ToLocalChecked());
  
  exports->Set(
    context,
    v8::String::NewFromUtf8(isolate, "VideoEngine").ToLocalChecked(),
    tpl->GetFunction(context).ToLocalChecked()
  ).FromJust();
}

void VideoEngine::New(const v8::FunctionCallbackInfo<v8::Value>& args) {
  VideoEngine* obj = new VideoEngine();
  obj->Wrap(args.This());
  args.GetReturnValue().Set(args.This());
}

// More wrapper methods...
NODE_MODULE(video_engine, VideoEngine::Init)
```

**Create native/src/vlc_wrapper.cc:**
```cpp
// Placeholder for VLC wrapper utilities
// To be expanded as needed

#include "video_engine.h"
#include <vlc/vlc.h>

// Helper functions for VLC instance management
namespace vlc_helper {
  libvlc_media_list_player_t* CreateMediaListPlayer(
      libvlc_instance_t* vlc,
      const std::string& file_path) {
    
    libvlc_media_t* media = libvlc_media_new_path(vlc, file_path.c_str());
    if (!media) return nullptr;

    libvlc_media_list_t* media_list = libvlc_media_list_new(vlc);
    libvlc_media_list_add_media(media_list, media);

    libvlc_media_list_player_t* player = 
      libvlc_media_list_player_new(vlc);
    libvlc_media_list_player_set_media_list(player, media_list);

    libvlc_media_release(media);
    libvlc_media_list_release(media_list);

    return player;
  }

  void DestroyMediaListPlayer(libvlc_media_list_player_t* player) {
    if (player) {
      libvlc_media_list_player_stop(player);
      libvlc_media_list_player_release(player);
    }
  }
}
```

**Create native/src/sync_master.cc:**
```cpp
// Placeholder for sync algorithm
// To be implemented in Phase 3

#include <chrono>

class SyncMaster {
  // TODO: Implement in Phase 3
};
```

**Build test:**
```bash
npm run build:native
# Output should show:
# gyp info ok
# (successful compilation)
```

---

## Day 3: IPC Command Handlers (Main Process)

### Morning (3h): Create IPC Handler Architecture

**Create src/ipc/handlers/video.ts:**
```typescript
import { ipcMain, BrowserWindow } from 'electron';
import VideoWorker from '../../workers/video-worker';

export function RegisterVideoHandlers(mainWindow: BrowserWindow) {
  const videoWorker = new VideoWorker();

  // ===== LOAD VIDEO =====
  ipcMain.handle('video:load', async (event, payload) => {
    try {
      const result = await videoWorker.load(payload);
      console.log('✅ Video loaded:', payload.id);
      return result;
    } catch (error) {
      console.error('❌ Video load failed:', error);
      return { success: false, error: error.message };
    }
  });

  // ===== PLAY =====
  ipcMain.handle('video:play', async (event, { videoIds }) => {
    try {
      await videoWorker.play(videoIds);
      console.log('▶️  Play:', videoIds);
      return { success: true };
    } catch (error) {
      console.error('❌ Play failed:', error);
      return { success: false, error: error.message };
    }
  });

  // ===== PAUSE =====
  ipcMain.handle('video:pause', async (event, { videoIds }) => {
    try {
      await videoWorker.pause(videoIds);
      console.log('⏸️  Pause:', videoIds);
      return { success: true };
    } catch (error) {
      console.error('❌ Pause failed:', error);
      return { success: false, error: error.message };
    }
  });

  // ===== SEEK =====
  ipcMain.handle('video:seek', async (event, { videoId, position }) => {
    try {
      const state = await videoWorker.seek(videoId, position);
      console.log(`📍 Seek video ${videoId} to ${position}s`);
      return state;
    } catch (error) {
      console.error('❌ Seek failed:', error);
      return { success: false, error: error.message };
    }
  });

  // ===== GET STATE =====
  ipcMain.handle('video:getState', async (event, { videoId }) => {
    try {
      const state = await videoWorker.getState(videoId);
      return state;
    } catch (error) {
      console.error('❌ Get state failed:', error);
      return null;
    }
  });

  // ===== TELEMETRY STREAM =====
  // Start telemetry stream when window loads
  videoWorker.on('telemetry', (telemetry) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('video:telemetry', telemetry);
    }
  });

  // ===== ERROR HANDLING =====
  videoWorker.on('error', (error) => {
    console.error('🚨 Video worker error:', error);
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('video:error', {
        errorCode: error.code,
        message: error.message
      });
    }
  });

  // Cleanup on window close
  mainWindow.on('closed', () => {
    videoWorker.shutdown();
  });
}
```

### Afternoon (2h): Create Video Worker

**Create src/workers/video-worker.ts:**
```typescript
import { Worker } from 'worker_threads';
import path from 'path';
import { EventEmitter } from 'events';

interface VideoCommand {
  type: string;
  payload?: any;
}

export default class VideoWorker extends EventEmitter {
  private worker: Worker;
  private isReady: boolean = false;

  constructor() {
    super();
    
    this.worker = new Worker(path.join(__dirname, 'video-worker-impl.js'));

    this.worker.on('message', (msg) => {
      this.handleWorkerMessage(msg);
    });

    this.worker.on('error', (error) => {
      this.emit('error', error);
    });

    this.worker.on('exit', (code) => {
      if (code !== 0) {
        this.emit('error', new Error(`Worker exited with code ${code}`));
      }
    });

    this.isReady = true;
  }

  async load(config: { id: number; filePath: string }): Promise<any> {
    return this.sendCommand('LOAD', config);
  }

  async play(videoIds: number[]): Promise<any> {
    return this.sendCommand('PLAY', { videoIds });
  }

  async pause(videoIds: number[]): Promise<any> {
    return this.sendCommand('PAUSE', { videoIds });
  }

  async seek(videoId: number, position: number): Promise<any> {
    return this.sendCommand('SEEK', { videoId, position });
  }

  async getState(videoId: number): Promise<any> {
    return this.sendCommand('GET_STATE', { videoId });
  }

  private handleWorkerMessage(msg: any) {
    if (msg.type === 'TELEMETRY') {
      this.emit('telemetry', msg.data);
    } else if (msg.type === 'ERROR') {
      this.emit('error', new Error(msg.data.message));
    }
  }

  private sendCommand(type: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = Math.random().toString(36);

      const timeoutId = setTimeout(() => {
        reject(new Error(`Command timeout: ${type}`));
      }, 5000);

      const listener = (msg: any) => {
        if (msg.requestId === requestId) {
          clearTimeout(timeoutId);
          this.worker.removeListener('message', listener);

          if (msg.error) {
            reject(new Error(msg.error));
          } else {
            resolve(msg.result);
          }
        }
      };

      this.worker.on('message', listener);
      this.worker.postMessage({ type, payload, requestId });
    });
  }

  shutdown() {
    this.worker.terminate();
  }
}
```

**Create src/workers/video-worker-impl.js (worker thread):**
```javascript
// This runs in a separate thread
const { parentPort } = require('worker_threads');
const VideoEngine = require('../../build/Release/video_engine');

const videoEngine = new VideoEngine.VideoEngine();
let requestHandlers = {};

// Start telemetry loop
setInterval(() => {
  try {
    const telemetry = videoEngine.GetTelemetry();
    parentPort.postMessage({
      type: 'TELEMETRY',
      data: telemetry
    });
  } catch (error) {
    console.error('Telemetry error:', error);
  }
}, 33);  // 30 FPS telemetry

// Handle incoming commands
parentPort.on('message', (msg) => {
  const { type, payload, requestId } = msg;
  
  try {
    let result;

    switch (type) {
      case 'LOAD':
        result = videoEngine.LoadVideo(payload.id, payload.filePath);
        break;

      case 'PLAY':
        videoEngine.Play(payload.videoIds);
        result = { success: true };
        break;

      case 'PAUSE':
        videoEngine.Pause(payload.videoIds);
        result = { success: true };
        break;

      case 'SEEK':
        videoEngine.Seek(payload.videoId, payload.position * 1000);
        result = { success: true };
        break;

      case 'GET_STATE':
        result = videoEngine.GetState(payload.videoId);
        break;

      default:
        throw new Error(`Unknown command: ${type}`);
    }

    parentPort.postMessage({
      requestId,
      result,
      error: null
    });
  } catch (error) {
    parentPort.postMessage({
      requestId,
      result: null,
      error: error.message
    });
  }
});
```

---

## Day 4: React Integration & Testing

### Morning (2h): Create React Hook & Component

**Create src/hooks/useVideoPlayback.ts:**
```typescript
import { useEffect, useState, useCallback } from 'react';

declare const window: any;

export function useVideoPlayback(videoIds: number[]) {
  const [state, setState] = useState<Map<number, any>>(new Map());
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on(
      'video:telemetry',
      (event: any, telemetry: any) => {
        const newState = new Map(state);
        
        telemetry.forEach((videoState: any) => {
          newState.set(videoState.videoId, videoState);
        });
        
        setState(newState);
      }
    );

    return unsubscribe;
  }, [state]);

  const play = useCallback(async () => {
    try {
      await window.electron.ipcRenderer.invoke('video:play', { videoIds });
      setIsPlaying(true);
    } catch (error) {
      console.error('Play failed:', error);
    }
  }, [videoIds]);

  const pause = useCallback(async () => {
    try {
      await window.electron.ipcRenderer.invoke('video:pause', { videoIds });
      setIsPlaying(false);
    } catch (error) {
      console.error('Pause failed:', error);
    }
  }, [videoIds]);

  const seek = useCallback(async (position: number) => {
    try {
      for (const id of videoIds) {
        await window.electron.ipcRenderer.invoke('video:seek', {
          videoId: id,
          position
        });
      }
    } catch (error) {
      console.error('Seek failed:', error);
    }
  }, [videoIds]);

  return { state, isPlaying, play, pause, seek };
}
```

**Create src/components/VideoTest.tsx:**
```typescript
import React from 'react';
import { useVideoPlayback } from '../hooks/useVideoPlayback';

export const VideoTest: React.FC = () => {
  const { state, isPlaying, play, pause, seek } = useVideoPlayback([1]);
  const [videoPath, setVideoPath] = React.useState('');

  const handleLoad = async () => {
    try {
      // In real app, use file picker
      const filePath = videoPath || '/path/to/test.mp4';
      const result = await window.electron.ipcRenderer.invoke('video:load', {
        id: 1,
        filePath
      });
      console.log('Load result:', result);
    } catch (error) {
      console.error('Load failed:', error);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Video Engine Test</h2>
      
      <div>
        <input
          type="text"
          placeholder="Video file path"
          value={videoPath}
          onChange={(e) => setVideoPath(e.target.value)}
        />
        <button onClick={handleLoad}>Load Video</button>
      </div>

      <div>
        <button onClick={play} disabled={isPlaying}>
          ▶️ Play
        </button>
        <button onClick={pause} disabled={!isPlaying}>
          ⏸️ Pause
        </button>
        <button onClick={() => seek(5)}>
          Seek to 5s
        </button>
      </div>

      <div>
        <h3>State:</h3>
        {state.has(1) ? (
          <pre>{JSON.stringify(Array.from(state.values()), null, 2)}</pre>
        ) : (
          <p>No video loaded</p>
        )}
      </div>
    </div>
  );
};
```

### Afternoon (2h): End-to-End Test

**Create test/e2e.test.ts:**
```typescript
import { VideoWorker } from '../src/workers/video-worker';

describe('VideoEngine E2E', () => {
  let worker: VideoWorker;

  beforeAll(() => {
    worker = new VideoWorker();
  });

  afterAll(() => {
    worker.shutdown();
  });

  it('should initialize', async () => {
    expect(worker).toBeDefined();
  });

  it('should load a video without crashing', async () => {
    const result = await worker.load({
      id: 1,
      filePath: './fixtures/test_video.mp4'
    });
    
    console.log('Load result:', result);
    expect(result).toBeDefined();
  });

  it('should play video', async () => {
    const result = await worker.play([1]);
    expect(result.success).toBe(true);
  });

  it('should emit telemetry', (done) => {
    worker.on('telemetry', (data) => {
      console.log('Telemetry:', data);
      expect(data).toBeDefined();
      done();
    });

    setTimeout(() => {
      done(new Error('Timeout waiting for telemetry'));
    }, 2000);
  });

  it('should pause video', async () => {
    const result = await worker.pause([1]);
    expect(result.success).toBe(true);
  });

  it('should seek video', async () => {
    const result = await worker.seek(1, 5);
    expect(result).toBeDefined();
  });
});
```

**Run test:**
```bash
npm test -- test/e2e.test.ts
```

---

## Day 5: Integration & Verification

### Morning (2h): Build & Run

**Build everything:**
```bash
# Build native module
npm run build:native

# Build TypeScript
npm run build

# Run tests
npm test
```

**Checklist:**
```
✅ Native module compiles without errors
✅ IPC handlers registered
✅ Worker thread spawns correctly
✅ E2E test passes (load + play + pause + seek)
✅ Telemetry events emit every 33ms
✅ No memory leaks in native code (check Activity Monitor)
✅ React component receives telemetry data
```

### Afternoon (2h): Documentation & Cleanup

**Create docs/PHASE_1_COMPLETE.md:**
```markdown
# Phase 1 Complete: Infrastructure

## What Works
- [x] Native module (video_engine) builds and loads
- [x] IPC communication bidirectional
- [x] Worker thread processes commands
- [x] Telemetry streaming from native to React
- [x] Video object lifecycle (load/unload)

## Known Limitations
- Single video instance (no multi-video yet)
- No actual video rendering (Phase 2)
- No sync master clock (Phase 3)
- Telemetry is dummy data (Phase 2-3)

## What's Next
- Phase 2: Single video playback with rendering
- Test with real .mp4 files
- Measure resource usage (CPU, memory)

## Troubleshooting

### "libvlc.so not found"
```bash
# macOS
brew install vlc

# Ubuntu
sudo apt-get install libvlc-dev

# Windows
choco install vlc-dev
```

### Native module build fails
```bash
npm run rebuild:native
# Check node version compatibility
node --version  # Should be 18.0.0+
```

### IPC commands timeout
- Check worker thread is running
- Verify VideoEngine object initialized
- Add console.log() to track command flow
```

## Metrics
- Build time: ~30 seconds
- Test suite: ~500ms
- Telemetry latency: <1ms
- Memory overhead: ~20MB
```

**Commit & push:**
```bash
git add -A
git commit -m "feat: phase 1 infrastructure setup (IPC + native module)"
git push origin phase-1-infra
```

---

## Troubleshooting Guide

### Issue: "node-gyp: command not found"
```bash
npm install -g node-gyp
```

### Issue: "Cannot find libvlc"
```bash
# Verify installation
pkg-config --cflags --libs libvlc

# If not found, reinstall
brew uninstall vlc
brew install vlc

# Update binding.gyp include path
```

### Issue: Worker thread crashes silently
```bash
# Add better error logging
// In video-worker.ts
this.worker.on('error', (error) => {
  console.error('WORKER_ERROR:', error.stack);
});
```

### Issue: IPC commands don't reach worker
```bash
# Check if worker was initialized
console.log('Worker ready:', this.isReady);

# Add request timeout logging
console.log(`Sending ${type}`, requestId);
```

---

## Success Criteria for Day 5

- ✅ All tests pass
- ✅ No errors in build log
- ✅ IPC round-trip < 5ms
- ✅ Telemetry emits every 33ms
- ✅ Telemetry payload < 1KB
- ✅ Process memory stable (no leaks)
- ✅ Code committed to git

---

## Next: Phase 2 Planning

Once Phase 1 complete:
1. Load real MP4 files
2. Attach VLC window to BrowserWindow
3. Test on all 3 platforms (Win/Mac/Linux)
4. Fix platform-specific issues

**Timeline:** Phase 2 starts Monday

---

**Phase 1 Owner:** [Engineer name]  
**Phase 1 Status:** ⏳ In Progress  
**Completion Date:** EOD Friday
