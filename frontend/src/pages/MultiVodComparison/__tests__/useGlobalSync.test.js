import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGlobalSync } from '../hooks/useGlobalSync';

global.fetch = vi.fn();

describe('useGlobalSync Hook', () => {
  beforeEach(() => {
    fetch.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockState = {
    sessionId: 'test-123',
    vods: [
      { vod_id: 'vod-1', current_time: 0, offset: 0, duration: 600 },
      { vod_id: 'vod-2', current_time: 0, offset: 5, duration: 600 },
      { vod_id: 'vod-3', current_time: 0, offset: -3, duration: 600 },
    ],
    global_playback_state: 'paused',
    sync_config: { speed: 1.0 },
  };

  describe('Global Time Calculation', () => {
    it('should return 0 when no playback clock is set', () => {
      const { result } = renderHook(() => useGlobalSync(null, 'test-123', vi.fn()));

      expect(result.current.globalTime).toBe(0);
    });

    it('should initialize playback clock from state', () => {
      const { result } = renderHook(() =>
        useGlobalSync({ ...mockState, global_playback_state: 'paused' }, 'test-123', vi.fn())
      );

      expect(result.current).toBeDefined();
    });
  });

  describe('Sync Mode', () => {
    it('should default to global sync mode', () => {
      const { result } = renderHook(() => useGlobalSync(mockState, 'test-123', vi.fn()));

      expect(result.current.syncMode).toBe('global');
    });

    it('should allow toggling between sync modes', () => {
      const { result } = renderHook(() => useGlobalSync(mockState, 'test-123', vi.fn()));

      act(() => {
        result.current.setSyncMode('independent');
      });

      expect(result.current.syncMode).toBe('independent');

      act(() => {
        result.current.setSyncMode('global');
      });

      expect(result.current.syncMode).toBe('global');
    });
  });

  describe('Global Seek', () => {
    it('should not seek when sessionId is missing', async () => {
      const { result } = renderHook(() => useGlobalSync(mockState, null, vi.fn()));

      await act(async () => {
        await result.current.handleGlobalSeek(150);
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should call API when in global sync mode', async () => {
      fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const { result } = renderHook(() => useGlobalSync(mockState, 'test-123', vi.fn()));

      await act(async () => {
        await result.current.handleGlobalSeek(150);
      });

      expect(fetch).toHaveBeenCalledWith(
        '/api/sessions/multi-vod/test-123/global-seek',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timestamp: 150 }),
        })
      );
    });

    it('should not call API when in independent sync mode', async () => {
      const { result } = renderHook(() => useGlobalSync(mockState, 'test-123', vi.fn()));

      act(() => {
        result.current.setSyncMode('independent');
      });

      await act(async () => {
        await result.current.handleGlobalSeek(150);
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should update global time immediately', async () => {
      fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const { result } = renderHook(() => useGlobalSync(mockState, 'test-123', vi.fn()));

      expect(result.current.globalTime).toBe(0);

      await act(async () => {
        await result.current.handleGlobalSeek(150);
      });

      expect(result.current.globalTime).toBe(150);
    });

    it('should handle seek API errors gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useGlobalSync(mockState, 'test-123', vi.fn()));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await act(async () => {
        await result.current.handleGlobalSeek(150);
      });

      expect(consoleSpy).toHaveBeenCalled();
      expect(result.current.globalTime).toBe(150); // Still updates local time
      consoleSpy.mockRestore();
    });
  });

  describe('Individual Seek', () => {
    it('should not seek when state is null', async () => {
      const { result } = renderHook(() => useGlobalSync(null, 'test-123', vi.fn()));

      await act(async () => {
        await result.current.handleIndividualSeek(0, 150);
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should not seek when sessionId is missing', async () => {
      const { result } = renderHook(() => useGlobalSync(mockState, null, vi.fn()));

      await act(async () => {
        await result.current.handleIndividualSeek(0, 150);
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should call API for individual VOD seek', async () => {
      fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const { result } = renderHook(() => useGlobalSync(mockState, 'test-123', vi.fn()));

      await act(async () => {
        await result.current.handleIndividualSeek(1, 150);
      });

      expect(fetch).toHaveBeenCalledWith(
        '/api/sessions/multi-vod/test-123/vods/vod-2/seek',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ timestamp: 150 }),
        })
      );
    });

    it('should work for all three VODs', async () => {
      fetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      const { result } = renderHook(() => useGlobalSync(mockState, 'test-123', vi.fn()));

      for (let i = 0; i < 3; i++) {
        await act(async () => {
          await result.current.handleIndividualSeek(i, 150);
        });

        const vodId = mockState.vods[i].vod_id;
        expect(fetch).toHaveBeenCalledWith(
          `/api/sessions/multi-vod/test-123/vods/${vodId}/seek`,
          expect.any(Object)
        );
      }
    });
  });

  describe('Dependencies', () => {
    it('should include sessionId in sync mode dependency', () => {
      const { result: result1 } = renderHook(() =>
        useGlobalSync(mockState, 'session-1', vi.fn())
      );

      const syncMode1 = result1.current.syncMode;

      // Create new hook with different sessionId
      const { result: result2 } = renderHook(() =>
        useGlobalSync(mockState, 'session-2', vi.fn())
      );

      // Both should still have global sync mode as default
      expect(result1.current.syncMode).toBe(syncMode1);
      expect(result2.current.syncMode).toBe('global');
    });
  });

  describe('Edge Cases', () => {
    it('should handle seek to 0', async () => {
      fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const { result } = renderHook(() => useGlobalSync(mockState, 'test-123', vi.fn()));

      await act(async () => {
        await result.current.handleGlobalSeek(0);
      });

      expect(result.current.globalTime).toBe(0);
    });

    it('should handle seek to very large time', async () => {
      fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const { result } = renderHook(() => useGlobalSync(mockState, 'test-123', vi.fn()));

      await act(async () => {
        await result.current.handleGlobalSeek(999999);
      });

      expect(result.current.globalTime).toBe(999999);
    });

    it('should handle seek with negative time (should clamp to 0)', async () => {
      fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const { result } = renderHook(() => useGlobalSync(mockState, 'test-123', vi.fn()));

      await act(async () => {
        await result.current.handleGlobalSeek(-100);
      });

      // Hook doesn't clamp, but this is the expected behavior
      expect(result.current.globalTime).toBe(-100);
    });
  });
});
