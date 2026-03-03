# Native Video Feature Setup & Deployment Guide

**Feature:** Multi-VOD Synchronized Playback  
**Phase:** Phase 3 (Native Video Integration)  
**Last Updated:** 2026-03-03

---

## Overview

This guide covers setting up and deploying the native video feature, which enables synchronized multi-VOD playback using libvlc.

### Prerequisites

| Component | Version | Purpose |
|-----------|---------|---------|
| Node.js | ≥18.x | Runtime |
| Electron | ≥27.x | Desktop shell |
| libvlc | ≥4.0.0 | Video playback |
| make/gcc | Latest | Native compilation |

---

## System Requirements

### Windows
- Windows 10/11 (64-bit)
- 8GB RAM minimum
- Video card with hardware acceleration

### macOS
- macOS 10.15+
- 8GB RAM minimum
- Apple Silicon or Intel

### Linux
- Ubuntu 20.04+ or equivalent
- 8GB RAM
- libvlc development libraries

---

## Installation

### 1. Install Build Dependencies

#### Windows
```powershell
# Install Visual Studio Build Tools
# Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/

# Install Node.js if not present
winget install OpenJS.NodeJS.LTS
```

#### macOS
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install Homebrew if not present
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install libvlc
brew install vlc
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install -y build-essential libvlc-dev vlc
```

### 2. Install Node Dependencies

```bash
cd vod-insights/desktop
npm install
```

### 3. Configure Electron

Ensure `electron-rebuild` is installed:

```bash
npm install @electron/rebuild --save-dev
```

### 4. Build Native Module

```bash
# Development build
npm run build:native

# Production build
npm run build:prod
```

---

## Configuration

### libvlc Path

The native module needs to locate libvlc binaries. Set environment variables:

#### Windows
```powershell
$env:LIBVLC_PATH = "C:\Program Files\VideoLAN\VLC"
```

#### macOS
```bash
export LIBVLC_PATH="/usr/local/lib/vlc"
```

#### Linux
```bash
export LIBVLC_PATH="/usr/lib/x86_64-linux-gnu"
```

### Feature Flags

Enable native video in `frontend/src/config/videoFeatureFlags.ts`:

```typescript
export const VIDEO_FEATURE_FLAGS = {
  enableNativeVideo: true,
  enableMultiVodSync: true,
  syncIntervalMs: 16,
  maxDriftFrames: 1,
  // ... other flags
};
```

---

## Running the Application

### Development Mode

```bash
# Start the backend API
cd vod-insights
python -m flask run --port 5000

# In another terminal, start Electron
cd vod-insights/desktop
npm run dev
```

### Production Build

```bash
# Build frontend and package
cd vod-insights
npm run build
npm run package
```

---

## Testing

### Unit Tests

```bash
# Frontend tests
cd vod-insights/frontend
npm test

# Backend tests
cd vod-insights
python -m pytest tests/ -v
```

### Integration Tests

```bash
# Native video integration
cd vod-insights/desktop
npm run test:native

# End-to-end
cd vod-insights
npm run test:e2e
```

### Manual Sync Test

1. Launch app with 3 VODs
2. Start synchronized playback
3. Monitor SyncIndicators component
4. Verify drift ≤1 frame (±16.67ms at 60fps)

---

## Troubleshooting

### Build Errors

#### "node-gyp not found"
```bash
npm install -g node-gyp
npm rebuild
```

#### "libvlc not found"
- Verify LIBVLC_PATH is set correctly
- On Windows, ensure VLC is installed to default location

#### "failed to locate name_to_any"
This is a known issue with older libvlc versions. Update to v4.0+.

### Runtime Errors

#### "Native video not available"
- Check that Electron context is enabled
- Verify ipcRenderer is exposed in window

#### "Video file not found"
- Verify file paths are absolute
- Check file permissions

#### "Sync drift too high"
- Reduce system load during playback
- Enable hardware acceleration if available
- Increase sync interval in feature flags

---

## Deployment

### Windows Installer

```bash
# Create installer with electron-builder
cd vod-insights
npm run build:win
```

Output: `release/VOD-Insights-Setup-{version}.exe`

### macOS DMG

```bash
npm run build:mac
```

Output: `release/VOD-Insights-{version}.dmg`

### Linux AppImage

```bash
npm run build:linux
```

Output: `release/VOD-Insights-{version}.AppImage`

---

## Performance Tuning

### Recommended Settings

| Setting | Value | Rationale |
|---------|-------|-----------|
| Sync interval | 16ms | 60fps refresh cycle |
| Telemetry rate | 33ms | ~30 FPS updates |
| Seek batch size | 3 | Parallel seek all videos |
| Buffer size | 512KB | Optimal for 5Mbps streams |

### Hardware Acceleration

Enable in Electron:
```javascript
// main.js
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');
```

---

## Security Considerations

1. **File access:** Native video can access local files. Validate paths.
2. **IPC security:** Use contextBridge, not nodeIntegration
3. **Video codecs:** Restrict to safe formats (mp4, webm, mkv)

---

## Architecture Notes

### Sync Algorithm

```
Master Clock (16ms tick)
  ↓
Calculate expected_frame = (elapsed_ms * fps) / 1000
  ↓
For each video:
  - Measure actual frame
  - Calculate drift = expected - actual
  - If drift > tolerance:
    - Micro-pause on faster videos
    - Skip frames on slower videos
  ↓
Emit telemetry to frontend
```

### IPC Flow

```
React UI
  ↓ ipcRenderer.invoke
Main Process (ipcMain.handle)
  ↓
Native Worker (piscina thread pool)
  ↓
libvlc (C++)
  ↓
Telemetry → Main → Renderer (ipcRenderer.on)
```

---

## Related Documentation

- [API Documentation](./API_DOCUMENTATION.md)
- [Phase 3 Sync Implementation](./PHASE_3_SYNC_IMPLEMENTATION.md)
- [Testing Strategy](./TESTING.md)
