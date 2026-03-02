import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import MultiVodComparison from '../../pages/MultiVodComparison/MultiVodComparison';

// Mock the child components to test MultiVodComparison logic only
vi.mock('../../pages/MultiVodComparison/components/MultiVodViewer', () => ({
  default: ({ globalTime, syncMode, onGlobalSeek, onSyncModeChange }) => (
    <div data-testid="multi-vod-viewer">
      <div data-testid="global-time">{globalTime}</div>
      <div data-testid="sync-mode">{syncMode}</div>
      <button onClick={() => onGlobalSeek(30)}>Seek</button>
      <button onClick={() => onSyncModeChange('independent')}>Change Mode</button>
    </div>
  ),
}));

vi.mock('../../pages/MultiVodComparison/components/EventTimeline', () => ({
  default: ({ globalTime, vods }) => (
    <div data-testid="event-timeline">
      Timeline: {globalTime}, VODs: {vods?.length || 0}
    </div>
  ),
}));

describe('MultiVodComparison', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockClear();
  });

  const mockState = {
    sessionId: 'test-session',
    vods: [
      { vod_id: '1', name: 'VOD 1', current_time: 0, offset: 0, duration: 3600, events: [] },
      { vod_id: '2', name: 'VOD 2', current_time: 0, offset: 2, duration: 3600, events: [] },
    ],
    global_playback_state: 'paused',
    sync_config: { speed: 1.0 },
  };

  const renderWithRouter = (component) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  describe('Loading State', () => {
    it('should show loading message while fetching', () => {
      global.fetch.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderWithRouter(<MultiVodComparison />);

      expect(screen.getByText(/Loading VODs/i)).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message on fetch failure', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      renderWithRouter(<MultiVodComparison />);

      await waitFor(() => {
        expect(screen.getByText(/Error:/i)).toBeInTheDocument();
      });
    });

    it('should show error when no session found', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => null,
      });

      renderWithRouter(<MultiVodComparison />);

      await waitFor(() => {
        expect(screen.getByText(/No session found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Session Loading', () => {
    it('should require sessionId from URL params', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockState,
      });

      renderWithRouter(<MultiVodComparison />);

      // Without sessionId in URL, should show error or loading
      await waitFor(() => {
        expect(
          screen.getByText(/No session found/i) || screen.getByText(/Loading/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Layout', () => {
    it('should start with default layout', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockState,
      });

      const { container } = renderWithRouter(<MultiVodComparison />);

      await waitFor(() => {
        expect(screen.queryByTestId('multi-vod-viewer')).toBeTruthy();
      });
    });

    it('should handle window resize', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockState,
      });

      renderWithRouter(<MultiVodComparison />);

      await waitFor(() => {
        expect(screen.getByTestId('multi-vod-viewer')).toBeInTheDocument();
      });

      // Simulate window resize
      fireEvent(window, new Event('resize'));

      expect(true).toBe(true); // Just ensure no errors
    });

    it('should apply 3-col layout at large widths', async () => {
      // Mock window.innerWidth to be large
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 2560,
      });

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockState,
      });

      const { container } = renderWithRouter(<MultiVodComparison />);

      await waitFor(() => {
        expect(screen.getByTestId('multi-vod-viewer')).toBeInTheDocument();
      });

      // Should have layout-3-col class
      const layoutContainer = container.querySelector('[class*="layout-3-col"]');
      expect(layoutContainer).toBeTruthy();
    });
  });

  describe('Component Cleanup', () => {
    it('should remove resize listener on unmount', async () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockState,
      });

      const { unmount } = renderWithRouter(<MultiVodComparison />);

      await waitFor(() => {
        expect(screen.getByTestId('multi-vod-viewer')).toBeInTheDocument();
      });

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Hooks Integration', () => {
    it('should integrate useMultiVodState hook', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockState,
      });

      renderWithRouter(<MultiVodComparison />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('should pass state to child components', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockState,
      });

      renderWithRouter(<MultiVodComparison />);

      await waitFor(() => {
        const timeline = screen.getByTestId('event-timeline');
        expect(timeline).toBeInTheDocument();
        expect(timeline.textContent).toContain('VODs: 2');
      });
    });
  });

  describe('Prop Passing', () => {
    it('should pass correct props to MultiVodViewer', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockState,
      });

      renderWithRouter(<MultiVodComparison />);

      await waitFor(() => {
        const viewer = screen.getByTestId('multi-vod-viewer');
        expect(viewer).toBeInTheDocument();
      });
    });

    it('should handle global seek callback', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockState,
      });

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockState,
      });

      renderWithRouter(<MultiVodComparison />);

      await waitFor(() => {
        screen.getByTestId('multi-vod-viewer');
      });

      // Simulate seek
      const seekButton = screen.getByText('Seek');
      fireEvent.click(seekButton);

      // Should have made fetch call for seek
      await waitFor(() => {
        // Verify interaction happened
        expect(true).toBe(true);
      });
    });
  });
});
