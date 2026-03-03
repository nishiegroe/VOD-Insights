# Multi-VOD Modal - Quick Reference

## Modal UI Structure

```
┌─────────────────────────────────────────────────────────┐
│ Create Multi-VOD Comparison                         [✕] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ [ERROR BOX - if error occurred]                        │
│                                                         │
│ SELECT VODS (2/3)                                      │
│ Select 2-3 VODs to compare                            │
│                                                         │
│ ☑ 2026-03-02 Apex Game            [duration] [res]   │
│ ☐ 2026-03-01 Practice Scrim        [duration] [res]   │
│ ☐ 2026-02-28 Tournament Final      [duration] [res]   │
│ ☐ 2026-02-27 Ranked Climb          [duration] [res]   │
│ ...                                                    │
│                                                         │
│ SESSION NAME (OPTIONAL)                               │
│ ┌─────────────────────────────────────────────────┐   │
│ │ Comparison-20260302-0955                        │   │
│ └─────────────────────────────────────────────────┘   │
│ Defaults to "Comparison-{date}" if left empty        │
│                                                         │
│ SYNC MODE                                             │
│ ┌──────────────────┐  ┌──────────────────┐           │
│ │ ◉ Global         │  │ ○ Independent    │           │
│ │  All videos      │  │  Videos play     │           │
│ │  play in sync    │  │  separately      │           │
│ └──────────────────┘  └──────────────────┘           │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                              [Cancel]  [Create...]     │
└─────────────────────────────────────────────────────────┘
```

## Button Locations

### VODs Page
```
┌───────────────────────────────────┐
│ Recordings                         │
│            [Reset Wizard] [Open Log] [Compare] [Download] [↑] │
└───────────────────────────────────┘
                  ↑
             NEW BUTTON
```

### VOD Viewer Page
```
┌───────────────────────────────────┐
│ Back to VODs │ VOD Title          │
│             [Clip] [Compare VODs] [Add Marker] [Show Bookmarks] [Delete] │
└───────────────────────────────────┘
                     ↑
                NEW BUTTON
```

## Component Hierarchy

```
MultiVodModal
├── props:
│   ├── isOpen: boolean
│   └── onClose: function
│
├── state:
│   ├── vodList: array
│   ├── selectedVods: array
│   ├── sessionName: string
│   ├── syncMode: 'global' | 'independent'
│   ├── loading: boolean
│   ├── error: string
│   └── submitting: boolean
│
└── render:
    ├── Modal Overlay (blur backdrop)
    │   └── Modal Content (card)
    │       ├── Header
    │       │   ├── Title: "Create Multi-VOD Comparison"
    │       │   └── Close Button
    │       │
    │       ├── Body
    │       │   ├── Error Alert (conditional)
    │       │   ├── VOD Selection
    │       │   │   ├── Label + counter
    │       │   │   └── Scrollable List
    │       │   │       └── Checkbox Items
    │       │   ├── Session Name Input
    │       │   └── Sync Mode Radio Buttons
    │       │
    │       └── Footer
    │           ├── Cancel Button
    │           └── Create Comparison Button
```

## State Flow

### On Modal Open
```
Modal opens
  ↓
fetchVodList()
  ├── API: GET /api/vods/list
  ├── setLoading(true)
  └── setError(null)
```

### On VOD Selection
```
User clicks checkbox
  ↓
handleVodToggle(vodPath)
  ├── If selected: add to array
  ├── If not selected: remove from array
  ├── If at limit (3): disable unchecked items
  └── updateSelectedVods[]
```

### On Form Submit
```
User clicks "Create Comparison"
  ↓
handleSubmit()
  ├── Validate: 2-3 VODs selected
  ├── Generate session name if empty
  ├── API: POST /api/sessions/multi-vod
  ├── If success:
  │   ├── navigate(/comparison?session=...)
  │   └── handleClose()
  └── If error:
      └── setError(message)
```

### On Modal Close
```
User clicks Cancel, Close, or Backdrop
  ↓
handleClose()
  ├── Reset all state
  ├── Clear selections
  ├── Clear session name
  └── onClose() → setState(showMultiVodModal=false)
```

## Validation Logic

### VOD Selection
```
if (selectedVods.length < 2) {
  ✗ Disable "Create" button
  ✗ Show message "Please select 2-3 VODs"
}

if (selectedVods.length > 3) {
  ✗ Disable unchecked VOD checkboxes
}

if (selectedVods.length >= 2 && selectedVods.length <= 3) {
  ✓ Enable "Create" button
}
```

### Session Name
```
Input: sessionName (optional, free text)
Default: "Comparison-" + YYYYMMDD + "-" + HHMM
Example: "Comparison-20260302-0955"
```

### Sync Mode
```
Default: "global"
Options:
  - global: All videos play in sync (scrubber controls all)
  - independent: Videos play separately (each has own controls)
```

## Responsive Behavior

### Desktop (1920px+)
```
Modal Width: 600px (max)
VOD List: 300px max-height (scrollable)
Layout: 2-column for sync modes
```

### Tablet (768px - 1919px)
```
Modal Width: 90vw
VOD List: 250px max-height (scrollable)
Layout: 2-column for sync modes
```

### Mobile (< 768px)
```
Modal Width: 90vw
VOD List: 200px max-height (scrollable)
Layout: Stacked vertically
```

## Loading States

### Fetching VOD List
```
┌─────────────────────┐
│ SELECT VODS (0/3)   │
│ Select 2-3 VODs     │
│                     │
│   Loading VODs...   │
└─────────────────────┘
```

### Creating Session
```
[Cancel]  [Creating...]
↑         ↑ Button disabled
Disabled  ↑ Spinner shown
```

## Error States

### VOD Fetch Error
```
┌──────────────────────────────────┐
│ ⚠️ Failed to load VODs           │
└──────────────────────────────────┘
```

### Validation Error
```
┌──────────────────────────────────┐
│ ⚠️ Please select 2-3 VODs        │
└──────────────────────────────────┘
```

### Creation Error
```
┌──────────────────────────────────┐
│ ⚠️ Failed to create session:     │
│    [error details]               │
└──────────────────────────────────┘
```

## Keyboard Navigation

### Tab Order
1. VOD checkboxes (in order)
2. Session Name input
3. Global Sync Mode radio
4. Independent Sync Mode radio
5. Cancel button
6. Create Comparison button
7. Close button (always accessible)

### Shortcuts
- `Escape` - Close modal (if not submitting)
- `Enter` - Submit form (from session name input)
- `Tab` - Navigate between elements
- `Space` - Toggle checkbox/radio

## Accessibility Features

### ARIA Labels
- Modal: `role="dialog"`, `aria-modal="true"`
- Checkboxes: `aria-label="Select {vod_name}"`
- Radios: `aria-label="{mode} sync mode"`
- Input: `aria-label="Session name"`
- Button: `aria-label="Create comparison session"`

### Semantic HTML
- `<label>` for all form controls
- `<input type="checkbox">` for VOD selection
- `<input type="radio">` for sync mode
- `<button type="button">` for actions
- Proper form structure

### Visual Feedback
- Hover states on all interactive elements
- Focus outline on keyboard navigation
- Disabled state styling (reduced opacity)
- Error colors (red/orange) for accessibility
- Icon + text for error messages

## Color Scheme

### Element States
```
Primary Button (Create):
  - Default: #ffb347 (orange)
  - Hover: darker orange
  - Disabled: 50% opacity
  - Active/Loading: same color

Secondary Button (Cancel):
  - Default: #1f3640 (dark blue)
  - Hover: lighter blue
  - Disabled: 50% opacity

Checkbox/Radio:
  - Unchecked: #1f3640 border
  - Checked: #ffb347 background
  - Hover: #ffb347 border

Input Field:
  - Default: #1f3640 border
  - Focus: #ffb347 border
  - Disabled: reduced opacity
  - Error: #ff7043 border

Text:
  - Normal: #f4f7f8 (white)
  - Muted: #9fb0b7 (gray)
  - Error: #ff7043 (red)

Background:
  - Modal: #13242a (card color)
  - Input: #0c171b (darker)
  - Selected: rgba(255, 179, 71, 0.1) (light orange)
```

## Performance Notes

### Optimizations
- VOD list fetch only on modal open
- Debounced form submissions (prevent double-submit)
- Efficient state updates (no unnecessary re-renders)
- CSS transitions for smooth UI
- Lazy loaded images (thumbnails)

### Network
- Single VOD list fetch per modal open
- Single session creation request on submit
- No polling or periodic updates
- Error responses handled immediately

## Browser Compatibility

```
Chrome/Edge: 90+ ✓
Firefox: 88+ ✓
Safari: 14+ ✓
Mobile Safari: 14+ ✓
Chrome Mobile: 90+ ✓
```

All modern CSS and JavaScript features used are well-supported.

---

## Next Steps for QA

1. **Test Entry Points**
   - VODs page "Compare" button
   - VOD Viewer "Compare VODs" button

2. **Test Functionality**
   - VOD list loads correctly
   - Selection limits work (2-3 VODs)
   - Form submission
   - Navigation to comparison page

3. **Test Error Cases**
   - Network errors
   - Validation errors
   - Backend errors

4. **Test UI/UX**
   - Responsive layouts
   - Keyboard navigation
   - Accessibility
   - Visual design

5. **Test Integration**
   - Backend API responses
   - Session creation
   - Navigation parameter passing
