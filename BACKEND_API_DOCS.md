# Multi-VOD Backend API Documentation

**Status:** ✅ All 8 endpoints implemented and registered  
**Last Updated:** March 2, 2026  
**Backend Engineer:** Larry the Lobster 🦞

---

## Quick Start

### Server URL
```
http://localhost:3001
(or http://localhost:5000 for legacy Flask dev server)
```

### Base Path
```
/api/sessions/multi-vod
```

---

## API Endpoints (8 Total)

### 1. **CREATE Session** — `POST /api/sessions/multi-vod`

Create a new multi-VOD comparison session.

**Request Body:**
```json
{
  "vods": [
    {
      "vod_id": "vod-player1",
      "name": "Player 1 (Fuse)",
      "path": "/path/to/vod1.mp4"
    },
    {
      "vod_id": "vod-player2", 
      "name": "Player 2 (Wraith)",
      "path": "/path/to/vod2.mp4"
    },
    {
      "vod_id": "vod-player3",
      "name": "Player 3 (Bloodhound)",
      "path": "/path/to/vod3.mp4"
    }
  ],
  "name": "Tournament Match - Finals",
  "description": "Apex Legends tournament finals analysis",
  "created_by": "coach-123"
}
```

**Request Parameters:**
- `vods` (required): Array of 2-3 VOD objects
  - `vod_id` (required): Unique identifier for the VOD
  - `name` (required): Friendly name displayed in UI
  - `path` (required): File system path to the video file
- `name` (optional): Session display name
- `description` (optional): Session description
- `created_by` (optional): User ID who created the session

**Response (201 Created):**
```json
{
  "ok": true,
  "session": {
    "session_id": "sess-abc123xyz789",
    "name": "Tournament Match - Finals",
    "description": "Apex Legends tournament finals analysis",
    "created_at": 1741014000.123,
    "updated_at": 1741014000.123,
    "created_by": "coach-123",
    "global_time": 0.0,
    "global_playback_state": "paused",
    "playback_started_at": null,
    "vods": [
      {
        "vod_id": "vod-player1",
        "name": "Player 1 (Fuse)",
        "path": "/path/to/vod1.mp4",
        "duration": 1800.0,
        "fps": 60.0,
        "resolution": "1920x1080",
        "codec": "h264",
        "filesize_mb": 2500.5,
        "current_time": 0.0,
        "offset": 0.0,
        "playback_state": "paused",
        "offset_source": "manual",
        "offset_confidence": 1.0,
        "offset_set_at": 1741014000.123,
        "offset_history": []
      },
      {
        "vod_id": "vod-player2",
        "name": "Player 2 (Wraith)",
        "path": "/path/to/vod2.mp4",
        "duration": 1795.0,
        "fps": 60.0,
        "resolution": "1920x1080",
        "codec": "h264",
        "filesize_mb": 2480.2,
        "current_time": 0.0,
        "offset": 0.0,
        "playback_state": "paused",
        "offset_source": "manual",
        "offset_confidence": 1.0,
        "offset_set_at": 1741014000.123,
        "offset_history": []
      },
      {
        "vod_id": "vod-player3",
        "name": "Player 3 (Bloodhound)",
        "path": "/path/to/vod3.mp4",
        "duration": 1790.0,
        "fps": 60.0,
        "resolution": "1920x1080",
        "codec": "h264",
        "filesize_mb": 2460.8,
        "current_time": 0.0,
        "offset": 0.0,
        "playback_state": "paused",
        "offset_source": "manual",
        "offset_confidence": 1.0,
        "offset_set_at": 1741014000.123,
        "offset_history": []
      }
    ]
  }
}
```

**Error Responses:**
- `400`: Invalid VOD count (must be 2-3)
- `400`: Missing `path` or `vod_id` in VOD object
- `400`: VOD file cannot be opened/read
- `500`: Internal server error (check logs)

---

### 2. **FETCH Session** — `GET /api/sessions/multi-vod/<session_id>`

Retrieve the full state of a multi-VOD session.

**URL Parameters:**
- `session_id` (required): Session ID returned from CREATE

**Example:**
```
GET /api/sessions/multi-vod/sess-abc123xyz789
```

**Response (200 OK):**
```json
{
  "ok": true,
  "session": {
    "session_id": "sess-abc123xyz789",
    "name": "Tournament Match - Finals",
    "vods": [ /* ... */ ],
    "global_time": 150.5,
    "global_playback_state": "paused",
    "created_at": 1741014000.123,
    "updated_at": 1741014030.456
  }
}
```

**Error Responses:**
- `404`: Session not found

---

### 3. **DELETE Session** — `DELETE /api/sessions/multi-vod/<session_id>`

Delete a session and all its data.

**URL Parameters:**
- `session_id` (required): Session ID to delete

**Response (204 No Content):**
```
(empty body)
```

**Error Responses:**
- `404`: Session not found

---

### 4. **GLOBAL SEEK** — `PUT /api/sessions/multi-vod/<session_id>/global-seek`

Seek all VODs to the same global timestamp, respecting their offsets.

**Request Body:**
```json
{
  "timestamp": 150.5
}
```

**Request Parameters:**
- `timestamp` (required): Global time in seconds (float)

**How It Works:**
- `VOD[i].current_time = timestamp - VOD[i].offset`
- All VODs update atomically
- Times are clamped to valid range [0, VOD.duration]

**Example Timeline:**
```
Global Time: 150.5s
VOD 0 (Fuse):     offset=0s   → plays at 150.5s
VOD 1 (Wraith):   offset=-5s  → plays at 155.5s (ahead by 5s)
VOD 2 (Bloodhound): offset=10s → plays at 140.5s (behind by 10s)
```

**Response (200 OK):**
```json
{
  "ok": true,
  "session": {
    "session_id": "sess-abc123xyz789",
    "global_time": 150.5,
    "global_playback_state": "seeking",
    "vods": [
      {
        "vod_id": "vod-player1",
        "current_time": 150.5,
        "playback_state": "seeking"
      },
      {
        "vod_id": "vod-player2",
        "current_time": 155.5,
        "playback_state": "seeking"
      },
      {
        "vod_id": "vod-player3",
        "current_time": 140.5,
        "playback_state": "seeking"
      }
    ]
  }
}
```

**Error Responses:**
- `400`: Invalid timestamp (must be >= 0)
- `404`: Session not found

---

### 5. **VOD SEEK** — `PUT /api/sessions/multi-vod/<session_id>/vods/<vod_id>/seek`

Seek a single VOD independently, without affecting others.

**Request Body:**
```json
{
  "timestamp": 100.0
}
```

**Request Parameters:**
- `timestamp` (required): Time in seconds for this specific VOD

**Note:** Independent VOD seeking updates `global_time` to the first VOD's time + its offset.

**Response (200 OK):**
```json
{
  "ok": true,
  "session": {
    "session_id": "sess-abc123xyz789",
    "global_time": 100.0,
    "vods": [
      {
        "vod_id": "vod-player2",
        "current_time": 100.0,
        "playback_state": "seeking"
      }
    ]
  }
}
```

**Error Responses:**
- `400`: Invalid timestamp
- `404`: Session not found
- `404`: VOD not found

---

### 6. **UPDATE OFFSETS** — `PUT /api/sessions/multi-vod/<session_id>/offsets`

Batch update offsets for multiple VODs with history tracking.

**Request Body (Manual Source):**
```json
{
  "offsets": {
    "vod-player1": 0.0,
    "vod-player2": -5.5,
    "vod-player3": 10.2
  },
  "source": "manual",
  "changed_by": "coach-123"
}
```

**Request Body (Timer OCR Source):**
```json
{
  "offsets": {
    "vod-player1": 0.0,
    "vod-player2": -5.5,
    "vod-player3": 10.2
  },
  "source": "timer_ocr",
  "confidence": 0.95,
  "changed_by": "ml-service"
}
```

**Request Parameters:**
- `offsets` (required): Dictionary mapping vod_id → offset in seconds
- `source` (optional, default="manual"): "manual" | "timer_ocr"
- `confidence` (required if source="timer_ocr"): Float 0-1, OCR confidence
- `changed_by` (optional): User/service that made the change

**Response (200 OK):**
```json
{
  "ok": true,
  "session": {
    "session_id": "sess-abc123xyz789",
    "vods": [
      {
        "vod_id": "vod-player1",
        "offset": 0.0,
        "offset_source": "manual",
        "offset_confidence": 1.0,
        "offset_set_at": 1741014050.789
      },
      {
        "vod_id": "vod-player2",
        "offset": -5.5,
        "offset_source": "manual",
        "offset_confidence": 1.0,
        "offset_set_at": 1741014050.789,
        "offset_history": [
          {
            "timestamp": 1741014050.789,
            "old_offset": 0.0,
            "new_offset": -5.5,
            "source": "manual",
            "confidence": null,
            "changed_by": "coach-123"
          }
        ]
      }
    ]
  }
}
```

**Error Responses:**
- `400`: Invalid offsets dict or missing confidence for timer_ocr
- `404`: Session not found
- `404`: One of the VOD IDs not found in session

---

### 7. **GET OFFSET HISTORY** — `GET /api/sessions/multi-vod/<session_id>/offset-history`

Retrieve the audit trail of all offset changes.

**Query Parameters:**
- `vod_id` (optional): Filter by specific VOD

**Examples:**
```
GET /api/sessions/multi-vod/sess-abc123xyz789/offset-history
GET /api/sessions/multi-vod/sess-abc123xyz789/offset-history?vod_id=vod-player2
```

**Response (200 OK):**
```json
{
  "ok": true,
  "history": [
    {
      "timestamp": 1741014050.789,
      "vod_id": "vod-player2",
      "vod_name": "Player 2 (Wraith)",
      "old_offset": 0.0,
      "new_offset": -5.5,
      "source": "manual",
      "confidence": null,
      "changed_by": "coach-123"
    },
    {
      "timestamp": 1741014020.123,
      "vod_id": "vod-player3",
      "vod_name": "Player 3 (Bloodhound)",
      "old_offset": 0.0,
      "new_offset": 10.2,
      "source": "timer_ocr",
      "confidence": 0.95,
      "changed_by": "ml-service"
    }
  ]
}
```

**Error Responses:**
- `404`: Session not found

---

### 8. **PLAYBACK CONTROL** — `PUT /api/sessions/multi-vod/<session_id>/playback`

Control global playback state (play, pause, seek).

**Request Body (Play):**
```json
{
  "action": "play"
}
```

**Request Body (Pause):**
```json
{
  "action": "pause"
}
```

**Request Body (Seek):**
```json
{
  "action": "seek",
  "timestamp": 75.5
}
```

**Request Parameters:**
- `action` (required): "play" | "pause" | "seek"
- `timestamp` (required if action="seek"): Global time in seconds

**Response (200 OK):**
```json
{
  "ok": true,
  "session": {
    "session_id": "sess-abc123xyz789",
    "global_playback_state": "playing",
    "global_time": 75.5,
    "vods": [
      {
        "vod_id": "vod-player1",
        "current_time": 75.5,
        "playback_state": "playing"
      },
      {
        "vod_id": "vod-player2",
        "current_time": 81.0,
        "playback_state": "playing"
      },
      {
        "vod_id": "vod-player3",
        "current_time": 65.3,
        "playback_state": "playing"
      }
    ]
  }
}
```

**Error Responses:**
- `400`: Invalid action or missing timestamp for seek
- `404`: Session not found

---

## Testing the API

### Using curl

#### 1. Create a Session
```bash
curl -X POST http://localhost:3001/api/sessions/multi-vod \
  -H "Content-Type: application/json" \
  -d '{
    "vods": [
      {
        "vod_id": "vod1",
        "name": "Player 1",
        "path": "/home/nishie/vods/match1_player1.mp4"
      },
      {
        "vod_id": "vod2",
        "name": "Player 2",
        "path": "/home/nishie/vods/match1_player2.mp4"
      }
    ],
    "name": "Test Match",
    "created_by": "test-user"
  }'
```

**Save the `session_id` from the response!**

#### 2. Fetch Session State
```bash
SESSION_ID="sess-abc123xyz789"
curl http://localhost:3001/api/sessions/multi-vod/$SESSION_ID
```

#### 3. Global Seek
```bash
curl -X PUT http://localhost:3001/api/sessions/multi-vod/$SESSION_ID/global-seek \
  -H "Content-Type: application/json" \
  -d '{"timestamp": 150.5}'
```

#### 4. Update Offsets
```bash
curl -X PUT http://localhost:3001/api/sessions/multi-vod/$SESSION_ID/offsets \
  -H "Content-Type: application/json" \
  -d '{
    "offsets": {
      "vod1": 0.0,
      "vod2": -5.5
    },
    "source": "manual",
    "changed_by": "test-coach"
  }'
```

#### 5. Playback Control (Play)
```bash
curl -X PUT http://localhost:3001/api/sessions/multi-vod/$SESSION_ID/playback \
  -H "Content-Type: application/json" \
  -d '{"action": "play"}'
```

#### 6. Playback Control (Seek)
```bash
curl -X PUT http://localhost:3001/api/sessions/multi-vod/$SESSION_ID/playback \
  -H "Content-Type: application/json" \
  -d '{"action": "seek", "timestamp": 200.0}'
```

#### 7. Get Offset History
```bash
curl http://localhost:3001/api/sessions/multi-vod/$SESSION_ID/offset-history
```

#### 8. Delete Session
```bash
curl -X DELETE http://localhost:3001/api/sessions/multi-vod/$SESSION_ID
```

---

## Frontend Integration

### URL Structure

Sessions are accessed via URL query parameters:

```
http://localhost:3000/?session=sess-abc123xyz789
```

**Query Parameter:**
- `session` — The session ID from the create response

### Fetching Session in React

```javascript
// Get session ID from URL
const queryParams = new URLSearchParams(window.location.search);
const sessionId = queryParams.get('session');

// Fetch session state
const response = await fetch(`/api/sessions/multi-vod/${sessionId}`);
const { session } = await response.json();

// Use session.vods, session.global_time, etc.
console.log(session.vods[0].current_time);
```

### Playing/Pausing from Frontend

```javascript
async function handlePlayClick(sessionId) {
  const response = await fetch(
    `/api/sessions/multi-vod/${sessionId}/playback`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'play' })
    }
  );
  const { session } = await response.json();
  // Update UI with new session state
  setSession(session);
}
```

### Syncing Scrubber

When user drags the global scrubber:

```javascript
async function handleGlobalScrubberChange(sessionId, timestamp) {
  const response = await fetch(
    `/api/sessions/multi-vod/${sessionId}/global-seek`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp })
    }
  );
  const { session } = await response.json();
  // Each VOD's current_time is now set correctly
}
```

---

## Error Handling Best Practices

All API responses include an `ok` field:

```javascript
async function apiCall(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  
  if (!data.ok) {
    // Error response
    console.error(`API Error: ${data.error}`);
    throw new Error(data.error);
  }
  
  return data;
}
```

### Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| "Session not found" | Invalid session_id | Check session ID in URL |
| "Must provide 2-3 VODs" | Wrong number of VODs | Include exactly 2 or 3 VODs |
| "Cannot open VOD: ..." | File path invalid or missing | Verify file paths are absolute |
| "Invalid timestamp" | Negative timestamp | Use >= 0 |
| "VOD not found" | Wrong vod_id | Check VOD IDs match creation |

---

## Session Persistence

Sessions are stored in:
```
~/.vod-insights/multi_vod_sessions/{session_id}.json
```

Each session file contains:
- All VOD metadata
- Current playback state
- Offset history (audit trail)
- Timestamps

**Persistence is automatic** — every change via API updates the file.

---

## Integration Checklist

- [ ] Backend endpoints all return 200/201/204 with correct JSON
- [ ] Error responses have clear error messages
- [ ] Session ID can be retrieved from create response
- [ ] Session state persists after reload (GET endpoint)
- [ ] Global seek updates all VOD times correctly
- [ ] Offset history is tracked properly
- [ ] Playback state changes work (play/pause/seek)
- [ ] Delete removes session file
- [ ] Frontend can create a session and pass session ID in URL
- [ ] Frontend can fetch session and render VODs
- [ ] Scrubber changes trigger global-seek
- [ ] Play/pause buttons trigger playback control

---

## Performance Notes

- **File I/O:** Sessions are written to disk on every update
  - In production, consider batching writes
  - For now, acceptable for single-session use
  
- **Metadata Extraction:** Happens at session creation
  - Uses opencv (cv2) for video metadata
  - Cached in session, never re-extracted

- **Offset History:** Unbounded array
  - No cleanup implemented yet
  - For typical use, acceptable

---

## Support & Debugging

**Enable verbose logging in Flask:**
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

**Check session file manually:**
```bash
cat ~/.vod-insights/multi_vod_sessions/sess-*.json | jq .
```

**Monitor API calls:**
```bash
# In another terminal
curl http://localhost:3001/api/sessions/multi-vod/sess-test/offset-history
```

---

**Created by Backend Engineer (Subagent)**  
**Ready for Frontend Integration Testing** ✅
