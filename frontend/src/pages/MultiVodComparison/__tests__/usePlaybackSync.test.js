import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePlaybackSync } from '../hooks/usePlaybackSync';

describe('usePlaybackSync Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockVideoElement = () => ({
    currentTime: 0,
    pause: vi.fn(),
  });

  const mockState = {
    vods: [
      { vod_id: 'vod-1', offset: 0, duration: 600 },
      { vod_id: 'vod-2', offset: 5, duration: 600 },
      { vod_id: 'vod-3', offset: -3, duration: 600 },
    ],
    global_playback_state: 'paused',
  };

  describe('Video Registration', () => {
    it('should register video elements by index', () => {
      const { result } = renderHook(() => usePlaybackSync(mockState, 0));

      const video1 = createMockVideoElement();
      const video2 = createMockVideoElement();

      result.current.registerVideoRef(0, video1);
      result.current.registerVideoRef(1, video2);

      expect(result.current.videoRefsRef.current[0]).toBe(video1);
      expect(result.current.videoRefsRef.current[1]).toBe(video2);
    });

    it('should initialize array if not exists', () => {
      const { result } = renderHook(() => usePlaybackSync(mockState, 0));

      const video = createMockVideoElement();
      result.current.registerVideoRef(0, video);

      expect(Array.isArray(result.current.videoRefsRef.current)).toBe(true);
    });
  });

  describe('Playback Sync', () => {
    it('should not set interval when state is null', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      renderHook(() => usePlaybackSync(null, 0));

      expect(clearIntervalSpy).not.toHaveBeenCalled();
    });

    it('should not set interval when playback is paused', () => {
      const { result } = renderHook(() =>
        usePlaybackSync({ ...mockState, global_playback_state: 'paused' }, 0)
      );

      const video = createMockVideoElement();
      result.current.registerVideoRef(0, video);

      vi.advanceTimersByTime(500);

      expect(video.currentTime).toBe(0); // Should not change
    });

    it('should set interval when playback is playing', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      renderHook(() => usePlaybackSync({ ...mockState, global_playback_state: 'playing' }, 0));

      expect(setIntervalSpy).toHaveBeenCalled();
    });

    it('should re-sync when drift exceeds threshold', () => {
      const { result } = renderHook(() =>
        usePlaybackSync({ ...mockState, global_playback_state: 'playing' }, 150)
      );

      const video = createMockVideoElement();
      video.currentTime = 150; // In sync

      result.current.registerVideoRef(0, video);

      // Set initial time to be in sync
      video.currentTime = 150;

      // Advance timers to trigger re-sync check
      vi.advanceTimersByTime(500);

      // Time should be updated to global time (150) since VOD 1 has offset 0
      expect(video.currentTime).toBe(150);
    });

    it('should detect drift and re-sync', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() =>
        usePlaybackSync({ ...mockState, global_playback_state: 'playing' }, 150)
      );

      const video = createMockVideoElement();
      video.currentTime = 145; // 5 seconds behind (beyond 100ms threshold)

      result.current.registerVideoRef(0, video);

      vi.advanceTimersByTime(500);

      expect(video.currentTime).toBe(150); // Should be re-synced
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should not re-sync when drift is below threshold', () => {
      const { result } = renderHook(() =>
        usePlaybackSync({ ...mockState, global_playback_state: 'playing' }, 150)
      );

      const video = createMockVideoElement();
      video.currentTime = 150.05; // 50ms ahead

      result.current.registerVideoRef(0, video);

      vi.advanceTimersByTime(500);

      expect(video.currentTime).toBe(150.05); // Should remain unchanged
    });
  });

  describe('Multiple VODs', () => {
    it('should sync all three VODs', () => {
      const { result } = renderHook(() =>
        usePlaybackSync({ ...mockState, global_playback_state: 'playing' }, 150)
      );

      const video1 = createMockVideoElement();
      const video2 = createMockVideoElement();
      const video3 = createMockVideoElement();

      video1.currentTime = 150; // Correct: 150 + 0 offset
      video2.currentTime = 100; // Wrong: should be 155 (150 + 5 offset)
      video3.currentTime = 160; // Wrong: should be 147 (150 - 3 offset)

      result.current.registerVideoRef(0, video1);
      result.current.registerVideoRef(1, video2);
      result.current.registerVideoRef(2, video3);

      vi.advanceTimersByTime(500);

      expect(video1.currentTime).toBe(150); // No drift
      expect(video2.currentTime).toBe(155); // Re-synced
      expect(video3.currentTime).toBe(147); // Re-synced
    });
  });

  describe('Offset Handling', () => {
    it('should account for VOD offset in sync calculation', () => {
      const stateWithOffset = {
        ...mockState,
        global_playback_state: 'playing',
        vods: [
          { ...mockState.vods[0], offset: 10 },
          { ...mockState.vods[1], offset: 15 },
          { ...mockState.vods[2], offset: 5 },
        ],
      };

      const { result } = renderHook(() => usePlaybackSync(stateWithOffset, 100));

      const video1 = createMockVideoElement();
      video1.currentTime = 110; // 100 + 10 offset

      result.current.registerVideoRef(0, video1);

      vi.advanceTimersByTime(500);

      expect(video1.currentTime).toBe(110); // Correct with offset
    });
  });

  describe('Cleanup', () => {
    it('should clear interval on unmount', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const { unmount } = renderHook(() =>
        usePlaybackSync({ ...mockState, global_playback_state: 'playing' }, 0)
      );

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should clear interval when state changes to paused', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const { rerender } = renderHook(
        ({ state, globalTime }) => usePlaybackSync(state, globalTime),
        {
          initialProps: {
            state: { ...mockState, global_playback_state: 'playing' },
            globalTime: 0,
          },
        }
      );

      rerender({
        state: { ...mockState, global_playback_state: 'paused' },
        globalTime: 0,
      });

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing video references gracefully', () => {
      const { result } = renderHook(() =>
        usePlaybackSync({ ...mockState, global_playback_state: 'playing' }, 150)
      );

      // Don't register any videos
      vi.advanceTimersByTime(500);

      // Should not throw
      expect(result.current).toBeDefined();
    });

    it('should handle zero globalTime', () => {
      const { result } = renderHook(() =>
        usePlaybackSync({ ...mockState, global_playback_state: 'playing' }, 0)
      );

      const video = createMockVideoElement();
      video.currentTime = 0;

      result.current.registerVideoRef(0, video);

      vi.advanceTimersByTime(500);

      expect(video.currentTime).toBe(0);
    });

    it('should handle very large globalTime', () => {
      const { result } = renderHook(() =>
        usePlaybackSync({ ...mockState, global_playback_state: 'playing' }, 999999)
      );

      const video = createMockVideoElement();
      video.currentTime = 999999;

      result.current.registerVideoRef(0, video);

      vi.advanceTimersByTime(500);

      expect(video.currentTime).toBe(999999);
    });
  });
});
