# VOD Insights Testing Guide

This document explains how to use the multi-VOD comparison feature in VOD Insights, including the URL format and setup requirements.

## Overview

The multi-VOD comparison feature allows you to load and synchronize multiple Apex Legends gameplay videos (VODs) side-by-side for analysis and comparison.

## Accessing the Multi-VOD Page

The multi-VOD comparison page is accessed via a URL with a session ID parameter:

```
http://localhost:5173/?session=<SESSION_ID>
```

### Example URLs

```
# Local development (default port 5173)
http://localhost:5173/?session=test-session

# With custom port
http://localhost:3000/?session=my-comparison-001

# Production example
https://vod-insights.example.com/?session=coach-analysis-2025-03
```

## Session ID Format

Session IDs are unique identifiers that track which VODs are being compared in a session. They can be:

- **Auto-generated**: When creating a new comparison session via the API
- **Custom**: Any alphanumeric string you provide (e.g., `coach-review-apex`, `team-scrim-02`)

### Creating a Session via API

```bash
# POST request to create a new comparison session
curl -X POST http://localhost:8000/api/sessions/multi-vod \
  -H "Content-Type: application/json" \
  -d '{
    "vods": [
      {
        "name": "Player 1 POV",
        "path": "/videos/player1.mp4",
        "duration": 3600,
        "current_time": 0,
        "offset": 0
      },
      {
        "name": "Player 2 POV",
        "path": "/videos/player2.mp4",
        "duration": 3600,
        "current_time": 0,
        "offset": 2
      }
    ]
  }'

# Response will include the session ID:
# { "sessionId": "abc-123-def-456", ... }
```

## Step-by-Step User Workflow

### 1. **Prepare Your VOD Files**

- Ensure all VOD files are in a supported format (MP4, WebM)
- Note the file paths on your server
- Know the duration of each VOD (in seconds)

### 2. **Create a Comparison Session**

Use the API endpoint to create a new session with your VODs:

```bash
curl -X POST http://localhost:8000/api/sessions/multi-vod \
  -H "Content-Type: application/json" \
  -d '{
    "vods": [
      {
        "name": "Main POV",
        "path": "/videos/main.mp4",
        "duration": 3600,
        "current_time": 0,
        "offset": 0,
        "events": []
      },
      {
        "name": "Support POV",
        "path": "/videos/support.mp4",
        "duration": 3600,
        "current_time": 0,
        "offset": 0,
        "events": []
      },
      {
        "name": "Third Angle",
        "path": "/videos/angle3.mp4",
        "duration": 3600,
        "current_time": 0,
        "offset": 0,
        "events": []
      }
    ]
  }'
```

### 3. **Navigate to the Comparison Page**

Copy the `sessionId` from the response and open the URL in your browser:

```
http://localhost:5173/?session=<RETURNED_SESSION_ID>
```

### 4. **View the Multi-VOD Interface**

The page displays:

- **Three Video Panels** (responsive layout adapts to screen size):
  - Left panel: First VOD
  - Center panel: Second VOD
  - Right panel: Third VOD (hidden on smaller screens)

- **Global Scrubber Bar**:
  - Shows synchronized timeline for all VODs
  - Color-coded event markers (kills, deaths, etc.)
  - Keyboard navigation support

- **Individual Scrubber Bars**:
  - Per-VOD scrubber for fine-grained control
  - Shows offset adjustments

- **Event Timeline**:
  - Visual timeline of game events (kills, deaths, etc.)
  - Synchronized across all VODs

### 5. **Add VODs to the Comparison**

To add more VODs to an existing session:

```bash
curl -X PUT http://localhost:8000/api/sessions/multi-vod/<SESSION_ID>/vods \
  -H "Content-Type: application/json" \
  -d '{
    "vods": [
      {
        "vod_id": "new-vod-1",
        "name": "New Angle",
        "path": "/videos/new_angle.mp4",
        "duration": 3600,
        "current_time": 0,
        "offset": 5
      }
    ]
  }'
```

## URL Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `session` | string | Yes | Unique session ID returned from the API |
| `layout` | string | No | Layout mode: `1-col`, `2-col`, `3-col` (auto-detected based on screen width) |
| `syncMode` | string | No | Sync behavior: `global` (default) or `independent` |

### Layout Behavior

The layout automatically adapts based on screen width:

- **≥1920px**: 3-column layout (all 3 VODs side-by-side)
- **≥768px**: 2-column layout (2 VODs visible + collapsible third)
- **<768px**: 1-column layout (vertical stacking)

### Sync Modes

- **Global Sync** (default): All scrubbers move together; global seek applies to all VODs
- **Independent Sync**: Each VOD can be scrubbed independently; global scrubber adjusts offsets

## Keyboard Navigation

### Global Scrubber

| Key | Action |
|-----|--------|
| `→` Arrow Right | Seek +1 second |
| `← Arrow Left` | Seek -1 second |
| `Shift + →` | Seek +10 seconds |
| `Shift + ←` | Seek -10 seconds |
| `Ctrl/Cmd + →` | Seek +30 seconds |
| `Home` | Jump to start |
| `End` | Jump to end |

### Playback Controls

| Key | Action |
|-----|--------|
| `Space` | Play/Pause all VODs |
| `Tab` | Navigate between controls |

## VOD Offset Explanation

Offsets allow you to synchronize VODs that started at different times:

- **Offset 0**: VOD starts at the same global time as others
- **Offset +5**: VOD starts 5 seconds later (waits 5s before syncing)
- **Offset -5**: VOD starts 5 seconds earlier (ahead of sync point)

### Example

If you're comparing:
- Main POD:ER starts at 12:00
- Support POV starts at 12:05
- Set Support POV offset to `-5` to align with Main POV

## API Endpoints for Testing

### Session Management

```bash
# Create session
POST /api/sessions/multi-vod

# Fetch session data
GET /api/sessions/multi-vod/<SESSION_ID>

# Delete session
DELETE /api/sessions/multi-vod/<SESSION_ID>

# Update playback state
PUT /api/sessions/multi-vod/<SESSION_ID>/playback

# Seek globally
PUT /api/sessions/multi-vod/<SESSION_ID>/global-seek

# Seek individual VOD
PUT /api/sessions/multi-vod/<SESSION_ID>/vods/<VOD_ID>/seek

# Update VOD offsets
PUT /api/sessions/multi-vod/<SESSION_ID>/offsets

# Get offset history (audit trail)
GET /api/sessions/multi-vod/<SESSION_ID>/offset-history
```

## Testing the Feature

### Running Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- src/__tests__/components/MultiVodComparison.test.jsx

# Run with coverage
npm test -- --coverage
```

### Expected Test Results

- **Total Tests**: 159 tests
- **Expected Result**: All tests passing ✅
- **Execution Time**: ~20 seconds
- **Test Files**: 9 files

## Troubleshooting

### "No session found" Error

**Cause**: Session ID is missing or invalid in URL  
**Fix**: Ensure the session ID is included in the URL: `?session=<SESSION_ID>`

### Videos Not Syncing

**Cause**: Global scrubber not working or offset values are incorrect  
**Fix**: 
- Verify sync mode is set to "Global" (not "Independent")
- Check offset values match the time difference between VODs
- Ensure all VODs have the same or compatible frame rates

### Playback Issues

**Cause**: Video codec incompatibility or browser limitations  
**Fix**:
- Convert videos to MP4 with H.264 codec
- Test in Chrome or Firefox (best support)
- Check browser console for specific errors

### Performance Issues with Multiple VODs

**Cause**: Insufficient system resources or large files  
**Fix**:
- Reduce video resolution (720p or lower recommended)
- Use hardware acceleration (browser settings)
- Close other applications to free memory
- Consider streaming from a more powerful server

## Development Notes

### Component Architecture

The multi-VOD feature uses:

- **MultiVodComparison**: Main page component
- **MultiVodViewer**: Video display and sync logic
- **GlobalScrubber**: Unified timeline scrubber
- **VodPanel**: Individual video + scrubber
- **EventTimeline**: Event marker visualization
- **ErrorBoundary**: Graceful error handling

### State Management

- **useMultiVodState**: Handles session data fetching and updates
- **useGlobalSync**: Manages global scrubber and sync operations
- **usePlaybackSync**: Keeps videos in sync during playback

### Error Handling

- Exponential backoff retry logic (1s → 2s → 4s)
- Max 3 retry attempts
- Comprehensive error messages
- Error boundary for component crashes

## Related Documentation

- [API Documentation](../backend/API.md)
- [Architecture Guide](./ARCHITECTURE.md)
- [Development Setup](../SETUP.md)

---

**Last Updated**: March 2, 2026  
**Status**: ✅ Production Ready  
**Test Coverage**: 159/159 tests passing
