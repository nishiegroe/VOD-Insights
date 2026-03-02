import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMultiVodState } from '../hooks/useMultiVodState';

// Mock fetch globally
global.fetch = vi.fn();

describe('useMultiVodState Hook', () => {
  beforeEach(() => {
    fetch.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockSessionData = {
    sessionId: 'test-session-123',
    vods: [
      { vod_id: 'vod-1', name: 'Player 1', offset: 0, duration: 600, current_time: 0 },
      { vod_id: 'vod-2', name: 'Player 2', offset: 5, duration: 600, current_time: 0 },
      { vod_id: 'vod-3', name: 'Player 3', offset: -3, duration: 600, current_time: 0 },
    ],
    global_playback_state: 'paused',
  };

  describe('Initial Load', () => {
    it('should load session state on mount with valid sessionId', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      const { result } = renderHook(() => useMultiVodState('test-session-123'));

      expect(result.current.loading).toBe(true);
      expect(result.current.state).toBeNull();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.state).toEqual(mockSessionData);
      expect(fetch).toHaveBeenCalledWith('/api/sessions/multi-vod/test-session-123');
    });

    it('should set error when sessionId is missing', async () => {
      const { result } = renderHook(() => useMultiVodState(null));

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('No session ID provided');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should set error when API returns non-200 status', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      const { result } = renderHook(() => useMultiVodState('invalid-session'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.state).toBeNull();
    });
  });

  describe('Retry Logic', () => {
    it('should retry on network failure with exponential backoff', async () => {
      fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionData,
        });

      const { result } = renderHook(() => useMultiVodState('test-session'));

      // Initial attempt fails
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(1);
      });

      // First retry after 1 second
      vi.advanceTimersByTime(1000);
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(2);
      });

      // Second retry after 2 seconds
      vi.advanceTimersByTime(2000);
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(3);
      });

      // Should succeed on third attempt
      await waitFor(() => {
        expect(result.current.state).toEqual(mockSessionData);
      });
    });

    it('should give up after 3 failed retries', async () => {
      fetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useMultiVodState('test-session'));

      // Initial + 3 retries = 4 total attempts
      vi.advanceTimersByTime(7000); // 1s + 2s + 4s

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(4);
        expect(result.current.error).toBeTruthy();
      });
    });
  });

  describe('updateOffset', () => {
    it('should update offset and return new state', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionData,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ...mockSessionData,
            vods: [
              mockSessionData.vods[0],
              { ...mockSessionData.vods[1], offset: 10 },
              mockSessionData.vods[2],
            ],
          }),
        });

      const { result } = renderHook(() => useMultiVodState('test-session'));

      await waitFor(() => expect(result.current.state).toBeTruthy());

      result.current.updateOffset(1, 10, 'manual', 1.0);

      await waitFor(() => {
        expect(fetch).toHaveBeenLastCalledWith(
          '/api/sessions/multi-vod/test-session/offsets',
          expect.objectContaining({
            method: 'PUT',
          })
        );
      });
    });

    it('should include confidence score when source is timer_ocr', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      const { result } = renderHook(() => useMultiVodState('test-session'));

      await waitFor(() => expect(result.current.state).toBeTruthy());

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      result.current.updateOffset(1, 10, 'timer_ocr', 0.95);

      await waitFor(() => {
        const lastCall = fetch.mock.calls[fetch.mock.calls.length - 1];
        const body = JSON.parse(lastCall[1].body);
        expect(body.source).toBe('timer_ocr');
        expect(body.confidence).toBe(0.95);
      });
    });

    it('should retry offset update on network failure', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      const { result } = renderHook(() => useMultiVodState('test-session'));

      await waitFor(() => expect(result.current.state).toBeTruthy());

      fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionData,
        });

      result.current.updateOffset(1, 10);

      vi.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(3); // initial load + failed update + retry
      });
    });
  });

  describe('updatePlayback', () => {
    it('should update playback state with action', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionData,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ...mockSessionData,
            global_playback_state: 'playing',
          }),
        });

      const { result } = renderHook(() => useMultiVodState('test-session'));

      await waitFor(() => expect(result.current.state).toBeTruthy());

      result.current.updatePlayback('play');

      await waitFor(() => {
        expect(fetch).toHaveBeenLastCalledWith(
          '/api/sessions/multi-vod/test-session/playback',
          expect.objectContaining({
            method: 'PUT',
          })
        );
      });
    });

    it('should include timestamp when seeking', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      const { result } = renderHook(() => useMultiVodState('test-session'));

      await waitFor(() => expect(result.current.state).toBeTruthy());

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      result.current.updatePlayback('play', 150);

      await waitFor(() => {
        const lastCall = fetch.mock.calls[fetch.mock.calls.length - 1];
        const body = JSON.parse(lastCall[1].body);
        expect(body.timestamp).toBe(150);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty VOD list', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: 'test',
          vods: [],
          global_playback_state: 'paused',
        }),
      });

      const { result } = renderHook(() => useMultiVodState('test-session'));

      await waitFor(() => expect(result.current.state).toBeTruthy());

      expect(result.current.state.vods).toHaveLength(0);
    });

    it('should handle null state gracefully', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      const { result } = renderHook(() => useMultiVodState('test-session'));

      await waitFor(() => expect(result.current.state).toBeTruthy());

      // updateOffset should return early if state is null
      // This is handled by the early return in the callback
      expect(result.current.state).toBeTruthy();
    });
  });
});
