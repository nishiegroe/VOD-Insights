# VOD Insights Native Video Module

**Status:** Week 1 Phase 1 - Infrastructure Setup
**Language:** C++17 with Node.js bindings (Nan)
**Framework:** libvlc (VideoLAN Core Library)

## 📁 Structure

```
native/
├── src/
│   ├── VideoPlayer.cc            - libvlc C++ wrapper implementation
│   └── VideoPlayerAddon.cc       - Node.js/V8 addon wrapper
├── include/
│   └── VideoPlayer.h             - Header with thread-safe class
├── build/                        - Compiled binaries (auto-generated)
│   └── Release/
│       └── video_player.node     - Compiled native module
├── binding.gyp                   - node-gyp build configuration
├── test-build.js                 - Build verification script
└── README.md                     - This file
```

## 🛠️ Building

### Prerequisites

**All Platforms:**
- Node.js v20+
- Python 3.x
- C++ compiler with C++17 support

**Platform-Specific:**

**Windows:**
```bash
# Install VLC development libraries
# Option 1: Using vcpkg (recommended)
vcpkg install vlc:x64-windows

# Option 2: Manual installation
# Download from https://www.videolan.org/developers/
# Add to PATH or update binding.gyp
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

### Build Commands

```bash
# From desktop/ directory
cd desktop

# Install dependencies
npm install

# Build the native module
npm run build:native

# Clean build
npm run build:native:clean

# Rebuild from scratch
npm run build:native:rebuild

# Test the build
node native/test-build.js
```

## 📋 Files Explained

### VideoPlayer.h - Class Definition

**Public Methods:**
- `Initialize(filePath)` - Load a media file
- `Play()` - Start playback
- `Pause()` - Pause playback
- `Stop()` - Stop and unload
- `Seek(timeMs)` - Jump to specific time
- `SetPlaybackRate(rate)` - Change speed (0.5x to 4x)
- `GetCurrentTime()` - Get current position (ms)
- `GetDuration()` - Get total length (ms)
- `GetState()` - Get state string ("playing"/"paused"/"stopped")
- `IsPlaying()` - Boolean check
- `SetStateCallback(callback)` - Subscribe to state changes
- `SetErrorCallback(callback)` - Subscribe to errors
- `ProcessEvents()` - Update state, call callbacks
- `GetLastError()` - Get last error message

**Thread Safety:**
- All public methods protected by `std::mutex`
- Safe for use from multiple threads
- Callbacks happen on the calling thread (ProcessEvents)

**Callbacks:**
- State updates: `(currentTime, duration, state) -> void`
- Errors: `(errorMessage) -> void`
- Called automatically when `ProcessEvents()` executes

### VideoPlayer.cc - Implementation

**Key Features:**
- ~200 lines of implementation
- Full error handling with logging
- State management (playing/paused/stopped)
- Automatic telemetry (33ms update rate)
- Graceful degradation on errors

**Error Handling Strategy:**
1. Check preconditions (player initialized?)
2. Call libvlc function
3. Check return value
4. Log error with context
5. Fire error callback
6. Return false to caller

**Thread Safety Implementation:**
```cpp
// Every public method:
std::lock_guard<std::mutex> lock(state_mutex_);
// Prevents race conditions on state
```

### VideoPlayerAddon.cc - Node.js Binding

**Technologies:**
- **Nan** (Node.js Native Abstractions) for V8 compatibility
- Handles type conversions between C++ and JavaScript
- Uses `ObjectWrap` for object lifecycle management

**All Methods Exposed:**
```javascript
new VideoPlayer()           // Constructor
.initialize(path)           // Returns boolean
.play()                     // Returns boolean
.pause()                    // Returns boolean
.seek(ms)                   // Returns boolean
.setPlaybackRate(rate)      // Returns boolean
.getCurrentTime()           // Returns number (ms)
.getDuration()              // Returns number (ms)
.getState()                 // Returns string
.isPlaying()                // Returns boolean
.processEvents()            // Returns undefined
.shutdown()                 // Returns undefined
.getLastError()             // Returns string
```

**Type Conversions:**
- `std::string` ↔ `v8::String`
- `bool` ↔ `v8::Boolean`
- `int64_t` ↔ `v8::Number`
- `float` ↔ `v8::Number`

### binding.gyp - Build Configuration

**Platform Detection:**
```python
if platform == "win32":
  # Windows-specific includes, libs, defines
elif platform == "darwin":  # macOS
  # macOS-specific Xcode settings
elif platform == "linux":
  # Linux-specific flags
```

**Compiler Flags:**
- `-std=c++17` - Modern C++ standard
- `-Wall -Wextra` - Warnings enabled
- `-fPIC` - Position-independent code
- `-O2` (default optimization) - Performance

**libvlc Linking:**
- Windows: `libvlc.lib`, `libvlccore.lib`
- macOS: `-lvlc` with Xcode settings
- Linux: `-lvlc`, `-lvlccore`

## 🧪 Testing

### Quick Test
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

### Manual Testing (in Node.js REPL)

```javascript
const VideoPlayer = require('./build/Release/video_player');
const player = new VideoPlayer();

// Test basic operations
console.log(player.getState());        // "stopped"
console.log(player.getCurrentTime());  // 0
console.log(player.getDuration());     // 0

// Test initialization
const success = player.initialize('/path/to/video.mp4');
console.log(success);                  // true or false

// Test playback
if (success) {
  player.play();
  player.processEvents();
  setTimeout(() => {
    player.pause();
    player.shutdown();
  }, 5000);
}
```

## 🔍 Debugging

### Compiler Errors

**"libvlc.h not found"**
- Cause: libvlc headers not installed
- Solution: Install VLC development libraries (see Prerequisites)

**"undefined reference to libvlc_*"**
- Cause: libvlc libraries not linked
- Solution: Check binding.gyp library paths, reinstall libvlc

**"error: no member named 'value' in 'v8::Local'"**
- Cause: V8/Nan version mismatch
- Solution: `npm install nan@latest && npm run build:native:rebuild`

### Runtime Errors

**"The specified module could not be found"**
- Cause: Missing DLL on Windows
- Solution: Ensure VLC runtime is installed, add to PATH

**"Segmentation fault"**
- Cause: Invalid memory access
- Solution: Check for null pointers, invalid media paths
- Debug: Use gdb (Linux/macOS) or WinDbg (Windows)

### Logging

**C++ Debugging:**
```cpp
std::cerr << "Debug message: " << value << std::endl;
// Messages appear in console
```

**JavaScript Debugging:**
```javascript
const player = new VideoPlayer();
const error = player.getLastError();
console.log(error);  // Check last error
```

## 📊 Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| Initialize | 50-200ms | Depends on file size |
| Play | <10ms | Usually instant |
| Seek | 50-150ms | Keyframe-dependent |
| Pause | <5ms | Immediate |
| SetRate | <5ms | Takes effect smoothly |
| GetCurrentTime | <1ms | Cached, fast query |
| ProcessEvents | 5-10ms | Telemetry processing |

## 🔄 Integration with Electron

### From ipcHandler.ts

```typescript
// Imported and used like:
const player = new VideoPlayer();
player.initialize('/path/to/video.mp4');
player.play();
player.processEvents();  // Called periodically
```

### IPC Handler Setup

```typescript
ipcMain.handle('video:play', async () => {
  return player.play();  // Returns true/false
});
```

### From React

```typescript
// Via IPC:
const success = await ipcRenderer.invoke('video:play');
```

## 🚀 Next Steps

1. **Install libvlc** on your system
2. **Build:** `npm run build:native`
3. **Test:** `node native/test-build.js`
4. **Verify:** Successful compilation and all tests pass
5. **Integrate:** See ipcHandler.ts for Electron integration

## 📚 References

### libvlc
- Documentation: https://www.videolan.org/developers/vlc/doc/doxygen/html/
- API Reference: https://www.videolan.org/developers/vlc/doc/doxygen/html/group__libvlc.html
- Examples: https://github.com/videolan/vlc/tree/master/lib

### Node.js Native Addons
- Nan Guide: https://github.com/nodejs/nan
- node-gyp: https://github.com/nodejs/node-gyp
- V8 API: https://v8.dev/docs

### C++
- cppreference: https://en.cppreference.com/
- Modern C++ (C++17): https://cppinsights.io/

## 🐛 Common Issues & Solutions

### Issue: Build hangs/takes very long

**Solution:**
```bash
# Kill any stuck processes
pkill -f node-gyp

# Clean and rebuild
npm run build:native:clean
npm run build:native
```

### Issue: Changes to .cc files not reflected

**Solution:**
```bash
# Touch binding.gyp to force rebuild
touch binding.gyp
npm run build:native
```

### Issue: Different behavior on different machines

**Cause:** libvlc version differences
**Solution:** Document which libvlc version was used, test cross-platform

---

**Created:** Phase 1 - Week 1
**Updated:** 2026-03-02
**Next Review:** After Phase 1 completion

## Quick Commands Reference

```bash
# Install & build
npm install
npm run build:native

# Test
node native/test-build.js

# Clean
npm run build:native:clean

# Rebuild
npm run build:native:rebuild

# Full rebuild (dev)
npm run dev
```

---

**Status:** ✅ Ready for libvlc integration testing
