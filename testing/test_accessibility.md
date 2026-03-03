# Multi-VOD Comparison - Accessibility Testing Checklist

**QA Agent**: Larry the Lobster
**Test Date**: 2026-03-01 onwards
**Scope**: Multi-VOD player components and controls

## WCAG 2.1 Level AA Compliance

### 1. Keyboard Navigation ✅ To Test

#### Tab Navigation
- [ ] Tab moves focus through all interactive elements in logical order
- [ ] Shift+Tab reverses focus order correctly
- [ ] Focus is never lost or trapped
- [ ] Focus indicator is visible (>3px, AAA contrast)
- [ ] Tab order: Add VOD → VOD Grid → Primary Player → Secondary Players → Offset Controls → Timeline

#### Arrow Keys
- [ ] Arrow Up/Down adjusts offset by 1 second
- [ ] Arrow Left/Right seeks within video by 5 seconds
- [ ] Ctrl+Left/Right seeks by 30 seconds
- [ ] Home/End jump to start/end of video
- [ ] Arrow keys work in both focused and unfocused states

#### Shortcut Keys
- [ ] Space toggles play/pause
- [ ] Ctrl+[: Jump to previous event marker
- [ ] Ctrl+]: Jump to next event marker
- [ ] +/-: Adjust offset by 1 second
- [ ] Ctrl++/-: Adjust offset by 5 seconds
- [ ] M: Mute/unmute primary VOD

### 2. ARIA Labels & Attributes ✅ To Test

#### Button Labels
- [ ] "Add VOD" button has descriptive label
- [ ] "Remove VOD" buttons labeled with VOD identifier
- [ ] "Play" / "Pause" buttons have current state in label
- [ ] "Mute" / "Unmute" buttons reflect state
- [ ] Offset +/- buttons labeled with amount ("+1s", "-5s", etc.)

#### Form Controls
- [ ] Offset input fields have labels (`<label for="">`)
- [ ] VOD URL input has placeholder or label
- [ ] VOD label input has descriptive label
- [ ] All inputs have `aria-label` or `aria-labelledby`

#### Live Regions
- [ ] Sync status displayed with `aria-live="polite"`
- [ ] Error messages announced with `role="alert"`
- [ ] Progress indicator with `aria-valuenow` and `aria-valuemax`
- [ ] Scrubber position announced with `aria-label`

#### Semantic Structure
- [ ] Video players in `<section>` or `<article>`
- [ ] Controls in `<fieldset>` or `<nav>`
- [ ] Headings use `<h1>`, `<h2>` hierarchy
- [ ] Lists of VODs use `<ul>` or `<ol>`

#### ARIA Roles
- [ ] Slider controls have `role="slider"`
- [ ] Timeline scrubber has `role="slider"`
- [ ] Event markers have `role="listitem"`
- [ ] Status indicators have `role="status"`

### 3. Color & Contrast ✅ To Test

#### Contrast Ratios
- [ ] Text on background: 4.5:1 minimum (WCAG AA)
- [ ] Large text (18pt+): 3:1 minimum
- [ ] UI components (buttons, borders): 3:1 minimum
- [ ] Text on active button: ≥4.5:1 contrast

#### Color-Blind Safe Palette
- [ ] Event types not distinguished by color alone
  - [ ] Kill events: Red + ✓ symbol + tooltip
  - [ ] Assist events: Blue + ◆ symbol + tooltip
  - [ ] Knock events: Yellow + ▲ symbol + tooltip
  - [ ] Custom events: Green + ⊕ symbol + tooltip

#### Accessible Colors
- [ ] No pure red-green combinations for meaning
- [ ] Primary accents: Use blue, yellow, orange (not red/green pair)
- [ ] Background: Dark theme (#13242a) or light mode (white/light gray)
- [ ] Text: White/light on dark, dark on light

### 4. Screen Reader Compatibility ✅ To Test

**Tools**: NVDA (Windows), JAWS (Windows), VoiceOver (Mac/iOS)

#### Announcements
- [ ] "Multi-VOD Comparison Player" announced on page load
- [ ] "3 Videos Added" announced when VODs loaded
- [ ] "Sync Status: Synced" announced when sync complete
- [ ] "Offset: -5 seconds" announced when offset changes
- [ ] "Playing at 1x speed" announced on playback start

#### Navigation
- [ ] Headings announced: "Video Players", "Controls", "Event Timeline"
- [ ] All buttons announced with purpose
- [ ] Form labels announced before inputs
- [ ] Error messages announced as alerts

#### Content Description
- [ ] Event markers described: "Kill event at 14:32"
- [ ] VOD metadata read: "Match 1 - POV 2, Duration: 30 minutes"
- [ ] Sync indicators read: "Synced with 92% confidence"
- [ ] Stats announced: "Primary VOD at 1:45, Secondary VOD 2 at 1:40"

### 5. Focus Management ✅ To Test

#### Focus Trap Prevention
- [ ] No focus traps in modal dialogs
- [ ] Focus escapes Add VOD modal with Escape key
- [ ] Focus returns to Add VOD button after modal closes
- [ ] Tab works throughout entire UI

#### Focus Visibility
- [ ] Focus indicator clearly visible on:
  - [ ] Buttons
  - [ ] Input fields
  - [ ] Sliders
  - [ ] VOD selectors
- [ ] Focus indicator has sufficient contrast
- [ ] Focus indicator is not obscured

### 6. Motion & Animation ✅ To Test

#### Reduced Motion Support
- [ ] Slider adjustments respect `prefers-reduced-motion`
- [ ] Timeline scrubbing doesn't animate
- [ ] Transitions disabled for users preferring reduced motion
- [ ] Video transitions are instant (not animated)

#### Animation Details
- [ ] No auto-playing animations
- [ ] Animations <5 seconds or pausable
- [ ] No flashing >3x per second
- [ ] Offset slider shows real-time value

### 7. Form & Input Accessibility ✅ To Test

#### Input Fields
- [ ] URL input has clear label ("Twitch VOD URL")
- [ ] Label visible (not just placeholder)
- [ ] Validation errors announced as alerts
- [ ] Character limits announced
- [ ] Required fields marked with `aria-required="true"`

#### Slider Controls
- [ ] Min/max values announced
- [ ] Current value always visible
- [ ] Slider responds to arrow keys
- [ ] Slider responds to Home/End keys
- [ ] Large touch target (minimum 44x44px)

### 8. Responsive Text & Zoom ✅ To Test

#### Text Resizing
- [ ] Page readable at 200% zoom
- [ ] No horizontal scroll at 200% zoom
- [ ] Controls remain functional at 200% zoom
- [ ] Text not cut off at smaller sizes

#### Breakpoints
- [ ] Desktop (1920x1080): All controls visible
- [ ] Tablet (768x1024): Stack or grid layout works
- [ ] Mobile (375x812): Single-column layout, controls accessible

### 9. Video Player Accessibility ✅ To Test

#### Native Controls
- [ ] HTML5 `<video>` with native controls
- [ ] Play/pause keyboard control
- [ ] Volume slider accessible via keyboard
- [ ] Progress bar scrubbing with keyboard

#### Custom Controls
- [ ] Custom play/pause button accessible
- [ ] Custom volume control labeled
- [ ] Custom progress bar slider accessible
- [ ] Timeline markers reachable via Tab

#### Captions & Audio Description
- [ ] VOD supports captions (`.vtt` file)
- [ ] Captions toggle button available
- [ ] Audio description track available
- [ ] Audio description toggle labeled

## Manual Testing Procedure

### Setup
1. Open VOD Insights in latest Chrome/Firefox
2. Load 3 different VODs
3. Enable browser DevTools (F12)
4. Open Accessibility Inspector

### Test 1: Keyboard Navigation
```
1. Press Tab repeatedly
   → Verify focus moves through all controls
   → Verify focus order is logical
   
2. Focus on primary video
   → Press Space
   → Verify video plays/pauses
   
3. Focus on offset slider
   → Press Arrow Up
   → Verify offset increases
   → Press Arrow Down
   → Verify offset decreases
   
4. Press Ctrl+[
   → Verify jumps to previous event
   
5. Press Ctrl+]
   → Verify jumps to next event
```

### Test 2: Screen Reader (NVDA on Windows)
```
1. Start NVDA (Ctrl+Alt+N)
2. Navigate to Multi-VOD player
3. Verify announces: "Multi-VOD Comparison Player"
4. Press H to jump to headings
   → Should hear: "Video Players", "Controls", "Timeline"
5. Press B to jump to buttons
   → Should hear: "Add VOD", "Play", "Pause", etc.
6. Change offset with +/- button
   → Should hear: "Offset: -5 seconds"
7. Select event marker
   → Should hear: "Kill event at 14:32"
```

### Test 3: Color Contrast
```
1. Open DevTools
2. Go to Accessibility tab
3. Use Color Contrast Analyzer
4. Check all:
   - Text on backgrounds
   - Buttons and borders
   - Event markers
   - Focus indicators
```

### Test 4: Color Blindness
```
1. Use DevTools > Rendering > Emulate CSS media feature prefers-color-scheme
2. Also try browser extensions:
   - "Color Oracle" (simulate Deuteranopia, Protanopia, Tritanopia)
3. Verify event types distinguishable by:
   - Symbols (✓, ◆, ▲, ⊕)
   - Patterns (not just color)
   - Tooltips
```

### Test 5: Zoom & Resize
```
1. Ctrl+Plus to zoom to 200%
   → Verify all controls visible
   → Verify no horizontal scroll
   → Verify readable

2. Resize browser to 375x812 (mobile)
   → Verify responsive layout
   → Verify controls accessible
   → Verify video visible
```

## Known Issues & Notes

- [ ] Issue 1: [Describe any found issues]
- [ ] Issue 2: [Describe any found issues]

## Sign-Off

- **Tested By**: _____________
- **Date**: _____________
- **WCAG 2.1 Level AA**: ✅ Pass / ❌ Fail
- **All Keyboard Navigation**: ✅ Pass / ❌ Fail
- **Screen Reader Compatible**: ✅ Pass / ❌ Fail
- **Color-Blind Safe**: ✅ Pass / ❌ Fail

## References

- WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/quickref/
- Accessible Video Player: https://www.w3.org/WAI/media/av/
- Color-Blind Palette: https://colorblindor.com/
- Screen Reader Testing: https://www.deque.com/tools/axe-devtools/
