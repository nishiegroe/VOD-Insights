# Testing VOD List Endpoints

## Setup

### Prerequisites
- Python 3.9+
- Dependencies installed: `pip install -r requirements.txt`
- Flask development server running on `http://localhost:5000`

### Starting the Backend
```bash
cd vod-insights
python app/webui.py
```

The Flask server will start on `http://localhost:5000`.

## Manual Testing with cURL

### Test 1: List VODs (Empty Library)
```bash
curl -X GET http://localhost:5000/api/sessions/multi-vod/vods/list
```

Expected output:
```json
{
  "ok": true,
  "vods": []
}
```

### Test 2: List VODs (With Sample Videos)
1. Add some `.mp4`, `.mov`, or `.mkv` files to your configured VOD directory
2. Run the same curl command:
```bash
curl -X GET http://localhost:5000/api/sessions/multi-vod/vods/list
```

Expected output:
```json
{
  "ok": true,
  "vods": [
    {
      "vod_id": "vod-...",
      "name": "video_filename",
      "path": "/full/path/to/video.mp4",
      "duration": 3600.0,
      "fps": 60.0,
      "resolution": "1920x1080",
      "codec": "h264",
      "created_at": 1740869400.0,
      "file_size_mb": 1024.5,
      "mtime": 1740869400.0
    }
  ]
}
```

### Test 3: List Sessions
```bash
curl -X GET http://localhost:5000/api/sessions/multi-vod/list
```

Expected output:
```json
{
  "ok": true,
  "sessions": []
}
```

## Testing in Browser

### Method 1: Browser Console
```javascript
// Test the VOD list endpoint
fetch('/api/sessions/multi-vod/vods/list')
  .then(r => r.json())
  .then(data => console.log(JSON.stringify(data, null, 2)));

// Test the session list endpoint
fetch('/api/sessions/multi-vod/list')
  .then(r => r.json())
  .then(data => console.log(JSON.stringify(data, null, 2)));
```

### Method 2: Postman/Insomnia
1. Create a new GET request to `http://localhost:5000/api/sessions/multi-vod/vods/list`
2. Send the request
3. Verify the response contains:
   - `"ok": true`
   - `"vods": []` (or list of VODs if files are present)

## Automated Testing

### Run Helper Function Tests
Tests the helper functions without Flask:
```bash
python tests/test_vods_list_helpers.py
```

### Run Full API Tests (Requires Flask)
```bash
python -m pytest tests/test_vods_list_api.py -v
# or
python tests/test_vods_list_api.py
```

### Run Multi-VOD Tests
```bash
python tests/test_multi_vod.py
```

## Expected Behavior

### Success Cases (200 OK)

**Empty library:**
- VOD directory exists but is empty
- Returns: `{ "ok": true, "vods": [] }`

**With VOD files:**
- VOD directory contains valid video files
- Each VOD has: vod_id, name, path, duration, fps, resolution, codec, created_at, file_size_mb, mtime
- Results sorted by mtime (newest first)
- Returns: `{ "ok": true, "vods": [...]}`

**Skips problematic files:**
- Corrupted or unreadable video files are skipped
- Only readable files appear in results
- Returns remaining readable VODs

### Error Cases (500 Internal Server Error)

**No directories configured:**
- Config is missing replay directory
- Downloads directory doesn't exist or is not accessible
- Returns: `{ "ok": false, "error": "No VOD directories configured" }`

**Permission denied:**
- VOD directory exists but no read permissions
- Returns: `{ "ok": false, "error": "Permission denied: ..." }`

**General error:**
- Unexpected exception during processing
- Returns: `{ "ok": false, "error": "Error listing VODs: ..." }`

## Verifying the Implementation

### Checklist

- [ ] Endpoint is accessible at `/api/sessions/multi-vod/vods/list`
- [ ] Empty library returns empty list
- [ ] VOD files are detected and listed
- [ ] Files sorted by modification time (newest first)
- [ ] Metadata is extracted correctly:
  - [ ] Duration is accurate
  - [ ] FPS is correct
  - [ ] Resolution matches video dimensions
  - [ ] File size is correct
- [ ] Error handling works:
  - [ ] Returns 500 when directories not configured
  - [ ] Returns 500 on permission errors
  - [ ] Gracefully skips unreadable files
- [ ] VOD IDs are unique and deterministic
- [ ] File names display correctly
- [ ] Temp files (.temp, .part) are filtered out
- [ ] Only video extensions are returned

## Integration with Frontend

The frontend can use the endpoint to:

1. **Display Available VODs:**
   ```javascript
   const response = await fetch('/api/sessions/multi-vod/vods/list');
   const data = await response.json();
   
   if (data.ok) {
     displayVods(data.vods);
   } else {
     showError(data.error);
   }
   ```

2. **Select VODs for Comparison:**
   - User selects 2-3 VODs from the list
   - VOD objects contain `vod_id` and `path` needed for session creation

3. **Create Session with Selected VODs:**
   ```javascript
   const vodList = getSelectedVods(); // Get from UI
   const response = await fetch('/api/sessions/multi-vod', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       vods: vodList.map(v => ({
         vod_id: v.vod_id,
         name: v.name,
         path: v.path
       })),
       name: 'My Comparison'
     })
   });
   ```

## Performance Notes

### Current Implementation
- No caching (metadata extracted on each request)
- Suitable for libraries with 100+ VODs
- Metadata extraction is fast (opens video file, reads headers, closes)

### Future Optimization
- Add 5-minute TTL cache for metadata
- Add pagination support for large libraries
- Lazy load metadata (only on demand)
- Async metadata extraction for performance

## Troubleshooting

### Endpoint returns error "No VOD directories configured"
**Solution:** Check config.json has a valid `replay.directory` path

### Endpoint returns no VODs even though files exist
**Solutions:**
1. Check file extensions are supported (.mp4, .mov, .mkv, .avi, .flv, .webm)
2. Verify directory path in config is absolute path
3. Check file permissions (app can read the files)
4. Verify files aren't temp files (.temp, .part extensions)

### Duration/FPS/Resolution appears as 0 or "unknown"
**Solutions:**
1. Verify video files are valid and not corrupted
2. Check video codec is supported by cv2
3. Try with different video file to isolate issue

### Permission denied error
**Solutions:**
1. Check VOD directory permissions: `ls -la /path/to/vods`
2. Ensure app process has read access
3. On Linux/Mac: `chmod 755 /path/to/vods`
