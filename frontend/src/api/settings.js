import { apiFetch, apiJson, apiPost } from "./client";

export function fetchConfig() {
  return apiJson("/api/config");
}

export function saveConfig(payload) {
  return apiFetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });
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

export function fetchGpuStatus() {
  return apiFetch("/api/ocr-gpu-status");
}

export function fetchLatestUpdate() {
  return apiFetch("/api/update/latest");
}

export function uploadOverlayImage(file) {
  const formData = new FormData();
  formData.append("overlay_image", file);
  return apiFetch("/api/overlay/upload", { method: "POST", body: formData });
}

export function removeOverlayImage() {
  return apiPost("/api/overlay/remove");
}