export async function fetchCaptureConfig() {
  const response = await fetch("/api/config");
  return response.json();
}

export async function saveCaptureArea(payload) {
  return fetch("/capture-area/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
