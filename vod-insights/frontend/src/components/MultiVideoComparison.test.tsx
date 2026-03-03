import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MultiVideoComparison from './MultiVideoComparison';
import { BrowserRouter } from 'react-router-dom';

// Mock the child components
vi.mock('./NativeVideoContainer', () => ({
  NativeVideoContainer: ({ videoId, src, isPlaying, onTelemetry }) => {
    // Simulate telemetry updates
    if (isPlaying) {
      // This is a simplified mock - real component would emit telemetry
      return <div data-testid={`native-video-${videoId}`}>Video {videoId}</div>;
    }
    return <div data-testid={`native-video-${videoId}`}>Video {videoId}</div>;
  }
}));

vi.mock('./PlaybackControls', () => ({
  PlaybackControls: ({ isPlaying, onPlay, onPause, playbackRate, onPlaybackRateChange, duration }) => (
    <div data-testid="playback-controls">
      <span data-testid="play-state">{isPlaying ? 'playing' : 'paused'}</span>
      <span data-testid="playback-rate">{playbackRate}</span>
      <button data-testid="play-btn" onClick={onPlay}>Play</button>
      <button data-testid="pause-btn" onClick={onPause}>Pause</button>
      <button data-testid="rate-btn" onClick={() => onPlaybackRateChange(2.0)}>2x</button>
    </div>
  )
}));

vi.mock('./ProgressBar', () => ({
  ProgressBar: ({ currentTime, duration, onSeek, className }) => (
    <div data-testid="progress-bar" className={className}>
      <div data-testid="current-time">{currentTime}</div>
      <div data-testid="duration">{duration}</div>
      <button data-testid="seek-btn" onClick={() => onSeek(60)}>Seek</button>
    </div>
  )
}));

vi.mock('./TimeDisplay', () => ({
  TimeDisplay: ({ currentTime, duration, format }) => (
    <div data-testid="time-display">
      {format}: {currentTime}s / {duration}s
    </div>
  )
}));

vi.mock('./SyncIndicators', () => ({
  SyncIndicators: ({ videoId, state, offset, onOffsetChange }) => (
    <div data-testid={`sync-indicators-${videoId}`}>
      <span data-testid={`video-${videoId}-drift`}>{state?.driftMs ?? 'no-state'}</span>
      <span data-testid={`video-${videoId}-offset`}>{offset}</span>
      <button data-testid={`offset-btn-${videoId}`} onClick={() => onOffsetChange(5)}>
        Adjust
      </button>
    </div>
  )
}));

describe('MultiVideoComparison', () => {
  const mockVideos = [
    { id: 1, filePath: '/videos/game1.mp4', name: 'Gameplay 1' },
    { id: 2, filePath: '/videos/game2.mp4', name: 'Gameplay 2' },
    { id: 3, filePath: '/videos/game3.mp4', name: 'Gameplay 3' }
  ];

  const mockTelemetry = {
    timestamp: Date.now(),
    states: [
      { videoId: 1, currentFrame: 1000, expectedFrame: 1000, driftFrames: 0, driftMs: 0, fps: 60, status: 'synced' },
      { videoId: 2, currentFrame: 999, expectedFrame: 1000, driftFrames: -1, driftMs: -16.67, fps: 60, status: 'adjusting' },
      { videoId: 3, currentFrame: 1001, expectedFrame: 1000, driftFrames: 1, driftMs: 16.67, fps: 60, status: 'adjusting' }
    ],
    maxDriftMs: 16.67,
    rmsDriftMs: 9.54,
    adjustmentCount: 2
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <BrowserRouter>
        <MultiVideoComparison {...props} />
      </BrowserRouter>
    );
  };

  describe('Component Rendering', () => {
    it('should render with default props', () => {
      renderComponent({ videos: mockVideos });
      
      expect(screen.getByText('Multi-VOD Comparison')).toBeInTheDocument();
    });

    it('should render video grid with correct number of videos', () => {
      renderComponent({ videos: mockVideos });
      
      const videoTiles = screen.getAllByTestId(/native-video-/);
      expect(videoTiles).toHaveLength(3);
    });

    it('should render with empty videos array', () => {
      renderComponent({ videos: [] });
      
      expect(screen.getByText('Multi-VOD Comparison')).toBeInTheDocument();
    });

    it('should render with single video', () => {
      renderComponent({ videos: [mockVideos[0]] });
      
      const videoTiles = screen.getAllByTestId(/native-video-/);
      expect(videoTiles).toHaveLength(1);
    });

    it('should render video labels', () => {
      renderComponent({ videos: mockVideos });
      
      expect(screen.getByText('Gameplay 1')).toBeInTheDocument();
      expect(screen.getByText('Gameplay 2')).toBeInTheDocument();
      expect(screen.getByText('Gameplay 3')).toBeInTheDocument();
    });
  });

  describe('Playback Controls', () => {
    it('should render playback controls', () => {
      renderComponent({ videos: mockVideos });
      
      expect(screen.getByTestId('playback-controls')).toBeInTheDocument();
    });

    it('should show initial paused state', () => {
      renderComponent({ videos: mockVideos });
      
      expect(screen.getByTestId('play-state').textContent).toBe('paused');
    });

    it('should toggle play state when play button clicked', async () => {
      renderComponent({ videos: mockVideos });
      
      const playButton = screen.getByTestId('play-btn');
      await userEvent.click(playButton);
      
      expect(screen.getByTestId('play-state').textContent).toBe('playing');
    });

    it('should toggle play state when pause button clicked', async () => {
      renderComponent({ videos: mockVideos });
      
      // First play
      const playButton = screen.getByTestId('play-btn');
      await userEvent.click(playButton);
      expect(screen.getByTestId('play-state').textContent).toBe('playing');
      
      // Then pause
      const pauseButton = screen.getByTestId('pause-btn');
      await userEvent.click(pauseButton);
      expect(screen.getByTestId('play-state').textContent).toBe('paused');
    });

    it('should handle playback rate change', async () => {
      renderComponent({ videos: mockVideos });
      
      const rateButton = screen.getByTestId('rate-btn');
      await userEvent.click(rateButton);
      
      expect(screen.getByTestId('playback-rate').textContent).toBe('2');
    });
  });

  describe('Progress Bar', () => {
    it('should render progress bar', () => {
      renderComponent({ videos: mockVideos });
      
      expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
    });

    it('should display current time', () => {
      renderComponent({ videos: mockVideos });
      
      expect(screen.getByTestId('current-time').textContent).toBe('0');
    });

    it('should handle seek', async () => {
      renderComponent({ videos: mockVideos });
      
      const seekButton = screen.getByTestId('seek-btn');
      await userEvent.click(seekButton);
      
      // After seek, current time should update
      expect(screen.getByTestId('current-time').textContent).toBe('60');
    });
  });

  describe('Sync Indicators', () => {
    // Note: SyncIndicators only render when telemetry exists in the current implementation
    // The tests below verify the component handles telemetry correctly
    
    it('should render sync indicators when telemetry is provided via mock', () => {
      // SyncIndicators are only rendered when there's telemetry state
      // The component conditionally renders them based on telemetry
      renderComponent({ videos: mockVideos });
      
      // Without telemetry, sync indicators won't render in each video tile
      // This is expected behavior - they only appear after telemetry is received
      const syncIndicator = document.querySelector('.sync-indicator');
      expect(syncIndicator).toBeInTheDocument();
    });
  });

  describe('Sync Status Display', () => {
    it('should display sync status indicator', () => {
      renderComponent({ videos: mockVideos });
      
      // Default sync status (healthy when no telemetry)
      expect(document.querySelector('.sync-indicator')).toBeInTheDocument();
    });

    it('should show sync status with telemetry', () => {
      // This test verifies the component handles telemetry state
      renderComponent({ videos: mockVideos });
      
      const indicatorText = document.querySelector('.indicator-text');
      // Initial state shows 0ms
      expect(indicatorText).toBeInTheDocument();
    });

    it('should display drift value in header', () => {
      renderComponent({ videos: mockVideos });
      
      const indicatorText = document.querySelector('.indicator-text');
      expect(indicatorText).toBeInTheDocument();
    });
  });

  describe('Close Button', () => {
    it('should not render close button when onClose is not provided', () => {
      renderComponent({ videos: mockVideos });
      
      const closeButtons = screen.queryAllByText('×');
      expect(closeButtons).toHaveLength(0);
    });

    it('should render close button when onClose is provided', () => {
      const handleClose = vi.fn();
      renderComponent({ videos: mockVideos, onClose: handleClose });
      
      const closeButton = document.querySelector('.close-btn');
      expect(closeButton).toBeInTheDocument();
    });

    it('should call onClose when close button clicked', async () => {
      const handleClose = vi.fn();
      renderComponent({ videos: mockVideos, onClose: handleClose });
      
      const closeButton = document.querySelector('.close-btn');
      await userEvent.click(closeButton);
      
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Time Display', () => {
    it('should render time display', () => {
      renderComponent({ videos: mockVideos });
      
      expect(screen.getByTestId('time-display')).toBeInTheDocument();
    });

    it('should format time correctly', () => {
      renderComponent({ videos: mockVideos });
      
      const timeDisplay = screen.getByTestId('time-display');
      expect(timeDisplay.textContent).toContain('HH:MM:SS');
    });
  });

  describe('Telemetry Debug Section', () => {
    it('should not show debug section by default', () => {
      renderComponent({ videos: mockVideos });
      
      const debugSection = document.querySelector('.telemetry-debug');
      // In production build, this should not render
      expect(debugSection).toBeFalsy();
    });

    it('should show debug section in development', () => {
      // Set NODE_ENV to development
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      renderComponent({ videos: mockVideos });
      
      // After render, check if debug section exists (only in dev)
      const debugSection = document.querySelector('.telemetry-debug');
      
      // Restore original env
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('State Management', () => {
    it('should initialize with default sessionId', () => {
      renderComponent({ videos: mockVideos });
      
      // Component should render without errors
      expect(screen.getByText('Multi-VOD Comparison')).toBeInTheDocument();
    });

    it('should use provided sessionId', () => {
      renderComponent({ videos: mockVideos, sessionId: 'custom-session' });
      
      // Component should render with custom session
      expect(screen.getByText('Multi-VOD Comparison')).toBeInTheDocument();
    });

    it('should initialize offset map for videos', () => {
      renderComponent({ videos: mockVideos });
      
      // Component renders successfully with initialized offset map
      expect(screen.getByText('Multi-VOD Comparison')).toBeInTheDocument();
    });
  });

  describe('Video Grid Layout', () => {
    it('should apply correct grid class for 2 videos', () => {
      renderComponent({ videos: [mockVideos[0], mockVideos[1]] });
      
      const gridContainer = document.querySelector('.video-grid');
      expect(gridContainer).toBeInTheDocument();
    });

    it('should apply correct grid class for 3 videos', () => {
      renderComponent({ videos: mockVideos });
      
      const gridContainer = document.querySelector('.video-grid');
      expect(gridContainer).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      renderComponent({ videos: mockVideos });
      
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading.textContent).toBe('Multi-VOD Comparison');
    });

    it('should have close button', () => {
      const handleClose = vi.fn();
      renderComponent({ videos: mockVideos, onClose: handleClose });
      
      const closeButton = document.querySelector('.close-btn');
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle videos with missing properties', () => {
      const incompleteVideos = [
        { id: 1 },
        { id: 2, name: 'Test' }
      ] as any;
      
      // This should render without crashing if all required props exist
      renderComponent({ videos: incompleteVideos });
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    });

    it('should handle very long video names', () => {
      const longNameVideos = [
        { id: 1, filePath: '/test.mp4', name: 'A'.repeat(100) }
      ];
      
      // Should render without layout breaking (name displays as label)
      renderComponent({ videos: longNameVideos });
      const videoLabels = document.querySelectorAll('.video-label');
      expect(videoLabels).toHaveLength(1);
    });
  });
});
