import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchCaptureConfig, saveCaptureArea } from "./captureArea";
import { fetchClipDays, fetchClipsByDay, chooseReplayDir } from "./clips";
import {
  fetchClipByPath,
  fetchOverlayConfig,
  renameClip,
  openClipFolder,
  deleteClip,
  getClipDownloadUrl,
} from "./clipsViewer";
import { fetchOverlayToolConfig, saveOverlayToolConfig } from "./overlayTool";

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("frontend api modules", () => {
  it("fetches capture config", async () => {
    fetch.mockResolvedValueOnce({ json: async () => ({ capture: { left: 1 } }) });
    const payload = await fetchCaptureConfig();
    expect(payload.capture.left).toBe(1);
    expect(fetch).toHaveBeenCalledWith("/api/config");
  });

  it("saves capture area", async () => {
    fetch.mockResolvedValueOnce({ ok: true });
    await saveCaptureArea({ left: 1, top: 2 });
    expect(fetch).toHaveBeenCalledWith(
      "/capture-area/save",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("loads clip days and clip day entries", async () => {
    fetch
      .mockResolvedValueOnce({ json: async () => ({ days: [{ day: "2026-03-05", count: 2 }] }) })
      .mockResolvedValueOnce({
        json: async () => ({ clips: [{ path: "a.mp4" }], total: 1, returned: 1 }),
      });

    const days = await fetchClipDays();
    const byDay = await fetchClipsByDay("2026-03-05", { offset: 0, limit: 5 });

    expect(days).toHaveLength(1);
    expect(byDay.clips).toHaveLength(1);
    expect(fetch).toHaveBeenNthCalledWith(1, "/api/clips/days");
    expect(String(fetch.mock.calls[1][0])).toContain("/api/clips/by-day?");
  });

  it("chooses replay dir", async () => {
    fetch.mockResolvedValueOnce({ json: async () => ({ directory: "C:/vods" }) });
    const payload = await chooseReplayDir();
    expect(payload.directory).toBe("C:/vods");
    expect(fetch).toHaveBeenCalledWith("/api/choose-replay-dir", { method: "POST" });
  });

  it("handles clips viewer endpoints", async () => {
    fetch
      .mockResolvedValueOnce({ json: async () => ({ ok: true, clip: { path: "x.mp4" } }) })
      .mockResolvedValueOnce({ json: async () => ({ ui: {} }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ display_name: "New" }) })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });

    const clipPayload = await fetchClipByPath("x.mp4");
    const overlayPayload = await fetchOverlayConfig();
    const renameResponse = await renameClip("x.mp4", "New");
    const openResponse = await openClipFolder("x.mp4");
    const deleteResponse = await deleteClip("x.mp4");
    const url = getClipDownloadUrl("x.mp4");

    expect(clipPayload.ok).toBe(true);
    expect(overlayPayload.ui).toEqual({});
    expect(renameResponse.ok).toBe(true);
    expect(openResponse.ok).toBe(true);
    expect(deleteResponse.ok).toBe(true);
    expect(url).toContain("/download-path?path=");
  });

  it("handles overlay tool config read and save", async () => {
    fetch
      .mockResolvedValueOnce({ json: async () => ({ ui: { overlay_x: 0.5 } }) })
      .mockResolvedValueOnce({ ok: true });

    const config = await fetchOverlayToolConfig();
    await saveOverlayToolConfig({ x: 0.5, y: 0.6, width: 0.2, opacity: 0.9 });

    expect(config.ui.overlay_x).toBe(0.5);
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/config",
      expect.objectContaining({ method: "POST" })
    );
  });
});
