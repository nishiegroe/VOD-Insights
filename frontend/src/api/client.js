export function apiFetch(path, options) {
  return fetch(path, options);
}

export async function apiJson(path, options) {
  const response = await apiFetch(path, options);
  return response.json();
}

export function apiPost(path, options) {
  return apiFetch(path, { method: "POST", ...options });
}