export const ZOOM_OPTIONS = [
  { label: "±5m", halfSeconds: 5 * 60 },
  { label: "±15m", halfSeconds: 15 * 60 },
  { label: "±30m", halfSeconds: 30 * 60 },
  { label: "Full", halfSeconds: null },
];

export const DEFAULT_FILTERS = {};
export const MANUAL_FILTER_KEY = "__manual__";
export const OTHER_FILTER_KEY = "__other__";

export const SETTINGS_KEYS = {
  zoom: "vodviewer.zoomHalfSeconds",
  collapsed: "vodviewer.bookmarksCollapsed",
  snap: "vodviewer.snapToEvent",
  filters: "vodviewer.eventFilters",
  volume: "vodviewer.volume",
  muted: "vodviewer.muted",
};

export function loadStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore persistence failures.
  }
}

export function keywordFilterKey(keyword) {
  return `kw:${String(keyword || "").trim().toLowerCase()}`;
}

export function classifyEventByKeywords(eventText, source, keywords) {
  if (source === "manual") return MANUAL_FILTER_KEY;
  const text = String(eventText || "").toLowerCase();
  for (const keyword of keywords) {
    const normalized = String(keyword || "").trim().toLowerCase();
    if (!normalized) continue;
    if (text.includes(normalized)) {
      return keywordFilterKey(keyword);
    }
  }
  return OTHER_FILTER_KEY;
}

export function buildEventWindowMap(keywords, rawWindows, fallbackPre, fallbackPost) {
  const normalized = {};
  const source = rawWindows && typeof rawWindows === "object" ? rawWindows : {};
  for (const keyword of keywords || []) {
    const text = String(keyword || "").trim();
    if (!text) continue;
    const row = source[text] || source[text.toLowerCase()] || {};
    const pre = Number(row.pre_seconds ?? fallbackPre);
    const post = Number(row.post_seconds ?? fallbackPost);
    normalized[keywordFilterKey(text)] = {
      pre: Number.isFinite(pre) ? Math.max(0, pre) : Math.max(0, fallbackPre),
      post: Number.isFinite(post) ? Math.max(0, post) : Math.max(0, fallbackPost),
    };
  }
  return normalized;
}

export function getEventColor(filterKey) {
  if (filterKey === MANUAL_FILTER_KEY) return "#7dd3fc";
  if (filterKey === OTHER_FILTER_KEY) return "#cbd5f5";
  if (typeof filterKey === "string" && filterKey.startsWith("kw:")) {
    const normalized = filterKey.replace("kw:", "");
    let hash = 0;
    for (let i = 0; i < normalized.length; i += 1) {
      hash = (hash * 31 + normalized.charCodeAt(i)) % 360;
    }
    return `hsl(${hash}, 70%, 60%)`;
  }
  return "#ffb347";
}
