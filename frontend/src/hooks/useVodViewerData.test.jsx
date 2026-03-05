import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import useVodViewerData from "./useVodViewerData";

vi.mock("../api/vodViewer", () => ({
  fetchViewerConfig: vi.fn(),
  fetchVodSingle: vi.fn(),
  fetchSessionData: vi.fn(),
}));

import { fetchViewerConfig, fetchVodSingle, fetchSessionData } from "../api/vodViewer";

describe("useVodViewerData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads config, vod metadata, and bookmarks", async () => {
    fetchViewerConfig.mockResolvedValueOnce({
      detection: { keywords: ["kill", "assist"] },
      split: { pre_seconds: 5, post_seconds: 10, event_windows: {} },
      ui: {
        overlay_image_path: "overlay.png",
        overlay_enabled: true,
        overlay_x: 0.8,
        overlay_y: 0.9,
        overlay_width: 0.2,
        overlay_opacity: 0.85,
      },
    });

    fetchVodSingle.mockResolvedValue({
      ok: true,
      vod: { sessions: [{ path: "session-1" }] },
    });

    fetchSessionData.mockResolvedValue({
      ok: true,
      bookmarks: [{ seconds: 12, event: "Kill" }],
    });

    const { result } = renderHook(() => useVodViewerData("vod.mp4", null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.selectedSession).toBe("session-1");
    expect(result.current.bookmarks).toHaveLength(1);
    expect(result.current.detectionKeywords).toEqual(["kill", "assist"]);
    expect(result.current.overlayConfig).not.toBeNull();
  });

  it("handles missing vod path", async () => {
    fetchViewerConfig.mockResolvedValueOnce({});

    const { result } = renderHook(() => useVodViewerData("", null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("No VOD path provided");
  });
});
