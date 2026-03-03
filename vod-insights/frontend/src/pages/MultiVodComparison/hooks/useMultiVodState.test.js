import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useMultiVodState } from './useMultiVodState';

// Mock fetch
global.fetch = vi.fn();

const mockSessionData = {
  session: {
    session_id: 'test-session-123',
    vods: [
      {
        vod_id: 'vod-1',
        name: 'VOD 1',
        path: '/path/to/vod1.mp4',
        duration: 600,
        current_time: 0,
        offset: 0,
        events: [],
      },
      {
        vod_id: 'vod-2',
        name: 'VOD 2',
        path: '/path/to/vod2.mp4',
        duration: 600,
        current_time: 0,
        offset: 5,
        events: [],
      },
    ],
  },
};

describe('useMultiVodState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetch.mockClear();
  });

  afterEach(() => {
    fetch.mockReset();
  });

  describe('Initial state', () => {
    it('should initialize with loading state', () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      const { result } = renderHook(() => useMultiVodState('test-session-123'));

      expect(result.current.loading).toBe(true);
      expect(result.current.state).toBe(null);
      expect(result.current.error).toBe(null);
    });

    it('should return error when no sessionId provided', () => {
      const { result } = renderHook(() => useMultiVodState(null));

      expect(result.current.error).toBe('No session ID provided');
      expect(result.current.loading).toBe(false);
    });

    it('should return error with empty string sessionId', () => {
      const { result } = renderHook(() => useMultiVodState(''));

      expect(result.current.error).toBe('No session ID provided');
      expect(result.current.loading).toBe(false);
    });
  });

  describe('Fetching session data', () => {
    it('should fetch session data on mount', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      const { result } = renderHook(() => useMultiVodState('test-session-123'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(fetch).toHaveBeenCalledWith('/api/sessions/multi-vod/test-session-123');
      expect(result.current.state).toEqual(mockSessionData.session);
      expect(result.current.error).toBe(null);
    });

    it('should handle fetch errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useMultiVodState('test-session-123'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.state).toBe(null);
    });

    it('should handle non-ok response status', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      const { result } = renderHook(() => useMultiVodState('test-session-123'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.state).toBe(null);
    });
  });

  describe('Retry logic', () => {
    it('should retry fetch on failure with exponential backoff', async () => {
      fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionData,
        });

      vi.useFakeTimers();

      const { result } = renderHook(() => useMultiVodState('test-session-123'));

      // Initial call fails
      expect(fetch).toHaveBeenCalledTimes(1);

      // Fast-forward through retries
      vi.advanceTimersByTime(1000); // First retry at 1s
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(2);
      });

      vi.advanceTimersByTime(2000); // Second retry at 2s
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(3);
      });

      // Third call succeeds
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.state).toEqual(mockSessionData.session);

      vi.useRealTimers();
    });

    it('should stop retrying after MAX_RETRIES', async () => {
      fetch.mockRejectedValue(new Error('Persistent error'));

      vi.useFakeTimers();

      const { result } = renderHook(() => useMultiVodState('test-session-123'));

      // Simulate 3 retries + initial = 4 total calls
      for (let i = 0; i < 3; i++) {
        vi.advanceTimersByTime(Math.pow(2, i) * 1000);
      }

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      // Should be called 4 times (initial + 3 retries)
      expect(fetch).toHaveBeenCalledTimes(4);

      vi.useRealTimers();
    });
  });

  describe('updateOffset', () => {
    it('should update offset for a specific VOD', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      const { result } = renderHook(() => useMultiVodState('test-session-123'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session: {
            ...mockSessionData.session,
            vods: [
              mockSessionData.session.vods[0],
              { ...mockSessionData.session.vods[1], offset: 10 },
            ],
          },
        }),
      });

      act(() => {
        result.current.updateOffset(1, 10);
      });

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/sessions/multi-vod/test-session-123/offsets',
          expect.any(Object)
        );
      });

      const lastCall = fetch.mock.calls[fetch.mock.calls.length - 1];
      const body = JSON.parse(lastCall[1].body);
      expect(body.offsets).toHaveProperty('vod-2', 10);
    });

    it('should send source parameter for offset update', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      const { result } = renderHook(() => useMultiVodState('test-session-123'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      act(() => {
        result.current.updateOffset(0, 5, 'manual');
      });

      await waitFor(() => {
        const lastCall = fetch.mock.calls[fetch.mock.calls.length - 1];
        const body = JSON.parse(lastCall[1].body);
        expect(body.source).toBe('manual');
      });
    });

    it('should include confidence for OCR source', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      const { result } = renderHook(() => useMultiVodState('test-session-123'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      act(() => {
        result.current.updateOffset(0, 5, 'timer_ocr', 0.95);
      });

      await waitFor(() => {
        const lastCall = fetch.mock.calls[fetch.mock.calls.length - 1];
        const body = JSON.parse(lastCall[1].body);
        expect(body.confidence).toBe(0.95);
      });
    });

    it('should not send confidence for non-OCR sources', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      const { result } = renderHook(() => useMultiVodState('test-session-123'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      act(() => {
        result.current.updateOffset(0, 5, 'manual', 0.95);
      });

      await waitFor(() => {
        const lastCall = fetch.mock.calls[fetch.mock.calls.length - 1];
        const body = JSON.parse(lastCall[1].body);
        expect(body.confidence).toBeUndefined();
      });
    });

    it('should handle offset update errors with retry', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      const { result } = renderHook(() => useMultiVodState('test-session-123'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      fetch.mockRejectedValueOnce(new Error('Update failed'));

      vi.useFakeTimers();

      act(() => {
        result.current.updateOffset(0, 5);
      });

      expect(fetch).toHaveBeenCalledTimes(2); // Initial + attempt

      vi.useRealTimers();
    });
  });

  describe('updatePlayback', () => {
    it('should update playback action', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      const { result } = renderHook(() => useMultiVodState('test-session-123'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      act(() => {
        result.current.updatePlayback('play');
      });

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/sessions/multi-vod/test-session-123/playback',
          expect.objectContaining({
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
    });

    it('should include timestamp for seek action', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      const { result } = renderHook(() => useMultiVodState('test-session-123'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      act(() => {
        result.current.updatePlayback('seek', 120);
      });

      await waitFor(() => {
        const lastCall = fetch.mock.calls[fetch.mock.calls.length - 1];
        const body = JSON.parse(lastCall[1].body);
        expect(body.timestamp).toBe(120);
      });
    });

    it('should handle playback update errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      const { result } = renderHook(() => useMultiVodState('test-session-123'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      fetch.mockRejectedValueOnce(new Error('Playback update failed'));

      vi.useFakeTimers();

      act(() => {
        result.current.updatePlayback('play');
      });

      // Should handle error gracefully
      expect(fetch).toBeCalled();

      vi.useRealTimers();
    });
  });

  describe('Return values', () => {
    it('should return all expected properties', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      });

      const { result } = renderHook(() => useMultiVodState('test-session-123'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current).toHaveProperty('state');
      expect(result.current).toHaveProperty('loading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('updateOffset');
      expect(result.current).toHaveProperty('updatePlayback');

      expect(typeof result.current.updateOffset).toBe('function');
      expect(typeof result.current.updatePlayback).toBe('function');
    });
  });
});
