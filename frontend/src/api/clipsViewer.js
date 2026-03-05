export async function fetchClipByPath(clipPath) {
  const response = await fetch(`/api/clips/lookup?path=${encodeURIComponent(clipPath)}`);
  return response.json();
}

export async function fetchOverlayConfig() {
  const response = await fetch("/api/config");
  return response.json();
}

export async function renameClip(path, name) {
  return fetch("/api/clip-name", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, name }),
  });
}

export async function openClipFolder(path) {
  return fetch(`/open-folder-path?path=${encodeURIComponent(path)}`, { method: "POST" });
}

export async function deleteClip(path) {
  return fetch(`/delete-path?path=${encodeURIComponent(path)}`, { method: "POST" });
}

export function getClipDownloadUrl(path) {
  return `/download-path?path=${encodeURIComponent(path)}`;
}
