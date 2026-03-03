/**
 * videoFeatureFlags.test.ts
 * 
 * Unit tests for video feature flag manager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getVideoFeatureFlagManager,
  isNativeVideoEnabled,
  setNativeVideoEnabled,
  isVideoTelemetryEnabled,
  isVideoDebugEnabled,
  logVideoFeatureFlags,
} from "./videoFeatureFlags";

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).localStorage = mockLocalStorage;
  mockLocalStorage.getItem.mockReturnValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("VideoFeatureFlagManager", () => {
  beforeEach(() => {
    // Create new manager instance for each test
    const manager = getVideoFeatureFlagManager();
    manager.resetToDefaults();
  });

  describe("initialization", () => {
    it("should initialize with default flags", () => {
      const manager = getVideoFeatureFlagManager();
      const flags = manager.getAllFlags();

      expect(flags).toMatchObject({
        enableNativeVideo: false,
        enableVideoTelemetry: true,
        enableVideoDebug: false,
        nativeVideoSampleRate: 0,
        fallbackOnError: true,
      });
    });

    it("should load flags from environment variables", () => {
      process.env.VITE_NATIVE_VIDEO_ENABLED = "true";
      process.env.VITE_VIDEO_DEBUG_ENABLED = "true";
      process.env.VITE_NATIVE_VIDEO_SAMPLE_RATE = "50";

      const manager = getVideoFeatureFlagManager();
      const flags = manager.getAllFlags();

      expect(flags.enableNativeVideo).toBe(true);
      expect(flags.enableVideoDebug).toBe(true);
      expect(flags.nativeVideoSampleRate).toBe(50);

      // Cleanup
      delete process.env.VITE_NATIVE_VIDEO_ENABLED;
      delete process.env.VITE_VIDEO_DEBUG_ENABLED;
      delete process.env.VITE_NATIVE_VIDEO_SAMPLE_RATE;
    });

    it("should load flags from localStorage", () => {
      const storedFlags = {
        enableNativeVideo: true,
        nativeVideoSampleRate: 75,
      };

      mockLocalStorage.getItem.mockReturnValueOnce(JSON.stringify(storedFlags));

      const manager = getVideoFeatureFlagManager();
      const flags = manager.getAllFlags();

      expect(flags.enableNativeVideo).toBe(true);
      expect(flags.nativeVideoSampleRate).toBe(75);
    });

    it("should handle corrupt localStorage gracefully", () => {
      mockLocalStorage.getItem.mockReturnValueOnce("{ invalid json");

      const manager = getVideoFeatureFlagManager();
      const flags = manager.getAllFlags();

      // Should fall back to defaults
      expect(flags.enableNativeVideo).toBe(false);
    });
  });

  describe("getFlag", () => {
    it("should get individual flag value", () => {
      const manager = getVideoFeatureFlagManager();

      expect(manager.getFlag("enableNativeVideo")).toBe(false);
      expect(manager.getFlag("enableVideoTelemetry")).toBe(true);
      expect(manager.getFlag("nativeVideoSampleRate")).toBe(0);
    });
  });

  describe("setFlag", () => {
    it("should set flag value", () => {
      const manager = getVideoFeatureFlagManager();

      manager.setFlag("enableNativeVideo", true, false);

      expect(manager.getFlag("enableNativeVideo")).toBe(true);
    });

    it("should persist flag to localStorage", () => {
      const manager = getVideoFeatureFlagManager();

      manager.setFlag("enableNativeVideo", true, true);

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      const [key, value] = mockLocalStorage.setItem.mock.calls[0];
      expect(key).toBe("videoFeatureFlags");
      expect(JSON.parse(value).enableNativeVideo).toBe(true);
    });

    it("should not persist when persist is false", () => {
      mockLocalStorage.setItem.mockClear();
      const manager = getVideoFeatureFlagManager();

      manager.setFlag("enableNativeVideo", true, false);

      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    it("should handle localStorage write errors gracefully", () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error("Storage full");
      });

      const manager = getVideoFeatureFlagManager();

      // Should not throw
      expect(() => {
        manager.setFlag("enableNativeVideo", true, true);
      }).not.toThrow();

      expect(manager.getFlag("enableNativeVideo")).toBe(true);
    });
  });

  describe("shouldEnableNativeVideo", () => {
    it("should return false when enableNativeVideo is false", () => {
      const manager = getVideoFeatureFlagManager();
      manager.setFlag("enableNativeVideo", false, false);

      expect(manager.shouldEnableNativeVideo()).toBe(false);
    });

    it("should return true when enableNativeVideo is true and sample rate is 100", () => {
      const manager = getVideoFeatureFlagManager();
      manager.setFlag("enableNativeVideo", true, false);
      manager.setFlag("nativeVideoSampleRate", 100, false);

      expect(manager.shouldEnableNativeVideo()).toBe(true);
    });

    it("should return false when sample rate is 0", () => {
      const manager = getVideoFeatureFlagManager();
      manager.setFlag("enableNativeVideo", true, false);
      manager.setFlag("nativeVideoSampleRate", 0, false);

      expect(manager.shouldEnableNativeVideo()).toBe(false);
    });

    it("should apply sample rate logic", () => {
      const manager = getVideoFeatureFlagManager();
      manager.setFlag("enableNativeVideo", true, false);
      manager.setFlag("nativeVideoSampleRate", 50, false);

      // Result depends on session hash, but should be deterministic
      const result1 = manager.shouldEnableNativeVideo();
      const result2 = manager.shouldEnableNativeVideo();

      expect(result1).toBe(result2); // Should be consistent
      expect(typeof result1).toBe("boolean");
    });

    it("should handle invalid sample rates", () => {
      const manager = getVideoFeatureFlagManager();
      manager.setFlag("enableNativeVideo", true, false);

      manager.setFlag("nativeVideoSampleRate", -10, false);
      expect(manager.shouldEnableNativeVideo()).toBe(false);

      manager.setFlag("nativeVideoSampleRate", 150, false);
      expect(manager.shouldEnableNativeVideo()).toBe(true);
    });
  });

  describe("resetToDefaults", () => {
    it("should reset all flags to defaults", () => {
      const manager = getVideoFeatureFlagManager();

      manager.setFlag("enableNativeVideo", true, false);
      manager.setFlag("nativeVideoSampleRate", 50, false);

      manager.resetToDefaults();

      expect(manager.getFlag("enableNativeVideo")).toBe(false);
      expect(manager.getFlag("nativeVideoSampleRate")).toBe(0);
    });

    it("should clear localStorage on reset", () => {
      const manager = getVideoFeatureFlagManager();

      manager.setFlag("enableNativeVideo", true, true);
      mockLocalStorage.removeItem.mockClear();

      manager.resetToDefaults();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        "videoFeatureFlags"
      );
    });

    it("should handle localStorage clear errors gracefully", () => {
      mockLocalStorage.removeItem.mockImplementation(() => {
        throw new Error("Clear failed");
      });

      const manager = getVideoFeatureFlagManager();

      expect(() => {
        manager.resetToDefaults();
      }).not.toThrow();
    });
  });

  describe("getFlagSource", () => {
    it("should return hardcoded for default flags", () => {
      const manager = getVideoFeatureFlagManager();

      expect(manager.getFlagSource("enableNativeVideo")).toBe("hardcoded");
    });

    it("should return override after setFlag", () => {
      const manager = getVideoFeatureFlagManager();

      manager.setFlag("enableNativeVideo", true, false);

      expect(manager.getFlagSource("enableNativeVideo")).toBe("override");
    });

    it("should return localStorage for persisted flags", () => {
      const storedFlags = {
        enableNativeVideo: true,
      };

      mockLocalStorage.getItem.mockReturnValueOnce(JSON.stringify(storedFlags));

      const manager = getVideoFeatureFlagManager();

      expect(manager.getFlagSource("enableNativeVideo")).toBe("localStorage");
    });

    it("should return env for environment variables", () => {
      process.env.VITE_NATIVE_VIDEO_ENABLED = "true";

      const manager = getVideoFeatureFlagManager();

      expect(manager.getFlagSource("enableNativeVideo")).toBe("env");

      delete process.env.VITE_NATIVE_VIDEO_ENABLED;
    });
  });

  describe("convenience functions", () => {
    it("isNativeVideoEnabled should use shouldEnableNativeVideo", () => {
      const manager = getVideoFeatureFlagManager();
      manager.setFlag("enableNativeVideo", true, false);
      manager.setFlag("nativeVideoSampleRate", 100, false);

      expect(isNativeVideoEnabled()).toBe(true);
    });

    it("isVideoTelemetryEnabled should check flag", () => {
      const manager = getVideoFeatureFlagManager();
      manager.setFlag("enableVideoTelemetry", false, false);

      expect(isVideoTelemetryEnabled()).toBe(false);
    });

    it("isVideoDebugEnabled should check flag", () => {
      const manager = getVideoFeatureFlagManager();
      manager.setFlag("enableVideoDebug", true, false);

      expect(isVideoDebugEnabled()).toBe(true);
    });

    it("setNativeVideoEnabled should update flag", () => {
      setNativeVideoEnabled(true, false);

      expect(isNativeVideoEnabled()).toBe(true);

      setNativeVideoEnabled(false, false);

      expect(isNativeVideoEnabled()).toBe(false);
    });

    it("logVideoFeatureFlags should log debug info", () => {
      const consoleSpy = vi.spyOn(console, "group");

      logVideoFeatureFlags();

      expect(consoleSpy).toHaveBeenCalledWith("🎬 Video Feature Flags");

      consoleSpy.mockRestore();
    });
  });
});
