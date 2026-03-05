import { apiFetch, apiJson, apiPost } from "./client";

export function setVodsWizardCompleted(completed) {
  return apiFetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wizard_vods_completed: completed }),
  });
}

export function openBackendLog() {
  return apiPost("/api/open-backend-log");
}

export function fetchVods(all = false) {
  const endpoint = all ? "/api/vods?all=1" : "/api/vods";
  return apiJson(endpoint);
}

export function fetchConfig() {
  return apiJson("/api/config");
}

export function createVodsStream(all = false) {
  const params = new URLSearchParams();
  if (all) {
    params.set("all", "1");
  }
  return new EventSource(`/api/vods/stream?${params.toString()}`);
}

export function splitSelected(vodPath, sessionPath) {
  return apiFetch("/api/split-selected", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vod_path: vodPath, session_path: sessionPath }),
  });
}

export function deleteVod(path) {
  return apiFetch("/api/vods/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
}

export function clearVodSessions(vodPath) {
  return apiFetch("/api/delete-sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vod_path: vodPath }),
  });
}

export function startVodScan(vodPath) {
  return apiFetch("/api/vod-ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vod_path: vodPath }),
  });
}

export function stopVodScan(vodPath) {
  return apiFetch("/api/stop-vod-ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vod_path: vodPath }),
  });
}

export function chooseReplayDir() {
  return apiJson("/api/choose-replay-dir", { method: "POST" });
}

export function uploadVodFile(file, { onProgress, onLoad, onError } = {}) {
  const formData = new FormData();
  formData.append("vod_file", file);

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/vod-ocr-upload");

  if (onProgress) {
    xhr.upload.addEventListener("progress", onProgress);
  }
  if (onLoad) {
    xhr.addEventListener("load", onLoad);
  }
  if (onError) {
    xhr.addEventListener("error", onError);
  }

  xhr.send(formData);
  return xhr;
}