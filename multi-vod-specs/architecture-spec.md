# Multi-VOD Comparison Architecture Specification

**Status**: Work in progress across Phases 1-4
**Last Updated**: 2026-03-01 23:06 CST
**Current Implementation Phases**: Phase 1-4 completed (UI, State, OCR Backend, Frontend Integration)

## System Architecture

### Frontend Stack
- React 18 with Vite
- React Router for navigation
- Custom hooks for state management
- HTML5 Video API for playback

### Backend Stack
- Flask web server (Python)
- Tesseract/EasyOCR for timer detection
- FFmpeg-based synchronization helpers

## Implementation Phases

### Phase 1: UI & State Management ✅
**Commit**: `619ad04`

**Frontend Components**:
- `MultiVodPlayer.jsx`: Grid-based player component
  - Add/remove VOD controls
  - Primary VOD highlighting
  - Sync status display
  - Responsive layout (1-3+ VODs)

**State Management**:
- `vodSyncStore.js`: Redux-like reducer
  - VOD CRUD operations
  - Sync offset tracking
  - Detected timer storage
  - Settings (auto-detect, confidence threshold)

**Custom Hook**:
- `useMultiVodSync.js`: React hook
  - Full reducer dispatch actions
  - Selectors (getPrimaryVod, getSecondaryVods, etc.)
  - Time adjustment calculation

### Phase 2: OCR Detection Backend ✅
**Commit**: `923a122`
- Timer detection in VOD files
- Apex Legends in-game timer parsing
- Confidence scoring for detections

### Phase 3: Frontend OCR Integration ✅
**Commit**: `87f72f1`
- Integrate detected timers into frontend
- Auto-sync calculation
- Confidence display to user

### Phase 4: Advanced Features ✅
**Commit**: `c8df7e0`
- Enhanced timer detection and parsing
- VOD player improvements
- Sync controls refinement

### Phase 5: Local Library & Integration ✅
**Commits**: `80341d3` (local library), `36ee2e7` (VodViewer integration)
- Local VOD library selection
- Multi-VOD player integration into VodViewer page
- Secondary video players

## File Structure

```
vod-insights/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── MultiVodPlayer.jsx
│   │   ├── hooks/
│   │   │   └── useMultiVodSync.js
│   │   ├── store/
│   │   │   └── vodSyncStore.js
│   │   ├── pages/
│   │   │   └── VodViewer.jsx (integration point)
│   │   └── styles/
│   │       └── [multi-vod styles]
│   └── tests/
│       └── [test files]
├── app/
│   ├── vod_ocr.py (OCR detection)
│   └── webui.py (API endpoints)
└── tests/
    ├── test_vod_api.py
    └── test_vod_download.py
```

## Key APIs

### Frontend: useMultiVodSync Hook
```javascript
// Actions
sync.addVod(vodData)
sync.removeVod(vodId)
sync.setPrimaryVod(vodId)
sync.updateVodTime(vodId, time)
sync.updateVodDuration(vodId, duration)
sync.setVodOffset(vodId, offset)
sync.syncVodsByTimers(detectedTimers)
sync.setLinkedPlayback(enabled)

// Selectors
sync.vods - all VODs
sync.primaryVodId - primary VOD ID
sync.isLinkedPlayback - playback link status
sync.syncStatus - overall sync state
sync.getAdjustedTime(vodId, baseTime) - time adjustment
```

### Backend: `/api/vod-ocr/detect` Endpoint
- **Input**: VOD file path or URL
- **Output**: Detected timer entries with timestamps and confidence
- **Performance**: <50ms per frame (target for 3x video)

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| 3x Video Playback Latency | <300ms total | End-to-end sync latency |
| Scrubber Sync Drift | <100ms | Acceptable drift during playback |
| Offset Calculation | <50ms | Per architecture spec |
| Memory Footprint | <3.5GB | For 3x 1080p simultaneous |
| React Render | No excessive re-renders | Monitor DevTools Profiler |
| CPU Usage | <80% | On GTX 1650+ baseline |

## Synchronization Strategy

1. **Timer Detection**: OCR detects Apex in-game timers from video frames
2. **Offset Calculation**: Calculate time offset between detected timers
3. **Playback Sync**: Apply offset to secondary videos during linked playback
4. **Manual Correction**: User adjusts offsets with +/- buttons or slider
5. **Global Scrubber**: Scrub timeline syncs all videos with offset applied

## State Management Flow

```
User Input (add VOD, adjust offset, seek)
    ↓
useMultiVodSync dispatch
    ↓
vodSyncStore reducer
    ↓
State update (vods, offsets, timings)
    ↓
React re-render (video.currentTime updates)
    ↓
Video elements sync via HTML5 API
```

## Error Handling
- VOD load failures: Graceful fallback to error state
- OCR detection failures: Manual offset entry as fallback
- Duration mismatch: Warn user, allow manual adjustment
- Network errors: Retry logic with exponential backoff

## Testing Strategy
- Unit: Offset calculation, sync logic, state management
- Integration: API → UI flows, timer detection → sync
- Accessibility: ARIA labels, keyboard nav, screen reader
- Performance: 3x video playback, render profiling
- Edge cases: Duration mismatch, rapid seeking, mid-playback offset changes
