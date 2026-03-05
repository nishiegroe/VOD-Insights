import { apiJson, apiPost } from "./client";

export function fetchHomeConfig() {
  return apiJson("/api/config");
}

export function fetchRecentVods() {
  return apiJson("/api/vods?limit=5");
}

export function fetchRecentClips() {
  return apiJson("/api/clips?limit=5");
}

export function chooseReplayDir() {
  return apiJson("/api/choose-replay-dir", { method: "POST" });
}

export function startSessionControl() {
  return apiPost("/api/control/start");
}

export function stopSessionControl() {
  return apiPost("/api/control/stop");
}
