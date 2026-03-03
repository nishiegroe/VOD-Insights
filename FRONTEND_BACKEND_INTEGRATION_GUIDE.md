# Frontend-Backend Integration Guide

**Purpose:** Help Frontend Developer integrate with the multi-VOD backend  
**Created by:** Backend Engineer (Larry the Lobster 🦞)  
**For:** Frontend Dev (Fixing QA issues)

---

## Quick Start

The backend is **ready to go**. You don't need to change anything on the backend side. 

This guide shows you **exactly what to do on the frontend** to make it all work.

---

## Issue 1: sessionId Not Being Passed to Components

### The Problem (From QA Report)
```
❌ CRITICAL: sessionId URL Parameter Not Passed to Components
Tests don't provide sessionId in URL query params
```

### The Solution

**1. Update your app routing to capture sessionId from URL:**

```javascript
// App.jsx or main routing file

import { useSearchParams } from 'react-router-dom';

function App() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');

  if (!sessionId) {
    return <ErrorPage message="No session ID provided" />;
  }

  return <MultiVodComparison sessionId={sessionId} />;
}
```

**2. Update your test setup to include sessionId in URL:**

```javascript
// MultiVodComparison.test.jsx

import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';

describe('MultiVodComparison', () => {
  test('should render with sessionId from URL', () => {
    render(
      <MemoryRouter initialEntries={['/?session=test-session-123']}>
        <MultiVodComparison />
      </MemoryRouter>
    );
    
    // Now sessionId will be available
    expect(screen.getByText(/comparing/i)).toBeInTheDocument();
  });
});
```

**3. Pass sessionId to child components:**

```javascript
// MultiVodComparison.jsx

export function MultiVodComparison({ sessionId }) {
  const [session, setSession] = useState(null);

  useEffect(() => {
    // Fetch session from backend
    fetch(`/api/sessions/multi-vod/${sessionId}`)
      .then(res => res.json())
      .then(data => setSession(data.session))
      .catch(err => console.error('Failed to load session:', err));
  }, [sessionId]);

  if (!session) return <LoadingSpinner />;

  return (
    <div className="multi-vod-comparison">
      <GlobalScrubber sessionId={sessionId} session={session} />
      <div className="vod-grid">
        {session.vods.map(vod => (
          <VodPanel 
            key={vod.vod_id}
            sessionId={sessionId}
            vod={vod}
          />
        ))}
      </div>
      <PlaybackControls sessionId={sessionId} session={session} />
    </div>
  );
}
```

---

## Issue 2: VodPanel Crashes on Undefined VOD

### The Problem (From QA Report)
```
❌ CRITICAL: VodPanel Component Crashes on Undefined VOD
TypeError: Cannot read properties of undefined (reading 'duration')
at VodPanel.jsx:19
```

### The Solution

**1. Add null checks in VodPanel:**

```javascript
// VodPanel.jsx

export function VodPanel({ sessionId, vod }) {
  // ❌ BAD - crashes if vod is undefined
  // const duration = vod.duration || 0;

  // ✅ GOOD - safe null checks
  if (!vod) {
    return <div className="vod-panel-error">VOD not found</div>;
  }

  const duration = vod?.duration ?? 0;
  const currentTime = vod?.current_time ?? 0;
  const offset = vod?.offset ?? 0;

  return (
    <div className="vod-panel">
      <h3>{vod.name || 'Unknown'}</h3>
      <VideoPlayer
        src={vod.path}
        duration={duration}
        currentTime={currentTime}
      />
      <div className="info">
        <span>Duration: {duration.toFixed(1)}s</span>
        <span>Offset: {offset.toFixed(2)}s</span>
        <span>Time: {currentTime.toFixed(2)}s / {duration.toFixed(2)}s</span>
      </div>
    </div>
  );
}
```

**2. Use optional chaining consistently:**

```javascript
// Bad patterns to avoid:
vod.duration           // ❌ crashes if vod is null/undefined
vod.offset || 0        // ⚠️  okay but verbose

// Good patterns:
vod?.duration          // ✅ returns undefined safely
vod?.duration ?? 0     // ✅ returns 0 if undefined
vod?.duration || 0     // ✅ returns 0 if falsy (duration could be 0!)
```

**3. Fix tests to always provide vod:**

```javascript
// VodPanel.test.jsx

const mockVod = {
  vod_id: 'vod-1',
  name: 'Test VOD',
  path: '/test/vod.mp4',
  duration: 600.0,
  current_time: 0.0,
  offset: 0.0,
  playback_state: 'paused',
  // Include all required fields
};

describe('VodPanel', () => {
  test('should render VOD info', () => {
    const { getByText } = render(
      <VodPanel sessionId="test-123" vod={mockVod} />
    );
    
    expect(getByText('Test VOD')).toBeInTheDocument();
    expect(getByText(/Duration: 600/)).toBeInTheDocument();
  });

  test('should handle missing vod gracefully', () => {
    const { getByText } = render(
      <VodPanel sessionId="test-123" vod={null} />
    );
    
    expect(getByText('VOD not found')).toBeInTheDocument();
  });
});
```

---

## Issue 3: Test Timeout on Retry Logic

### The Problem (From QA Report)
```
⚠️ HIGH: useMultiVodState Hook Timeout on Retry Logic
Failing: "should set error after max retries exhausted"
Exponential backoff (1s + 2s + 4s = 7s) exceeds default 5s timeout
```

### The Solution

**1. Increase test timeout in vitest config:**

```javascript
// vitest.config.js

export default defineConfig({
  test: {
    environment: 'jsdom',
    testTimeout: 10000,  // 10 seconds instead of 5
    hookTimeout: 10000,
    // ... rest of config
  }
});
```

**2. Or increase timeout per test:**

```javascript
// useMultiVodState.test.js

describe('useMultiVodState', () => {
  test('should set error after max retries exhausted', async () => {
    // Increase this specific test's timeout
  }, 10000);  // 10 seconds

  test('should handle malformed JSON response', async () => {
    // ...
  }, 10000);
});
```

**3. Or reduce backoff in the actual hook:**

```javascript
// hooks/useMultiVodState.js

const MAX_RETRIES = 3;
const BACKOFF_MULTIPLIER = 1.5;  // 1.5s, 2.25s, 3.375s = 7.125s instead of 7s
// OR
const BACKOFF_MULTIPLIER = 1.2;  // Even shorter

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function retryFetch(url, options) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      
      const delay = Math.pow(BACKOFF_MULTIPLIER, attempt - 1) * 1000;
      await sleep(delay);
    }
  }
}
```

---

## Issue 4: GlobalScrubber Not Rendering

### The Problem (From QA Report)
```
⚠️ HIGH: GlobalScrubber Component Not Rendering
Component not found in DOM
```

### The Solution

**1. Fix test setup to mock the component properly:**

```javascript
// GlobalScrubber.test.jsx

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlobalScrubber } from './GlobalScrubber';

describe('GlobalScrubber', () => {
  const mockSession = {
    session_id: 'test-123',
    global_time: 150.0,
    global_playback_state: 'paused',
    vods: [
      { vod_id: 'vod-1', duration: 1800.0 },
      { vod_id: 'vod-2', duration: 1800.0 }
    ]
  };

  test('should render scrubber', () => {
    const { container } = render(
      <GlobalScrubber 
        sessionId="test-123"
        session={mockSession}
        onSeek={jest.fn()}
      />
    );

    // Look for the actual element (input, div, etc.)
    const scrubber = container.querySelector('[data-testid="global-scrubber"]');
    expect(scrubber).toBeInTheDocument();
  });
});
```

**2. Ensure component exports correctly:**

```javascript
// GlobalScrubber.jsx

export function GlobalScrubber({ sessionId, session, onSeek }) {
  const [isDragging, setIsDragging] = useState(false);

  const maxDuration = Math.max(...session.vods.map(v => v.duration));

  const handleChange = async (newTime) => {
    // Call backend
    const res = await fetch(
      `/api/sessions/multi-vod/${sessionId}/global-seek`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp: newTime })
      }
    );
    const data = await res.json();
    if (onSeek) onSeek(data.session);
  };

  return (
    <div className="global-scrubber">
      <input
        data-testid="global-scrubber"
        type="range"
        min={0}
        max={maxDuration}
        value={session.global_time}
        onChange={e => handleChange(parseFloat(e.target.value))}
        disabled={isDragging}
      />
      <span className="time">{session.global_time.toFixed(2)}s / {maxDuration.toFixed(2)}s</span>
    </div>
  );
}
```

---

## Issue 5: PlaybackControls Keyboard Event Not Triggered

### The Problem (From QA Report)
```
⚠️ MEDIUM: PlaybackControls Keyboard Event Handler Not Triggered
Space key should trigger play/pause
```

### The Solution

**1. Fix event handling in component:**

```javascript
// PlaybackControls.jsx

export function PlaybackControls({ sessionId, session, onPlaybackChange }) {
  const handlePlayPause = async () => {
    const action = session.global_playback_state === 'playing' ? 'pause' : 'play';
    
    const res = await fetch(
      `/api/sessions/multi-vod/${sessionId}/playback`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      }
    );
    const data = await res.json();
    if (onPlaybackChange) onPlaybackChange(data.session);
  };

  // Add keyboard event listener
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [session]);

  const isPlaying = session.global_playback_state === 'playing';

  return (
    <div className="playback-controls">
      <button
        onClick={handlePlayPause}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '⏸ Pause' : '▶ Play'}
      </button>
    </div>
  );
}
```

**2. Fix test to properly simulate keyboard events:**

```javascript
// PlaybackControls.test.jsx

import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('PlaybackControls', () => {
  test('should toggle play/pause on space key', async () => {
    const mockOnPlaybackChange = jest.fn();
    const mockSession = {
      global_playback_state: 'paused'
    };

    render(
      <PlaybackControls
        sessionId="test-123"
        session={mockSession}
        onPlaybackChange={mockOnPlaybackChange}
      />
    );

    // Method 1: Focus and trigger space
    const button = screen.getByLabelText('Play');
    button.focus();
    fireEvent.keyDown(window, { code: 'Space' });

    // Method 2: Use userEvent (better)
    await userEvent.keyboard(' ');

    // Verify the handler was called
    expect(mockOnPlaybackChange).toHaveBeenCalled();
  });
});
```

---

## Complete Integration Example

Here's how all these pieces fit together:

```javascript
// App.jsx - Entry point
import { useSearchParams } from 'react-router-dom';
import { MultiVodComparison } from './pages/MultiVodComparison';

export default function App() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');

  if (!sessionId) {
    return <div>Error: No session provided</div>;
  }

  return <MultiVodComparison sessionId={sessionId} />;
}
```

```javascript
// MultiVodComparison.jsx - Main component
import { useState, useEffect } from 'react';
import { GlobalScrubber } from './components/GlobalScrubber';
import { VodPanel } from './components/VodPanel';
import { PlaybackControls } from './components/PlaybackControls';

export function MultiVodComparison({ sessionId }) {
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  const fetchSession = async () => {
    try {
      const res = await fetch(`/api/sessions/multi-vod/${sessionId}`);
      const data = await res.json();
      
      if (!data.ok) {
        setError(data.error);
        return;
      }
      
      setSession(data.session);
    } catch (err) {
      setError(`Failed to load session: ${err.message}`);
    }
  };

  if (error) return <div className="error">{error}</div>;
  if (!session) return <div className="loading">Loading...</div>;

  return (
    <div className="multi-vod-comparison">
      <GlobalScrubber 
        sessionId={sessionId}
        session={session}
        onSeek={setSession}
      />
      
      <div className="vod-grid">
        {session.vods.map(vod => (
          <VodPanel 
            key={vod.vod_id}
            sessionId={sessionId}
            vod={vod}
          />
        ))}
      </div>
      
      <PlaybackControls 
        sessionId={sessionId}
        session={session}
        onPlaybackChange={setSession}
      />
    </div>
  );
}
```

---

## Testing Checklist for Frontend Dev

- [ ] sessionId is read from URL query parameter
- [ ] sessionId is passed to all child components
- [ ] VodPanel handles null/undefined vod safely
- [ ] GlobalScrubber renders without errors
- [ ] PlaybackControls responds to keyboard (space key)
- [ ] All components fetch from correct API endpoints
- [ ] Error messages are clear and helpful
- [ ] Session state updates after API calls
- [ ] Tests use MemoryRouter with sessionId in initialEntries
- [ ] Test timeout is 10000ms for hooks with retries

---

## Backend Endpoints You'll Call

From the frontend, you'll make these calls:

```javascript
// Fetch session
GET /api/sessions/multi-vod/{sessionId}

// Play/pause/seek
PUT /api/sessions/multi-vod/{sessionId}/playback
{ "action": "play|pause|seek", "timestamp": <optional> }

// Global seek (sync all)
PUT /api/sessions/multi-vod/{sessionId}/global-seek
{ "timestamp": <seconds> }

// Single VOD seek
PUT /api/sessions/multi-vod/{sessionId}/vods/{vodId}/seek
{ "timestamp": <seconds> }

// Update offsets
PUT /api/sessions/multi-vod/{sessionId}/offsets
{ "offsets": { "vod-1": 0, "vod-2": -5 }, "source": "manual" }

// Get offset history
GET /api/sessions/multi-vod/{sessionId}/offset-history
```

All responses follow this format:
```javascript
{
  "ok": true,
  "session": { /* full session object */ },
  "error": null  // or error message if ok: false
}
```

---

## Common Mistakes to Avoid

❌ **Don't:**
```javascript
vod.duration  // crashes if vod is null
session.vods[0]  // crashes if vods is empty
parseFloat(undefined)  // results in NaN
```

✅ **Do:**
```javascript
vod?.duration ?? 0
session?.vods?.[0]
parseFloat(value ?? 0)
```

❌ **Don't:**
```javascript
// Missing sessionId in test
render(<MultiVodComparison />)
```

✅ **Do:**
```javascript
// Include sessionId in URL
render(
  <MemoryRouter initialEntries={['/?session=test-123']}>
    <MultiVodComparison />
  </MemoryRouter>
)
```

---

## Support

For backend questions, refer to:
- `BACKEND_API_DOCS.md` — Full API reference
- `BACKEND_VERIFICATION_STATUS.md` — Backend status & implementation details
- `testing/MANUAL_BACKEND_TESTS.md` — How to test endpoints with curl

---

**Created by: Backend Engineer (Larry the Lobster 🦞)**  
**For: Frontend Developer**  
**Let's ship this! 🚀**
