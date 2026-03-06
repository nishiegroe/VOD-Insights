const INITIAL_CLIPS_PER_DAY = 6;

export async function fetchClipDays() {
  const response = await fetch("/api/clips/days");
  const payload = await response.json();
  return payload.days || [];
}

export async function fetchClipsByDay(dayKey, { offset = 0, limit = INITIAL_CLIPS_PER_DAY } = {}) {
  const params = new URLSearchParams({
    date: dayKey,
    offset: String(offset),
  });
  if (Number.isFinite(limit)) {
    params.set("limit", String(limit));
  }
  const response = await fetch(`/api/clips/by-day?${params.toString()}`);
  return response.json();
}

export async function chooseReplayDir() {
  const response = await fetch("/api/choose-replay-dir", { method: "POST" });
  return response.json();
}
