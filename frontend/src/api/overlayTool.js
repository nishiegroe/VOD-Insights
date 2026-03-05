export async function fetchOverlayToolConfig() {
  const response = await fetch("/api/config");
  return response.json();
}

export async function saveOverlayToolConfig(config) {
  return fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      overlay_x: config.x,
      overlay_y: config.y,
      overlay_width: config.width,
      overlay_opacity: config.opacity,
    }),
  });
}
