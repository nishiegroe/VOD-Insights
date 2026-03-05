import { apiFetch, apiJson } from "./client";

export function deleteVod(path) {
  return apiFetch("/api/vods/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
}

export function fetchViewerConfig() {
  return apiJson("/api/config");
}

export function fetchVodSingle(path) {
  return apiJson(`/api/vods/single?path=${encodeURIComponent(path)}`);
}

export function fetchSessionData(path) {
  return apiJson(`/api/session-data?path=${encodeURIComponent(path)}`);
}

export function createClipRange(vodPath, start, end) {
  return apiFetch("/api/clip-range", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vod_path: vodPath, start, end }),
  });
}
