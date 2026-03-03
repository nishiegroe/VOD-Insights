# VOD Insights API Documentation

**Version:** 1.0  
**Phase:** Phase 2-3 (Multi-VOD Comparison & Telemetry)  
**Last Updated:** 2026-03-03

---

## Table of Contents

1. [Overview](#overview)
2. [Base URL & Authentication](#base-url--authentication)
3. [Multi-VOD Session API](#multi-vod-session-api)
4. [Telemetry API](#telemetry-api)
5. [Native Video IPC](#native-video-ipc)
6. [Error Responses](#error-responses)
7. [Rate Limits](#rate-limits)

---

## Overview

VOD Insights provides three main API surfaces:

| API | Purpose | Phase |
|-----|---------|-------|
| Multi-VOD Session API | Create/manage comparison sessions, stream VODs | Phase 2 |
| Telemetry API | Record and query playback metrics | Phase 2 |
| Native Video IPC | Control native video playback (Electron) | Phase 3 |

---

## Base URL & Authentication

### Development
```
http://localhost:5000
```

### Production
```
http://localhost:5000  # Local deployment
```

### Headers
All requests should include:
```http
Content-Type: application/json
```

---

## Multi-VOD Session API

### Endpoints

#### `POST /api/sessions/multi-vod`

Create a new multi-VOD comparison session.

**Request Body:**
```json
{
  "vods": [
    {
      "vod_id": "vod-1",
      "name": "Player 1 POV",
      "path": "/storage/vods/player1.mp4"
    },
    {
      "vod_id": "vod-2", 
      "name": "Player 2 POV",
      "path": "/storage/vods/player2.mp4"
    },
    {
      "vod_id": "vod-3",
      "name": "Player 3 POV",
      "path": "/storage/vods/player3.mp4"
    }
  ],
  "name": "Team Fight Analysis",
  "description": "Comparing rotations in the final circle"
}
```

**Response (201):**
```json
{
  "ok": true,
  "session": {
    "session_id": "session-abc123",
    "name": "Team Fight Analysis",
    "description": "Comparing rotations in the final circle",
    "global_time": 0,
    "global_playback_state": "stopped",
    "created_at": 1740869400.0,
    "vods": [
      {
        "vod_id": "vod-1",
        "name": "Player 1 POV",
        "path": "/storage/vods/player1.mp4",
        "duration": 3600.0,
        "offset": 0,
        "current_time": 0,
        "playback_state": "stopped",
        "fps": 60.0,
        "resolution": "1920x1080"
      }
      // ... more vods
    ]
  }
}
```

**Validation:**
- Must provide 2-3 VODs
- Each VOD must have `path` and `vod_id`
- Paths must point to valid video files

---

#### `GET /api/sessions/multi-vod/<session_id>`

Fetch full state of a multi-VOD session.

**Response (200):**
```json
{
  "ok": true,
  "session": { /* Full session object */ }
}
```

**Errors:**
- `404`: Session not found

---

#### `DELETE /api/sessions/multi-vod/<session_id>`

Delete a session.

**Response (204):** No content on success

---

#### `GET /api/sessions/multi-vod/list`

List all comparison sessions.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| limit | int | 20 | Max results |
| offset | int | 0 | Pagination offset |
| created_by | string | - | Filter by user |

**Response (200):**
```json
{
  "ok": true,
  "sessions": [
    {
      "session_id": "session-abc123",
      "name": "Team Fight Analysis",
      "created_at": 1740869400.0,
      "num_vods": 3
    }
  ],
  "total": 5,
  "limit": 20,
  "offset": 0,
  "has_more": false
}
```

---

#### `PUT /api/sessions/multi-vod/<session_id>/global-seek`

Seek all VODs to the same global timestamp (respecting offsets).

**Request Body:**
```json
{
  "timestamp": 150.5
}
```

**Response (200):**
```json
{
  "ok": true,
  "session": { /* Updated session */ }
}
```

---

#### `PUT /api/sessions/multi-vod/<session_id>/vods/<vod_id>/seek`

Seek a single VOD independently (bypasses global sync).

**Request Body:**
```json
{
  "timestamp": 150.5
}
```

---

#### `PUT /api/sessions/multi-vod/<session_id>/offsets`

Update one or more VOD offsets (batch operation).

**Request Body:**
```json
{
  "offsets": {
    "vod-1": 0,
    "vod-2": -50,
    "vod-3": 37
  },
  "source": "manual",
  "confidence": 0.95
}
```

**Parameters:**
- `offsets`: Map of vod_id → offset in seconds
- `source`: `"manual"` | `"timer_ocr"`
- `confidence`: Required if source is `"timer_ocr"`

**Response (200):**
```json
{
  "ok": true,
  "session": { /* Updated session with new offsets */ }
}
```

---

#### `GET /api/sessions/multi-vod/<session_id>/offset-history`

Get audit trail of offset changes.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| vod_id | string | Optional filter by VOD |

**Response (200):**
```json
{
  "ok": true,
  "history": [
    {
      "vod_id": "vod-2",
      "old_offset": 0,
      "new_offset": -50,
      "source": "timer_ocr",
      "confidence": 0.88,
      "timestamp": 1740869500.0
    }
  ]
}
```

---

#### `PUT /api/sessions/multi-vod/<session_id>/playback`

Update playback state (play/pause/seek).

**Request Body:**
```json
{
  "action": "play",
  "timestamp": 150.5  // required for seek action
}
```

**Actions:**
- `"play"`: Start playback
- `"pause"`: Pause playback
- `"seek"`: Seek to timestamp (requires `timestamp` field)

---

#### `GET /api/sessions/multi-vod/<session_id>/vods/<vod_id>/stream`

Stream a VOD file with HTTP range request support.

**Response:**
- `206 Partial Content`: With Range header for seeking
- `200 OK`: Full file without Range header
- `404`: Session or VOD not found
- `416`: Invalid range

**Headers returned:**
```http
Accept-Ranges: bytes
Content-Type: video/mp4
```

---

#### `GET /api/sessions/multi-vod/vods/list`

List all available VODs in the library.

**Response (200):**
```json
{
  "ok": true,
  "vods": [
    {
      "vod_id": "vod-123",
      "name": "Apex Legends - Match 1",
      "path": "/storage/vod1.mp4",
      "duration": 3600.0,
      "fps": 60.0,
      "resolution": "1920x1080",
      "codec": "h264",
      "file_size_mb": 1024.5,
      "mtime": 1740869400.0
    }
  ]
}
```

---

## Telemetry API

### Endpoints

#### `POST /api/telemetry/sessions/<session_id>/events`

Record a playback event.

**Request Body:**
```json
{
  "event_type": "play",
  "timestamp_in_video": 150.5,
  "vod_id": "vod-1",
  "data": {
    "duration_ms": 145
  }
}
```

**Event Types:**
- `"play"` - Playback started
- `"pause"` - Playback paused
- `"seek"` - Seeked to position
- `"rate_change"` - Playback rate changed
- `"volume_change"` - Volume adjusted
- `"error"` - Playback error occurred

**Response (201):**
```json
{
  "ok": true,
  "event": {
    "event_id": "evt-abc123",
    "event_type": "play",
    "timestamp": 1740869400.0,
    "timestamp_in_video": 150.5,
    "vod_id": "vod-1"
  }
}
```

---

#### `POST /api/telemetry/sessions/<session_id>/vod/<vod_id>/session`

Create a new playback session for a VOD.

**Request Body:**
```json
{
  "duration_seconds": 3600.0
}
```

---

#### `POST /api/telemetry/sessions/<session_id>/vod/<vod_id>/session/end`

Mark end of a playback session.

**Request Body:**
```json
{
  "final_position": 2400.5,
  "watch_time_ms": 1800000.0
}
```

---

#### `GET /api/telemetry/sessions/<session_id>/summary`

Get summary of telemetry data.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| vod_id | string | Optional filter by VOD |

**Response (200):**
```json
{
  "ok": true,
  "summary": {
    "session_id": "session-abc",
    "total_watch_time_ms": 3600000,
    "total_playback_events": 150,
    "avg_rewatch_percentage": 45.2,
    "num_vods": 3
  }
}
```

---

#### `GET /api/telemetry/sessions/<session_id>/events`

Get all playback events.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| vod_id | string | - | Filter by VOD |
| event_type | string | - | Filter by type |
| limit | int | 100 | Max results |
| offset | int | 0 | Pagination |

---

#### `GET /api/telemetry/sessions/<session_id>/heatmap`

Get rewatch heatmap data.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| vod_id | string | - | Filter by VOD |
| bucket_size | int | 1 | Time bucket in seconds |

**Response (200):**
```json
{
  "ok": true,
  "heatmap": [
    {"time_seconds": 0, "rewatch_count": 5},
    {"time_seconds": 30, "rewatch_count": 12}
  ],
  "total_rewatch_events": 150,
  "bucket_size_seconds": 1
}
```

---

#### `GET /api/telemetry/sessions/<session_id>/stats`

Get detailed statistics.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| vod_id | string | Optional filter by VOD |

---

#### `GET /api/telemetry/sessions/<session_id>/export`

Export telemetry data.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| format | string | json | Export format: `"json"` or `"csv"` |
| vod_id | string | - | Optional filter by VOD |

**Response:** File download with appropriate Content-Type

---

#### `GET /api/telemetry/sessions`

List all telemetry sessions.

**Query Parameters:**
| Param | Type | Default |
|-------|------|---------|
| limit | int | 20 |
| offset | int | 0 |

---

#### `DELETE /api/telemetry/sessions/<session_id>`

Delete telemetry data for a session.

**Response (204):** No content on success

---

## Native Video IPC

> **Phase 3:** These IPC channels connect the React frontend to the native libvlc backend.

### Channel Contract

#### `video:initialize`

Initialize native video player with file.

```typescript
ipcRenderer.invoke('video:initialize', filePath: string): Promise<{
  success: boolean;
  error?: string;
}>
```

---

#### `video:play`

Start playback.

```typescript
ipcRenderer.invoke('video:play'): Promise<{
  success: boolean;
  error?: string;
}>
```

---

#### `video:pause`

Pause playback.

```typescript
ipcRenderer.invoke('video:pause'): Promise<{
  success: boolean;
  error?: string;
}>
```

---

#### `video:stop`

Stop playback and release resources.

```typescript
ipcRenderer.invoke('video:stop'): Promise<{
  success: boolean;
  error?: string;
}>
```

---

#### `video:seek`

Seek to specific time.

```typescript
ipcRenderer.invoke('video:seek', timeMs: number): Promise<{
  success: boolean;
  error?: string;
}>
```

---

#### `video:setPlaybackRate`

Set playback speed.

```typescript
ipcRenderer.invoke('video:setPlaybackRate', rate: number): Promise<{
  success: boolean;
  error?: string;
}>
```

---

#### Telemetry Events

The native backend emits telemetry to the renderer:

```typescript
// Event: video:telemetry
{
  timestamp: number;
  currentTime: number;
  duration: number;
  state: 'playing' | 'paused' | 'stopped';
  fps: number;
}

// Event: video:error
{
  code: string;
  message: string;
  context?: string;
}
```

---

### Frontend Usage Example

```typescript
import { getVideoClient, initializeVideoClient } from './services/videoClient';

// Initialize on app startup
await initializeVideoClient();

const client = getVideoClient();

// Register for telemetry updates
const unsubscribe = client.onTelemetry((telemetry) => {
  console.log(`Current time: ${telemetry.currentTime}ms`);
});

// Play video
await client.play();

// Seek to 5 minutes
await client.seek(5 * 60 * 1000);

// Cleanup on unmount
unsubscribe();
await client.shutdown();
```

---

## Error Responses

All API endpoints return errors in this format:

```json
{
  "ok": false,
  "error": "Human-readable error message"
}
```

### HTTP Status Codes

| Status | Meaning |
|--------|---------|
| 400 | Bad Request - Invalid parameters |
| 404 | Not Found - Resource doesn't exist |
| 416 | Range Not Satisfiable - Invalid byte range |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

### Error Codes (Native IPC)

| Code | Meaning |
|------|---------|
| `UNAVAILABLE` | Native video not available |
| `INVOCATION_FAILED` | IPC call failed |
| `INIT_FAILED` | Video initialization failed |
| `INVALID_ARG` | Invalid argument provided |

---

## Rate Limits

Currently no rate limits enforced. Future versions may include:
- 100 requests/minute for session endpoints
- 60 requests/minute for telemetry recording
