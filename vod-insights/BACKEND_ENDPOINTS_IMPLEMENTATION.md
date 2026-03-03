# Backend Endpoints Implementation - Multi-VOD Comparison

## Summary

Implemented endpoints to support the UI for creating multi-VOD comparisons. The implementation includes the complete `GET /api/vods/list` endpoint and verified the existing `/api/sessions/multi-vod/list` endpoint.

## Implementation Details

### 1. List Available VODs Endpoint

**Endpoint:** `GET /api/vods/list`
**Full URL:** `http://localhost:5000/api/sessions/multi-vod/vods/list`

**Response (200 OK):**
```json
{
  "ok": true,
  "vods": [
    {
      "vod_id": "vod-7f3e8a1c9e2b4d5a6c8f1e2d",
      "name": "apex_match_final",
      "path": "/home/user/Videos/apex_match_final.mp4",
      "duration": 3600.0,
      "fps": 60.0,
      "resolution": "1920x1080",
      "codec": "h264",
      "created_at": 1740869400.0,
      "file_size_mb": 1024.5,
      "mtime": 1740869400.0
    },
    {
      "vod_id": "vod-a2f9e1d4c7b3e6f2a1c9e8d5",
      "name": "apex_match_practice",
      "path": "/home/user/Videos/apex_match_practice.mp4",
      "duration": 2400.0,
      "fps": 60.0,
      "resolution": "1920x1080",
      "codec": "h264",
      "created_at": 1740868000.0,
      "file_size_mb": 768.2,
      "mtime": 1740868000.0
    }
  ]
}
```

**Error Responses:**

500 Internal Server Error - No VOD directories configured:
```json
{
  "ok": false,
  "error": "No VOD directories configured"
}
```

500 Internal Server Error - Permission issues:
```json
{
  "ok": false,
  "error": "Permission denied: [specific error]"
}
```

### 2. Session Management Endpoint (Already Existed)

**Endpoint:** `GET /api/sessions/multi-vod/list`

**Response (200 OK):**
```json
{
  "ok": true,
  "sessions": [
    {
      "session_id": "session-abc123",
      "name": "Coach Analysis - Week 1",
      "description": "Comparing 3 player POVs",
      "created_at": 1740869400.0,
      "updated_at": 1740869500.0,
      "created_by": "coach-user",
      "vod_count": 3
    }
  ]
}
```

## Implementation Features

### VOD Discovery
- **Multiple Directory Support**: Scans both replay directory (from config) and downloads directory
- **Extension Filtering**: Supports `.mp4`, `.mov`, `.mkv`, `.avi`, `.flv`, `.webm`
- **Temp File Filtering**: Automatically skips yt-dlp temp files (`.temp`, `.part`)
- **Recursive Scanning**: Scans all VOD directories for eligible files

### Metadata Extraction
- **Duration**: Extracted from video frame count and FPS
- **FPS**: Frames per second from video codec info
- **Resolution**: Width x Height format
- **Codec**: Video codec (currently defaults to h264, can be enhanced with ffprobe)
- **File Size**: In megabytes
- **Creation Time**: From file stats (ctime and mtime)

### Sorting & Presentation
- **Chronological Sorting**: By modification time, newest first (most recent videos first)
- **Unique IDs**: VOD IDs generated using UUID5 from file path (deterministic and collision-free)
- **File Names**: Display using file stem (name without extension)

### Error Handling
- **Missing Directories**: Returns 500 with descriptive error
- **Permission Errors**: Returns 500 with permission error message
- **Unreadable Files**: Gracefully skips files that can't be read (corrupted, unsupported format)
- **General Errors**: Returns 500 with detailed error message

## Helper Functions Implemented

All helper functions are in `app/multi_vod_api.py`:

1. **`_load_config()`** - Loads configuration from disk
2. **`_get_vods_dir(config)`** - Gets primary VOD directory from config
3. **`_get_vod_dirs(config)`** - Gets all VOD directories (replay + downloads)
4. **`_get_vod_paths(directories, extensions)`** - Scans directories and returns VOD file paths
5. **`_get_vod_metadata(vod_path)`** - Extracts metadata using cv2
6. **`_serialize_session(session)`** - Serializes session objects to JSON

## Integration Points

### Uses Existing Components
- **Config Loading**: Uses existing `get_config_path()` from `runtime_paths`
- **Downloads Directory**: Uses existing `get_downloads_dir()` from `runtime_paths`
- **Metadata Extraction**: Uses cv2 (same as existing code in `multi_vod_api.py`)
- **Blueprint Pattern**: Follows existing Flask blueprint pattern

### Configuration
The endpoint reads from config's `replay` and `split` sections:
```json
{
  "replay": {
    "directory": "/path/to/vod/library"
  },
  "split": {
    "extensions": [".mp4", ".mov", ".mkv"]
  }
}
```

## Testing Coverage

Comprehensive test files created:

### `tests/test_vods_list_api.py`
- Tests endpoint with no directories configured
- Tests with empty directory
- Tests with sample VOD files (mocked metadata)
- Tests with 3+ VODs
- Tests error handling for unreadable files
- Tests sorting (newest first)

### `tests/test_vods_list_helpers.py`
- Tests `_get_vod_paths()` with empty directory
- Tests extension filtering
- Tests mtime-based sorting
- Tests `_get_vods_dir()` config parsing
- Tests `_get_vod_dirs()` with multiple directories
- Tests metadata extraction error handling
- Tests `_load_config()` functionality

## Ready for QA

The implementation is complete and ready for QA testing with the Frontend:

✅ Endpoint implementation complete  
✅ Error handling implemented  
✅ Configuration integration complete  
✅ VOD discovery and filtering working  
✅ Metadata extraction functioning  
✅ Sorting by recency implemented  
✅ Helper functions tested  
✅ Code follows existing patterns  

### Next Steps for QA
1. Test endpoint in browser/frontend
2. Verify VOD list displays correctly
3. Test with real VOD files in library
4. Verify metadata accuracy (duration, FPS, resolution)
5. Test with various video formats
6. Test error cases (missing directories, permission errors)
7. Performance test with large number of VODs (100+)
8. Test with concurrent requests

### Optional Enhancements for Future
1. Add caching (5-minute TTL) for metadata
2. Add pagination support to `/api/vods/list`
3. Enhanced codec detection using ffprobe
4. Thumbnail extraction for VOD previews
5. Search/filter by filename
6. Sort by different criteria (size, duration, fps)
