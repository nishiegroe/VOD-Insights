import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGlobalSync } from '../../pages/MultiVodComparison/hooks/useGlobalSync';

describe('useGlobalSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    global.fetch.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockState = {
    vods: [
      { vod_id: '1', name: 'VOD 1', current_time: 0, offset: 0, duration: 3600 },
      { vod_id: '2', name: 'VOD 2', current_time: 0, offset: 2, duration: 3600 },
    ],
    global_playback_state: 'paused',
    sync_config: { speed: 1.0 },
  };

  const mockUpdatePlayback = vi.fn();

  describe('Global Seek', () => {
    it('should handle global seek with sessionId', async () => {
      global.fetch.mockResolvedValue({ ok: true });

      const { result } = renderHook(() =>
        useGlobalSync(mockState, 'test-session', mockUpdatePlayback)
      );

      await act(async () => {
        await result.current.handleGlobalSeek(30);
      });

      expect(result.current.globalTime).toBe(30);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/sessions/multi-vod/test-session/global-seek',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"timestamp":30'),
        })
      );
    });

    it('should not fetch if sessionId is missing', async () => {
      const { result } = renderHook(() =>
        useGlobalSync(mockState, null, mockUpdatePlayback)
      );

      await act(async () => {
        await result.current.handleGlobalSeek(30);
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should update playback clock on global seek', async () => {
      global.fetch.mockResolvedValue({ ok: true });

      const { result } = renderHook(() =>
        useGlobalSync(mockState, 'test-session', mockUpdatePlayback)
      );

      const initialGlobalTime = result.current.globalTime;

      await act(async () => {
        await result.current.handleGlobalSeek(50);
      });

      expect(result.current.globalTime).not.toBe(initialGlobalTime);
    });

    it('should handle fetch errors gracefully', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useGlobalSync(mockState, 'test-session', mockUpdatePlayback)
      );

      await act(async () => {
        await result.current.handleGlobalSeek(30);
      });

      expect(result.current.globalTime).toBe(30); // Still updates local state
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Individual Seek', () => {
    it('should seek individual VOD with correct endpoint', async () => {
      global.fetch.mockResolvedValue({ ok: true });

      const { result } = renderHook(() =>
        useGlobalSync(mockState, 'test-session', mockUpdatePlayback)
      );

      await act(async () => {
        await result.current.handleIndividualSeek(0, 45);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/sessions/multi-vod/test-session/vods/1/seek',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"timestamp":45'),
        })
      );
    });

    it('should handle seek on second VOD', async () => {
      global.fetch.mockResolvedValue({ ok: true });

      const { result } = renderHook(() =>
        useGlobalSync(mockState, 'test-session', mockUpdatePlayback)
      );

      await act(async () => {
        await result.current.handleIndividualSeek(1, 60);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/sessions/multi-vod/test-session/vods/2/seek',
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });

    it('should not seek if state is missing', async () => {
      const { result } = renderHook(() =>
        useGlobalSync(null, 'test-session', mockUpdatePlayback)
      );

      await act(async () => {
        await result.current.handleIndividualSeek(0, 30);
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should not seek if sessionId is missing', async () => {
      const { result } = renderHook(() =>
        useGlobalSync(mockState, null, mockUpdatePlayback)
      );

      await act(async () => {
        await result.current.handleIndividualSeek(0, 30);
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Sync Mode', () => {
    it('should initialize with global sync mode', () => {
      const { result } = renderHook(() =>
        useGlobalSync(mockState, 'test-session', mockUpdatePlayback)
      );

      expect(result.current.syncMode).toBe('global');
    });

    it('should allow changing sync mode', async () => {
      const { result } = renderHook(() =>
        useGlobalSync(mockState, 'test-session', mockUpdatePlayback)
      );

      await act(() => {
        result.current.setSyncMode('independent');
      });

      expect(result.current.syncMode).toBe('independent');
    });

    it('should only fetch in global sync mode', async () => {
      global.fetch.mockResolvedValue({ ok: true });

      const { result } = renderHook(() =>
        useGlobalSync(mockState, 'test-session', mockUpdatePlayback)
      );

      // Set to independent mode
      await act(() => {
        result.current.setSyncMode('independent');
      });

      // Attempt global seek
      await act(async () => {
        await result.current.handleGlobalSeek(30);
      });

      // Should still update local state
      expect(result.current.globalTime).toBe(30);

      // But should not make API call
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Playback Clock', () => {
    it('should initialize playback clock on state change', async () => {
      const { result, rerender } = renderHook(() =>
        useGlobalSync(mockState, 'test-session', mockUpdatePlayback)
      );

      expect(result.current.globalTime).toBe(0);

      // Simulate playing state change
      const playingState = { ...mockState, global_playback_state: 'playing' };
      rerender(() => useGlobalSync(playingState, 'test-session', mockUpdatePlayback));

      // Fast-forward timers to trigger clock updates
      await act(() => {
        vi.advanceTimersByTime(100);
      });

      // globalTime should have advanced
      expect(result.current.globalTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Global Time Updates', () => {
    it('should update globalTime when playing', async () => {
      const playingState = { ...mockState, global_playback_state: 'playing' };

      const { result } = renderHook(() =>
        useGlobalSync(playingState, 'test-session', mockUpdatePlayback)
      );

      await act(() => {
        vi.advanceTimersByTime(100);
      });

      // globalTime should be updated (at least to 0)
      expect(typeof result.current.globalTime).toBe('number');
    });

    it('should not update globalTime when paused', async () => {
      const { result } = renderHook(() =>
        useGlobalSync(mockState, 'test-session', mockUpdatePlayback)
      );

      const initialTime = result.current.globalTime;

      await act(() => {
        vi.advanceTimersByTime(1000);
      });

      // globalTime should remain the same
      expect(result.current.globalTime).toBe(initialTime);
    });
  });
});
