# Multi-VOD Comparison Feature - UI/UX Design Specification

**Status:** Design Complete (Ready for Architect Review)  
**Designer:** Larry (UI/UX Lead)  
**Date:** 2026-03-01  
**Version:** 1.0

---

## 🎯 Executive Summary

This design specification provides complete UI/UX guidance for the **Multi-VOD Comparison** feature—a side-by-side viewer for up to 3 Apex VODs with synchronized scrubbing, event markers, and offset controls. The design prioritizes:

- **Clarity**: Visual hierarchy makes it obvious which VOD is which
- **Intuitiveness**: Scrubber interactions feel natural (drag = seek)
- **Accessibility**: Keyboard-navigable, colorblind-friendly, screen-reader compatible
- **Scalability**: Works responsively from mobile (single-column) to ultra-wide (3-column)
- **Performance**: Minimal visual overhead; snappy interactions

---

## 1. LAYOUT DESIGN

### 1.1 Desktop Layout (Primary - 1920px+)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  VOD Comparison: Match Alpha vs Rotations (3 VODs)                    [×] [–] │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ┌─────────────────────┬─────────────────────┬─────────────────────┐       │
│ │                     │                     │                     │       │
│ │    VOD 1 (Title)    │    VOD 2 (Title)    │    VOD 3 (Title)    │       │
│ │  Nishie - Main      │  TSM_Pro - POV2     │  Optic_Aim - POV3   │       │
│ │                     │                     │                     │       │
│ │    [Video Frame]    │    [Video Frame]    │    [Video Frame]    │       │
│ │                     │                     │                     │       │
│ │  16:9 (responsive)  │  16:9 (responsive)  │  16:9 (responsive)  │       │
│ │                     │                     │                     │       │
│ │ ┌─────────────────┐ │ ┌─────────────────┐ │ ┌─────────────────┐ │       │
│ │ │ Individual      │ │ │ Individual      │ │ │ Individual      │ │       │
│ │ │ Scrubber        │ │ │ Scrubber        │ │ │ Scrubber        │ │       │
│ │ │[Y═══════════►━] │ │ │[Y═════════►░░░░░] │ │ │[Y════════════►━] │       │
│ │ │ 2:35 / 10:00    │ │ │ 1:45 / 10:00    │ │ │ 3:12 / 10:00    │ │       │
│ │ │ Offset: 0s      │ │ │ Offset: -50s    │ │ │ Offset: +37s    │ │       │
│ │ └─────────────────┘ │ └─────────────────┘ │ └─────────────────┘ │       │
│ │                     │                     │                     │       │
│ └─────────────────────┴─────────────────────┴─────────────────────┘       │
│                                                                              │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │  Global Scrubber (Syncs all 3 VODs)                                      │ │
│ │  [Y══════════════════════════════════════════════════════════════════►░] │ │
│ │   0:00          2:35          5:00         7:30         10:00            │ │
│ │   ⚡ 🔥 💀 ⚡ ⚡   (event markers - color-coded by VOD)                     │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │  Playback Controls & Info                                                │ │
│ │  [◀◀] [⏸] [▶▶] [🔊] ──●────  [🎬] [↙] [🔄 Auto-Align]    [⚙️]          │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │  Offset Panel (Adjust VOD timing relative to VOD 1)                       │ │
│ │  ┌────────────┐  ┌────────────┐  ┌────────────┐                          │ │
│ │  │ VOD 1      │  │ VOD 2      │  │ VOD 3      │                          │ │
│ │  │ (Ref)      │  │ [–] 50s [+]│  │ [–] 37s [+]│                          │ │
│ │  │ 0s offset  │  │ Ahead      │  │ Behind     │                          │ │
│ │  └────────────┘  └────────────┘  └────────────┘                          │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │  Event Timeline (Expandable)                                             │ │
│ │  [▼] Events (12 total) | Filters: [All] [Kills] [Deaths] [Abilities]    │ │
│ │                                                                           │ │
│ │  0:45  ⚡ VOD1: Sent Grenade (Catalyst) | VOD2: N/A | VOD3: N/A         │ │
│ │  1:12  💀 VOD1: Knocked | VOD2: Knocked | VOD3: N/A                     │ │
│ │  2:35  🔥 VOD1: Revived | VOD2: N/A | VOD3: Revived                     │ │
│ │  ...                                                                      │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Grid Specs:**
- **Video Panels:** 3 equal columns, 1:1 aspect ratio for row wrapping, video maintains 16:9
- **Gaps:** 12px between columns (visual separation)
- **Heights:** Each video panel height = (viewport width - 24px gaps) / 3 * 9/16
- **Scrubber Height:** 60px per panel (includes timeline + offset label)
- **Global Scrubber:** 80px (larger hit target)
- **Controls Row:** 48px
- **Offset Panel:** 100px (3 equal sub-columns)
- **Event Timeline:** 200px+ (scrollable)

### 1.2 Tablet Layout (768px - 1920px)

```
2-Column View (stacked at 50% width each):
┌──────────────────────────┬──────────────────────────┐
│     VOD 1 (Title)        │     VOD 2 (Title)        │
│   [Video Frame]          │   [Video Frame]          │
│  [Individual Scrubber]   │  [Individual Scrubber]   │
├──────────────────────────┴──────────────────────────┤
│           VOD 3 (Title) - Full Width Below          │
│          [Video Frame]                              │
│        [Individual Scrubber]                        │
├─────────────────────────────────────────────────────┤
│         [Global Scrubber]                           │
├─────────────────────────────────────────────────────┤
│      [Playback Controls & Offset Panel]             │
└─────────────────────────────────────────────────────┘
```

**Breakpoint:** 768px - 1264px width
- VOD 1 & 2: 50% width each, side-by-side
- VOD 3: 100% width below
- All other elements: full width

### 1.3 Mobile Layout (< 768px)

```
Single-Column View:
┌─────────────────────────────────┐
│   VOD 1 (Title)                 │
│ [Video Frame - Full Width]      │
│ [Individual Scrubber]           │
├─────────────────────────────────┤
│   VOD 2 (Title)                 │
│ [Video Frame - Full Width]      │
│ [Individual Scrubber]           │
├─────────────────────────────────┤
│   VOD 3 (Title)                 │
│ [Video Frame - Full Width]      │
│ [Individual Scrubber]           │
├─────────────────────────────────┤
│   [Global Scrubber]             │
├─────────────────────────────────┤
│ [Playback Controls]             │
├─────────────────────────────────┤
│ [Offset Panel - Scrollable Tabs]│
├─────────────────────────────────┤
│ [Event Timeline]                │
└─────────────────────────────────┘
```

**Notes:**
- Each VOD stacks vertically
- Global scrubber shows position of all 3 (with legend)
- Offset panel becomes tab-based (swipe between VOD 1/2/3)
- Event timeline scrollable
- **Performance Note:** At small viewport, consider lazy-loading VODs 2 & 3 until user scrolls to them

---

## 2. SCRUBBER INTERACTION DESIGN

### 2.1 Individual Scrubber Anatomy

```
VOD 1: Nishie - Main
┌────────────────────────────────────┐
│    Event Markers (Color-Coded)     │  <- Hover shows tooltip
│  [Y] [Y]     [Y]  [Y] [Y]  [Y]    │     "Kill at 0:45 (Headshot)"
├────────────────────────────────────┤
│ Individual Scrubber Track          │
│ [═══════════════════════════════]  │  <- Gray background, 4px radius
│ [Y──────────────►  ░░░░░░░░░░░░]   │  <- Yellow filled portion (played)
│                    [◄──Thumb──►]   │     White unfilled (remaining)
│                                    │     Thumb = 14px, interactive
└────────────────────────────────────┘
Current Time: 2:35 | Duration: 10:00
Offset: 0s (Reference)
```

**Scrubber Track:**
- **Background:** #f0f0f0 (light gray)
- **Played Portion:** Linear gradient:
  - VOD 1: #d4a500 (golden yellow, warm)
  - VOD 2: #c41e3a (red, distinct)
  - VOD 3: #0066cc (blue, cool)
- **Unplayed Portion:** #e0e0e0 (slightly darker gray)
- **Radius:** 4px (subtle roundness)
- **Height:** 6px (easy to grab, not intrusive)

**Thumb (Playhead):**
- **Size:** 14px × 14px (circle or rounded square)
- **Color:** Inherit VOD color (yellow/red/blue)
- **Border:** 2px white stroke (visibility on any background)
- **Shadow:** Drop shadow on hover/active (elevation effect)
- **Cursor:** Grab ✋ on hover, Grabbing ✌️ while dragging

**Event Markers (on track above scrubber):**
```
Event Marker Stack (Multiple Events at Same Time):
  K  K    K   K  K   K       <- Each letter/icon = 8px tall
  [Y] [Y] [Y] [Y][Y] [Y]
─────────────────────────────── (track)
```
- **Kill (K):** ⚡ or dagger icon, VOD color
- **Death (D):** 💀 or X icon, VOD color
- **Ability (A):** 🔥 or ability icon, VOD color
- **Revive (R):** 💚 or plus icon, VOD color
- **Hover Tooltip:** Appears above marker, shows event details:
  ```
  ┌────────────────────────┐
  │ Catalyst Sent Grenade  │
  │ by Nishie at 0:45      │
  │ Kill: Headshot         │
  └────────────────────────┘
  ```

### 2.2 Global Scrubber Design

```
Global Scrubber (Syncs All 3 VODs)
┌──────────────────────────────────────────────────────────────────┐
│ Combined Event Markers (Color-Coded by VOD)                      │
│ [Y] [Y]   [R]  [Y][R] [Y]  [B]  [Y]                             │
│ Legend: [Y] VOD1  [R] VOD2  [B] VOD3                             │
├──────────────────────────────────────────────────────────────────┤
│ Global Scrubber Track (Unified Timeline)                         │
│ [═══════════════════════════════════════════════════════════════] │
│ [Y───────────────────────────────►  ░░░░░░░░░░░░░░░░░░░░░░░░░░░] │
│                                  [◄─────Thumb─────►]             │
│                                                                   │
│ Position: 2:35 / 10:00                                          │
│ VOD States: Playing (all in sync) ⏸                             │
└──────────────────────────────────────────────────────────────────┘
```

**Specs:**
- **Height:** 10px track (larger than individual, easier to target)
- **Thumb:** 18px × 18px (larger for precise control)
- **Track Color:** Same golden yellow (primary action)
- **Event Markers:** All 3 VOD colors mixed, stacked in priority order
- **Time Labels:** Show at 5 or 10-second intervals (depending on duration)

### 2.3 Scrubber Interaction States

#### 2.3.1 Default State (Idle, Not Playing)
```
[Y─────────────►  ░░░░░░░░░░░] 
```
- Thumb visible, no glow
- Cursor: pointer
- Background: light gray

#### 2.3.2 Hover State
```
[Y─────────────►  ░░░░░░░░░░░]
                  [◄─Thumb─►]  (grows to 18px, shows depth)
```
- Thumb: Larger (grows by 4px), subtle shadow
- Cursor: grab 🖐️
- Track: Slightly darker (highlight)
- Appears at mouse position (preview)

#### 2.3.3 Active/Dragging State
```
[Y─────────────────►  ░░░░░░░]
                     [◄─Thumb─►]  (18px, heavy shadow)
  [Current time: 3:12]  (follows cursor, light background)
```
- Thumb: Full 18px, shadow lifted (z-index 100)
- Cursor: grabbing ✋
- Time preview: Shows time as you drag (±100ms update frequency for smoothness)
- Track: Slightly lighter (indicates active interaction)
- **Keyboard variant:** If using arrow keys, same visual + focus ring (see Accessibility)

#### 2.3.4 Playing State
```
[Y═════════════════►  ░░░░░░░]
 ^────────────────────────────
    (continuous movement, 60fps)
```
- Thumb moves smoothly with playback
- No pause/hover effects (user is watching, not interacting)
- Time updates in real-time

### 2.4 Multi-Scrubber Synchronization Logic

**Scenario 1: Individual Scrubber Drag (e.g., VOD 1)**
```
User drags VOD 1 scrubber to 5:00

State Change:
  vod1.currentTime = 5:00 ← user seeking
  vod2.currentTime = no change (stays at 4:20)
  vod3.currentTime = no change (stays at 3:45)
  globalTime = 5:00 ← updated to reflect active VOD

Visual Feedback:
  VOD 1 scrubber: [═══════════════►  ░░░░]  (yellow fills to 5:00)
  VOD 2 scrubber: [═════════►       ░░░░░]  (stays at 4:20)
  VOD 3 scrubber: [██████►          ░░░░░░]  (stays at 3:45)
  Global scrubber: [═════════════════►  ░░░]  (follows VOD1)

Network Sync:
  POST /api/sessions/{id}/vods/vod-1/seek { timestamp: 300 }
  Response: { vod1: { currentTime: 300 }, globalTime: 300 }
  Update other VODs' display (but don't seek them)
```

**Scenario 2: Global Scrubber Drag**
```
User drags Global scrubber to 6:00

State Change:
  globalTime = 6:00 ← user syncing all
  vod1.currentTime = 6:00 - 0s (offset) = 6:00
  vod2.currentTime = 6:00 - (-50s) = 6:50 (capped at duration)
  vod3.currentTime = 6:00 - (+37s) = 5:23

Visual Feedback:
  VOD 1 scrubber: [═══════════════════►  ░]  (seeks to 6:00)
  VOD 2 scrubber: [══════════════════════►]  (seeks to 6:50, near end)
  VOD 3 scrubber: [═══════════════════►  ░]  (seeks to 5:23)
  Global scrubber: [══════════════════════►]  (all in sync)

Network Sync:
  PUT /api/sessions/{id}/global-seek { timestamp: 360 }
  Response: { 
    vod1: { currentTime: 360 },
    vod2: { currentTime: 410 },
    vod3: { currentTime: 323 },
    globalTime: 360
  }
  All 3 videos seek simultaneously
```

**Scenario 3: Play/Pause (Shared Control)**
```
User clicks [▶] (Play button)

State Change:
  playback = "playing" ← all VODs play together
  vod1.playback = "playing"
  vod2.playback = "playing"
  vod3.playback = "playing"

Visual Feedback:
  All scrubbers move in sync (playheads advance together)
  Button changes to [⏸] (pause icon)
  
Sync Strategy:
  Use shared playback clock (not individual clocks)
  Hardware timing: All 3 video elements use same requestAnimationFrame
  Periodic re-sync: Every 100ms, correct any drift >20ms
```

---

## 3. EVENT MARKERS & TOOLTIPS

### 3.1 Event Types & Visual Design

```
Event Type    Icon    Color       Use Case
─────────────────────────────────────────────────────
Kill          ⚡      VOD Color   Enemy eliminated
Death         💀      VOD Color   Player eliminated
Ability       🔥      VOD Color   Ability used (grenade, etc.)
Revive        💚      VOD Color   Teammate revived
Knockdown     🔓      VOD Color   Enemy knocked (not killed)
Damage Event  💥      VOD Color   Significant damage taken/dealt
Reload        🔄      VOD Color   Magazine reload
Ability Used  🎯      VOD Color   Tactical/Ultimate ability
```

### 3.2 Marker Stacking (Multiple Events at Same Timestamp)

When multiple events occur at the same time:

```
Scenario: At 2:35, VOD1 kills enemy AND uses ability

Marker Display (Compact):
  ⚡    <- Kill icon (primary)
  🔥    <- Ability icon (secondary, slightly offset)
  
Marker Display (Crowded - 3+ events):
  ⚡    <- Icon stack
  🔥
  💀    <- Show up to 3 icons, then "..."
  ...

On Hover - Show All:
┌─────────────────────────────────────┐
│ Time 2:35                           │
│ ──────────────────────────────────  │
│ ⚡ Kill: Headshot (Vandal)          │
│ 🔥 Ability: Throwable Grenade       │
│ 💀 Death: Knocked by teammate       │
│                                     │
│ [See Full Event]                    │
└─────────────────────────────────────┘
```

### 3.3 Tooltip Design & Interaction

**Hover Tooltip (Individual Scrubber):**
```
User hovers over event marker at 0:45 on VOD1 scrubber:

┌────────────────────────────────────┐
│  ⚡ Catalyst Sent Grenade          │  <- Icon + Event Name
│  by Nishie (Catalyst)              │  <- Character + Ability
│  at 0:45 | Kill: Headshot          │  <- Time + Extra info
│                                     │
│  [View Context] [Jump to Event]     │  <- Action buttons
└────────────────────────────────────┘
  △
  │
  └─ Positioned ABOVE marker (not to cover other markers)
     If near top, flip to BELOW
     Arrow points to marker
```

**Tooltip Specs:**
- **Width:** 300px (max)
- **Padding:** 12px
- **Background:** Dark theme (rgba(0,0,0,0.9))
- **Text:** White, 13px
- **Font:** Monospace for timestamps (easier to read)
- **Delay:** 400ms (standard web tooltip delay)
- **Arrow:** 8px triangle, color-matched to background
- **Z-index:** 1000 (above videos)

**Global Scrubber Tooltip (Mixed VODs):**
```
User hovers over a multi-color event marker on Global scrubber:

┌──────────────────────────────────────┐
│ Event at 2:35 (VOD1), 1:45 (VOD2)   │
│                                      │
│ VOD1 [Y]: ⚡ Kill (Headshot)         │
│ VOD2 [R]: 🔥 Ability: Smoke Grenade  │
│ VOD3 [B]: ○ No event                │
│                                      │
│ [Jump to VOD1] [Jump to VOD2]       │
└──────────────────────────────────────┘
```

---

## 4. OFFSET CONTROLS

### 4.1 Offset Panel UI

```
┌────────────────────────────────────────────────────────────────┐
│  Offset Controls - Adjust VOD Timing (VOD 1 is Reference)      │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ VOD 1       │  │ VOD 2        │  │ VOD 3        │          │
│  │ (Reference) │  │ [–] 50s [+]  │  │ [–] 37s [+]  │          │
│  │             │  │              │  │              │          │
│  │ 0s offset   │  │ Ahead ▲      │  │ Behind ▼     │          │
│  │             │  │              │  │              │          │
│  │ [Edit]      │  │ [Edit]       │  │ [Edit]       │          │
│  └─────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  Help Text: "Positive offset = VOD starts earlier"            │
│  [↔ Drag to Sync] [Auto-Align from Timer ▶] [Reset Offsets]  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### 4.2 Offset Adjustment Modes

#### Mode A: +/- Button (Quick Adjustment)
```
Current Offset: +45s

Clicking [–] three times (1s increments):
  [–] ─ 45s ─ 44s ─ 43s ─ 42s ─ (stops updating)
       ↑ hold to speed up (accelerate)

Clicking [+] two times:
  [+] ─ 42s ─ 43s ─ 44s ─ 45s ─

Visual Feedback:
  - Button highlights on click (active state)
  - Number animates/counter ticks (satisfying)
  - Offset value shows live (no submit button, auto-save)
```

**Increment Options:**
- Click: +/- 1s
- Long-press (hold >500ms): Accelerate to +/- 5s per 100ms
- Modifier (Shift+Click): +/- 100ms (fine-tuning)

#### Mode B: Drag to Sync
```
[↔ Drag to Sync] button → Enter drag mode

Visual:
  All scrubbers become draggable as a unit
  When dragging VOD2 scrubber left/right:
    - VOD2 moves forward/backward
    - Shows offset delta: "+50s → +55s (↑5s)"
    - Release to apply

Use Case: Quick alignment without precise timing
```

#### Mode C: Manual Input (Precision)
```
User clicks "[Edit]" next to VOD 2 offset:

┌───────────────────────────┐
│ VOD 2 Offset (seconds)    │
│ ┌─────────────────────┐   │
│ │   +50 ▔▔▔▔▔▔▔▔▔▔▔   │   │ <- Input field (editable)
│ └─────────────────────┘   │
│                            │
│ [Apply] [Cancel] [Reset]   │
└───────────────────────────┘

User types: 45
Value updates: +45s
Click [Apply] → network call → apply to all VODs
```

### 4.3 Offset State Display

**Visual Indicators:**
- **VOD 1:** "0s offset" (badge, slightly grayed)
- **VOD 2:** "+50s" (red/warm color, larger)
- **VOD 3:** "-37s" (blue/cool color, larger)

**Helper Text:**
- "+X seconds" = VOD started earlier (shown BEFORE global timeline)
- "-X seconds" = VOD started later (shown AFTER global timeline)

**Example State:**
```
VOD 1 @ 3:00  ──────────────────────────────────
VOD 2 @ 2:10  (VOD2 is 50s AHEAD, showing at +50s offset)
VOD 3 @ 3:37  (VOD3 is 37s BEHIND, showing at -37s offset)

When synced with global scrubber at 3:00:
  VOD1 plays from timestamp 3:00
  VOD2 plays from timestamp 3:50 (3:00 + 50s)
  VOD3 plays from timestamp 2:23 (3:00 - 37s)
```

---

## 5. COMPONENT HIERARCHY

### 5.1 React Component Structure

```
MultiVodComparison/
├── MultiVodComparison.jsx (root container, state orchestrator)
│   ├── MultiVodViewer.jsx (3-column grid layout)
│   │   ├── VodPanel.jsx (x3 - individual VOD + scrubber)
│   │   │   ├── VideoElement.jsx (HTML5 <video> wrapper)
│   │   │   ├── VodTitle.jsx (VOD name, player, date)
│   │   │   ├── EventMarkerTrack.jsx (event icons above scrubber)
│   │   │   └── IndividualScrubber.jsx (draggable timeline)
│   │   │       ├── ScrubberTrack.jsx (visual track)
│   │   │       ├── ScrubberThumb.jsx (playhead)
│   │   │       └── EventMarker.jsx (clickable event icons)
│   │   │
│   │   ├── GlobalScrubberContainer.jsx (unified scrubber)
│   │   │   ├── GlobalScrubber.jsx (main scrubber)
│   │   │   │   ├── ScrubberTrack.jsx (reused)
│   │   │   │   ├── ScrubberThumb.jsx (reused)
│   │   │   │   └── CombinedEventMarkers.jsx (VOD1+2+3)
│   │   │   └── GlobalTimecode.jsx (current/duration display)
│   │   │
│   │   ├── PlaybackControls.jsx (play/pause/skip)
│   │   │   ├── PlayPauseButton.jsx
│   │   │   ├── SkipButton.jsx (prev/next event)
│   │   │   ├── SpeedControl.jsx (0.5x, 1x, 1.5x, 2x)
│   │   │   └── VolumeControl.jsx
│   │   │
│   │   └── OffsetPanel.jsx (adjust timings)
│   │       ├── OffsetCard.jsx (x3 - one per VOD)
│   │       │   ├── OffsetDisplay.jsx (shows current offset)
│   │       │   ├── OffsetButtons.jsx (+/- buttons)
│   │       │   └── OffsetEditor.jsx (modal for precision input)
│   │       ├── DragSyncButton.jsx ([↔ Drag to Sync])
│   │       ├── AutoAlignButton.jsx ([Auto-Align from Timer])
│   │       └── ResetButton.jsx ([Reset Offsets])
│   │
│   ├── EventTimeline.jsx (expanded view of all events)
│   │   ├── EventFilter.jsx (All/Kills/Deaths/etc.)
│   │   ├── EventRow.jsx (x many - each event)
│   │   │   └── EventBadge.jsx (icon + details)
│   │   └── EventDetail.jsx (expand event for more info)
│   │
│   └── SessionPanel.jsx (metadata)
│       ├── SessionName.jsx (editable title)
│       ├── VodMetadata.jsx (duration, date, player names)
│       └── ExportButton.jsx (save session, share link)
│
├── hooks/
│   ├── useMultiVodState.js (fetch/manage session state from backend)
│   ├── useVodScrubber.js (handle individual scrubber drag)
│   ├── useGlobalSync.js (handle global scrubber + playback sync)
│   ├── usePlaybackSync.js (keep all 3 videos in sync during playback)
│   ├── useOffsetControl.js (manage offset state)
│   ├── useEventMarkers.js (fetch and display event data)
│   └── useKeyboardNav.js (keyboard controls - see Accessibility)
│
├── styles/
│   ├── MultiVodComparison.module.scss (grid layout, responsive)
│   ├── VodPanel.module.scss
│   ├── Scrubber.module.scss (shared scrubber styles)
│   ├── OffsetPanel.module.scss
│   ├── EventTimeline.module.scss
│   └── _variables.scss (colors, spacing, breakpoints)
│
└── utils/
    ├── offsetCalculations.js (apply offsets, validate bounds)
    ├── eventMarkerRendering.js (render markers by type)
    ├── syncLogic.js (calculate which videos seek on global scrub)
    └── accessibilityHelpers.js (ARIA labels, keyboard nav)
```

### 5.2 Reusable vs. Custom Components

**Reusable Components (from VOD Insights design system):**
- `Button.jsx` (for +/-, Play, etc.)
- `Icon.jsx` (for event markers, controls)
- `Tooltip.jsx` (show details on hover)
- `Modal.jsx` (offset editor, confirmation dialogs)
- `Input.jsx` (text fields for offset precision)
- `Badge.jsx` (VOD labels, offset display)

**Custom Components (specific to Multi-VOD):**
- `VodPanel.jsx` (unique 3-column layout)
- `IndividualScrubber.jsx` (single-VOD scrubbing logic)
- `GlobalScrubber.jsx` (multi-VOD sync scrubber)
- `CombinedEventMarkers.jsx` (mixed-color event rendering)
- `OffsetPanel.jsx` (offset card layout)
- `EventTimeline.jsx` (multi-VOD event list)

### 5.3 State Management Architecture

```javascript
// Redux store structure (or Context API)
{
  multiVod: {
    session: {
      id: "comp-abc123",
      name: "Match Alpha Comparison",
      created: "2026-03-01T23:00:00Z",
      vods: [
        {
          id: "vod-1",
          path: "/path/to/vod1.mp4",
          title: "Nishie - Main",
          duration: 600,
          currentTime: 150,
          playback: "playing" | "paused",
          offset: 0,
          events: [
            { timestamp: 45, type: "kill", character: "Catalyst", details: "Headshot" },
            // ...
          ]
        },
        // vod-2, vod-3...
      ],
      
      // Playback state
      playback: {
        isPlaying: true,
        globalTime: 150,
        syncMode: "global",
        speed: 1.0
      },
      
      // UI state
      ui: {
        expandedEventTimeline: false,
        offsetPanelMode: "buttons", // or "edit", "drag"
        focusedVodId: "vod-1", // which scrubber was last dragged
        showEventFilters: true
      },
      
      // Timer sync (Phase 2)
      timerDetection: {
        enabled: false,
        status: "idle", // "idle", "detecting", "complete"
        detectedTimers: {
          "vod-1": "3:45",
          "vod-2": "3:45",
          "vod-3": "3:45"
        },
        aligned: false
      }
    }
  }
}
```

---

## 6. ACCESSIBILITY DESIGN

### 6.1 Keyboard Navigation

**Primary Navigation:**
```
Tab           → Move focus through scrubbers, buttons, controls
Shift+Tab     → Reverse focus direction
Enter/Space   → Activate focused button (Play/Pause, Sync, etc.)

Scrubber Navigation (when focused):
  Arrow Keys (Left/Right)   → Seek ±1 second
  Shift+Arrow Keys          → Seek ±10 seconds
  Ctrl/Cmd+Arrow Keys       → Jump to ±30 seconds (next/prev event)
  Home                      → Jump to start (0:00)
  End                       → Jump to end (duration)

Offset Adjustment (when focused on offset card):
  Arrow Up/Down             → Adjust offset ±1s
  Shift+Arrow Up/Down       → Adjust offset ±10s
  Ctrl/Cmd+Arrow Up/Down    → Adjust offset ±100ms

Global Controls:
  Space                     → Play/Pause (anywhere, except in input fields)
  Shift+Space               → Play/Pause (alternative)
  ,  (comma)                → Frame back (for pause state)
  .  (period)               → Frame forward (for pause state)
  [                         → Go to previous event
  ]                         → Go to next event
  M                         → Mute/unmute volume
  Escape                    → Close dialogs, exit edit mode
```

### 6.2 Screen Reader Support

**ARIA Labels & Descriptions:**

```jsx
// Individual Scrubber
<div
  role="slider"
  aria-label="VOD 1 (Nishie - Main) timeline"
  aria-valuemin={0}
  aria-valuemax={600}
  aria-valuenow={150}
  aria-valuetext="2 minutes 30 seconds out of 10 minutes"
  aria-describedby="vod1-scrubber-help"
  tabIndex={0}
  onKeyDown={handleScrubberKeydown}
>
  {/* Scrubber content */}
</div>
<span id="vod1-scrubber-help" hidden>
  Use arrow keys to seek by 1 second, Shift+arrow for 10 seconds,
  Ctrl+arrow to jump to next/previous event
</span>
```

**Event Marker Tooltips:**
```jsx
<button
  aria-label="Kill event at 0:45: Headshot with Vandal"
  aria-describedby="event-tooltip-1"
  onMouseEnter={showTooltip}
>
  ⚡
</button>
<div id="event-tooltip-1" hidden>
  Catalyst Sent Grenade at 0:45. Kill: Headshot.
</div>
```

**Offset Control:**
```jsx
<div
  role="group"
  aria-labelledby="offset-vod2-label"
>
  <span id="offset-vod2-label">VOD 2 Offset</span>
  <button aria-label="Decrease VOD 2 offset by 1 second">–</button>
  <output aria-live="polite">+50s</output>
  <button aria-label="Increase VOD 2 offset by 1 second">+</button>
</div>
```

**Play/Pause:**
```jsx
<button
  aria-label={isPlaying ? "Pause all videos" : "Play all videos"}
  aria-pressed={isPlaying}
>
  {isPlaying ? "⏸" : "▶"}
</button>
```

### 6.3 Color-Blind Friendly Design

**Problem:** Yellow, Red, Blue scrubber colors may not be distinguishable for color-blind users.

**Solution:** Use color + pattern/shape

```
VOD 1 (Yellow): ▬ ▬ ▬ ▬ ▬ (solid line)
VOD 2 (Red):    ▬ ─ ▬ ─ ▬ (dashed line)
VOD 3 (Blue):   ▬ ▪ ▬ ▪ ▬ (dotted line)

Event Markers (Icons + Color):
  ⚡ (Lightning) + Color = Kill
  💀 (Skull) + Color = Death
  🔥 (Flame) + Color = Ability
  💚 (Heart) + Color = Revive
```

**Alternative Display Mode:**
Add "High Contrast" theme toggle:
```
VOD 1: Black with white outline
VOD 2: Dark gray with white outline
VOD 3: Light gray with black outline

Event markers: Use text labels (K, D, A, R) instead of icons
```

**Implementation:**
```css
/* Accessible color palette */
:root {
  --vod-1-color: #d4a500;
  --vod-1-pattern: repeat(4px, solid);
  
  --vod-2-color: #c41e3a;
  --vod-2-pattern: repeat(4px 2px, dashed);
  
  --vod-3-color: #0066cc;
  --vod-3-pattern: repeat(4px 1px, dotted);
}

@media (prefers-contrast: more) {
  --vod-1-color: #000;
  --vod-2-color: #555;
  --vod-3-color: #ccc;
}
```

### 6.4 Focus Management

**Visual Focus Indicators:**
```
:focus-visible {
  outline: 3px solid #4a90e2;
  outline-offset: 2px;
  border-radius: 4px;
}

/* Scrubber focus */
.scrubber:focus-visible::after {
  content: '';
  display: block;
  position: absolute;
  border: 2px solid #4a90e2;
  border-radius: 8px;
  top: -6px;
  left: -10px;
  right: -10px;
  bottom: -6px;
}
```

**Focus Order:**
1. Global Scrubber (most important for sync)
2. Individual Scrubbers (VOD 1, 2, 3 in order)
3. Play/Pause button
4. Offset cards (in order)
5. Event Timeline (if expanded)

**Focus Trap:** Modal dialogs (offset editor) should trap focus within the dialog

---

## 7. PHASE 2 UI: TIMER DETECTION & AUTO-ALIGNMENT

### 7.1 Timer Calibration UI (Similar to CaptureArea)

```
┌────────────────────────────────────────────────────────────┐
│  Auto-Align from Game Timer                         [×]    │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1: Calibrate Timer Region                           │
│  ─────────────────────────────────────────────────────     │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ VOD 1: Nishie - Main                              │   │
│  │                                                     │   │
│  │  [Video Frame Preview]                            │   │
│  │  ┌──────────────────────────────────────┐        │   │
│  │  │                                       │        │   │
│  │  │   ┌─────────────┐   (DRAG TO SELECT) │        │   │
│  │  │   │  ┌────────┐ │                    │        │   │
│  │  │   │  │  3:45  │ │  <- Drag box around       │   │
│  │  │   │  │ Timer  │ │     the timer region       │   │
│  │  │   │  └────────┘ │                    │        │   │
│  │  │   │             │                    │        │   │
│  │  │   └─────────────┘                    │        │   │
│  │  │                                       │        │   │
│  │  └──────────────────────────────────────┘        │   │
│  │                                                     │   │
│  │ Selected Region: [x: 150, y: 50, w: 100, h: 30]  │   │
│  │                                                     │   │
│  │ [Clear] [Use Default Region]                       │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Timer Format (What to look for):                  │   │
│  │  [●] Countdown (3:45 → 0:00)                       │   │
│  │  [ ] Elapsed (0:00 → 3:45)                         │   │
│  │  [ ] Custom Format: __:__ (digits only)           │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  Confidence Threshold: [████████░░] 80%                   │
│  (Higher = slower but more accurate)                      │
│                                                             │
│  [Previous Step] [Cancel] [Start Detection ▶]             │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

**Interaction Flow:**
1. User clicks [Auto-Align from Timer] button
2. Modal opens with video preview of VOD 1
3. User draws rectangle around timer on screen (drag interaction)
4. Selected region shown as bounding box coordinates
5. User selects timer format (countdown vs. elapsed)
6. User sets confidence threshold (slider)
7. Click [Start Detection] → moves to Step 2

### 7.2 Detection Progress UI

```
┌────────────────────────────────────────────────────────────┐
│  Auto-Align from Game Timer                         [×]    │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 2: Detecting Game Timers                            │
│  ─────────────────────────────────────────────────────     │
│                                                             │
│  VOD 1: Nishie - Main                                      │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Progress: 35% (2:06 / 10:00 scanned)  [⏸]        │   │
│  │ [████████████░░░░░░░░░░░░░░░░░░░░░░░] 3:30 left  │   │
│  │                                                     │   │
│  │ Detected Timers:                                   │   │
│  │ ✓ 0:00 → 5:00 (ascending, confidence 0.94)        │   │
│  │ ✓ 3:45 detected 8 times (consistency: high)       │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  VOD 2: TSM_Pro - POV2                                     │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Progress: 28% (2:48 / 10:00 scanned)  [⏸]        │   │
│  │ [█████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 4:10 left │   │
│  │                                                     │   │
│  │ Detected Timers:                                   │   │
│  │ ✓ 4:32 detected 5 times (consistency: medium)     │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  VOD 3: Optic_Aim - POV3                                   │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Progress: 8% (0:48 / 10:00 scanned)   [⏸]        │   │
│  │ [██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 5:45 left  │   │
│  │                                                     │   │
│  │ Detecting timers...                               │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  [Cancel] [Pause]                                          │
│                                                             │
│  Overall: ~3 minutes remaining                            │
│  (Detection runs in background; you can continue working)  │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

**Specs:**
- **Progress Bar:** Animated, color gradient (green for high confidence)
- **Detected Timers:** Show in real-time as they're found
- **Pause/Resume:** Allow user to pause if system is overloaded
- **Cancellable:** Can cancel and fall back to manual offset adjustment
- **Status Message:** Show estimated time remaining

### 7.3 Matching & Confirmation UI

```
┌────────────────────────────────────────────────────────────┐
│  Auto-Align from Game Timer                         [×]    │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 3: Select Matching Timers                           │
│  ─────────────────────────────────────────────────────     │
│                                                             │
│  Detection found timers in all 3 VODs!                    │
│  Select the same moment in each VOD to align:             │
│                                                             │
│  ┌──────────────────────────────────────────────────┐    │
│  │ VOD 1: Nishie - Main                             │    │
│  │ Detected Timers:                                  │    │
│  │ [●] 3:45 (confidence: 0.94, found 8x)           │    │
│  │ [ ] 2:15 (confidence: 0.87, found 4x)           │    │
│  │ [ ] 1:30 (confidence: 0.82, found 3x)           │    │
│  └──────────────────────────────────────────────────┘    │
│                                                             │
│  ┌──────────────────────────────────────────────────┐    │
│  │ VOD 2: TSM_Pro - POV2                            │    │
│  │ Detected Timers:                                  │    │
│  │ [ ] 3:47 (confidence: 0.91, found 6x)           │    │
│  │ [●] 3:45 (confidence: 0.88, found 7x) ← MATCHED │    │
│  │ [ ] 2:13 (confidence: 0.85, found 5x)           │    │
│  └──────────────────────────────────────────────────┘    │
│                                                             │
│  ┌──────────────────────────────────────────────────┐    │
│  │ VOD 3: Optic_Aim - POV3                          │    │
│  │ Detected Timers:                                  │    │
│  │ [ ] 3:43 (confidence: 0.89, found 5x)           │    │
│  │ [ ] 3:45 (confidence: 0.86, found 6x) ← AUTO     │    │
│  │ [●] 3:45 (confidence: 0.90, found 8x) ← MATCH   │    │
│  └──────────────────────────────────────────────────┘    │
│                                                             │
│  Summary:                                                  │
│  ───────                                                   │
│  VOD 1 @ 3:45 (video time: 2:35)                         │
│  VOD 2 @ 3:45 (video time: 1:50) → offset: -45s        │
│  VOD 3 @ 3:45 (video time: 3:22) → offset: +47s        │
│                                                             │
│  [← Back] [Cancel] [Preview] [✓ Apply Alignment]         │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

**User Interaction:**
- Click radio button to select which timer to use as reference
- System auto-matches selected timer across all VODs (shows matches)
- User can override if auto-match is wrong
- [Preview] shows scrubbers with proposed offsets (no commit yet)
- [Apply] sends alignment to backend, returns to main view

### 7.4 Phase 2 Component Structure

```
GameTimerDetection/
├── TimerDetectionModal.jsx (main dialog wrapper)
├── Step1_TimerCalibration.jsx
│   ├── VideoPreview.jsx (VOD 1 with interactive region selector)
│   ├── RegionSelector.jsx (draw bounding box on video)
│   ├── TimerFormatSelector.jsx (countdown vs. elapsed)
│   └── ConfidenceSlider.jsx (OCR confidence threshold)
├── Step2_DetectionProgress.jsx
│   ├── VodProgressCard.jsx (x3 - one per VOD)
│   │   ├── ProgressBar.jsx
│   │   └── DetectedTimersList.jsx
│   └── DetectionStatusPanel.jsx (overall progress)
├── Step3_TimerMatching.jsx
│   ├── TimerOptionGroup.jsx (x3 - one per VOD)
│   │   ├── TimerOption.jsx (radio button + details)
│   │   └── ConfidenceBadge.jsx
│   ├── AlignmentSummary.jsx (shows calculated offsets)
│   └── PreviewButton.jsx
└── hooks/
    ├── useTimerDetection.js (orchestrate detection API calls)
    ├── useTimerMatching.js (logic for matching timers across VODs)
    └── useDetectionProgress.js (poll for progress updates)
```

---

## 8. DESIGN SYSTEM & COMPONENT REUSE

### 8.1 Existing VOD Insights Components to Reuse

| Component | Current Use | Multi-VOD Use |
|-----------|-------------|---------------|
| `Button` | Playback, export | Play/pause, offsets, alignment |
| `Icon` | Event markers | Event markers, controls |
| `Tooltip` | Hover details | Event marker tooltips |
| `Modal` | Dialogs | Offset editor, timer calibration |
| `Input` | Text fields | Offset precision, timer format |
| `Badge` | Labels | VOD labels, event type indicators |
| `Slider` | Volume, seek | Confidence threshold, speed |
| `Dropdown` | Select options | Timer format, filter events |
| `ProgressBar` | Upload, processing | Detection progress |
| `Tabs` | Navigation | VOD selection, filter views |

### 8.2 New Components to Design

| Component | Purpose | Complexity |
|-----------|---------|------------|
| `VodPanel` | Single VOD with scrubber | Medium (custom layout) |
| `IndividualScrubber` | Per-VOD timeline | High (drag logic, sync) |
| `GlobalScrubber` | Master timeline | High (sync all 3) |
| `EventMarker` | Icon + tooltip | Low (reuses Icon + Tooltip) |
| `CombinedEventMarkers` | Mixed-color events | Medium (layout + color) |
| `OffsetCard` | Offset display + controls | Medium (buttons + input) |
| `OffsetPanel` | Container for 3 offset cards | Low (layout) |
| `EventTimeline` | Expanded event list | Medium (filtering, sorting) |
| `VideoElement` | HTML5 video wrapper | Low (thin wrapper) |
| `PlaybackControls` | Play, skip, speed, volume | Medium (multi-function) |
| `TimerCalibration` | Draw region on video | High (canvas interaction) |
| `DetectionProgress` | Show OCR progress | Medium (real-time updates) |
| `TimerMatching` | Select matching timers | High (multi-select logic) |

### 8.3 Color Palette Extension

**Existing VOD Insights colors:**
```
Primary: #2563eb (Tailwind blue)
Secondary: #7c3aed (Tailwind purple)
Accent: #f59e0b (Tailwind amber)
Background: #ffffff
Text: #1f2937 (dark gray)
Border: #e5e7eb (light gray)
```

**New colors for Multi-VOD:**
```
VOD 1: #d4a500 (golden yellow) + #f0f0f0 (light background)
VOD 2: #c41e3a (crimson red) + #fef2f2 (very light red)
VOD 3: #0066cc (royal blue) + #f0f7ff (very light blue)

Neutral scrubber: #e5e7eb (gray track)
Played portion (base): #d4a500 (golden, matches VOD 1)
Success (applied): #16a34a (green)
Warning (high offset): #f59e0b (amber)
Error (out of bounds): #dc2626 (red)
```

**Event Type Colors (inherit VOD color, with variants):**
```
Kill: Base VOD color + icon ⚡
Death: Base VOD color + icon 💀
Ability: Base VOD color + icon 🔥
Revive: Base VOD color + icon 💚
```

### 8.4 Typography & Spacing

**Existing scales (keep consistent):**
```
Headings: 24px (h1), 20px (h2), 16px (h3)
Body: 14px (default), 13px (small), 12px (caption)
Mono (timecode): 13px or 14px, font-family: 'Monaco', 'Consolas'

Spacing (8px base unit):
xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 32px

Padding:
Component: 12px (default), 8px (compact), 16px (spacious)
Scrubber: 8px vertical, full width horizontal

Gaps:
Between scrubbers: 12px
Between columns: 12px (same as internal padding)
Row gaps: 16px
```

### 8.5 Motion & Animation

**Scrubber Interactions:**
```
Thumb hover growth: 150ms cubic-bezier(0.4, 0, 0.2, 1)
Track highlight: 100ms ease-in-out
Playhead movement: Smooth (60fps), no easing (real-time playback)

Offset number change: 200ms ease-out (satisfying counter effect)
Modal open: 200ms ease-out (fade in + slide)
Progress bar update: 300ms ease-in-out (smooth animation)
```

**Accessibility Note:**
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 9. INTERACTION FLOWS (Detailed User Journeys)

### 9.1 Flow: Load VODs & Compare

```
1. User navigates to "Compare VODs" page
   ↓
2. Selects 3 VODs from library (or uploads new)
   ↓
3. System creates MultiVodSession, loads VODs
   ↓
4. Layout loads with 3 video panels, scrubbers, controls
   ↓
5. User reviews each VOD independently:
   - Drag individual scrubber to review
   - Events shown above each scrubber
   - Other VODs remain at current position
   ↓
6. User sees offsets are misaligned:
   VOD1: 2:35 | VOD2: 1:45 | VOD3: 3:12
   ↓
7. User manually adjusts with +/- buttons:
   Click [–] on VOD2 twice → VOD2 offset: -50s
   Click [+] on VOD3 once → VOD3 offset: +37s
   ↓
8. User drags Global Scrubber to sync all 3
   ↓
9. Videos now play in sync (Play/Pause controls all 3)
   ↓
10. User expands Event Timeline to compare events across VODs
```

### 9.2 Flow: Auto-Align with Game Timer

```
1. User sees manual offset adjustment is tedious
   ↓
2. Clicks [🔄 Auto-Align from Timer] button
   ↓
3. TimerDetectionModal opens (Step 1: Calibration)
   ↓
4. User draws rectangle around timer on VOD 1 preview
   - Selects "Countdown" format
   - Sets confidence to 85%
   ↓
5. Clicks [Start Detection ▶]
   ↓
6. System shows detection progress (Step 2)
   - Scans all 3 VODs for timers
   - Shows detected values in real-time
   - Takes ~3-5 minutes
   ↓
7. Detection complete, shows Step 3 (Timer Matching)
   ↓
8. System auto-selects matching timers:
   - VOD1: 3:45
   - VOD2: 3:45 (auto-matched)
   - VOD3: 3:45 (auto-matched)
   ↓
9. User reviews calculated offsets:
   - VOD2: -45s (faster)
   - VOD3: +47s (slower)
   ↓
10. Clicks [✓ Apply Alignment]
    ↓
11. Modal closes, offsets applied, VODs now auto-synced
    ↓
12. User verifies by dragging Global Scrubber
    - All 3 videos show same in-game moment
```

### 9.3 Flow: Accessibility - Keyboard Navigation

```
1. User presses Tab to focus Global Scrubber
   ↓
2. Focus ring visible around scrubber (3px blue outline)
   ↓
3. User presses Right Arrow → scrubber advances 1 second
   ↓
4. User presses Shift+Right Arrow → scrubber advances 10 seconds
   ↓
5. User presses Ctrl+Right Arrow → jumps to next event
   ↓
6. Screen reader announces: "Jump to next event: Kill at 3:15"
   ↓
7. User presses Escape to exit scrubber focus
   ↓
8. Tab key moves to Play/Pause button
   ↓
9. User presses Space → all 3 videos pause
   ↓
10. User presses Tab multiple times to reach VOD2 offset card
    ↓
11. Up Arrow increases offset by 1s
    ↓
12. User presses Shift+Up Arrow to increase by 10s
    ↓
13. Screen reader announces: "VOD 2 offset: -40s"
```

---

## 10. RESPONSIVE BEHAVIOR & EDGE CASES

### 10.1 Viewport Size Behavior

```
Viewport Size    Layout         Video Height    Scrubber Height
─────────────────────────────────────────────────────────────
1920px+          3 columns      360px           60px
1280-1919px      3 columns      300px           50px
1024-1279px      3 columns      250px           48px
768-1023px       2+1 columns    280px           50px
640-767px        1 column       380px           55px
< 640px          1 column       240px           48px
```

**Scrolling Behavior:**
- Desktop (3-column): Scrubbers align horizontally (no scroll needed for main content)
- Tablet (2+1): VOD 3 requires scroll to reach; global scrubber sticky at top
- Mobile (1-column): Vertical scroll through all VODs; global scrubber sticky at top

### 10.2 Edge Cases & Solutions

| Edge Case | Problem | Solution |
|-----------|---------|----------|
| VOD duration mismatch | VOD2 is 9:30, VOD3 is 10:00 | When seeking VOD2, cap at 9:30. Show "duration exceeded" warning |
| Large offset | VOD2 offset +5:00, but duration is only 10:00 | Show warning: "Offset may cause playback issues" |
| User seeks beyond bounds | Click global scrubber at 11:00 (past duration) | Snap to end (10:00) |
| Rapid clicking offsets | User clicks [+] 10 times rapidly | Debounce/throttle to 200ms per update (prevent flooding) |
| Offset while playing | User adjusts VOD2 offset during playback | Re-sync all scrubbers immediately; pause, adjust, resume |
| Event at exact start/end | Event at 0:00 or 10:00 | Show marker, but handle tooltip positioning to avoid clipping |
| No events in VOD | VOD1 has events, but VOD2 has none | Show empty event track, no markers (not an error) |
| Timer detection fails | OCR can't find timer (confidence <30%) | Show error: "Timer not detected. Try adjusting region or confidence. Fall back to manual." |
| Very long VOD (30+ min) | Scrubber gets crowded with events | Group events by minute; show "5 events in this minute" on hover |

---

## 11. PERFORMANCE CONSIDERATIONS

### 11.1 Rendering Optimization

**Problem:** 3 videos + scrubbers + event markers = potential jank

**Solutions:**

```javascript
// 1. Virtualize event timeline (only render visible events)
<FixedSizeList
  height={300}
  itemCount={events.length}
  itemSize={48}
  width="100%"
>
  {EventRow}
</FixedSizeList>

// 2. Memoize scrubber components (prevent re-renders)
export const VodPanel = React.memo(({ vod }) => {
  return (
    <div>
      <VideoElement src={vod.path} />
      <IndividualScrubber {...props} />
    </div>
  );
}, (prev, next) => {
  // Only re-render if vod.path or currentTime changed
  return prev.vod.path === next.vod.path &&
         prev.vod.currentTime === next.vod.currentTime;
});

// 3. Debounce scrubber updates (don't update on every pixel)
const handleScrubberDrag = debounce((time) => {
  updateVodTime(time); // API call
}, 100);

// 4. Use CSS containment (isolate VOD panels)
.vod-panel {
  contain: layout style paint;
}
```

### 11.2 Network Optimization

```javascript
// Batch API calls (don't make 3 separate seek calls)
PUT /api/sessions/{id}/global-seek { timestamp: 300 }
Response: {
  vod1: { currentTime: 300 },
  vod2: { currentTime: 350 },
  vod3: { currentTime: 263 }
}
// Server returns all 3 updates in one response

// Use WebSocket for real-time offset updates (optional)
socket.emit('offset-adjust', { vodId: 'vod-2', offset: 50 })
socket.on('session-updated', (state) => {
  updateUI(state); // broadcast to all connected clients
})
```

---

## 12. TESTING & QA CHECKLIST

### 12.1 Functional Testing

- [ ] Load 3 VODs, verify all play together
- [ ] Drag individual scrubber → only that VOD seeks
- [ ] Drag global scrubber → all 3 seek with offset applied
- [ ] Click Play → all 3 play; Click Pause → all 3 pause
- [ ] Adjust offset with +/- buttons → scrubbers update
- [ ] Open offset editor modal → type value → apply → updates
- [ ] Event markers show on all scrubbers (correct colors)
- [ ] Hover event marker → tooltip appears (correct details)
- [ ] Click event → jump to that timestamp
- [ ] Event timeline shows all events (across all 3 VODs)
- [ ] Filter events → only selected types shown
- [ ] Expand/collapse event timeline → works smoothly
- [ ] Responsive layout: Desktop 3-col, Tablet 2+1, Mobile 1-col
- [ ] Global scrubber sticky when scrolling (mobile)

### 12.2 Performance Testing

- [ ] 3x 1080p video playback: No lag (<60fps)
- [ ] Scrubber drag: Responsive (<100ms latency)
- [ ] Offset adjust: Snappy counter animation
- [ ] Event marker hover: Tooltip appears <200ms
- [ ] Expand event timeline: Smooth scroll, no jank
- [ ] Memory usage: <1GB with 3 videos loaded

### 12.3 Accessibility Testing

- [ ] Keyboard navigation: Tab through all interactive elements
- [ ] Scrubber keyboard control: Arrow keys work
- [ ] Screen reader: All buttons labeled with ARIA labels
- [ ] Focus visible: Blue outline on all :focus-visible elements
- [ ] Color-blind mode: Toggle high-contrast → patterns visible
- [ ] Mobile keyboard: Offset adjust works with mobile keyboard
- [ ] Skip links: Ability to jump to main content (after header)

### 12.4 Browser Compatibility

- [ ] Chrome 90+: Full support
- [ ] Firefox 88+: Full support
- [ ] Safari 14+: Full support
- [ ] Edge 90+: Full support
- [ ] Mobile Safari (iOS 14+): Responsive layout works
- [ ] Chrome Mobile (Android 10+): Responsive layout works

---

## 13. IMPLEMENTATION NOTES FOR DEVELOPERS

### 13.1 Key Technical Decisions

1. **Video Sync Strategy:**
   - Use shared playback clock (not individual video.play() calls)
   - Single `requestAnimationFrame` loop for all 3 video elements
   - Periodic re-sync every 100ms to correct drift

2. **Offset Calculation:**
   - Global Time = reference scrubber position
   - VOD Time = Global Time - offset
   - Example: VOD2 offset -50s means it started 50s ahead

3. **Event Marker Rendering:**
   - Pre-compute marker positions (don't recalculate on every render)
   - Use CSS grid for event stack layout
   - Icon fonts for events (lighter than images)

4. **State Management:**
   - Redux for multi-VOD state (or Context API for simpler apps)
   - Separate UI state (focus, expanded panels) from playback state
   - Backend as single source of truth for offsets

### 13.2 CSS-in-JS vs. SCSS

**Recommendation:** Use SCSS for layout, CSS-in-JS for component styles
```scss
// layout/scrubbers.scss (shared scrubber styles)
.scrubber {
  &--vod1 { --accent: #d4a500; }
  &--vod2 { --accent: #c41e3a; }
  &--vod3 { --accent: #0066cc; }
}

// Component.module.scss (component-specific)
.panel {
  display: grid;
  gap: $spacing-md;
}
```

### 13.3 Build & Bundling

- Lazy-load DetectionProgress UI (not used until Phase 2)
- Split VodPanel components if bundle size > 1MB
- Code-split event timeline (render on demand)

---

## 14. FINAL CHECKLIST FOR DESIGNER REVIEW

- [ ] All 8 focus areas addressed (Layout, Scrubber, Markers, Offset, Components, Accessibility, Phase 2, Design System)
- [ ] ASCII art mockups provided for each major UI section
- [ ] Responsive breakpoints defined (desktop, tablet, mobile)
- [ ] Interaction flows documented (drag, click, keyboard)
- [ ] Color palette + contrast ratios checked (WCAG AA)
- [ ] Component hierarchy clearly mapped to React structure
- [ ] Accessibility guidelines detailed (ARIA, keyboard nav, focus)
- [ ] Performance considerations listed
- [ ] Edge cases identified with solutions
- [ ] Phase 2 UI design included (timer calibration, detection, matching)
- [ ] QA checklist provided for testers
- [ ] Implementation notes for developers

---

## Questions for the Architect

Before handing off to development, I'd like to clarify a few technical constraints:

1. **Video Playback Sync:**
   - Should we use shared `requestAnimationFrame` or WebWorker for clock synchronization?
   - Are there browser limitations for 3x video playback simultaneously?
   - Recommendation: Profile on target hardware (typical coach's laptop)

2. **Offset Storage:**
   - Should offsets persist after session closes?
   - Should users be able to save sessions by name?
   - Recommendation: Yes to both (database schema already supports)

3. **Timer Detection (Phase 2):**
   - Should we support custom timer formats (not just MM:SS)?
   - Any plans to integrate with game APIs (e.g., Apex API for match timer)?
   - Recommendation: Support MM:SS + M:SS for now; custom formats Phase 2+

4. **Multi-User / Sharing:**
   - Should users be able to share comparison sessions?
   - Should session editing be real-time collaborative?
   - Recommendation: Phase 2 feature; for now, simple share link

5. **Hardware Requirements:**
   - What's the target system specs (CPU, GPU, RAM)?
   - Should we support GPU acceleration for video rendering?
   - Recommendation: Document minimum specs (e.g., Intel i5, 8GB RAM)

---

## Conclusion

This design specification provides a complete blueprint for the Multi-VOD Comparison feature. The layout is responsive, interactions are intuitive, and accessibility is baked in from the start.

**Next Steps:**
1. Architect reviews this design + answers clarifying questions
2. Frontend Dev builds VodPanel, scrubbers, offset controls
3. Backend Dev implements API endpoints + state management
4. QA begins testing once Phase 1 components ready

**Timeline:** 3-4 days for Phase 1, 2-3 days for Phase 2.

---

**Design v1.0** | Larry | 2026-03-01 | Ready for Architect Review ✅
