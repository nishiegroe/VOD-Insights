import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlaybackSync } from '../../pages/MultiVodComparison/hooks/usePlaybackSync';

describe('usePlaybackSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockState = {
    vods: [
      { vod_id: '1', name: 'VOD 1', offset: 0, current_time: 0 },
      { vod_id: '2', name: 'VOD 2', offset: 2, current_time: 0 },
    ],
    global_playback_state: 'paused',
  };

  describe('Video Registration', () => {
    it('should register video elements', () => {
      const { result } = renderHook(() => usePlaybackSync(mockState, 0));

      const mockVideo = document.createElement('video');

      result.current.registerVideoRef(0, mockVideo);
      result.current.registerVideoRef(1, document.createElement('video'));

      expect(result.current.videoRefsRef.current[0]).toBe(mockVideo);
      expect(result.current.videoRefsRef.current[1]).toBeTruthy();
    });

    it('should handle null video element', () => {
      const { result } = renderHook(() => usePlaybackSync(mockState, 0));

      result.current.registerVideoRef(0, null);

      expect(result.current.videoRefsRef.current[0]).toBeNull();
    });

    it('should replace existing video reference', () => {
      const { result } = renderHook(() => usePlaybackSync(mockState, 0));

      const video1 = document.createElement('video');
      const video2 = document.createElement('video');

      result.current.registerVideoRef(0, video1);
      expect(result.current.videoRefsRef.current[0]).toBe(video1);

      result.current.registerVideoRef(0, video2);
      expect(result.current.videoRefsRef.current[0]).toBe(video2);
    });
  });

  describe('Sync Behavior', () => {
    it('should not sync if state is null', () => {
      const { result } = renderHook(() => usePlaybackSync(null, 0));

      expect(result.current.videoRefsRef.current.length).toBe(0);
    });

    it('should not sync if playback state is paused', async () => {
      const { result } = renderHook(() => usePlaybackSync(mockState, 0));

      const video = document.createElement('video');
      video.currentTime = 10;

      result.current.registerVideoRef(0, video);

      await act(() => {
        vi.advanceTimersByTime(500);
      });

      // Should not change currentTime
      expect(video.currentTime).toBe(10);
    });

    it('should resync video when drift exceeds threshold', async () => {
      const playingState = { ...mockState, global_playback_state: 'playing' };
      const globalTime = 20;

      const { result } = renderHook(() => usePlaybackSync(playingState, globalTime));

      const video = document.createElement('video');
      video.currentTime = 20.5; // 500ms drift (exceeds 100ms threshold)

      result.current.registerVideoRef(0, video);

      await act(() => {
        vi.advanceTimersByTime(500);
      });

      // Should be re-synced to expectedTime (globalTime + offset)
      expect(video.currentTime).toBe(globalTime + mockState.vods[0].offset);
    });

    it('should not resync if drift is within threshold', async () => {
      const playingState = { ...mockState, global_playback_state: 'playing' };
      const globalTime = 20;

      const { result } = renderHook(() => usePlaybackSync(playingState, globalTime));

      const video = document.createElement('video');
      video.currentTime = 20.05; // 50ms drift (within 100ms threshold)

      result.current.registerVideoRef(0, video);

      const initialTime = video.currentTime;

      await act(() => {
        vi.advanceTimersByTime(500);
      });

      // Should remain unchanged
      expect(video.currentTime).toBe(initialTime);
    });

    it('should handle multiple VODs with offsets', async () => {
      const playingState = { ...mockState, global_playback_state: 'playing' };
      const globalTime = 20;

      const { result } = renderHook(() => usePlaybackSync(playingState, globalTime));

      const video1 = document.createElement('video');
      const video2 = document.createElement('video');

      video1.currentTime = 10; // Should be 20 (globalTime + offset0)
      video2.currentTime = 10; // Should be 22 (globalTime + offset2)

      result.current.registerVideoRef(0, video1);
      result.current.registerVideoRef(1, video2);

      await act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(video1.currentTime).toBe(20);
      expect(video2.currentTime).toBe(22);
    });
  });

  describe('Cleanup', () => {
    it('should clear resync interval on unmount', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const playingState = { ...mockState, global_playback_state: 'playing' };

      const { unmount } = renderHook(() => usePlaybackSync(playingState, 10));

      await act(() => {
        vi.advanceTimersByTime(100);
      });

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
    });

    it('should handle no video refs during cleanup', () => {
      const playingState = { ...mockState, global_playback_state: 'playing' };

      const { result, unmount } = renderHook(() => usePlaybackSync(playingState, 10));

      // Don't register any videos
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('State Updates', () => {
    it('should resync when globalTime changes', async () => {
      let globalTime = 10;
      const playingState = { ...mockState, global_playback_state: 'playing' };

      const { result, rerender } = renderHook(() => usePlaybackSync(playingState, globalTime));

      const video = document.createElement('video');
      video.currentTime = 10;

      result.current.registerVideoRef(0, video);

      // Update global time
      globalTime = 20;
      rerender(() => usePlaybackSync(playingState, globalTime));

      await act(() => {
        vi.advanceTimersByTime(500);
      });

      // Video should be updated to new global time
      expect(video.currentTime).toBe(20 + mockState.vods[0].offset);
    });

    it('should stop syncing when playback state changes to paused', async () => {
      let playingState = { ...mockState, global_playback_state: 'playing' };

      const { rerender } = renderHook(() => usePlaybackSync(playingState, 20));

      const video = document.createElement('video');
      video.currentTime = 20.5;

      // Change to paused
      playingState = { ...mockState, global_playback_state: 'paused' };
      rerender(() => usePlaybackSync(playingState, 20));

      const pausedTime = video.currentTime;

      await act(() => {
        vi.advanceTimersByTime(500);
      });

      // Time should not change
      expect(video.currentTime).toBe(pausedTime);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing video refs gracefully', async () => {
      const playingState = { ...mockState, global_playback_state: 'playing' };

      const { result } = renderHook(() => usePlaybackSync(playingState, 10));

      // Register only some videos
      result.current.registerVideoRef(0, document.createElement('video'));
      // videoRefsRef.current[1] is undefined

      await act(() => {
        vi.advanceTimersByTime(500);
      });

      // Should not throw error
      expect(true).toBe(true);
    });

    it('should handle VOD with zero offset', async () => {
      const playingState = { ...mockState, global_playback_state: 'playing' };

      const { result } = renderHook(() => usePlaybackSync(playingState, 20));

      const video = document.createElement('video');
      video.currentTime = 10;

      result.current.registerVideoRef(0, video);

      await act(() => {
        vi.advanceTimersByTime(500);
      });

      // Should sync to globalTime + 0
      expect(video.currentTime).toBe(20);
    });

    it('should handle negative offset', async () => {
      const stateWithNegativeOffset = {
        vods: [
          { vod_id: '1', name: 'VOD 1', offset: -2, current_time: 0 },
        ],
        global_playback_state: 'playing',
      };

      const { result } = renderHook(() => usePlaybackSync(stateWithNegativeOffset, 20));

      const video = document.createElement('video');
      video.currentTime = 10;

      result.current.registerVideoRef(0, video);

      await act(() => {
        vi.advanceTimersByTime(500);
      });

      // Should sync to globalTime + offset (20 + (-2) = 18)
      expect(video.currentTime).toBe(18);
    });
  });
});
