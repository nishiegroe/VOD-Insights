# Phase 1: Electron Native Video - Quick Start

**Timeline:** Week 1 of 28-day implementation (Days 1-5)
**Status:** Infrastructure Setup - Week 1
**Target:** EOD Friday

## 📁 Directory Structure Created

```
desktop/
├── native/
│   ├── src/
│   │   ├── VideoPlayer.cc          # libvlc C++ wrapper implementation
│   │   └── VideoPlayerAddon.cc     # Node.js addon wrapper
│   ├── include/
│   │   └── VideoPlayer.h           # Header file with thread-safe design
│   ├── build/                       # Compiled binaries (auto-generated)
│   ├── binding.gyp                 # node-gyp build configuration
│   └── test-build.js               # Build test script
├── ipcHandler.ts                   # Electron IPC handlers for video commands
├── videoWorker.ts                  # piscina worker thread for non-blocking ops
└── package.json                    # Updated with native module config
```

## 🔧 Setup Instructions

### Prerequisites

**All Platforms:**
- Node.js v20+ (already installed)
- Python 3.x (required by node-gyp)
- Build tools (Visual Studio on Windows, Xcode on macOS, build-essential on Linux)

**Platform-Specific Dependencies:**

**Windows:**
```bash
# Install VLC development libraries via vcpkg
vcpkg install vlc:x64-windows
# Add to PATH or update binding.gyp to point to vcpkg installation
```

**macOS:**
```bash
brew install vlc
brew install pkg-config
```

**Linux:**
```bash
sudo apt-get install libvlc-dev vlc-plugin-base
sudo apt-get install build-essential python3
```

### Installation Steps

1. **Install node-gyp and dependencies:**
```bash
cd desktop
npm install
# This will install:
# - node-gyp (build system)
# - nan (Node.js Native Abstractions)
# - piscina (worker thread pool)
# - @types/node (TypeScript types)
```

2. **Build the native module:**
```bash
npm run build:native
```

3. **Test the build:**
```bash
node native/test-build.js
```

Expected output:
```
✅ Binary file found
✅ Native module loaded successfully
✅ VideoPlayer instance created
✅ All 13 expected methods are available
✅ All tests passed!
```

4. **Verify integration:**
```bash
# Run the dev environment
npm run dev
```

## 🏗️ Architecture Overview

### Native Module Stack

```
React Frontend (UI)
    ↓
Electron IPC (ipcHandler.ts)
    ↓
Main Process IPC Handlers
    ↓
Native Module (video_player.node)
    ↓
libvlc (Video Framework)
```

### Components

#### 1. **VideoPlayer.h/cc** - C++ Wrapper
- Thread-safe libvlc instance management
- Methods: play(), pause(), seek(), setPlaybackRate(), getCurrentTime()
- Error handling with callback system
- State management (playing/paused/stopped)
- Telemetry support (state updates every 33ms)

#### 2. **VideoPlayerAddon.cc** - Node.js Binding
- Exposes VideoPlayer class to JavaScript using Nan
- Handles type conversions between C++ and JavaScript
- All 13 methods callable from Node.js/TypeScript

#### 3. **binding.gyp** - Build Configuration
- Configures node-gyp for Windows/Mac/Linux
- Defines libvlc include paths and libraries
- Platform-specific compiler flags

#### 4. **ipcHandler.ts** - Electron IPC
- Maps React commands to native module calls
- Handles 14 IPC handlers:
  - Playback control: play, pause, stop, seek, setPlaybackRate
  - State queries: getCurrentTime, getDuration, getState, isPlaying
  - Telemetry: startTelemetry, stopTelemetry
  - Lifecycle: initialize, shutdown, getLastError

#### 5. **videoWorker.ts** - piscina Worker
- Non-blocking video operations
- Message-based command processing
- Operations: analyzeFrame, processTelemetry, generatePlaybackReport, extractKeyframes
- Prevents main thread blocking

## 📋 IPC Message Protocol

### Command Format

**From React:**
```typescript
// Playback control
await ipcRenderer.invoke('video:initialize', '/path/to/video.mp4');
await ipcRenderer.invoke('video:play');
await ipcRenderer.invoke('video:pause');
await ipcRenderer.invoke('video:seek', 5000); // 5 seconds in ms
await ipcRenderer.invoke('video:setPlaybackRate', 1.5);

// State queries
const currentTime = await ipcRenderer.invoke('video:getCurrentTime');
const duration = await ipcRenderer.invoke('video:getDuration');
const state = await ipcRenderer.invoke('video:getState');
const playing = await ipcRenderer.invoke('video:isPlaying');

// Telemetry
await ipcRenderer.invoke('video:startTelemetry', 33); // 30 FPS
await ipcRenderer.invoke('video:stopTelemetry');

// Error handling
const error = await ipcRenderer.invoke('video:getLastError');
```

### Response Format

**Success:**
```typescript
{
  success: true,
  // Specific response depends on command
}
```

**Error:**
```typescript
{
  success: false,
  error: "Error message describing what went wrong"
}
```

### Telemetry Stream

**From Main Process (every 33ms):**
```typescript
ipcRenderer.on('video:telemetry', (frame: TelemetryFrame) => {
  // {
  //   timestamp: 1703275200000,
  //   currentTime: 5000,
  //   duration: 120000,
  //   state: 'playing',
  //   fps: 30
  // }
});
```

## ✅ Success Criteria (EOD Friday)

- [x] Native module directory structure created
- [x] binding.gyp configured for Windows/Mac/Linux
- [x] VideoPlayer.h/cc implemented with thread-safe design
- [x] VideoPlayerAddon.cc Node.js bindings
- [x] ipcHandler.ts with 14 IPC handlers
- [x] videoWorker.ts piscina worker setup
- [x] test-build.js for verification
- [ ] Native module compiles without errors (requires libvlc installation)
- [ ] All IPC handlers functional
- [ ] Telemetry streaming at 30 FPS
- [ ] Documentation complete

## 🔍 Integration Checklist

### Before Phase 2 (Next Week)

**For the next developer:**

- [ ] Read this file and IMPLEMENTATION_PLAN_ELECTRON_NATIVE_VIDEO.md
- [ ] Install libvlc on your development machine
- [ ] Run `npm run build:native` to verify compilation
- [ ] Run `node native/test-build.js` to verify the module loads
- [ ] Integrate ipcHandler.ts into desktop/main.js (see integration guide)
- [ ] Create React components that use the IPC handlers
- [ ] Test video playback with a sample MP4 file
- [ ] Measure FPS and latency

### Environment Variables

Add to your `.env.local` (or set in shell):
```bash
# Optional: Control IPC timeout (ms)
ELECTRON_IPC_TIMEOUT=5000

# Optional: Video playback buffer size (frames)
VIDEO_BUFFER_SIZE=100

# Optional: Telemetry logging level
VIDEO_LOG_LEVEL=debug
```

## 📚 File Reference

| File | Purpose | Status |
|------|---------|--------|
| `binding.gyp` | node-gyp config | ✅ Complete |
| `native/src/VideoPlayer.cc` | C++ wrapper impl | ✅ Complete |
| `native/include/VideoPlayer.h` | C++ header | ✅ Complete |
| `native/src/VideoPlayerAddon.cc` | Node.js addon | ✅ Complete |
| `ipcHandler.ts` | Electron IPC setup | ✅ Complete |
| `videoWorker.ts` | Worker thread | ✅ Complete |
| `native/test-build.js` | Build test | ✅ Complete |
| `PHASE_1_QUICK_START.md` | This file | ✅ Complete |
| `IMPLEMENTATION_PLAN_ELECTRON_NATIVE_VIDEO.md` | Full plan | ✅ Complete |

## 🐛 Troubleshooting

### Build fails with "libvlc.h not found"

**Solution:** Install libvlc development headers (see Prerequisites)

### Error: "The specified module could not be found"

**Cause:** Missing DLL dependencies on Windows
**Solution:** Ensure VLC is installed and in PATH

### "node-gyp: command not found"

**Solution:** 
```bash
npm install -g node-gyp
# OR use npx
npx node-gyp configure build
```

### Compilation errors in VideoPlayerAddon.cc

**Cause:** Nan or V8 version mismatch
**Solution:**
```bash
npm run build:native:clean
npm install nan@latest
npm run build:native
```

## 📞 Next Steps

1. **Install libvlc** on your development machine
2. **Build native module:** `npm run build:native`
3. **Run tests:** `node native/test-build.js`
4. **Review ipcHandler.ts** integration points
5. **Create video UI component** in React
6. **Test end-to-end** with sample video file

## 📖 Documentation Files

- **PHASE_1_QUICK_START.md** (this file) - Quick setup guide
- **IMPLEMENTATION_PLAN_ELECTRON_NATIVE_VIDEO.md** - Full 28-day roadmap
- **binding.gyp** - Build configuration with detailed comments
- **VideoPlayer.h** - Doxygen-style C++ documentation
- **ipcHandler.ts** - TSDoc comments for all IPC handlers
- **videoWorker.ts** - Worker operation documentation

---

**Created:** Phase 1 Infrastructure (Week 1)
**Updated:** 2026-03-02
**Next Review:** Phase 2 - UI Integration (Week 2)
