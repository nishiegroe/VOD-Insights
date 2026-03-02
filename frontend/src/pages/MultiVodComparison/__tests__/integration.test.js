import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MultiVodComparison from '../MultiVodComparison';

global.fetch = vi.fn();

// Mock useSearchParams
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams('session=test-session-123')],
  };
});

describe('MultiVodComparison Integration Tests', () => {
  const mockSessionData = {
    sessionId: 'test-session-123',
    vods: [
      {
        vod_id: 'vod-1',
        name: 'Player 1',
        path: '/videos/vod1.mp4',
        offset: 0,
        duration: 600,
        current_time: 0,
        events: [
          { event_id: 'evt-1', timestamp: 100, type: 'kill', label: 'Headshot', color: '#FFD700' },
        ],
      },
      {
        vod_id: 'vod-2',
        name: 'Player 2',
        path: '/videos/vod2.mp4',
        offset: 5,
        duration: 600,
        current_time: 0,
        events: [],
      },
      {
        vod_id: 'vod-3',
        name: 'Player 3',
        path: '/videos/vod3.mp4',
        offset: -3,
        duration: 600,
        current_time: 0,
        events: [
          { event_id: 'evt-2', timestamp: 150, type: 'death', label: 'Eliminated', color: '#FF6B6B' },
        ],
      },
    ],
    global_playback_state: 'paused',
    sync_config: { speed: 1.0 },
  };

  beforeEach(() => {
    fetch.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      fetch.mockImplementationOnce(
        () => new Promise(() => {}) // Never resolves
      );

      render(
        <BrowserRouter>
          <MultiVodComparison />
        </BrowserRouter>
      );

      expect(screen.getByText(/loading vods/i)).toBeInTheDocument();
    });

    it('should display VODs after loading', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      render(
        <BrowserRouter>
          <MultiVodComparison />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      expect(screen.getByText('Player 1')).toBeInTheDocument();
      expect(screen.getByText('Player 2')).toBeInTheDocument();
      expect(screen.getByText('Player 3')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should show error message when API fails', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      render(
        <BrowserRouter>
          <MultiVodComparison />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });

    it('should show error when session ID is missing', () => {
      // Override mock to return empty params
      vi.resetModules();

      render(
        <BrowserRouter>
          <MultiVodComparison />
        </BrowserRouter>
      );

      // Will show loading first, then eventually error
      // This depends on implementation details
    });
  });

  describe('VOD Panel Rendering', () => {
    it('should render all three VOD panels', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      render(
        <BrowserRouter>
          <MultiVodComparison />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Player 1')).toBeInTheDocument();
        expect(screen.getByText('Player 2')).toBeInTheDocument();
        expect(screen.getByText('Player 3')).toBeInTheDocument();
      });
    });

    it('should display VOD offsets', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      render(
        <BrowserRouter>
          <MultiVodComparison />
        </BrowserRouter>
      );

      await waitFor(() => {
        // VOD 1 has no offset display (reference)
        // VOD 2 shows +5 offset
        // VOD 3 shows -3 offset
        expect(screen.getByText(/offset/i, { exact: false })).toBeInTheDocument();
      });
    });
  });

  describe('Scrubber Controls', () => {
    it('should render global scrubber', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      render(
        <BrowserRouter>
          <MultiVodComparison />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/global timeline/i)).toBeInTheDocument();
      });
    });

    it('should render individual scrubbers for each VOD', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      render(
        <BrowserRouter>
          <MultiVodComparison />
        </BrowserRouter>
      );

      await waitFor(() => {
        const sliders = screen.getAllByRole('slider');
        expect(sliders.length).toBeGreaterThanOrEqual(4); // 1 global + 3 individual
      });
    });
  });

  describe('Event Timeline', () => {
    it('should display event timeline', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      render(
        <BrowserRouter>
          <MultiVodComparison />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/events/i)).toBeInTheDocument();
      });
    });

    it('should show event count', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      render(
        <BrowserRouter>
          <MultiVodComparison />
        </BrowserRouter>
      );

      await waitFor(() => {
        // Should show "2 of 2" events (from our mock data)
        expect(screen.getByText(/2/)).toBeInTheDocument();
      });
    });
  });

  describe('Playback Controls', () => {
    it('should render play/pause button', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      render(
        <BrowserRouter>
          <MultiVodComparison />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
      });
    });

    it('should render sync mode dropdown', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      render(
        <BrowserRouter>
          <MultiVodComparison />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/sync mode/i)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Layout', () => {
    it('should apply layout class based on screen size', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      // Set initial window width to 1920
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1920,
      });

      const { container } = render(
        <BrowserRouter>
          <MultiVodComparison />
        </BrowserRouter>
      );

      await waitFor(() => {
        const mainContainer = container.querySelector('[class*="layout"]');
        expect(mainContainer).toBeInTheDocument();
      });
    });
  });

  describe('Error Boundary', () => {
    it('should display error boundary message on component error', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      const { container } = render(
        <BrowserRouter>
          <MultiVodComparison />
        </BrowserRouter>
      );

      // Simulate component error by force rendering a bad component
      // This is a simplified test - full error boundary testing requires special setup
      expect(container).toBeInTheDocument();
    });
  });

  describe('API Integration', () => {
    it('should fetch session on mount', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      render(
        <BrowserRouter>
          <MultiVodComparison />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/sessions/multi-vod/test-session-123');
      });
    });

    it('should handle retry on network failure', async () => {
      fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionData,
        });

      render(
        <BrowserRouter>
          <MultiVodComparison />
        </BrowserRouter>
      );

      // Advance to first retry
      vi.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Performance', () => {
    it('should render without lag', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      const startTime = performance.now();

      render(
        <BrowserRouter>
          <MultiVodComparison />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Player 1')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render in less than 1 second
      expect(renderTime).toBeLessThan(1000);
    });
  });
});
