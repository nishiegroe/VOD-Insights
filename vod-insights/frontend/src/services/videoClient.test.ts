/**
 * videoClient.test.ts
 * 
 * Unit tests for VideoClient IPC communication wrapper
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import VideoClient, { getVideoClient } from "./videoClient";

// Mock ipcRenderer
const mockIpcRenderer = {
  invoke: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

// Mock window context
beforeEach(() => {
  // Reset mocks
  vi.clearAllMocks();

  // Mock window.aetDesktop and window.ipcRenderer
  (window as any).aetDesktop = { updateApp: vi.fn() };
  (window as any).ipcRenderer = mockIpcRenderer;
});

afterEach(() => {
  delete (window as any).aetDesktop;
  delete (window as any).ipcRenderer;
});

describe("VideoClient", () => {
  let client: VideoClient;

  beforeEach(() => {
    client = new VideoClient();
  });

  describe("initialization", () => {
    it("should initialize successfully in Electron context", async () => {
      await client.initialize();
      expect(client.isAvailable()).toBe(true);
    });

    it("should handle missing ipcRenderer gracefully", async () => {
      delete (window as any).ipcRenderer;
      await client.initialize();
      expect(client.isAvailable()).toBe(false);
    });

    it("should be idempotent", async () => {
      await client.initialize();
      const firstInit = client.isAvailable();
      await client.initialize();
      expect(client.isAvailable()).toBe(firstInit);
    });
  });

  describe("initialization commands", () => {
    beforeEach(async () => {
      await client.initialize();
      mockIpcRenderer.invoke.mockResolvedValue(undefined);
    });

    it("should initialize player with valid file path", async () => {
      await client.initializePlayer("/path/to/video.mp4");
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        "video:initialize",
        "/path/to/video.mp4"
      );
    });

    it("should throw error when not available", async () => {
      const unavailableClient = new VideoClient();
      await expect(unavailableClient.initializePlayer("/path.mp4")).rejects.toThrow();
    });
  });

  describe("playback controls", () => {
    beforeEach(async () => {
      await client.initialize();
      mockIpcRenderer.invoke.mockResolvedValue(undefined);
    });

    it("should invoke play command", async () => {
      await client.play();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith("video:play");
    });

    it("should invoke pause command", async () => {
      await client.pause();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith("video:pause");
    });

    it("should invoke stop command", async () => {
      await client.stop();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith("video:stop");
    });

    it("should invoke seek command with time", async () => {
      await client.seek(5000);
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith("video:seek", 5000);
    });

    it("should reject seek with negative time", async () => {
      await expect(client.seek(-100)).rejects.toThrow();
    });

    it("should reject seek with non-number", async () => {
      await expect(client.seek("1000" as any)).rejects.toThrow();
    });

    it("should invoke setPlaybackRate command", async () => {
      await client.setPlaybackRate(2.0);
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        "video:set-rate",
        2.0
      );
    });

    it("should reject setPlaybackRate with invalid rate", async () => {
      await expect(client.setPlaybackRate(0)).rejects.toThrow();
      await expect(client.setPlaybackRate(-1)).rejects.toThrow();
    });
  });

  describe("state queries", () => {
    beforeEach(async () => {
      await client.initialize();
    });

    it("should get current state", async () => {
      mockIpcRenderer.invoke.mockResolvedValueOnce("playing");
      const state = await client.getState();
      expect(state).toBe("playing");
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith("video:get-state");
    });

    it("should get current time", async () => {
      mockIpcRenderer.invoke.mockResolvedValueOnce(5000);
      const time = await client.getCurrentTime();
      expect(time).toBe(5000);
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith("video:get-time");
    });

    it("should get duration", async () => {
      mockIpcRenderer.invoke.mockResolvedValueOnce(60000);
      const duration = await client.getDuration();
      expect(duration).toBe(60000);
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith("video:get-duration");
    });
  });

  describe("command queue", () => {
    beforeEach(async () => {
      await client.initialize();
      mockIpcRenderer.invoke.mockResolvedValue(undefined);
    });

    it("should queue commands in order", async () => {
      const promises = [
        client.play(),
        client.seek(1000),
        client.pause(),
      ];

      await Promise.all(promises);

      expect(mockIpcRenderer.invoke).toHaveBeenCalledTimes(3);
      // Commands should be processed in order
      const calls = mockIpcRenderer.invoke.mock.calls;
      expect(calls[0][0]).toBe("video:play");
      expect(calls[1][0]).toBe("video:seek");
      expect(calls[2][0]).toBe("video:pause");
    });

    it("should handle command failures gracefully", async () => {
      mockIpcRenderer.invoke.mockRejectedValueOnce(
        new Error("Command failed")
      );

      await expect(client.play()).rejects.toThrow();
      expect(client.getLastError()).toBeDefined();

      // Should still be able to process subsequent commands
      mockIpcRenderer.invoke.mockResolvedValueOnce(undefined);
      await expect(client.pause()).resolves.not.toThrow();
    });
  });

  describe("telemetry", () => {
    beforeEach(async () => {
      await client.initialize();
    });

    it("should register telemetry callback", (done) => {
      const callback = vi.fn((telemetry) => {
        expect(telemetry.currentTime).toBe(5000);
        expect(telemetry.duration).toBe(60000);
        expect(telemetry.state).toBe("playing");
        done();
      });

      client.onTelemetry(callback);

      // Simulate telemetry from main process
      const listener = mockIpcRenderer.on.mock.calls.find(
        (call) => call[0] === "video:telemetry"
      );
      if (listener) {
        listener[1](null, {
          currentTime: 5000,
          duration: 60000,
          state: "playing",
          timestamp: Date.now(),
        });
      }
    });

    it("should unsubscribe from telemetry", () => {
      const callback = vi.fn();
      const unsubscribe = client.onTelemetry(callback);

      unsubscribe();

      // Simulate telemetry
      const listener = mockIpcRenderer.on.mock.calls.find(
        (call) => call[0] === "video:telemetry"
      );
      if (listener) {
        listener[1](null, {
          currentTime: 5000,
          duration: 60000,
          state: "playing",
          timestamp: Date.now(),
        });
      }

      expect(callback).not.toHaveBeenCalled();
    });

    it("should handle telemetry callback errors", () => {
      const errorCallback = vi.fn(() => {
        throw new Error("Callback error");
      });

      client.onTelemetry(errorCallback);

      // Should not throw even if callback throws
      const listener = mockIpcRenderer.on.mock.calls.find(
        (call) => call[0] === "video:telemetry"
      );
      if (listener) {
        expect(() => {
          listener[1](null, {
            currentTime: 5000,
            duration: 60000,
            state: "playing",
            timestamp: Date.now(),
          });
        }).not.toThrow();
      }
    });
  });

  describe("error handling", () => {
    beforeEach(async () => {
      await client.initialize();
    });

    it("should register error callback", (done) => {
      const callback = vi.fn((error) => {
        expect(error.code).toBe("TEST_ERROR");
        expect(error.message).toBe("Test error message");
        done();
      });

      client.onError(callback);

      // Simulate error from main process
      const listener = mockIpcRenderer.on.mock.calls.find(
        (call) => call[0] === "video:error"
      );
      if (listener) {
        listener[1](null, {
          code: "TEST_ERROR",
          message: "Test error message",
        });
      }
    });

    it("should unsubscribe from errors", () => {
      const callback = vi.fn();
      const unsubscribe = client.onError(callback);

      unsubscribe();

      // Simulate error
      const listener = mockIpcRenderer.on.mock.calls.find(
        (call) => call[0] === "video:error"
      );
      if (listener) {
        listener[1](null, {
          code: "TEST_ERROR",
          message: "Test error message",
        });
      }

      expect(callback).not.toHaveBeenCalled();
    });

    it("should store last error", async () => {
      mockIpcRenderer.invoke.mockRejectedValueOnce(new Error("Test error"));

      await expect(client.play()).rejects.toThrow();
      expect(client.getLastError()).toBeDefined();
      expect(client.getLastError()?.code).toBe("INVOCATION_FAILED");
    });
  });

  describe("shutdown", () => {
    beforeEach(async () => {
      await client.initialize();
      mockIpcRenderer.invoke.mockResolvedValue(undefined);
    });

    it("should shutdown gracefully", async () => {
      await client.shutdown();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith("video:shutdown");
      expect(client.isAvailable()).toBe(false);
    });

    it("should handle shutdown errors gracefully", async () => {
      mockIpcRenderer.invoke.mockRejectedValueOnce(new Error("Shutdown failed"));

      await expect(client.shutdown()).resolves.not.toThrow();
    });
  });

  describe("singleton", () => {
    it("should return same instance", () => {
      const first = getVideoClient();
      const second = getVideoClient();
      expect(first).toBe(second);
    });
  });
});
