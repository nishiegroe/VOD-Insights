import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMultiVodState } from '../../pages/MultiVodComparison/hooks/useMultiVodState';

describe('useMultiVodState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Initial Load', () => {
    it('should load session data on mount when sessionId is provided', async () => {
      const mockData = {
        sessionId: 'test-session',
        vods: [
          { vod_id: '1', name: 'VOD 1', current_time: 0, offset: 0, duration: 3600 },
          { vod_id: '2', name: 'VOD 2', current_time: 0, offset: 0, duration: 3600 },
        ],
        global_playback_state: 'paused',
        sync_config: { speed: 1.0 },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const { result } = renderHook(() => useMultiVodState('test-session'));

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.state).toEqual(mockData);
      expect(result.current.error).toBeNull();
      expect(global.fetch).toHaveBeenCalledWith('/api/sessions/multi-vod/test-session');
    });

    it('should set error when no sessionId is provided', async () => {
      const { result } = renderHook(() => useMultiVodState(null));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('No session ID provided');
      expect(result.current.state).toBeNull();
    });

    it('should retry with exponential backoff on fetch failure', async () => {
      vi.useFakeTimers();

      global.fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sessionId: 'test-session',
            vods: [],
            global_playback_state: 'paused',
          }),
        });

      const { result } = renderHook(() => useMultiVodState('test-session'));

      // Fast-forward through retries
      await waitFor(() => vi.advanceTimersByTime(1000));
      await waitFor(() => vi.advanceTimersByTime(2000));

      vi.useRealTimers();

      await waitFor(() => {
        expect(result.current.state).toBeTruthy();
      });

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should set error after max retries exhausted', async () => {
      vi.useFakeTimers();

      global.fetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useMultiVodState('test-session'));

      // Fast-forward through all retries
      await waitFor(() => vi.advanceTimersByTime(1000));
      await waitFor(() => vi.advanceTimersByTime(2000));
      await waitFor(() => vi.advanceTimersByTime(4000));

      vi.useRealTimers();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.state).toBeNull();
    });
  });

  describe('updateOffset', () => {
    it('should update offset and fetch new state', async () => {
      const mockData = {
        sessionId: 'test-session',
        vods: [
          { vod_id: '1', name: 'VOD 1', current_time: 0, offset: 0, duration: 3600 },
        ],
        global_playback_state: 'paused',
      };

      global.fetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockData })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockData, vods: [{ ...mockData.vods[0], offset: 5 }] }),
        });

      const { result } = renderHook(() => useMultiVodState('test-session'));

      await waitFor(() => {
        expect(result.current.state).toBeTruthy();
      });

      result.current.updateOffset(0, 5, 'manual', 1.0);

      await waitFor(() => {
        expect(result.current.state.vods[0].offset).toBe(5);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/sessions/multi-vod/test-session/offsets',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"1"'),
        })
      );
    });

    it('should retry offset update on failure', async () => {
      vi.useFakeTimers();

      const mockData = {
        sessionId: 'test-session',
        vods: [{ vod_id: '1', name: 'VOD 1', current_time: 0, offset: 0 }],
      };

      global.fetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockData })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockData, vods: [{ ...mockData.vods[0], offset: 5 }] }),
        });

      const { result } = renderHook(() => useMultiVodState('test-session'));

      await waitFor(() => {
        expect(result.current.state).toBeTruthy();
      });

      result.current.updateOffset(0, 5);

      await waitFor(() => vi.advanceTimersByTime(1000));

      vi.useRealTimers();

      await waitFor(() => {
        expect(result.current.state.vods[0].offset).toBe(5);
      });
    });
  });

  describe('updatePlayback', () => {
    it('should update playback state', async () => {
      const mockData = {
        sessionId: 'test-session',
        vods: [{ vod_id: '1', name: 'VOD 1', current_time: 0, offset: 0 }],
        global_playback_state: 'paused',
      };

      global.fetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockData })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockData, global_playback_state: 'playing' }),
        });

      const { result } = renderHook(() => useMultiVodState('test-session'));

      await waitFor(() => {
        expect(result.current.state).toBeTruthy();
      });

      result.current.updatePlayback('play', 0);

      await waitFor(() => {
        expect(result.current.state.global_playback_state).toBe('playing');
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/sessions/multi-vod/test-session/playback',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"action":"play"'),
        })
      );
    });

    it('should handle pause action', async () => {
      const mockData = {
        sessionId: 'test-session',
        vods: [{ vod_id: '1', name: 'VOD 1', current_time: 10 }],
        global_playback_state: 'playing',
      };

      global.fetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockData })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockData, global_playback_state: 'paused' }),
        });

      const { result } = renderHook(() => useMultiVodState('test-session'));

      await waitFor(() => {
        expect(result.current.state).toBeTruthy();
      });

      result.current.updatePlayback('pause', 10);

      await waitFor(() => {
        expect(result.current.state.global_playback_state).toBe('paused');
      });
    });
  });

  describe('Error States', () => {
    it('should handle malformed JSON response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
      });

      const { result } = renderHook(() => useMultiVodState('test-session'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should not update if sessionId is not available', async () => {
      const { result } = renderHook(() => useMultiVodState(null));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      result.current.updateOffset(0, 5);
      result.current.updatePlayback('play');

      expect(global.fetch).toHaveBeenCalledTimes(1); // Only initial fetch attempt
    });
  });
});
