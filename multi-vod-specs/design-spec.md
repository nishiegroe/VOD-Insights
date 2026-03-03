# Multi-VOD Comparison Design Specification

**Status**: Being validated against implementation
**Last Updated**: 2026-03-01 23:06 CST

## Overview

The multi-VOD comparison feature enables Apex Legends coaches and content creators to analyze up to 3+ different video-on-demand (VOD) files side-by-side with synchronized playback and offset control.

## Key Features

### 1. Multi-VOD Grid Layout
- Responsive grid supporting 1-3 VODs (expandable to more)
- Primary VOD highlighted with visual indicators
- Secondary VODs in a grid layout
- Add/Remove VOD buttons
- VOD library selection modal

### 2. Synchronization
- **Timer-based sync**: Automatically detect Apex Legends in-game timers via OCR
- **Manual offset adjustment**: +/- buttons and slider controls
- **Global scrubber**: Sync all videos to single timeline
- **Independent scrubbing**: Each VOD can be scrubbed independently
- **Linked playback**: Play/pause all VODs together

### 3. Offset Control
- **Auto-detect**: Apex Legends timer parsing for automatic offset calculation
- **Manual adjustment**: +/- 1s, 5s, 10s buttons
- **Slider control**: Drag to adjust offsets smoothly
- **Visual feedback**: Real-time preview of offset changes

### 4. Event Markers & Annotations
- Event markers from VOD bookmarks displayed on all 3 videos
- Color-coded by event type (kill, assist, knock, etc.)
- Markers stack when overlapped
- Tooltips on hover
- Filterable by event type

### 5. Playback Controls
- Global play/pause (affects all 3 videos simultaneously)
- Individual VOD volume controls
- Speed control (1x, 1.5x, 2x)
- Mute/unmute per video
- Skip forward/backward buttons

### 6. Keyboard Navigation
- Tab: Move between controls
- Arrow Up/Down: Adjust offset
- Arrow Left/Right: Seek within video
- Space: Play/pause
- Home/End: Jump to start/end
- Ctrl+[: Previous event marker
- Ctrl+]: Next event marker

### 7. Responsive Design
- Desktop (1920x1080): 3-column grid
- Tablet (768x1024): 2-column grid or stacked
- Mobile (375x812): Single video focused, others below

## Performance Targets
- 3x 1080p video playback: <300ms total latency
- Scrubber sync drift: <100ms acceptable
- Offset calculation: <50ms
- Memory footprint: <3.5GB for 3x 1080p

## Accessibility Requirements
- ARIA labels on all controls
- Keyboard navigation fully functional
- Color-blind safe palette (no red/green only)
- Screen reader compatible
- High contrast mode support

## Test Coverage
- Unit tests: offset calculation, sync logic, state management
- Integration tests: API → UI flows
- Accessibility tests: keyboard, ARIA, screen reader
- Performance tests: render performance, latency
- Edge cases: duration mismatch, rapid seeking, offset changes mid-playback
