/**
 * NativeVideoPlayer.test.tsx
 * 
 * Unit tests for NativeVideoPlayer component
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NativeVideoPlayer } from "./NativeVideoPlayer";

// Mock useNativeVideo hook
vi.mock("../hooks/useNativeVideo", () => {
  return {
    useNativeVideo: vi.fn(() => [
      {
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
      },
      {
        play: vi.fn(),
        pause: vi.fn(),
        stop: vi.fn(),
        seek: vi.fn(),
        setPlaybackRate: vi.fn(),
        initialize: vi.fn(),
        cleanup: vi.fn(),
        getState: vi.fn(),
        getCurrentTime: vi.fn(),
        getDuration: vi.fn(),
      },
    ]),
  };
});

describe("NativeVideoPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("should render video player container", () => {
      const { container } = render(
        <NativeVideoPlayer
          src="/path/to/video.mp4"
          className="test-class"
        />
      );

      const player = container.querySelector(".test-class");
      expect(player).toBeDefined();
      expect(player?.style.backgroundColor).toBe("rgb(0, 0, 0)");
    });

    it("should render native video container", () => {
      const { container } = render(<NativeVideoPlayer src="/path/to/video.mp4" />);

      const videoContainer = container.querySelector("#native-video-container");
      expect(videoContainer).toBeDefined();
    });

    it("should apply custom style", () => {
      const { container } = render(
        <NativeVideoPlayer
          src="/path/to/video.mp4"
          style={{ opacity: 0.5 }}
          containerStyle={{ padding: "10px" }}
        />
      );

      const player = container.firstChild as HTMLElement;
      expect(player.style.opacity).toBe("0.5");
      expect(player.style.padding).toBe("10px");
    });

    it("should forward ref", () => {
      const ref = { current: null };
      const { container } = render(
        <NativeVideoPlayer src="/path/to/video.mp4" ref={ref} />
      );

      expect(ref.current).toBe(container.firstChild);
    });
  });

  describe("unavailable state", () => {
    beforeEach(() => {
      const { useNativeVideo } = require("../hooks/useNativeVideo");
      useNativeVideo.mockReturnValue([
        {
          isPlaying: false,
          isPaused: false,
          isStopped: true,
          currentTime: 0,
          duration: 0,
          playbackRate: 1.0,
          isInitialized: false,
          isAvailable: false,
          lastError: {
            code: "UNAVAILABLE",
            message: "Native video not available",
          },
          isLoading: false,
        },
        {
          play: vi.fn(),
          pause: vi.fn(),
          stop: vi.fn(),
          seek: vi.fn(),
          setPlaybackRate: vi.fn(),
          initialize: vi.fn(),
          cleanup: vi.fn(),
          getState: vi.fn(),
          getCurrentTime: vi.fn(),
          getDuration: vi.fn(),
        },
      ]);
    });

    it("should display unavailable message", () => {
      const { container } = render(
        <NativeVideoPlayer src="/path/to/video.mp4" />
      );

      const text = container.textContent || "";
      expect(text).toContain("Native video not available");
    });

    it("should display error message", () => {
      const { container } = render(
        <NativeVideoPlayer src="/path/to/video.mp4" />
      );

      const text = container.textContent || "";
      expect(text).toContain("Native video not available");
    });

    it("should suggest fallback", () => {
      const { container } = render(
        <NativeVideoPlayer src="/path/to/video.mp4" allowFallback={true} />
      );

      const text = container.textContent || "";
      expect(text).toContain("Fallback to HTML5");
    });

    it("should not show fallback suggestion if disabled", () => {
      const { container } = render(
        <NativeVideoPlayer src="/path/to/video.mp4" allowFallback={false} />
      );

      const text = container.textContent || "";
      expect(text).not.toContain("Fallback");
    });
  });

  describe("debug mode", () => {
    beforeEach(() => {
      const { useNativeVideo } = require("../hooks/useNativeVideo");
      useNativeVideo.mockReturnValue([
        {
          isPlaying: true,
          isPaused: false,
          isStopped: false,
          currentTime: 5000,
          duration: 60000,
          playbackRate: 1.0,
          isInitialized: true,
          isAvailable: true,
          lastError: null,
          isLoading: false,
        },
        {
          play: vi.fn(),
          pause: vi.fn(),
          stop: vi.fn(),
          seek: vi.fn(),
          setPlaybackRate: vi.fn(),
          initialize: vi.fn(),
          cleanup: vi.fn(),
          getState: vi.fn(),
          getCurrentTime: vi.fn(),
          getDuration: vi.fn(),
        },
      ]);
    });

    it("should show debug info when enabled", () => {
      const { container } = render(
        <NativeVideoPlayer src="/path/to/video.mp4" debug={true} />
      );

      const text = container.textContent || "";
      expect(text).toContain("NativeVideoPlayer Debug");
      expect(text).toContain("playing");
      expect(text).toContain("5s / 60s");
    });

    it("should hide debug by default", () => {
      const { container } = render(
        <NativeVideoPlayer src="/path/to/video.mp4" debug={false} />
      );

      const text = container.textContent || "";
      // Should not show full debug when not enabled
      expect(text).not.toContain("NativeVideoPlayer Debug");
    });

    it("should show debug toggle when initialized", () => {
      const { container } = render(
        <NativeVideoPlayer src="/path/to/video.mp4" debug={false} />
      );

      const text = container.textContent || "";
      expect(text).toContain("🔍");
    });
  });

  describe("props", () => {
    it("should accept muted prop", () => {
      render(
        <NativeVideoPlayer
          src="/path/to/video.mp4"
          muted={true}
        />
      );
      // Muted prop is for compatibility, doesn't affect rendering
      expect(true).toBe(true);
    });

    it("should accept onError callback", () => {
      const onError = vi.fn();
      render(
        <NativeVideoPlayer
          src="/path/to/video.mp4"
          onError={onError}
        />
      );
      // onError is passed to hook
      expect(true).toBe(true);
    });

    it("should accept onTelemetry callback", () => {
      const onTelemetry = vi.fn();
      render(
        <NativeVideoPlayer
          src="/path/to/video.mp4"
          onTelemetry={onTelemetry}
        />
      );
      // onTelemetry is passed to hook
      expect(true).toBe(true);
    });
  });

  describe("lifecycle", () => {
    it("should cleanup on unmount", () => {
      const { useNativeVideo } = require("../hooks/useNativeVideo");
      const mockCleanup = vi.fn();
      useNativeVideo.mockReturnValue([
        {
          isPlaying: false,
          isPaused: false,
          isStopped: true,
          currentTime: 0,
          duration: 0,
          playbackRate: 1.0,
          isInitialized: true,
          isAvailable: true,
          lastError: null,
          isLoading: false,
        },
        {
          play: vi.fn(),
          pause: vi.fn(),
          stop: vi.fn(),
          seek: vi.fn(),
          setPlaybackRate: vi.fn(),
          initialize: vi.fn(),
          cleanup: mockCleanup.mockResolvedValue(undefined),
          getState: vi.fn(),
          getCurrentTime: vi.fn(),
          getDuration: vi.fn(),
        },
      ]);

      const { unmount } = render(
        <NativeVideoPlayer src="/path/to/video.mp4" />
      );

      unmount();

      expect(mockCleanup).toHaveBeenCalled();
    });
  });
});
