export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const total = Math.round(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const parts = [];
  if (hrs > 0) parts.push(`${hrs} hr`);
  if (mins > 0 || hrs > 0) parts.push(`${mins} min`);
  parts.push(`${secs} sec`);
  return parts.join(" ");
}
