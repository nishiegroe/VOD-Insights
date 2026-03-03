/**
 * useNativeVideo.test.ts
 * 
 * Unit tests for useNativeVideo React hook
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useNativeVideo } from "./useNativeVideo";

// Mock videoClient
vi.mock("../services/videoClient", () => {
  const mockListeners = new Map();
  const mockClient = {
    isAvailable: vi.fn(() => true),
    initialize: vi.fn(async () => {}),
    initializePlayer: vi.fn(async () => {}),
    play: vi.fn(async () => {}),
    pause: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    seek: vi.fn(async () => {}),
    setPlaybackRate: vi.fn(async () => {}),
    getState: vi.fn(async () => "stopped"),
    getCurrentTime: vi.fn(async () => 0),
    getDuration: vi.fn(async () => 0),
    shutdown: vi.fn(async () => {}),
    onTelemetry: vi.fn((callback) => {
      if (!mockListeners.has("telemetry")) {
        mockListeners.set("telemetry", []);
      }
      mockListeners.get("telemetry").push(callback);
      return () => {
        const callbacks = mockListeners.get("telemetry");
        const index = callbacks.indexOf(callback);
        if (index > -1) callbacks.splice(index, 1);
      };
    }),
    onError: vi.fn((callback) => {
      if (!mockListeners.has("error")) {
        mockListeners.set("error", []);
      }
      mockListeners.get("error").push(callback);
      return () => {
        const callbacks = mockListeners.get("error");
        const index = callbacks.indexOf(callback);
        if (index > -1) callbacks.splice(index, 1);
      };
    }),
  };

  return {
    getVideoClient: () => mockClient,
    __mockClient: mockClient,
    __mockListeners: mockListeners,
  };
});

describe("useNativeVideo", () => {
  let mockClient: any;
  let mockListeners: any;

  beforeEach(() => {
    const module = require("../services/videoClient");
    mockClient = module.__mockClient;
    mockListeners = module.__mockListeners;

    // Reset mocks
    vi.clearAllMocks();
    mockListeners.clear();

    // Reset mock implementations
    mockClient.isAvailable.mockReturnValue(true);
    mockClient.initialize.mockResolvedValue(undefined);
    mockClient.initializePlayer.mockResolvedValue(undefined);
    mockClient.play.mockResolvedValue(undefined);
    mockClient.pause.mockResolvedValue(undefined);
    mockClient.stop.mockResolvedValue(undefined);
    mockClient.seek.mockResolvedValue(undefined);
    mockClient.setPlaybackRate.mockResolvedValue(undefined);
    mockClient.getState.mockResolvedValue("stopped");
    mockClient.getCurrentTime.mockResolvedValue(0);
    mockClient.getDuration.mockResolvedValue(0);
    mockClient.shutdown.mockResolvedValue(undefined);
  });

  describe("initialization", () => {
    it("should initialize with default state", async () => {
      const { result } = renderHook(() => useNativeVideo());

      await waitFor(() => {
        expect(result.current[0].isAvailable).toBe(true);
      });

      expect(result.current[0]).toMatchObject({
        isPlaying: false,
        isPaused: false,
        isStopped: true,
        currentTime: 0,
        duration: 0,
        playbackRate: 1.0,
        isInitialized: false,
        isAvailable: true,
        lastError: null,
        isLoading: false,
      });
    });

    it("should auto-initialize player when filePath is provided", async () => {
      const { result } = renderHook(() =>
        useNativeVideo({
          filePath: "/path/to/video.mp4",
          autoInitialize: true,
        })
      );

      await waitFor(() => {
        expect(result.current[0].isInitialized).toBe(true);
      });

      expect(mockClient.initializePlayer).toHaveBeenCalledWith(
        "/path/to/video.mp4"
      );
    });

    it("should skip auto-initialization when autoInitialize is false", async () => {
      const { result } = renderHook(() =>
        useNativeVideo({
          filePath: "/path/to/video.mp4",
          autoInitialize: false,
        })
      );

      expect(mockClient.initializePlayer).not.toHaveBeenCalled();
    });

    it("should handle initialization error", async () => {
      const error = new Error("Init failed");
      mockClient.initializePlayer.mockRejectedValueOnce(error);

      const onError = vi.fn();
      const { result } = renderHook(() =>
        useNativeVideo({
          filePath: "/path/to/video.mp4",
          onError,
        })
      );

      await waitFor(() => {
        expect(result.current[0].lastError).toBeDefined();
      });

      expect(onError).toHaveBeenCalled();
      expect(result.current[0].lastError?.code).toBe("INIT_FAILED");
    });
  });

  describe("playback controls", () => {
    it("should play", async () => {
      const { result } = renderHook(() => useNativeVideo());

      await waitFor(() => {
        expect(result.current[0].isAvailable).toBe(true);
      });

      await act(async () => {
        await result.current[1].play();
      });

      expect(mockClient.play).toHaveBeenCalled();
    });

    it("should pause", async () => {
      const { result } = renderHook(() => useNativeVideo());

      await waitFor(() => {
        expect(result.current[0].isAvailable).toBe(true);
      });

      await act(async () => {
        await result.current[1].pause();
      });

      expect(mockClient.pause).toHaveBeenCalled();
    });

    it("should stop", async () => {
      const { result } = renderHook(() => useNativeVideo());

      await waitFor(() => {
        expect(result.current[0].isAvailable).toBe(true);
      });

      await act(async () => {
        await result.current[1].stop();
      });

      expect(mockClient.stop).toHaveBeenCalled();
    });

    it("should seek", async () => {
      const { result } = renderHook(() => useNativeVideo());

      await waitFor(() => {
        expect(result.current[0].isAvailable).toBe(true);
      });

      await act(async () => {
        await result.current[1].seek(5000);
      });

      expect(mockClient.seek).toHaveBeenCalledWith(5000);
    });

    it("should set playback rate", async () => {
      const { result } = renderHook(() => useNativeVideo());

      await waitFor(() => {
        expect(result.current[0].isAvailable).toBe(true);
      });

      await act(async () => {
        await result.current[1].setPlaybackRate(2.0);
      });

      expect(mockClient.setPlaybackRate).toHaveBeenCalledWith(2.0);
      expect(result.current[0].playbackRate).toBe(2.0);
    });
  });

  describe("manual initialization", () => {
    it("should initialize player manually", async () => {
      const { result } = renderHook(() =>
        useNativeVideo({ autoInitialize: false })
      );

      await act(async () => {
        await result.current[1].initialize("/path/to/video.mp4");
      });

      expect(mockClient.initializePlayer).toHaveBeenCalledWith(
        "/path/to/video.mp4"
      );
      expect(result.current[0].isInitialized).toBe(true);
    });

    it("should handle manual initialization error", async () => {
      mockClient.initializePlayer.mockRejectedValueOnce(
        new Error("Init failed")
      );

      const onError = vi.fn();
      const { result } = renderHook(() =>
        useNativeVideo({ autoInitialize: false, onError })
      );

      await act(async () => {
        await expect(
          result.current[1].initialize("/path/to/video.mp4")
        ).rejects.toThrow();
      });

      expect(onError).toHaveBeenCalled();
    });
  });

  describe("telemetry", () => {
    it("should receive telemetry updates", async () => {
      const onTelemetry = vi.fn();
      const { result } = renderHook(() =>
        useNativeVideo({ onTelemetry })
      );

      await waitFor(() => {
        expect(result.current[0].isAvailable).toBe(true);
      });

      // Simulate telemetry
      const telemetryCallbacks = mockListeners.get("telemetry") || [];
      act(() => {
        telemetryCallbacks.forEach((cb: any) => {
          cb({
            currentTime: 5000,
            duration: 60000,
            state: "playing",
            timestamp: Date.now(),
          });
        });
      });

      await waitFor(() => {
        expect(result.current[0].currentTime).toBe(5000);
        expect(result.current[0].duration).toBe(60000);
        expect(result.current[0].isPlaying).toBe(true);
      });

      expect(onTelemetry).toHaveBeenCalled();
    });

    it("should update state based on telemetry", async () => {
      const { result } = renderHook(() => useNativeVideo());

      await waitFor(() => {
        expect(result.current[0].isAvailable).toBe(true);
      });

      const telemetryCallbacks = mockListeners.get("telemetry") || [];
      act(() => {
        telemetryCallbacks.forEach((cb: any) => {
          cb({
            currentTime: 10000,
            duration: 120000,
            state: "paused",
            timestamp: Date.now(),
          });
        });
      });

      await waitFor(() => {
        expect(result.current[0]).toMatchObject({
          currentTime: 10000,
          duration: 120000,
          isPlaying: false,
          isPaused: true,
          isStopped: false,
        });
      });
    });
  });

  describe("error handling", () => {
    it("should receive error events", async () => {
      const onError = vi.fn();
      const { result } = renderHook(() => useNativeVideo({ onError }));

      await waitFor(() => {
        expect(result.current[0].isAvailable).toBe(true);
      });

      const errorCallbacks = mockListeners.get("error") || [];
      act(() => {
        errorCallbacks.forEach((cb: any) => {
          cb({
            code: "TEST_ERROR",
            message: "Test error",
          });
        });
      });

      await waitFor(() => {
        expect(result.current[0].lastError).toBeDefined();
      });

      expect(onError).toHaveBeenCalled();
    });
  });

  describe("unavailable native video", () => {
    it("should handle unavailable native video", async () => {
      mockClient.isAvailable.mockReturnValue(false);

      const onError = vi.fn();
      const { result } = renderHook(() => useNativeVideo({ onError }));

      await waitFor(() => {
        expect(result.current[0].isAvailable).toBe(false);
      });

      expect(result.current[0].lastError).toBeDefined();
      expect(onError).toHaveBeenCalled();
    });

    it("should throw when controls invoked on unavailable client", async () => {
      mockClient.isAvailable.mockReturnValue(false);

      const { result } = renderHook(() => useNativeVideo());

      await waitFor(() => {
        expect(result.current[0].isAvailable).toBe(false);
      });

      await expect(result.current[1].play()).rejects.toThrow();
    });
  });

  describe("cleanup", () => {
    it("should cleanup resources", async () => {
      const { result } = renderHook(() => useNativeVideo());

      await waitFor(() => {
        expect(result.current[0].isAvailable).toBe(true);
      });

      await act(async () => {
        await result.current[1].cleanup();
      });

      expect(mockClient.shutdown).toHaveBeenCalled();
      expect(result.current[0].isInitialized).toBe(false);
    });

    it("should cleanup on unmount", async () => {
      const { unmount } = renderHook(() => useNativeVideo());

      unmount();

      // Verify cleanup was attempted
      expect(mockClient.shutdown).toHaveBeenCalled();
    });
  });

  describe("debug mode", () => {
    it("should log debug messages when enabled", async () => {
      const consoleSpy = vi.spyOn(console, "log");

      const { result } = renderHook(() =>
        useNativeVideo({
          filePath: "/path/to/video.mp4",
          debug: true,
        })
      );

      await waitFor(() => {
        expect(result.current[0].isInitialized).toBe(true);
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[useNativeVideo]"),
        expect.anything()
      );

      consoleSpy.mockRestore();
    });

    it("should not log when debug is disabled", async () => {
      const consoleSpy = vi.spyOn(console, "log");

      renderHook(() =>
        useNativeVideo({
          filePath: "/path/to/video.mp4",
          debug: false,
        })
      );

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("[useNativeVideo]"),
        expect.anything()
      );

      consoleSpy.mockRestore();
    });
  });
});
