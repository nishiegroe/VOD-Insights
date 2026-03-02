import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMultiVodState } from '../../pages/MultiVodComparison/hooks/useMultiVodState';

describe('useMultiVodState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
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
      }, { timeout: 3000 });

      expect(result.current.state).toEqual(mockData);
      expect(result.current.error).toBeNull();
      expect(global.fetch).toHaveBeenCalledWith('/api/sessions/multi-vod/test-session');
    });

    it('should set error when no sessionId is provided', async () => {
      const { result } = renderHook(() => useMultiVodState(null));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 1000 });

      expect(result.current.error).toBe('No session ID provided');
      expect(result.current.state).toBeNull();
    });

    it('should retry with exponential backoff on fetch failure', async () => {
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

      await waitFor(() => {
        expect(result.current.state).toBeTruthy();
      }, { timeout: 10000 });

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should set error after max retries exhausted', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useMultiVodState('test-session'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 15000 });

      // Error is set after max retries
      expect(result.current.error).toBeTruthy();
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
      }, { timeout: 3000 });

      result.current.updateOffset(0, 5, 'manual', 1.0);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      }, { timeout: 3000 });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/sessions/multi-vod/test-session/offsets',
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });

    it('should retry offset update on failure', async () => {
      const mockData = {
        sessionId: 'test-session',
        vods: [
          { vod_id: '1', name: 'VOD 1', current_time: 0, offset: 0, duration: 3600 },
        ],
        global_playback_state: 'paused',
      };

      global.fetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockData })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockData,
        });

      const { result } = renderHook(() => useMultiVodState('test-session'));

      await waitFor(() => {
        expect(result.current.state).toBeTruthy();
      }, { timeout: 3000 });

      result.current.updateOffset(0, 5, 'manual', 1.0);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(3);
      }, { timeout: 8000 });
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
      }, { timeout: 3000 });

      result.current.updatePlayback('play', 0);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      }, { timeout: 3000 });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/sessions/multi-vod/test-session/playback',
        expect.objectContaining({
          method: 'PUT',
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
      }, { timeout: 3000 });

      result.current.updatePlayback('pause', 10);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      }, { timeout: 3000 });
    });
  });

  describe('Error States', () => {
    it('should handle malformed JSON response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: async () => { throw new Error('Invalid JSON'); },
      });

      const { result } = renderHook(() => useMultiVodState('test-session'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 15000 });

      expect(result.current.error).toBeTruthy();
    });

    it('should not update if sessionId is not available', async () => {
      const { result } = renderHook(() => useMultiVodState(null));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 1000 });

      result.current.updateOffset(0, 5, 'manual', 1.0);
      result.current.updatePlayback('play');

      // With null sessionId, only initial validation fetch happens (0 calls actually)
      expect(global.fetch).toHaveBeenCalledTimes(0);
    });
  });
});
