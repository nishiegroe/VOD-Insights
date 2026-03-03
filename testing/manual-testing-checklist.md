# Multi-VOD Comparison - Manual Testing Checklist

**QA Agent**: Larry the Lobster
**Test Period**: Week of 2026-03-01
**Environment**: Windows 10/11, Chrome 120+, Firefox 120+

## Pre-Test Setup

### Environment
- [ ] Windows PC with latest drivers
- [ ] GPU: GTX 1650 or equivalent
- [ ] RAM: 8GB+ available
- [ ] VOD Insights running on latest main branch
- [ ] Test VODs downloaded (3x 1080p, ~30 minutes each)
- [ ] Network: Stable internet connection

### Tools Required
- [ ] Chrome DevTools Performance tab
- [ ] Task Manager (for CPU/Memory monitoring)
- [ ] Screen recorder (OBS or Windows Screen Recorder)
- [ ] Stopwatch for timing tests
- [ ] Color picker tool (for contrast checks)

## Phase 1: Load & Display (Day 1)

### Test 1.1: Load 3 Different VODs
**Expected**: All 3 VODs load successfully in grid layout

- [ ] **Step 1**: Click "Multi-VOD" button or panel
- [ ] **Step 2**: Click "Add VOD" button
- [ ] **Step 3**: Enter URL for first VOD
- [ ] **Step 4**: Enter label "POV 1"
- [ ] **Step 5**: Click Add → VOD appears in grid
- [ ] **Step 6**: Repeat for VOD 2 (label "POV 2")
- [ ] **Step 7**: Repeat for VOD 3 (label "POV 3")

**Verification**:
- [ ] 3 VODs visible in grid layout
- [ ] Primary VOD highlighted (different styling)
- [ ] Secondary VODs styled distinctly
- [ ] VOD labels visible ("POV 1", "POV 2", "POV 3")
- [ ] Video players render (not black screens)
- [ ] Video dimensions correct (1080p aspect ratio)
- [ ] Metadata shows (duration, current time)

**Performance**:
- [ ] Load time: <2 seconds per VOD
- [ ] No freezing or stuttering
- [ ] CPU usage while loading: <50%

---

### Test 1.2: Grid Layout at Different Breakpoints

**Desktop (1920x1080)**
- [ ] All 3 videos visible in 3-column grid
- [ ] Players sized appropriately (not too small)
- [ ] Controls below or beside each player
- [ ] Overall layout balanced

**Tablet (768x1024)**
- [ ] Videos stack or 2-column layout
- [ ] Players sized for screen
- [ ] No horizontal scroll
- [ ] Controls accessible

**Mobile (375x812)**
- [ ] Single video focused (primary)
- [ ] Secondary videos as smaller cards below
- [ ] Full-width and readable
- [ ] Vertical scrolling only

---

## Phase 2: Playback & Synchronization (Days 2-3)

### Test 2.1: Independent Scrubbing

**Expected**: Scrubbing one VOD doesn't affect others (when not linked)

- [ ] **Step 1**: Load 3 VODs
- [ ] **Step 2**: Verify linked playback is OFF
- [ ] **Step 3**: Click on primary VOD's progress bar at 50% mark
- [ ] **Step 4**: Observe primary VOD jumps to ~50%

**Verification**:
- [ ] Primary VOD is now at 50% of duration
- [ ] VOD 2 remains at original position
- [ ] VOD 3 remains at original position
- [ ] No warning or error

**Repeat** for VOD 2 and VOD 3 scrubbing independently

---

### Test 2.2: Global Scrubber Sync

**Expected**: Scrubber below all videos syncs all 3 (with offsets applied)

- [ ] **Step 1**: Load 3 VODs with auto-detected offsets
- [ ] **Step 2**: Verify linked playback is ON
- [ ] **Step 3**: Locate global scrubber (below all videos)
- [ ] **Step 4**: Click at 25% of global scrubber

**Verification**:
- [ ] Primary VOD jumps to 25%
- [ ] VOD 2 jumps to 25% - its offset
- [ ] VOD 3 jumps to 25% - its offset
- [ ] All 3 videos show corrected position
- [ ] Sync drift: <100ms between videos

**Record video** of scrubber drag and playback sync

---

### Test 2.3: Play/Pause All Together

**Expected**: Play button starts all 3 videos; pause stops all 3

- [ ] **Step 1**: Reset to common starting point (0:00)
- [ ] **Step 2**: Verify linked playback is ON
- [ ] **Step 3**: Click global Play button
- [ ] **Step 4**: All 3 videos start playing

**Verification** (wait 5 seconds):
- [ ] Primary VOD is playing (progress advancing)
- [ ] VOD 2 is playing (position advancing by offset)
- [ ] VOD 3 is playing (position advancing by offset)
- [ ] Time progression synchronized
- [ ] Sync drift: <100ms

**Step 5**: Click Pause
- [ ] All 3 videos pause instantly
- [ ] No rubber-banding (seeking backward)

**Record video** of synchronized playback for 10 seconds

---

### Test 2.4: Speed Control

**Expected**: Speed control affects all 3 videos (when linked)

- [ ] **Step 1**: Videos playing at 1x speed
- [ ] **Step 2**: Select 1.5x speed from dropdown
- [ ] **Step 3**: All 3 videos speed up

**Verification**:
- [ ] Primary VOD playing at 1.5x
- [ ] VOD 2 playing at 1.5x
- [ ] VOD 3 playing at 1.5x
- [ ] Sync maintained at faster speed

**Repeat** for 2x speed and back to 1x

---

## Phase 3: Offset Control (Days 2-3)

### Test 3.1: Auto-Detected Offsets

**Expected**: Offsets calculated from timer detection and displayed

- [ ] **Step 1**: Load 3 VODs from same match
- [ ] **Step 2**: Observe offset values in VOD info panels
  - [ ] Primary VOD: 0ms offset
  - [ ] VOD 2: -5000ms (example)
  - [ ] VOD 3: 0ms

**Verification**:
- [ ] Offsets display in milliseconds
- [ ] Offsets are consistent (not changing)
- [ ] Offset calculations took <50ms
- [ ] Sync status shows "Synced" or confidence level

---

### Test 3.2: +/- Offset Buttons

**Expected**: Buttons adjust offset by fixed amounts (1s, 5s, 10s)

- [ ] **Step 1**: Locate offset control for VOD 2
- [ ] **Step 2**: Click "+1s" button
  - [ ] Offset changes: -5000ms → -4000ms
- [ ] **Step 3**: Click "+5s" button
  - [ ] Offset changes: -4000ms → 1000ms
- [ ] **Step 4**: Click "-10s" button
  - [ ] Offset changes: 1000ms → -9000ms

**Verification**:
- [ ] Offset value updates immediately
- [ ] Video playback reflects new offset (if playing)
- [ ] Changes are smooth (no stuttering)
- [ ] Offset persists if switched away and back

**Record screenshot** of offset controls

---

### Test 3.3: Drag Offset Slider

**Expected**: Dragging slider adjusts offset smoothly

- [ ] **Step 1**: Locate offset slider for VOD 2
- [ ] **Step 2**: Drag slider from -10s to +10s
  - [ ] Visual feedback (value changes in real-time)
- [ ] **Step 3**: Play videos while dragging slider
  - [ ] Offset applies immediately
  - [ ] Playback smoothly adjusts

**Verification**:
- [ ] Slider range: -20s to +20s (or suitable range)
- [ ] Smooth dragging (no jank)
- [ ] Real-time offset display
- [ ] Playback stays in sync during adjustment

**Record video** of slider drag during playback

---

### Test 3.4: Offset Persistence

**Expected**: Offsets saved and restored in session

- [ ] **Step 1**: Set custom offset for VOD 2: -3000ms
- [ ] **Step 2**: Pause playback
- [ ] **Step 3**: Switch to different panel or page
- [ ] **Step 4**: Return to Multi-VOD player
- [ ] **Step 5**: VOD 2 offset still shows -3000ms

**Verification**:
- [ ] Offset not reset to auto-detected value
- [ ] Offset persists across navigation
- [ ] If refresh page, offset saved (localStorage/session)

---

## Phase 4: Event Markers & Timeline (Days 2-3)

### Test 4.1: Event Markers Render

**Expected**: Event markers from bookmarks visible on all 3 videos

- [ ] **Step 1**: Load 3 VODs from match with bookmarked events
- [ ] **Step 2**: Observe timeline below each video
- [ ] **Step 3**: Event markers visible:
  - [ ] Kill events (red, 🔴 or ✓)
  - [ ] Assist events (blue, 🔵 or ◆)
  - [ ] Knock events (yellow, 🟡 or ▲)
  - [ ] Custom events (green, 🟢 or ⊕)

**Verification**:
- [ ] Markers appear at same relative time on all 3 videos
- [ ] Marker colors consistent
- [ ] Markers don't overlap visually (use tooltip instead)
- [ ] Marker position adjusts with offset

**Record screenshot** of event markers on timeline

---

### Test 4.2: Marker Tooltips

**Expected**: Hovering over marker shows event details

- [ ] **Step 1**: Locate event marker on primary VOD
- [ ] **Step 2**: Hover over marker
- [ ] **Step 3**: Tooltip appears with:
  - [ ] Event type (e.g., "Kill")
  - [ ] Timestamp (e.g., "1:23:45")
  - [ ] Description (if any)

**Verification**:
- [ ] Tooltip appears within 100ms
- [ ] Tooltip is readable (good contrast)
- [ ] Tooltip doesn't obscure other markers
- [ ] Tooltip disappears on mouse leave

**Repeat** for different event types

---

### Test 4.3: Click Marker to Jump

**Expected**: Clicking event marker jumps all videos to that time

- [ ] **Step 1**: Playing videos at 1:00
- [ ] **Step 2**: Click event marker at 2:30
- [ ] **Step 3**: All 3 videos jump to 2:30

**Verification**:
- [ ] Primary VOD at 2:30
- [ ] VOD 2 at 2:30 - its offset
- [ ] VOD 3 at 2:30 - its offset
- [ ] Playback resumes from new position
- [ ] Jump time: <100ms

---

## Phase 5: Keyboard Navigation (Day 4)

### Test 5.1: Tab Navigation

**Expected**: Tab cycles through controls in logical order

- [ ] **Step 1**: Click Multi-VOD player
- [ ] **Step 2**: Press Tab repeatedly
- [ ] **Step 3**: Observe focus order:
  1. Add VOD button
  2. Remove buttons (for each VOD)
  3. Primary VOD selector button
  4. Play button
  5. Pause button
  6. Volume control
  7. Speed selector
  8. Offset +/- buttons
  9. Offset slider
  10. Timeline scrubber
  11. Event filters
  12. Settings button

**Verification**:
- [ ] Focus order is logical (left-to-right, top-to-bottom)
- [ ] No focus traps
- [ ] Focus indicator clearly visible on all elements

**Record screenshot** of focus indicator

---

### Test 5.2: Arrow Key Controls

**Expected**: Arrow keys control video and offsets

- [ ] **Step 1**: Focus on offset slider
- [ ] **Step 2**: Press Arrow Up
  - [ ] Offset increases by 1s
- [ ] **Step 3**: Press Arrow Down
  - [ ] Offset decreases by 1s
- [ ] **Step 4**: Press Arrow Left
  - [ ] Seek backward 5s (if focused on timeline)
- [ ] **Step 5**: Press Arrow Right
  - [ ] Seek forward 5s

**Verification**:
- [ ] Arrow keys responsive
- [ ] Values update immediately
- [ ] Behavior contextual (different for slider vs timeline)

---

### Test 5.3: Keyboard Shortcuts

**Expected**: Ctrl + key combinations provide shortcuts

- [ ] **Step 1**: Ctrl+[ (Jump to previous event)
  - [ ] Video jumps to previous marker
- [ ] **Step 2**: Ctrl+] (Jump to next event)
  - [ ] Video jumps to next marker
- [ ] **Step 3**: Space (Play/pause)
  - [ ] Playback toggles
- [ ] **Step 4**: M (Mute/unmute)
  - [ ] Audio mutes/unmutes
- [ ] **Step 5**: + (Increase offset by 1s)
  - [ ] Offset increases
- [ ] **Step 6**: - (Decrease offset by 1s)
  - [ ] Offset decreases

**Verification**:
- [ ] All shortcuts work globally (not just when focused)
- [ ] Shortcuts documented in UI (tooltip or help)
- [ ] No conflicts with browser shortcuts

---

### Test 5.4: Home/End Keys

**Expected**: Home/End jump to start/end of VOD

- [ ] **Step 1**: Focus on timeline or video
- [ ] **Step 2**: Press Home
  - [ ] All videos jump to 0:00
- [ ] **Step 3**: Press End
  - [ ] All videos jump to duration

**Verification**:
- [ ] Videos positioned at boundaries
- [ ] Smooth transition (no jank)

---

## Phase 6: Volume & Mute Controls (Day 3)

### Test 6.1: Per-VOD Volume Control

**Expected**: Each VOD has independent volume control

- [ ] **Step 1**: Locate volume slider for VOD 1
- [ ] **Step 2**: Drag to 50% volume
  - [ ] Primary VOD audio at 50%
- [ ] **Step 3**: Locate volume slider for VOD 2
- [ ] **Step 4**: Drag to 75% volume
  - [ ] VOD 2 audio at 75%
- [ ] **Step 5**: Play all 3
  - [ ] Primary: 50%, VOD 2: 75%, VOD 3: 100% volumes

**Verification**:
- [ ] Independent control works
- [ ] Audio levels reflect slider position
- [ ] No crosstalk between volumes
- [ ] Volume persists

---

### Test 6.2: Mute Buttons

**Expected**: Mute button silences individual VOD

- [ ] **Step 1**: VOD 1 playing, unmuted
- [ ] **Step 2**: Click Mute button for VOD 1
- [ ] **Step 3**: VOD 1 mute icon shows muted state
- [ ] **Step 4**: VOD 1 silent (no audio)
- [ ] **Step 5**: VOD 2 and 3 still have audio

**Verification**:
- [ ] Mute icon updates (speaker with X)
- [ ] Audio stops immediately
- [ ] Other VODs unaffected
- [ ] Unmute restores previous volume level

---

## Phase 7: Edge Cases & Error Handling (Day 5)

### Test 7.1: Duration Mismatch

**Expected**: Gracefully handle VODs of different lengths

- [ ] **Step 1**: Load 3 VODs with different durations:
  - VOD 1: 30:00
  - VOD 2: 29:55
  - VOD 3: 30:30
- [ ] **Step 2**: Play to near end of VOD 2 (29:50)

**Verification**:
- [ ] VOD 2 stops at 29:55 (its end)
- [ ] VOD 1 continues (at 30:00 equivalent by offset)
- [ ] No crash or error
- [ ] User warned (optional)

---

### Test 7.2: Offset Changes During Playback

**Expected**: Offset changes apply smoothly during playback

- [ ] **Step 1**: All 3 videos playing at 1:00
- [ ] **Step 2**: Drag offset slider for VOD 2 while playing
  - [ ] Offset changes to -10s
  - [ ] VOD 2 jumps to 50s (1:00 - 10s)
- [ ] **Step 3**: Continue dragging to +5s
  - [ ] VOD 2 smoothly adjusts to 1:05

**Verification**:
- [ ] No audio glitches
- [ ] No stuttering
- [ ] Playback resumes smoothly
- [ ] Sync maintained

**Record video** of mid-playback offset change

---

### Test 7.3: Rapid Seeking

**Expected**: Rapid clicks on timeline or arrow keys don't crash

- [ ] **Step 1**: Click timeline multiple times in quick succession (5+ clicks in 2 seconds)
- [ ] **Step 2**: Drag timeline slider rapidly back and forth

**Verification**:
- [ ] No freeze or crash
- [ ] Videos eventually settle to final position
- [ ] No audio artifacts
- [ ] UI remains responsive

---

### Test 7.4: VOD Load Failure

**Expected**: Gracefully handle bad URLs

- [ ] **Step 1**: Try to add invalid VOD URL (e.g., "https://notaurl")
- [ ] **Step 2**: Error message appears
- [ ] **Step 3**: Try to add non-existent URL (404)

**Verification**:
- [ ] Clear error message: "Invalid URL" or "VOD not found"
- [ ] Suggested fixes offered
- [ ] Can retry or remove invalid VOD
- [ ] Other VODs still playable

---

### Test 7.5: Remove Primary VOD

**Expected**: Removing primary VOD switches to secondary

- [ ] **Step 1**: 3 VODs loaded, VOD 1 is primary
- [ ] **Step 2**: Click Remove button for VOD 1

**Verification**:
- [ ] VOD 1 disappears
- [ ] VOD 2 becomes new primary (highlighted)
- [ ] Playback continues with new primary
- [ ] Offsets for remaining VODs preserved

---

### Test 7.6: Network Interruption

**Expected**: Handle temporary network loss

- [ ] **Step 1**: VODs loading
- [ ] **Step 2**: Disconnect internet (disable network)
- [ ] **Step 3**: Reconnect after 5 seconds

**Verification**:
- [ ] Videos pause gracefully
- [ ] Reconnection resumes playback
- [ ] No permanent errors
- [ ] Retry option available

---

## Phase 8: Performance Testing (Day 4)

### Test 8.1: CPU Usage (3x 1080p)

**Expected**: CPU usage stays under 80% on GTX 1650+

**Setup**:
- [ ] Open Task Manager (Ctrl+Shift+Esc)
- [ ] Switch to Performance tab
- [ ] Monitor CPU while testing

**Test**:
- [ ] **Step 1**: Load 3x 1080p VODs
- [ ] **Step 2**: Play all 3 synchronously for 2 minutes
- [ ] **Step 3**: Scrub timeline 10 times
- [ ] **Step 4**: Adjust offsets 5 times

**Verification**:
- [ ] CPU usage peaks: <80%
- [ ] Average CPU: <50%
- [ ] No spikes or sustained high usage
- [ ] Playback smooth throughout

**Record screenshot** of CPU graph

---

### Test 8.2: Memory Usage

**Expected**: Memory stays under 3.5GB for 3x 1080p

**Setup**:
- [ ] Open Task Manager
- [ ] Note baseline memory before test
- [ ] Monitor during playback

**Test**:
- [ ] **Step 1**: Load 3x 1080p VODs
- [ ] **Step 2**: Play for 5 minutes
- [ ] **Step 3**: Observe memory growth

**Verification**:
- [ ] Memory increases gradually (not spikes)
- [ ] Peak memory: <3.5GB
- [ ] No memory leaks (memory stabilizes)

**Record screenshot** of memory graph

---

### Test 8.3: Render Performance

**Expected**: React renders efficiently (<16.7ms per frame @ 60fps)

**Setup**:
- [ ] Open Chrome DevTools (F12)
- [ ] Go to Performance tab
- [ ] Start recording

**Test**:
- [ ] **Step 1**: Record for 5 seconds
- [ ] **Step 2**: Play all 3 videos
- [ ] **Step 3**: Adjust offset during playback
- [ ] **Step 4**: Stop recording

**Verification**:
- [ ] Frame rate: 55-60 FPS (most of the time)
- [ ] No frames >16.7ms (except startup)
- [ ] No long tasks blocking main thread
- [ ] Smooth scrolling

**Record Performance timeline screenshot**

---

### Test 8.4: Scrubber Sync Drift

**Expected**: Scrubber sync <100ms drift between videos

**Test**:
- [ ] **Step 1**: Start all 3 videos playing
- [ ] **Step 2**: Use stopwatch to measure time between:
  - Video 1 plays
  - Video 2 plays (with offset applied)
  - Video 3 plays
- [ ] **Step 3**: Record drift measurements

**Verification**:
- [ ] Drift between videos: <100ms
- [ ] All 3 play within 100ms of each other
- [ ] No rubber-banding or catching up

**Record data**:
```
Test 1: VOD1 @ 0:00, VOD2 @ -5s (expected), VOD3 @ 0:00
Actual times: 0:00.000, -4:59.985, 0:00.010
Drift: 15ms (acceptable)
```

---

## Phase 9: Responsive Design (Day 4)

### Test 9.1: Desktop (1920x1080)

**Expected**: All features visible and usable

- [ ] **Step 1**: Open VOD Insights on 1920x1080 display
- [ ] **Step 2**: Load 3 VODs
- [ ] **Step 3**: Test all features (playback, offset, etc.)

**Verification**:
- [ ] All 3 videos visible simultaneously
- [ ] All controls visible (no overflow)
- [ ] No horizontal scroll
- [ ] Touch friendly (buttons >44px)
- [ ] Text readable (>12px)

**Record screenshot**

---

### Test 9.2: Tablet (768x1024)

**Expected**: Responsive layout adapts to smaller screen

**Setup**:
- [ ] Chrome DevTools → Device Emulation (iPad)
- [ ] Set to 768x1024

- [ ] **Step 1**: Load 3 VODs
- [ ] **Step 2**: Test layout and controls

**Verification**:
- [ ] Videos stack or 2-column grid
- [ ] Controls easily accessible
- [ ] No horizontal scroll
- [ ] Readable text (no zoom needed)
- [ ] Touch targets adequate (>44px)

**Record screenshot at 50%, 75%, 100% zoom**

---

### Test 9.3: Mobile (375x812)

**Expected**: Single-column layout, focused on primary video

**Setup**:
- [ ] Chrome DevTools → Device Emulation (iPhone 12)
- [ ] Set to 375x812

- [ ] **Step 1**: Load 3 VODs
- [ ] **Step 2**: Test primary video playback
- [ ] **Step 3**: Scroll to see secondary videos
- [ ] **Step 4**: Test all controls

**Verification**:
- [ ] Primary video full-width and prominent
- [ ] Secondary videos below (card style)
- [ ] All controls accessible via vertical scroll
- [ ] No horizontal scroll
- [ ] Touch-friendly buttons
- [ ] Video doesn't crop or distort

**Record screenshot and scroll video**

---

## Phase 10: Comparison with Design Spec (Day 5)

### Requirement Checklist

- [ ] **Multi-VOD Grid Layout**: ✅ Visible, 3 videos
- [ ] **Primary VOD Highlighting**: ✅ Visual distinction
- [ ] **Sync Status Display**: ✅ Shows status
- [ ] **Independent Scrubbing**: ✅ Works, others don't move
- [ ] **Global Scrubber**: ✅ Syncs all with offset
- [ ] **Offset Control**:
  - [ ] Auto-detect: ✅ Works
  - [ ] Manual +/-: ✅ Works
  - [ ] Slider: ✅ Works
- [ ] **Event Markers**: ✅ Render correctly
- [ ] **Keyboard Navigation**: ✅ Tab, arrows, shortcuts
- [ ] **Responsive Design**:
  - [ ] 1920x1080: ✅
  - [ ] 768x1024: ✅
  - [ ] 375x812: ✅
- [ ] **Performance**:
  - [ ] <300ms latency: ✅ (measure)
  - [ ] <100ms sync drift: ✅ (measure)
  - [ ] CPU <80%: ✅ (measure)
  - [ ] Memory <3.5GB: ✅ (measure)
- [ ] **Accessibility**:
  - [ ] ARIA labels: ✅ (audit)
  - [ ] Keyboard nav: ✅ (tested)
  - [ ] Screen reader: ✅ (tested)
  - [ ] Color-blind safe: ✅ (tested)

---

## Issues Found Log

| # | Title | Steps | Expected | Actual | Severity | PR Link |
|---|-------|-------|----------|--------|----------|---------|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |

---

## Sign-Off

**QA Agent**: Larry the Lobster
**Test Start**: 2026-03-01
**Test Complete**: 2026-03-06

**Test Results**:
- [ ] All manual tests passed
- [ ] No critical bugs found
- [ ] Performance targets met
- [ ] Accessibility verified
- [ ] Ready for release

**Issues Summary**:
- [ ] Critical: 0
- [ ] High: 0
- [ ] Medium: 0
- [ ] Low: 0

**Signed**: _________________ **Date**: _________
