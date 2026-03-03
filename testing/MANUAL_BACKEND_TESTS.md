# Manual Backend Testing Guide

**Purpose:** Verify all 8 backend endpoints work correctly with actual HTTP requests  
**Created by:** Backend Engineer (Subagent)  
**Last Updated:** March 2, 2026

---

## Prerequisites

1. **Running Server**
   ```bash
   cd /home/owner/.openclaw/workspace/vod-insights
   python app/webui.py
   # OR if using npm
   npm start
   ```

2. **Test Video Files** (or mock responses)
   - At minimum, need paths to 2-3 valid MP4 files
   - OR mock the video reading to test without files

3. **curl** (for making requests) — usually pre-installed

---

## Test Scenario: Tournament Match Analysis

We'll create a session, sync VODs, adjust offsets, and track changes.

### Step 1: Create a Multi-VOD Session

**Command:**
```bash
BASE_URL="http://localhost:3001"

curl -X POST "$BASE_URL/api/sessions/multi-vod" \
  -H "Content-Type: application/json" \
  -d '{
    "vods": [
      {
        "vod_id": "fuse-player",
        "name": "Fuse Gameplay",
        "path": "/path/to/fuse_gameplay.mp4"
      },
      {
        "vod_id": "wraith-player",
        "name": "Wraith Gameplay",
        "path": "/path/to/wraith_gameplay.mp4"
      },
      {
        "vod_id": "bloodhound-player",
        "name": "Bloodhound Gameplay",
        "path": "/path/to/bloodhound_gameplay.mp4"
      }
    ],
    "name": "Tournament Finals - Team Alpha",
    "description": "3-player comparison for finals analysis",
    "created_by": "coach-nishie"
  }' | jq .
```

**Expected Response:**
```json
{
  "ok": true,
  "session": {
    "session_id": "sess-abc123xyz789...",
    "name": "Tournament Finals - Team Alpha",
    "created_at": 1741014000.123,
    "updated_at": 1741014000.123,
    "created_by": "coach-nishie",
    "global_time": 0.0,
    "global_playback_state": "paused",
    "vods": [
      {
        "vod_id": "fuse-player",
        "name": "Fuse Gameplay",
        "path": "/path/to/fuse_gameplay.mp4",
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
      ...
    ]
  }
}
```

**✓ Verify:**
- Status is `201 Created`
- Response has `ok: true`
- `session_id` is populated (save this!)
- All 3 VODs are in the response
- Each VOD has metadata (duration, fps, resolution, etc.)
- Initial state: all paused, all at time 0.0, no offsets

**⚠️ Common Issue:** If you get a 400 error, check:
- Video file paths are valid and absolute
- Files can be opened/read
- Files are valid video formats

---

### Step 2: Save Session ID

```bash
SESSION_ID="sess-abc123xyz789"  # Replace with actual ID from response
echo $SESSION_ID
```

---

### Step 3: Fetch Session State

**Command:**
```bash
curl "$BASE_URL/api/sessions/multi-vod/$SESSION_ID" | jq .
```

**✓ Verify:**
- Status is `200 OK`
- Response includes full session state
- Global time and offsets match what we set

---

### Step 4: Global Seek (Sync All VODs)

Seek all VODs to 150 seconds into the match.

**Command:**
```bash
curl -X PUT "$BASE_URL/api/sessions/multi-vod/$SESSION_ID/global-seek" \
  -H "Content-Type: application/json" \
  -d '{"timestamp": 150.0}' | jq .
```

**Expected Response:**
```json
{
  "ok": true,
  "session": {
    "global_time": 150.0,
    "global_playback_state": "seeking",
    "vods": [
      {
        "vod_id": "fuse-player",
        "current_time": 150.0,
        "playback_state": "seeking"
      },
      {
        "vod_id": "wraith-player",
        "current_time": 150.0,
        "playback_state": "seeking"
      },
      {
        "vod_id": "bloodhound-player",
        "current_time": 150.0,
        "playback_state": "seeking"
      }
    ]
  }
}
```

**✓ Verify:**
- All VODs now show `current_time: 150.0`
- All VODs show `playback_state: "seeking"`
- Global time is `150.0`

---

### Step 5: Adjust Offsets (Manually Sync)

Notice that the Wraith player started recording 5 seconds after Fuse, and Bloodhound started 10 seconds *before* Fuse.

Set offsets to match them:

**Command:**
```bash
curl -X PUT "$BASE_URL/api/sessions/multi-vod/$SESSION_ID/offsets" \
  -H "Content-Type: application/json" \
  -d '{
    "offsets": {
      "fuse-player": 0.0,
      "wraith-player": -5.0,
      "bloodhound-player": 10.0
    },
    "source": "manual",
    "changed_by": "coach-nishie"
  }' | jq .
```

**Expected Response:**
```json
{
  "ok": true,
  "session": {
    "vods": [
      {
        "vod_id": "fuse-player",
        "offset": 0.0,
        "offset_history": []
      },
      {
        "vod_id": "wraith-player",
        "offset": -5.0,
        "offset_source": "manual",
        "offset_history": [
          {
            "timestamp": 1741014050.123,
            "vod_id": "wraith-player",
            "vod_name": "Wraith Gameplay",
            "old_offset": 0.0,
            "new_offset": -5.0,
            "source": "manual",
            "confidence": null,
            "changed_by": "coach-nishie"
          }
        ]
      },
      {
        "vod_id": "bloodhound-player",
        "offset": 10.0,
        "offset_source": "manual",
        "offset_history": [
          {
            "timestamp": 1741014050.123,
            "vod_id": "bloodhound-player",
            "vod_name": "Bloodhound Gameplay",
            "old_offset": 0.0,
            "new_offset": 10.0,
            "source": "manual",
            "confidence": null,
            "changed_by": "coach-nishie"
          }
        ]
      }
    ]
  }
}
```

**✓ Verify:**
- Offsets are updated correctly
- Offset history shows the change with timestamp, old/new values, source, and user
- All 3 VODs are in offset_history

---

### Step 6: Seek with Offsets Applied

Now when we seek globally, the offsets should be respected.

**Command:**
```bash
curl -X PUT "$BASE_URL/api/sessions/multi-vod/$SESSION_ID/global-seek" \
  -H "Content-Type: application/json" \
  -d '{"timestamp": 200.0}' | jq .
```

**Expected Response (with offsets):**
```json
{
  "ok": true,
  "session": {
    "global_time": 200.0,
    "vods": [
      {
        "vod_id": "fuse-player",
        "offset": 0.0,
        "current_time": 200.0    // 200.0 - 0.0 = 200.0
      },
      {
        "vod_id": "wraith-player",
        "offset": -5.0,
        "current_time": 205.0    // 200.0 - (-5.0) = 205.0
      },
      {
        "vod_id": "bloodhound-player",
        "offset": 10.0,
        "current_time": 190.0    // 200.0 - 10.0 = 190.0
      }
    ]
  }
}
```

**✓ Verify:**
- Wraith is 5s *ahead* (205s while global is 200s) because offset is -5
- Bloodhound is 10s *behind* (190s) because offset is +10
- Formula: `current_time = global_time - offset`

---

### Step 7: Get Offset History

See the complete audit trail of changes.

**Command:**
```bash
curl "$BASE_URL/api/sessions/multi-vod/$SESSION_ID/offset-history" | jq .
```

**Optional - Filter by VOD:**
```bash
curl "$BASE_URL/api/sessions/multi-vod/$SESSION_ID/offset-history?vod_id=wraith-player" | jq .
```

**Expected Response:**
```json
{
  "ok": true,
  "history": [
    {
      "timestamp": 1741014050.123,
      "vod_id": "bloodhound-player",
      "vod_name": "Bloodhound Gameplay",
      "old_offset": 0.0,
      "new_offset": 10.0,
      "source": "manual",
      "confidence": null,
      "changed_by": "coach-nishie"
    },
    {
      "timestamp": 1741014050.123,
      "vod_id": "wraith-player",
      "vod_name": "Wraith Gameplay",
      "old_offset": 0.0,
      "new_offset": -5.0,
      "source": "manual",
      "confidence": null,
      "changed_by": "coach-nishie"
    }
  ]
}
```

**✓ Verify:**
- History is in reverse chronological order (most recent first)
- All changes are recorded with source, user, and confidence
- Filtering by vod_id only shows changes for that VOD

---

### Step 8: Individual VOD Seek

Seek just the Wraith player forward without affecting others.

**Command:**
```bash
curl -X PUT "$BASE_URL/api/sessions/multi-vod/$SESSION_ID/vods/wraith-player/seek" \
  -H "Content-Type: application/json" \
  -d '{"timestamp": 220.0}' | jq .
```

**Expected Response:**
```json
{
  "ok": true,
  "session": {
    "global_time": 220.0,
    "vods": [
      {
        "vod_id": "wraith-player",
        "current_time": 220.0
      }
    ]
  }
}
```

**✓ Verify:**
- Only the Wraith VOD's current_time changed
- global_time was updated to this VOD's time

---

### Step 9: Playback Control

Start playing all VODs.

**Command:**
```bash
curl -X PUT "$BASE_URL/api/sessions/multi-vod/$SESSION_ID/playback" \
  -H "Content-Type: application/json" \
  -d '{"action": "play"}' | jq .
```

**Expected Response:**
```json
{
  "ok": true,
  "session": {
    "global_playback_state": "playing",
    "vods": [
      {
        "playback_state": "playing"
      }
    ]
  }
}
```

**✓ Verify:**
- `global_playback_state` is now "playing"

---

### Step 10: Pause

**Command:**
```bash
curl -X PUT "$BASE_URL/api/sessions/multi-vod/$SESSION_ID/playback" \
  -H "Content-Type: application/json" \
  -d '{"action": "pause"}' | jq .
```

---

### Step 11: Delete Session

Clean up the session.

**Command:**
```bash
curl -X DELETE "$BASE_URL/api/sessions/multi-vod/$SESSION_ID"
```

**Expected Response:**
- Status `204 No Content`
- Empty body

**Verify deletion:**
```bash
curl "$BASE_URL/api/sessions/multi-vod/$SESSION_ID"
# Should return 404 with error: "Session not found"
```

**✓ Verify:**
- Session is gone from filesystem
- Future requests return 404

---

## Error Cases to Test

### Test 1: Invalid Session ID
```bash
curl "$BASE_URL/api/sessions/multi-vod/invalid-session-id" | jq .
# Expected: 404 with error: "Session not found"
```

### Test 2: Invalid Timestamp (Negative)
```bash
curl -X PUT "$BASE_URL/api/sessions/multi-vod/$SESSION_ID/global-seek" \
  -H "Content-Type: application/json" \
  -d '{"timestamp": -10.0}' | jq .
# Expected: 400 with error: "Invalid timestamp"
```

### Test 3: Missing Required Field
```bash
curl -X POST "$BASE_URL/api/sessions/multi-vod" \
  -H "Content-Type: application/json" \
  -d '{
    "vods": [
      {
        "vod_id": "vod1",
        "name": "Test"
        # Missing "path"!
      }
    ]
  }' | jq .
# Expected: 400 with error: "Each VOD must have 'path' and 'vod_id'"
```

### Test 4: Invalid Action
```bash
curl -X PUT "$BASE_URL/api/sessions/multi-vod/$SESSION_ID/playback" \
  -H "Content-Type: application/json" \
  -d '{"action": "fastforward"}' | jq .
# Expected: 400 with error: "Invalid action. Must be 'play', 'pause', or 'seek'"
```

### Test 5: Missing VOD for Independent Seek
```bash
curl -X PUT "$BASE_URL/api/sessions/multi-vod/$SESSION_ID/vods/nonexistent-vod/seek" \
  -H "Content-Type: application/json" \
  -d '{"timestamp": 100.0}' | jq .
# Expected: 404 with error: "VOD not found"
```

---

## Testing Session Persistence

After making changes, stop and restart the server, then fetch the session again:

```bash
# After changing offsets and state...
curl "$BASE_URL/api/sessions/multi-vod/$SESSION_ID" | jq '.session | {global_time, vods[].offset}'

# Stop server (Ctrl+C)
# Restart server
# Fetch again:
curl "$BASE_URL/api/sessions/multi-vod/$SESSION_ID" | jq '.session | {global_time, vods[].offset}'

# Should match!
```

**✓ Verify:**
- State is identical after restart
- No data loss

---

## Performance Checklist

- [ ] Create session returns quickly (< 1s)
- [ ] Fetch session is instant (< 100ms)
- [ ] Seek operations complete immediately (< 100ms)
- [ ] Offset updates are fast (< 100ms)
- [ ] Offset history doesn't grow unboundedly
- [ ] Session files are reasonable size (< 1MB)

---

## Frontend Integration Checklist

- [ ] Frontend can create a session via API
- [ ] Session ID is passed via URL query parameter (?session=...)
- [ ] Frontend fetches session state on mount
- [ ] Scrubber changes call global-seek endpoint
- [ ] Play/pause buttons call playback endpoint
- [ ] Offset adjustments call offsets endpoint
- [ ] History is visible in UI
- [ ] All three VODs render with correct current_time

---

## Debugging Tips

### Check Server Logs
```bash
# Terminal where server is running
# Look for:
# - 200/201/204/404 status codes
# - Any ERROR messages
# - Timestamps and request paths
```

### Inspect Session Files
```bash
ls -lh ~/.vod-insights/multi_vod_sessions/
# List all session files

cat ~/.vod-insights/multi_vod_sessions/sess-*.json | jq .
# View a specific session (with pretty JSON)
```

### Test Response Format
```bash
curl -s "$BASE_URL/api/sessions/multi-vod/$SESSION_ID" | jq '.'
# Pretty-print JSON

curl -s "$BASE_URL/api/sessions/multi-vod/$SESSION_ID" | jq '.session.vods | length'
# Count VODs

curl -s "$BASE_URL/api/sessions/multi-vod/$SESSION_ID" | jq '.session.vods[0].offset_history'
# View offset history for first VOD
```

---

## Notes

- All timestamps in responses are Unix epoch (seconds since 1970)
- Offsets can be negative (VOD ahead of reference)
- Current time is clamped to [0, duration]
- Session deletion is permanent
- No undo/rollback for offset changes

---

**Created by Backend Engineer (Larry the Lobster 🦞)**  
**Ready for Nishie to test!** ✅
