# Black Screen Error - Debug Findings

## Root Cause

**The API response structure is being mishandled in the frontend.**

### The Problem

The backend API endpoint `GET /api/sessions/multi-vod/{sessionId}` returns:

```json
{
  "ok": true,
  "session": {
    "session_id": "...",
    "vods": [...],
    "global_time": 0,
    ...
  }
}
```

But the frontend's `useMultiVodState.js` hook extracts data incorrectly:

```javascript
const data = await response.json();
setState(data);  // ❌ Sets state to { ok: true, session: {...} }
```

This means:
- `state.vods` is undefined → EventTimeline crashes trying to call `.forEach()` on undefined
- `state.global_playback_state` is undefined → Similar issues
- Actually, ALL the data is nested in `state.session.*` instead of `state.*`

### Where the Errors Occur

**1. EventTimeline.jsx (Line 12-21)** - Critical
```javascript
const allEvents = useMemo(() => {
  const combined = [];
  vods.forEach((vod, vodIndex) => {  // ❌ vods is undefined
    (vod.events || []).forEach((event) => { // Error: "Cannot read properties of undefined (reading 'forEach')"
      // ...
    });
  });
  // ...
}, [vods]);
```

**2. OffsetPanel.jsx (Line 16-22)** - Critical
```javascript
const handleResetOffsets = () => {
  vods.forEach((vod, idx) => {  // ❌ vods is undefined
    if (vod.offset !== 0) {
      // ...
    }
  });
};
```

Also in the render section (Line 57):
```javascript
{vods.map((vod, index) => ( // ❌ vods is undefined
```

**3. GlobalScrubber.jsx** - Likely (need to verify)
**4. Other components** - Need to check

## The Fix

In `useMultiVodState.js`, line 28-30:

**BEFORE:**
```javascript
const data = await response.json();
setState(data);
setError(null);
```

**AFTER:**
```javascript
const data = await response.json();
setState(data.session);  // ✅ Extract the session object
setError(null);
```

Also fix in `updateOffset` (line 68):
```javascript
const updatedState = await response.json();
setState(updatedState);  // ❌ Should be setState(updatedState.session);
```

And in `updatePlayback` (line 115):
```javascript
const updatedState = await response.json();
setState(updatedState);  // ❌ Should be setState(updatedState.session);
```

## Null/Undefined Safety Checks Needed

Also need to add proper null checks in components:

1. **EventTimeline.jsx** - Add guard before forEach
2. **OffsetPanel.jsx** - Add guard before forEach and map
3. **MultiVodViewer.jsx** - Already has a check ✅
4. **VodPanel.jsx** - Already has a check ✅

## Verification Steps

Once fixed, verify:
1. Navigate to `/?session={sessionId}`
2. Check DevTools → Network tab: The API response should contain the correct structure
3. Check console: No "Cannot read properties of undefined" errors
4. Component should render all VODs, event timeline, offset controls
