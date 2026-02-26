# Twitch VOD Download Feature - Implementation Specification

**Status**: Ready for implementation
**Priority**: HIGH
**Estimated Effort**: 12,000 tokens
**Target Component**: VOD Insights App (webui.py in Apex Event Tracker)

## Feature Overview

Add Twitch VOD download capability directly within the VOD Insights application. Users can paste a Twitch VOD URL and have it downloaded to their VOD directory for immediate analysis.

## User Requirements (from your spec)

1. **Use yt-dlp** (check if already installed, else recommend alternatives)
2. **NO API setup required** - URL input only
3. **Filename format**: `[streamer]_[date].mp4`
4. **UI**: Button with Twitch icon → popup modal for URL input
5. **Progress**: Show download progress in notification center with progress indicator
6. **Error handling**: Notification on failure (no auto-scan)
7. **Investigation**: Determine VOD format compatibility

## Requirements Deep-Dive

### 1. Tool: yt-dlp (No API setup required)

**Status Check**:
```bash
# Check if yt-dlp is installed
which yt-dlp
yt-dlp --version

# If not found, recommend: pip install yt-dlp
# Alternative: youtube-dl (older, slower)
```

**Why yt-dlp**:
- Actively maintained (vs deprecated youtube-dl)
- Works without API keys/tokens
- Supports Twitch (clips, VODs, entire channels)
- Fast and reliable
- Gives granular control over output format

### 2. Filename Format: `[streamer]_[date].mp4`

**Examples**:
- `TimTheTatman_2026-02-26.mp4`
- `NiceWigg_2026-02-25.mp4`
- `Reps_2026-02-24.mp4`

**Implementation**:
```python
def get_vod_filename(url: str, title: str) -> str:
    """Extract streamer name and date from VOD metadata"""
    # Parse title to get streamer and date
    # yt-dlp provides: video title, channel name, upload date
    # Format: [channel]_[YYYY-MM-DD].mp4
```

### 3. UI: Button with Twitch Icon → Modal

**Location**: VOD Insights page (webui.py)
**Design**:
```
┌─────────────────────────┐
│ Recorded VODs           │
│ ┌─────────────────────┐ │
│ │ Recorded VODs list  │ │  ← Add button here
│ │  • vod1.mp4        │ │
│ │  • vod2.mp4        │ │    [🎥 Download VOD]
│ └─────────────────────┘ │
└─────────────────────────┘

Modal (Popup):
╔════════════════════════════════════╗
║ Download Twitch VOD                ║
╠════════════════════════════════════╣
║ Paste VOD URL:                     ║
║ [_____________________________]     ║
║                                    ║
║ Example: https://twitch.tv/...    ║
║                                    ║
║ [Cancel]  [Download]               ║
╚════════════════════════════════════╝
```

**Features**:
- Text input field for URL
- Validation (must be valid Twitch URL)
- Error messaging in modal
- Close/cancel button
- Download button triggers backend

### 4. Download Progress Tracking

**Notification Center Integration**:
```
Downloading: Streamer_Name VOD
████████░░░░ 65%
[↓ 2.5 GB / 3.8 GB]
Speed: 5.2 MB/s
Time remaining: ~3 minutes
```

**Implementation Points**:
- Real-time progress callbacks from yt-dlp
- Update notification every 1-5 seconds
- Show: percentage, size, speed, ETA

### 5. Error Handling

**Failure Scenarios**:
- Invalid URL (not a Twitch link)
- VOD doesn't exist (deleted or private)
- Network timeout
- yt-dlp not installed
- Insufficient disk space
- Permission denied on VOD directory

**User Notification**:
- Show error in notification center
- **NOT** auto-scanning after failure
- Include helpful message (e.g., "yt-dlp not found. Install: pip install yt-dlp")
- Suggest retry or alternatives

**Key**: No auto-scan after download (as you specified)

### 6. VOD Format Compatibility

**Investigation Required**:
- What formats does VOD Insights currently accept?
  - MP4, MKV, WebM, AVI?
- What video codecs work best for analysis?
  - H.264, H.265, VP9?
- What audio requirements?
  - Optional? Specific codec?

**To Investigate in Code**:
- Look in: split_bookmarks.py, vod_ocr.py
- Check for video/audio processing requirements
- Determine if any format conversion needed
- Check expected file location: DOWNLOADS_DIR or replay directory

## Implementation Plan

### Phase 1: Backend Foundation (2k tokens)
- [ ] Create `vod_download.py` module
  - `check_yt_dlp_installed()` - Verify tool availability
  - `validate_twitch_url(url)` - URL validation
  - `download_vod(url, output_dir, callback)` - Main download logic
  - `parse_vod_metadata(url)` - Get streamer/date info

### Phase 2: Frontend UI (3k tokens)
- [ ] Add "Download VOD" button to React component (frontend/src/pages/)
- [ ] Create DownloadVODModal React component
- [ ] Add event handlers and API calls
- [ ] Real-time progress UI updates with polling

### Phase 3: Backend API Endpoint (2k tokens)
- [ ] Create Python route in `app/webui.py`: `POST /api/vod/download`
- [ ] Input validation: URL, directory access
- [ ] Background job handling (thread/async, don't block request)
- [ ] Return job ID for progress tracking

### Phase 4: Progress Tracking (2k tokens)
- [ ] `GET /api/vod/progress/<job_id>` endpoint
- [ ] Progress state in Python backend
- [ ] Real-time updates via polling from React
- [ ] Display: percentage, speed, ETA in notification center

### Phase 5: Testing & Polish (3k tokens)
- [ ] Test with various Twitch URLs
- [ ] Error scenarios (invalid URL, missing tool, no space)
- [ ] Format verification
- [ ] Performance optimization
- [ ] Documentation

## Code Structure

### New File: `app/vod_download.py` (Backend Python)

```python
import subprocess
import json
from pathlib import Path
from typing import Optional, Callable, Dict
import re
from datetime import datetime
import uuid

class TwitchVODDownloader:
    """Download Twitch VODs using yt-dlp"""

    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.jobs: Dict[str, dict] = {}  # Track download jobs

    def check_yt_dlp(self) -> bool:
        """Check if yt-dlp is installed"""
        try:
            subprocess.run(['yt-dlp', '--version'], capture_output=True, check=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False

    def validate_url(self, url: str) -> bool:
        """Validate Twitch VOD URL"""
        pattern = r'https?:\/\/(www\.)?twitch\.tv\/videos\/\d+'
        return bool(re.match(pattern, url))

    def start_download(self, url: str, job_id: str) -> None:
        """Start background download job"""
        # Implementation details in Phase 1
        pass

    def get_progress(self, job_id: str) -> Dict:
        """Get job progress"""
        return self.jobs.get(job_id, {})

    def _parse_metadata(self, url: str) -> Dict[str, str]:
        """Extract streamer name and date from VOD"""
        # Use yt-dlp --dump-json to get metadata
        # Return: {"streamer": "...", "date": "YYYY-MM-DD"}
        pass

    def _get_filename(self, metadata: Dict[str, str]) -> str:
        """Format filename: [streamer]_[date].mp4"""
        return f"{metadata['streamer']}_{metadata['date']}.mp4"
```

### Updated: `app/webui.py` (Flask Backend)

```python
# Add import
from app.vod_download import TwitchVODDownloader
import uuid

vod_downloader = TwitchVODDownloader(output_dir=Path(config.get("replay", {}).get("directory", "")))

@app.route('/api/vod/download', methods=['POST'])
def download_vod():
    """
    Start VOD download job

    Request JSON:
    {
        "url": "https://twitch.tv/videos/123456789"
    }

    Response:
    {
        "job_id": "job_xyz",
        "status": "downloading"
    }
    """
    data = request.get_json()
    url = data.get('url', '')

    # Validate
    if not vod_downloader.validate_url(url):
        return {'error': 'Invalid Twitch URL'}, 400

    # Start job
    job_id = str(uuid.uuid4())
    vod_downloader.start_download(url, job_id)

    return {'job_id': job_id, 'status': 'downloading'}, 200

@app.route('/api/vod/progress/<job_id>', methods=['GET'])
def get_download_progress(job_id):
    """Get download progress"""
    progress = vod_downloader.get_progress(job_id)
    return progress or {'error': 'Job not found'}, 404
```

### Frontend React Component (frontend/src/components/DownloadVODModal.jsx)

```jsx
import React, { useState } from 'react';

export function DownloadVODModal({ isOpen, onClose }) {
  const [url, setUrl] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState(null);
  const [error, setError] = useState(null);

  const handleDownload = async () => {
    setError(null);

    // Validate URL
    if (!isValidTwitchUrl(url)) {
      setError('Invalid Twitch URL');
      return;
    }

    try {
      setIsDownloading(true);
      const response = await fetch('/api/vod/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await response.json();
      setJobId(data.job_id);

      // Poll for progress
      pollProgress(data.job_id);
    } catch (err) {
      setError(err.message);
      setIsDownloading(false);
    }
  };

  const pollProgress = async (jId) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/vod/progress/${jId}`);
        const data = await response.json();

        setProgress(data.percentage);

        if (data.status === 'completed') {
          clearInterval(interval);
          setIsDownloading(false);
          onClose();
        } else if (data.status === 'error') {
          clearInterval(interval);
          setError(data.error);
          setIsDownloading(false);
        }
      } catch (err) {
        console.error('Progress fetch error:', err);
      }
    }, 1000);
  };

  const isValidTwitchUrl = (url) => {
    return /https?:\/\/(www\.)?twitch\.tv\/videos\/\d+/.test(url);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content vod-download-modal">
        <h2>Download Twitch VOD</h2>

        {error && <div className="error-message">{error}</div>}

        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://twitch.tv/videos/123456789"
          disabled={isDownloading}
        />

        {isDownloading && (
          <div className="progress-container">
            <progress value={progress} max="100"></progress>
            <span>{progress}%</span>
          </div>
        )}

        <div className="modal-buttons">
          <button onClick={onClose} disabled={isDownloading}>Cancel</button>
          <button onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? 'Downloading...' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

## Testing Checklist

- [ ] yt-dlp detection (installed/not installed)
- [ ] Valid VOD URL accepted
- [ ] Invalid URLs rejected with clear message
- [ ] Download progress tracked (0-100%)
- [ ] File saved with correct name format
- [ ] File appears in correct directory
- [ ] Notification center updates work
- [ ] Large files (>5GB) handled properly
- [ ] Network interruption handling
- [ ] Insufficient disk space error
- [ ] Permission denied error
- [ ] URL validation (Twitch domain, video ID)

## Alternatives if yt-dlp Unavailable

1. **youtube-dl** (deprecated but functional)
   ```bash
   pip install youtube-dl
   ```

2. **FFmpeg + RTMP** (advanced, Twitch doesn't expose RTMP anymore)

3. **External tool recommendation** (degrade gracefully)
   - Suggest TwitchLeecher, streamlink, etc.
   - Provide download link

## Performance Considerations

- **Download speed**: Limited by user's internet/Twitch servers
- **File size**: VODs can be 3-10GB+ (no limit check needed)
- **Disk space**: Warn if <500MB free
- **Processing time**: For large files, download can take 10-30+ minutes

## Security Notes

- Validate URL is actually Twitch domain
- Check file writing doesn't escape directory
- Verify downloaded file is valid video
- Don't execute downloaded files
- Sanitize filenames

## Integration with VOD Insights

1. **Auto-detection**: When download completes, file is ready for analysis
2. **Scanning**: User can manually trigger scan on new file
3. **Format verification**: Ensure downloaded format works with scanner
4. **Metadata**: Pre-populate any available metadata (date, channel)

## Future Enhancements

- Download entire channel VODs
- Download clips (shorter format)
- Stream directly to analyzer (skip download)
- Quality selection (720p, 1080p, 60fps, etc.)
- Batch downloads
- Schedule downloads (run overnight)
- Archive management (auto-delete old VODs)

## References

- **yt-dlp**: https://github.com/yt-dlp/yt-dlp
- **Twitch URL formats**: https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/twitch.py
- **Flask async jobs**: Celery, RQ, APScheduler

---

**Implementation Priority**: HIGH
**Complexity**: Medium-High (async handling, progress tracking, error cases)
**Estimated Time**: 12 hours of work (12,000 tokens at ~1 hour per 1000 tokens)
**Status**: ✅ Ready for Implementation
