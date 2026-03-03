# Phase 2 Debugging Guide

**Target:** Single Native Video Playback  
**Scope:** Days 6-10 Implementation Verification  
**Updated:** 2026-03-02

---

## Quick Diagnostics

### 1. Native Module Not Loading

**Symptom:** "Cannot find module" error when require('video_player')

```bash
# Check if native module was built
ls -la desktop/native/build/Release/
# Should see: video_player.node (macOS/Linux) or video_player.napi.node (Windows)

# Rebuild if missing
npm run build:native:clean
npm run build:native

# Verify build output
node -e "const v = require('./desktop/native/build/Release/video_player'); console.log(v)"
```

### 2. Video Not Rendering to Window

**Symptom:** Black screen, no video visible

```cpp
// Add debug logging in VideoPlayer.cc
bool VideoPlayer::SetWindowHandle(void* hwnd) {
  std::lock_guard<std::mutex> lock(state_mutex_);
  
  std::cerr << "Setting window handle: " << hwnd << std::endl;
  
  if (!media_player_) {
    LogError("SetWindowHandle", "Media player not initialized");
    return false;
  }

#ifdef _WIN32
  std::cerr << "Using Windows HWND binding" << std::endl;
  libvlc_media_player_set_hwnd(media_player_, hwnd);
#endif
  
  return true;
}
```

**Diagnostics:**
```bash
# Check platform detection
node -e "console.log(process.platform)"  # win32, darwin, linux

# Verify libvlc is installed
which vlc              # macOS/Linux
where vlc.exe          # Windows

# Check libvlc version
vlc --version
```

### 3. Frame Position Tracking Incorrect

**Symptom:** GetCurrentFrame() returns wrong values

```cpp
// Debug frame calculation
int VideoPlayer::GetCurrentFrame() const {
  int64_t current_time_ms = libvlc_media_player_get_time(media_player_);
  double fps = GetFps();
  
  std::cerr << "GetCurrentFrame: time=" << current_time_ms << "ms, fps=" << fps << std::endl;
  
  int frame = static_cast<int>((current_time_ms / 1000.0) * fps);
  std::cerr << "Calculated frame: " << frame << std::endl;
  
  return frame;
}
```

**Expected Behavior:**
```
Time: 1000ms (1 second), FPS: 60 → Frame: 60
Time: 2500ms (2.5 seconds), FPS: 60 → Frame: 150
Time: 5000ms (5 seconds), FPS: 30 → Frame: 150
```

**Verification Script:**
```typescript
// test-frame-tracking.js
const VideoPlayer = require('./native/build/Release/video_player').VideoPlayer;
const player = new VideoPlayer();

player.initialize('/path/to/test.mp4');

const testPoints = [
  { seek: 0, fps: 60, expectedFrame: 0 },
  { seek: 1000, fps: 60, expectedFrame: 60 },
  { seek: 2500, fps: 60, expectedFrame: 150 },
  { seek: 5000, fps: 30, expectedFrame: 150 }
];

testPoints.forEach(test => {
  player.seek(test.seek);
  const actualFrame = player.getCurrentFrame();
  const actualFps = player.getFps();
  const match = actualFrame === test.expectedFrame ? '✓' : '✗';
  console.log(`${match} Seek ${test.seek}ms: got frame=${actualFrame} (fps=${actualFps}), expected=${test.expectedFrame}`);
});
```

### 4. Performance Metrics Are Zero

**Symptom:** GetPerformanceMetrics() returns all zeros

```cpp
// Check metrics update is being called
void VideoPlayer::ProcessEvents() {
  // ...
  UpdatePerformanceMetrics();  // Make sure this is called
  std::cerr << "Updated metrics: fps=" << current_metrics_.current_fps 
            << ", frames=" << current_metrics_.total_frames_rendered << std::endl;
}
```

**Verification:**
```javascript
const metrics = player.getPerformanceMetrics();
console.log('Current FPS:', metrics.currentFps);
console.log('Total Frames:', metrics.totalFramesRendered);

// Should see metrics increasing over time
for (let i = 0; i < 10; i++) {
  player.processEvents();
  console.log('Metrics:', player.getPerformanceMetrics());
}
```

### 5. Seek Latency Not Recorded

**Symptom:** seekLatencyMs always zero

```cpp
// Verify seek timing
bool VideoPlayer::Seek(int64_t time_ms) {
  auto seek_start = std::chrono::steady_clock::now();
  std::cerr << "Seek started at: " << seek_start.time_since_epoch().count() << std::endl;
  
  // Actual seek...
  libvlc_media_player_set_time(media_player_, time_ms, true);
  
  auto seek_end = std::chrono::steady_clock::now();
  last_seek_latency_ms_ = std::chrono::duration_cast<std::chrono::milliseconds>(
      seek_end - seek_start).count();
  
  std::cerr << "Seek completed in " << last_seek_latency_ms_ << "ms" << std::endl;
  
  return true;
}
```

---

## Platform-Specific Issues

### Windows HWND Issues

**Problem:** "Invalid window handle"

```cpp
// Verify HWND is valid before use
#ifdef _WIN32
bool VideoPlayer::SetWindowHandle(void* hwnd) {
  if (!IsWindow((HWND)hwnd)) {
    LogError("SetWindowHandle", "Invalid HWND");
    return false;
  }
  // ... rest of binding
}
#endif
```

**Test HWND Validity:**
```javascript
// In Electron main process
const { BrowserWindow } = require('electron');
const win = new BrowserWindow();

// Get actual window handle
const hwnd = win.getNativeWindowHandle();  // May not be available in all Electron versions
console.log('HWND:', hwnd);

// Alternative: use win.id instead
console.log('Window ID:', win.id);
```

### macOS View Issues

**Problem:** "Cannot attach to NSView"

```cpp
#ifdef __APPLE__
// Verify NSView is valid
bool VideoPlayer::SetWindowHandle(void* hwnd) {
  if (!hwnd) {
    LogError("SetWindowHandle", "Invalid NSView pointer");
    return false;
  }
  
  libvlc_media_player_set_nsobject(media_player_, hwnd);
  return true;
}
#endif
```

### Linux X11 Issues

**Problem:** "Cannot find X11 window"

```cpp
#else  // Linux
// X11 window ID should be uint32_t, not void*
bool VideoPlayer::SetWindowHandle(void* hwnd) {
  uint32_t xid = reinterpret_cast<uint32_t>(hwnd);
  std::cerr << "Setting X11 window ID: " << xid << std::endl;
  
  if (xid == 0) {
    LogError("SetWindowHandle", "Invalid X11 window ID");
    return false;
  }
  
  libvlc_media_player_set_xwindow(media_player_, xid);
  return true;
}
#endif
```

**Diagnose X11:**
```bash
# Check X11 is running
echo $DISPLAY
# Should output something like ":0"

# List windows
xdotool search --name "."

# Get window ID for debugging
xdotool getactivewindow
```

---

## Common Build Errors

### Error: "Cannot find libvlc headers"

```bash
# Install VLC development libraries

# macOS
brew install vlc
# Check installation
pkg-config --cflags --libs libvlc

# Ubuntu/Debian
sudo apt-get install libvlc-dev
pkg-config --cflags --libs libvlc

# Windows
# Download VLC from videolan.org
# Set environment: set VLC_HOME=C:\Program Files\VideoLAN\VLC
```

### Error: "undefined reference to libvlc_*"

```bash
# Ensure binding.gyp includes correct library paths

# Check binding.gyp has:
# - "include_dirs": [...includes libvlc headers...]
# - "libraries": [...libvlc.lib or -lvlc...]
# - Platform-specific entries for Windows/macOS/Linux
```

### Error: "node-gyp: command not found"

```bash
# Install node-gyp globally or use local copy
npm install -g node-gyp

# Or use npx
npx node-gyp configure build --directory=native
```

---

## Performance Debugging

### Frame Drop Detection

```cpp
// Track frame drops by monitoring libvlc events
void VideoPlayer::MonitorFrameDrops() {
  // Hook into libvlc_event_manager_t
  libvlc_event_manager_t* em = libvlc_media_player_event_manager(media_player_);
  
  // Listen for state changes that indicate drops
  libvlc_event_t event;
  // Check for libvlc_MediaPlayerBuffering, etc.
}
```

### CPU Usage (Placeholder Implementation)

```cpp
// Platform-specific CPU measurement (TODO for Phase 5)

#ifdef _WIN32
#include <windows.h>
#include <psapi.h>

double GetCpuUsagePercent() {
  // Use Windows Performance API
  // or Task Manager WMI queries
  return 0.0;  // Placeholder
}

#elif __APPLE__
#include <mach/mach.h>

double GetCpuUsagePercent() {
  // Use mach_host_self() API
  return 0.0;  // Placeholder
}

#else  // Linux
#include <sys/stat.h>

double GetCpuUsagePercent() {
  // Parse /proc/self/stat
  return 0.0;  // Placeholder
}
#endif
```

### Memory Usage (Placeholder Implementation)

```cpp
#include <cstdint>

double GetMemoryMb() {
#ifdef _WIN32
  // Use PROCESS_MEMORY_COUNTERS
  PROCESS_MEMORY_COUNTERS pmc;
  GetProcessMemoryInfo(GetCurrentProcess(), &pmc, sizeof(pmc));
  return pmc.WorkingSetSize / (1024 * 1024.0);
#else
  // Use /proc/self/status on Linux
  // or libproc on macOS
  return 0.0;  // Placeholder
#endif
}
```

---

## IPC Communication Debugging

### Test IPC Handlers

```javascript
// test-ipc.js
const { ipcMain, BrowserWindow, app } = require('electron');

// Set up VideoIpcHandler as usual...

// Test directly
async function testIpc() {
  console.log('Testing video:initialize...');
  const result = await ipcHandler.videoPlayer.initialize('/path/to/test.mp4');
  console.log('Result:', result);
  
  console.log('Testing video:play...');
  const playResult = await ipcHandler.videoPlayer.play();
  console.log('Play result:', playResult);
  
  // Test metrics
  const metrics = ipcHandler.videoPlayer.getPerformanceMetrics();
  console.log('Metrics:', metrics);
}

// Run after app ready
app.on('ready', testIpc);
```

### Monitor Telemetry Stream

```javascript
// Monitor telemetry updates
ipcRenderer.on('video:telemetry', (event, telemetry) => {
  console.log('Telemetry update:', {
    frame: telemetry.frame,
    fps: telemetry.metrics.currentFps,
    time: telemetry.currentTime
  });
});
```

---

## Test Suite Execution

### Run All Phase 2 Tests

```bash
npm test -- test/native-rendering.test.ts
```

### Run Specific Test Suite

```bash
# Window rendering tests only
npm test -- --grep "Window Rendering"

# Frame tracking tests
npm test -- --grep "Frame Position Tracking"

# Performance metrics tests
npm test -- --grep "Performance Metrics"

# Success criteria tests
npm test -- --grep "Success Criteria"
```

### Enable Verbose Test Output

```javascript
// In test file
describe('Native Video Rendering', () => {
  beforeEach(() => {
    console.log('Starting test:', this.currentTest.title);
  });
  
  it('should work', () => {
    console.log('Test running...');
    // test code
    console.log('Test completed.');
  });
});
```

---

## Logging & Tracing

### Enable Debug Logging

```cpp
// In VideoPlayer.cc
#define VLOG(level) if (level <= DEBUG_LEVEL) std::cerr

const int DEBUG_LEVEL = 2;  // 0=off, 1=errors, 2=info, 3=verbose

void VideoPlayer::Seek(int64_t time_ms) {
  VLOG(1) << "Seek requested to " << time_ms << "ms";
  // ... actual seek code
  VLOG(1) << "Seek completed, latency=" << last_seek_latency_ms_ << "ms";
}
```

### Check libvlc Debug Output

```cpp
// Enable libvlc verbose logging
const char* args[] = {
  "--verbose=3"  // 0=none, 1=error, 2=warning, 3=debug, 4=more
};
vlc_instance = libvlc_new(1, args);
```

---

## Crash Diagnostics

### Handle Segmentation Faults

```cpp
// Add signal handlers for debugging
#include <signal.h>

void segfault_handler(int sig) {
  std::cerr << "SEGFAULT in VideoPlayer!" << std::endl;
  // Print backtrace
  exit(1);
}

void VideoPlayer::Initialize(const std::string& file_path) {
  signal(SIGSEGV, segfault_handler);
  // ... rest of init
}
```

### Use Address Sanitizer

```bash
# Build with ASAN (Linux/macOS)
export CXXFLAGS="-fsanitize=address"
npm run build:native

# Run with ASAN
npm test
# Will report memory errors and crashes with stack traces
```

### Valgrind Memory Check (Linux)

```bash
# Install valgrind
sudo apt-get install valgrind

# Run Node with Valgrind
valgrind --leak-check=full --show-leak-kinds=all \
  node -e "require('./test/native-rendering.test.ts')"
```

---

## Checklist: Phase 2 Validation

### Before Deployment

- [ ] Native module builds without errors
  ```bash
  npm run build:native:clean && npm run build:native
  ```

- [ ] All tests pass
  ```bash
  npm test -- test/native-rendering.test.ts
  ```

- [ ] No memory leaks (24h playback test)
  ```bash
  # Run continuous playback test
  node scripts/stress-test-24h.js
  ```

- [ ] Window rendering works on target platforms
  - [ ] Windows (HWND binding)
  - [ ] macOS (NSView binding)
  - [ ] Linux (XCB binding)

- [ ] Frame tracking accurate (±0 frames)
  ```bash
  npm test -- --grep "Frame Position Tracking"
  ```

- [ ] Metrics collection active
  - [ ] FPS reporting
  - [ ] Frame count incrementing
  - [ ] Seek latency < 100ms

- [ ] IPC handlers respond correctly
  ```javascript
  await ipcRenderer.invoke('video:getCurrentFrame');
  await ipcRenderer.invoke('video:getPerformanceMetrics');
  ```

- [ ] No errors in console during playback
  ```
  npm run dev
  # Check Electron DevTools console for errors
  ```

---

## Quick Reference: Error Codes

| Code | Meaning | Fix |
|------|---------|-----|
| E001 | libvlc instance creation failed | Install libvlc-dev |
| E002 | Media load failed | Check file path, verify file exists |
| E003 | Playback failed | Verify codec support, try different video |
| E004 | Invalid window handle | Ensure window is valid before attaching |
| E005 | FPS detection failed | Check video format, may be uncommon |
| E006 | Seek out of bounds | Clamp seek position to duration |

---

## Next Steps

1. **Run Phase 2 tests** to validate implementation
2. **Test on all platforms** (Windows, macOS, Linux)
3. **Enable logging** to trace any issues
4. **Iterate on fixes** for any failures
5. **Proceed to Phase 3** once all criteria met

---

**End of Phase 2 Debugging Guide**
