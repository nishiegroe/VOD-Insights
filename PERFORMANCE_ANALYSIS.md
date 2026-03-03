# VOD Insights Performance Analysis & Fixes

## Problem Identified

### Issue 1: Long VOD Loading Performance (Vods.jsx & VodViewer.jsx)

**Root Cause:**
- The `/api/session-data` endpoint in `webui.py` loads **ALL bookmarks** from the session file without pagination
- For a 10+ hour VOD with event detection (default 1-second interval), this means **36,000+ bookmarks**
- The frontend then processes these through expensive useMemo operations:
  - `timelineEvents` - combines bookmarks + manual markers
  - `filteredEvents` - filters by keywords
  - `densityBins` - calculates density for heatmap (120 bins)
  - `smoothedDensityBins` - smooths the density
  - `eventClusters` - groups nearby events
  - `nearbyEventIds` - finds events near current time

**Why It's Slow:**
- Processing thousands of events on page load
- Multiple dependent calculations trigger on every filter/time change
- No virtualization or lazy loading of bookmark list

### Issue 2: Image Overlay Feature (New)

**Requirements:**
- Settings section for image upload
- UI to position/select placement on VOD
- Display on VOD Viewer and Clips pages

## Solutions

### Fix 1: Optimize VodViewer.jsx (Frontend)
- Add window-based event loading (only load events in visible scrub window)
- Virtualize the bookmark list for better scrolling performance
- Reduce unnecessary recalculations
- Pre-calculate heatmap bins incrementally

### Fix 2: Add Image Overlay Feature
- Add image upload in Settings.jsx
- Store overlay config (file path, position, size)
- Display overlay in VodViewer.jsx and ClipsViewer.jsx
- Add positioning UI with drag/resize

## Implementation Order
1. ✅ Analyze performance issue
2. ⬜ Fix API/frontend performance bottleneck
3. ⬜ Implement image overlay feature
