# Multi-VOD Session Creation Bug - DEBUG REPORT

## Summary
**Root Cause Found and Fixed** ✅

The validation error "Must provide 2-3 VODs" was caused by a **mismatch between frontend and backend field names**, not a backend validation issue.

---

## The Problem

### What Was Happening
1. User selects 3 VODs in the UI ✅
2. Frontend sends request to `/api/sessions/multi-vod` with **wrong field names**
3. Backend receives payload missing the `vods` key
4. Backend defaults `vods` to empty array `[]`
5. Validation fails: "Must provide 2-3 VODs" ❌

### Root Cause: Field Name Mismatch

**Frontend was sending:**
```json
{
  "vod_paths": ["path1.mp4", "path2.mp4", "path3.mp4"],
  "session_name": "My Comparison",
  "sync_mode": "global"
}
```

**Backend expects:**
```json
{
  "vods": [
    { "vod_id": "vod-1", "name": "Player1", "path": "path1.mp4" },
    { "vod_id": "vod-2", "name": "Player2", "path": "path2.mp4" },
    { "vod_id": "vod-3", "name": "Player3", "path": "path3.mp4" }
  ],
  "name": "My Comparison",
  "description": "Optional"
}
```

---

## Changes Made

### 1. Frontend Fix: `MultiVodModal.jsx` (Line 96-101)

**Before:**
```javascript
body: JSON.stringify({
  vod_paths: selectedVods,           // ❌ Wrong field name
  session_name: finalSessionName,    // ❌ Wrong field name
  sync_mode: syncMode,               // ❌ Not used by backend
})
```

**After:**
```javascript
// Build proper VOD objects with full metadata
const selectedVodObjects = selectedVods.map((vodPath) => {
  const vodInfo = vodList.find((v) => v.path === vodPath);
  return {
    vod_id: vodInfo.vod_id,
    name: vodInfo.name || vodInfo.display_name,
    path: vodPath,
  };
});

body: JSON.stringify({
  vods: selectedVodObjects,   // ✅ Correct field + proper structure
  name: finalSessionName,     // ✅ Correct field name
})
```

### 2. Backend Enhancement: `multi_vod_api.py`

Added comprehensive debug logging to the `create_session()` endpoint to help diagnose payload issues in the future:

```python
# DEBUG: Log the incoming payload
print(f"[DEBUG] create_session() called")
print(f"[DEBUG] Full payload: {json.dumps(payload, indent=2, default=str)}")
print(f"[DEBUG] vods_data type: {type(vods_data)}")
print(f"[DEBUG] vods_data length: {len(vods_data)}")
print(f"[DEBUG] Validation details...")
```

This will show in server logs when a request comes in, making it easier to debug similar issues.

---

## Validation Logic (Backend)

The backend validation in `create_session()` is **correct**:

```python
vods_data = payload.get('vods', [])
if not vods_data or len(vods_data) < 2 or len(vods_data) > 3:
    return jsonify({
        "ok": False,
        "error": "Must provide 2-3 VODs"
    }), 400
```

It correctly checks:
- ✅ `vods` key exists
- ✅ Array has at least 2 items
- ✅ Array has at most 3 items

The issue was that the key didn't exist in the incoming payload, so it defaulted to `[]`.

---

## Expected Behavior After Fix

1. User selects 2-3 VODs in modal ✅
2. Frontend sends correct payload structure ✅
3. Backend receives and validates properly ✅
4. Session is created with ID ✅
5. Frontend navigates to comparison page ✅

---

## Testing Checklist

- [ ] Try creating session with 2 VODs → should work
- [ ] Try creating session with 3 VODs → should work
- [ ] Check server logs for debug output → should see payload details
- [ ] Verify session ID is returned and used correctly for navigation
- [ ] Try with 1 VOD → should fail with "Must provide 2-3 VODs"
- [ ] Try with 4 VODs → should fail with "Must provide 2-3 VODs"

---

## Files Modified

1. `/home/owner/.openclaw/workspace/vod-insights/frontend/src/components/MultiVodModal.jsx`
   - Fixed `handleSubmit()` to send correct payload structure

2. `/home/owner/.openclaw/workspace/vod-insights/app/multi_vod_api.py`
   - Added debug logging to `create_session()` endpoint

---

## Notes for Team

The backend validation logic is working correctly. This was purely a frontend integration issue where the wrong field names were being sent. The debug logging added will help catch similar issues in the future before they reach production.
