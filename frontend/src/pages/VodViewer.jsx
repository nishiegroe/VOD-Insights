import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const ZOOM_OPTIONS = [
  { label: "±5m", halfSeconds: 5 * 60 },
  { label: "±15m", halfSeconds: 15 * 60 },
  { label: "±30m", halfSeconds: 30 * 60 },
  { label: "Full", halfSeconds: null },
];

const DEFAULT_FILTERS = {};
const MANUAL_FILTER_KEY = "__manual__";
const OTHER_FILTER_KEY = "__other__";

const SETTINGS_KEYS = {
  zoom: "vodviewer.zoomHalfSeconds",
  collapsed: "vodviewer.bookmarksCollapsed",
  snap: "vodviewer.snapToEvent",
  filters: "vodviewer.eventFilters",
  volume: "vodviewer.volume",
  muted: "vodviewer.muted",
};

function loadStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore persistence failures.
  }
}

function keywordFilterKey(keyword) {
  return `kw:${String(keyword || "").trim().toLowerCase()}`;
}

function classifyEventByKeywords(eventText, source, keywords) {
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

function getEventColor(filterKey) {
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

export default function VodViewer() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const timelineRef = useRef(null);
  const bookmarkListRef = useRef(null);
  const activeBookmarkRef = useRef(null);

  const vodPath = searchParams.get("path");
  const sessionPath = searchParams.get("session");

  const [bookmarks, setBookmarks] = useState([]);
  const [vodMeta, setVodMeta] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(sessionPath);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detectionKeywords, setDetectionKeywords] = useState([]);
  const [preRollSeconds, setPreRollSeconds] = useState(0);
  const [splitPreSeconds, setSplitPreSeconds] = useState(0);
  const [splitPostSeconds, setSplitPostSeconds] = useState(0);

  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(0);
  const [draggingHandle, setDraggingHandle] = useState(null);
  const [clipStatus, setClipStatus] = useState("");
  const [clipResult, setClipResult] = useState(null);
  const [showClipTools, setShowClipTools] = useState(false);

  const [scrubDragging, setScrubDragging] = useState(false);
  const [rangeDragging, setRangeDragging] = useState(false);
  const [bookmarksCollapsed, setBookmarksCollapsed] = useState(() =>
    loadStored(SETTINGS_KEYS.collapsed, false)
  );
  const [scrubHalfSeconds, setScrubHalfSeconds] = useState(() =>
    loadStored(SETTINGS_KEYS.zoom, 15 * 60)
  );
  const [snapToEvent, setSnapToEvent] = useState(() =>
    loadStored(SETTINGS_KEYS.snap, false)
  );
  const [eventFilters, setEventFilters] = useState(() =>
    loadStored(SETTINGS_KEYS.filters, DEFAULT_FILTERS)
  );
  const [manualMarkers, setManualMarkers] = useState([]);
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const [showEventMenu, setShowEventMenu] = useState(false);
  const [overviewDragging, setOverviewDragging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(() => loadStored(SETTINGS_KEYS.muted, false));
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showVolume, setShowVolume] = useState(false);
  const [volumeValue, setVolumeValue] = useState(() => {
    const stored = loadStored(SETTINGS_KEYS.volume, 1);
    if (typeof stored !== "number" || Number.isNaN(stored)) return 1;
    return Math.max(0, Math.min(1, stored));
  });

  const dragStateRef = useRef({ handle: null, raf: 0, pendingTime: null });
  const durationRef = useRef(0);
  const clipStartRef = useRef(0);
  const clipEndRef = useRef(0);
  const currentTimeRef = useRef(0);
  const clipDefaultsRef = useRef(false);
  const rangeDragOffsetRef = useRef(0);
  const overviewDragOffsetRef = useRef(0);
  const overviewCursorOffsetRef = useRef(0);

  const vodMediaUrl = vodPath
    ? `/media-path?path=${encodeURIComponent(vodPath)}`
    : "";
  const markersStorageKey = vodPath
    ? `vodviewer.manualMarkers.${encodeURIComponent(vodPath)}`
    : null;

  const scrubWindowStart =
    scrubHalfSeconds == null
      ? 0
      : Math.max(0, currentTime - scrubHalfSeconds);
  const scrubWindowEnd =
    scrubHalfSeconds == null
      ? duration || 0
      : Math.min(duration || 0, currentTime + scrubHalfSeconds);
  const scrubWindowSpan = Math.max(1, scrubWindowEnd - scrubWindowStart);

  const toWindowPercent = (time) => {
    const clamped = Math.max(scrubWindowStart, Math.min(scrubWindowEnd, time));
    return ((clamped - scrubWindowStart) / scrubWindowSpan) * 100;
  };

  const fromWindowPercent = (pct) => scrubWindowStart + pct * scrubWindowSpan;

  const normalizeEvent = (eventText) => {
    if (!eventText) return "Event";

    const text = eventText.toLowerCase();
    if (text.includes("squad") && (text.includes("elimination") || text.includes("eliminated"))) {
      return "Squad Wipe";
    }

    const words = eventText.toLowerCase().split(/[\s,]+/);
    const keywordsLower = detectionKeywords.map((k) => k.toLowerCase());
    const matchedKeywords = [];

    for (const word of words) {
      for (const keyword of keywordsLower) {
        if ((word.includes(keyword) || keyword.includes(word)) && !matchedKeywords.includes(keyword)) {
          matchedKeywords.push(keyword);
          break;
        }
      }
    }

    const filteredKeywords = matchedKeywords.filter((kw) => {
      return !matchedKeywords.some((other) => other !== kw && other.includes(kw));
    });

    if (filteredKeywords.length > 0) {
      return filteredKeywords
        .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
        .join(", ");
    }

    const firstWord = eventText.split(/[\s,]+/)[0];
    return firstWord.length > 15 ? `${firstWord.substring(0, 15)}...` : firstWord;
  };

  const timelineEvents = useMemo(() => {
    const configuredKeywords = (detectionKeywords || [])
      .map((keyword) => String(keyword || "").trim())
      .filter(Boolean);

    const autoEvents = (bookmarks || []).map((bookmark, index) => ({
      ...bookmark,
      id: `auto-${index}-${bookmark.seconds}`,
      source: "auto",
      filterKey: classifyEventByKeywords(bookmark.event, "auto", configuredKeywords),
    }));

    const customEvents = (manualMarkers || []).map((marker, index) => ({
      id: marker.id || `manual-${index}-${marker.seconds}`,
      seconds: marker.seconds,
      event: marker.label || "Manual marker",
      ocr: marker.note || "",
      source: "manual",
      filterKey: MANUAL_FILTER_KEY,
    }));

    return [...autoEvents, ...customEvents].sort((a, b) => a.seconds - b.seconds);
  }, [bookmarks, manualMarkers, detectionKeywords]);

  const eventFilterOptions = useMemo(() => {
    const configuredKeywords = Array.from(
      new Set(
        (detectionKeywords || [])
          .map((keyword) => String(keyword || "").trim())
          .filter(Boolean)
      )
    );

    return [
      { key: MANUAL_FILTER_KEY, label: "Manual" },
      ...configuredKeywords.map((keyword) => ({ key: keywordFilterKey(keyword), label: keyword })),
      { key: OTHER_FILTER_KEY, label: "Other" },
    ];
  }, [detectionKeywords]);

  useEffect(() => {
    if (!eventFilterOptions.length) return;
    setEventFilters((prev) => {
      const next = {};
      for (const option of eventFilterOptions) {
        next[option.key] = prev[option.key] ?? true;
      }

      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (
        prevKeys.length === nextKeys.length &&
        nextKeys.every((key) => prev[key] === next[key])
      ) {
        return prev;
      }
      return next;
    });
  }, [eventFilterOptions]);

  const filteredEvents = useMemo(() => {
    return timelineEvents.filter((eventItem) => {
      const key = eventItem.filterKey || OTHER_FILTER_KEY;
      return eventFilters[key] !== false;
    });
  }, [timelineEvents, eventFilters]);

  const nearbyEventIds = useMemo(() => {
    const primaryNearby = filteredEvents.filter(
      (entry) =>
        entry.seconds >= currentTime - splitPreSeconds &&
        entry.seconds <= currentTime + splitPostSeconds
    );

    const secondaryNearby = new Set();
    primaryNearby.forEach((primary) => {
      filteredEvents.forEach((entry) => {
        if (
          entry.seconds >= primary.seconds - splitPreSeconds &&
          entry.seconds <= primary.seconds + splitPostSeconds
        ) {
          secondaryNearby.add(entry.id);
        }
      });
    });

    return secondaryNearby;
  }, [filteredEvents, currentTime, splitPreSeconds, splitPostSeconds]);

  const windowEvents = useMemo(() => {
    return filteredEvents.filter(
      (entry) => entry.seconds >= scrubWindowStart && entry.seconds <= scrubWindowEnd
    );
  }, [filteredEvents, scrubWindowStart, scrubWindowEnd]);

  const densityBins = useMemo(() => {
    if (!duration || duration <= 0) return [];
    const binCount = 120;
    const bins = Array.from({ length: binCount }, () => 0);
    filteredEvents.forEach((entry) => {
      const idx = Math.max(0, Math.min(binCount - 1, Math.floor((entry.seconds / duration) * binCount)));
      bins[idx] += 1;
    });
    const maxCount = Math.max(1, ...bins);
    return bins.map((value) => value / maxCount);
  }, [filteredEvents, duration]);

  const smoothedDensityBins = useMemo(() => {
    if (!densityBins.length) return [];
    return densityBins.map((_, index) => {
      const prev = densityBins[index - 1] ?? densityBins[index];
      const current = densityBins[index];
      const next = densityBins[index + 1] ?? densityBins[index];
      return (prev + current + next) / 3;
    });
  }, [densityBins]);

  const heatmapGradient = useMemo(() => {
    if (!smoothedDensityBins.length) {
      return "linear-gradient(90deg, rgba(255, 179, 71, 0.12), rgba(255, 179, 71, 0.12))";
    }
    const lastIndex = Math.max(1, smoothedDensityBins.length - 1);
    const stops = smoothedDensityBins.map((value, index) => {
      const pct = (index / lastIndex) * 100;
      const alpha = 0.08 + value * 0.72;
      return `rgba(255, 179, 71, ${alpha.toFixed(3)}) ${pct.toFixed(2)}%`;
    });
    return `linear-gradient(90deg, ${stops.join(", ")})`;
  }, [smoothedDensityBins]);

  const heatmapActiveBinCount = useMemo(
    () => densityBins.filter((value) => value > 0).length,
    [densityBins]
  );

  const eventClusters = useMemo(() => {
    const events = filteredEvents;
    if (!events.length) return [];
    const clusterGap = 45;
    const clusters = [];
    let start = events[0].seconds;
    let end = events[0].seconds;

    for (let index = 1; index < events.length; index += 1) {
      const t = events[index].seconds;
      if (t - end <= clusterGap) {
        end = t;
      } else {
        clusters.push({ start, end });
        start = t;
        end = t;
      }
    }
    clusters.push({ start, end });
    return clusters;
  }, [filteredEvents]);

  const formatTime = (seconds) => {
    const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
    const hrs = Math.floor(safe / 3600);
    const mins = Math.floor((safe % 3600) / 60);
    const secs = Math.floor(safe % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const snapTime = (time) => {
    if (!snapToEvent || !filteredEvents.length) return time;
    const threshold = Math.max(1.5, scrubWindowSpan * 0.01);
    let nearest = null;
    let nearestDiff = Number.POSITIVE_INFINITY;

    filteredEvents.forEach((entry) => {
      const diff = Math.abs(entry.seconds - time);
      if (diff < nearestDiff) {
        nearestDiff = diff;
        nearest = entry;
      }
    });

    if (nearest && nearestDiff <= threshold) {
      return nearest.seconds;
    }
    return time;
  };

  const seekToExact = (seconds) => {
    if (!videoRef.current) return;
    const target = Math.max(0, Math.min(durationRef.current || duration || 0, snapTime(seconds)));
    videoRef.current.currentTime = target;
    currentTimeRef.current = target;
    setCurrentTime(target);
  };

  const seekTo = (seconds) => {
    const targetTime = Math.max(0, seconds - preRollSeconds);
    seekToExact(targetTime);
  };

  const seekRelative = (delta) => {
    seekToExact((videoRef.current?.currentTime || currentTimeRef.current || 0) + delta);
  };

  const jumpToAdjacentEvent = (direction) => {
    if (!filteredEvents.length) return;
    const now = currentTimeRef.current || currentTime;
    const effectiveNow = now + (preRollSeconds || 0);
    if (direction < 0) {
      const previous = [...filteredEvents]
        .reverse()
        .find((entry) => entry.seconds < effectiveNow - 0.2);
      if (previous) seekTo(previous.seconds);
      return;
    }
    const next = filteredEvents.find((entry) => entry.seconds > effectiveNow + 0.2);
    if (next) seekTo(next.seconds);
  };

  const jumpDeadAir = () => {
    if (!eventClusters.length) return;
    const now = currentTimeRef.current || currentTime;
    const currentClusterIndex = eventClusters.findIndex(
      (cluster) => now >= cluster.start && now <= cluster.end
    );

    if (currentClusterIndex >= 0 && currentClusterIndex + 1 < eventClusters.length) {
      seekToExact(eventClusters[currentClusterIndex + 1].start);
      return;
    }

    const nextCluster = eventClusters.find((cluster) => cluster.start > now + 8);
    if (nextCluster) {
      seekToExact(nextCluster.start);
    }
  };

  const DEAD_AIR_LABEL = "Next Group of Events";
  const PLAYBACK_RATES = [0.5, 1, 1.5, 2];

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
  };

  const cyclePlaybackRate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.playbackRate || 1;
    const index = PLAYBACK_RATES.indexOf(current);
    const next = PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length] || 1;
    videoRef.current.playbackRate = next;
  };

  const downloadVod = () => {
    if (!vodPath) return;
    const link = document.createElement("a");
    link.href = vodMediaUrl;
    link.download = vodPath.split(/[/\\]/).pop() || "vod";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const deleteVod = async () => {
    if (!vodPath) return;
    const label = vodPath.split(/[/\\]/).pop() || "this VOD";
    const confirmed = window.confirm(`Delete ${label}? This will remove the file from disk.`);
    if (!confirmed) return;
    try {
      const response = await fetch("/api/vods/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: vodPath }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "Failed to delete VOD");
      }
      navigate("/vods");
    } catch (err) {
      setError(err.message || "Failed to delete VOD");
    }
  };

  const addManualMarker = () => {
    const now = currentTimeRef.current || currentTime;
    setManualMarkers((prev) => [
      ...prev,
      { id: `manual-${Date.now()}`, seconds: now, label: "Manual marker", note: "" },
    ]);
  };

  useEffect(() => {
    if (!bookmarkListRef.current || !activeBookmarkRef.current || bookmarksCollapsed) return;

    const container = bookmarkListRef.current;
    const activeItem = activeBookmarkRef.current;

    const containerRect = container.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();

    if (itemRect.top < containerRect.top || itemRect.bottom > containerRect.bottom) {
      const scrollTo =
        activeItem.offsetTop - container.clientHeight / 2 + activeItem.offsetHeight / 2;
      container.scrollTo({ top: scrollTo, behavior: "smooth" });
    }
  }, [currentTime, filteredEvents, bookmarksCollapsed]);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch("/api/config");
        const config = await response.json();
        setDetectionKeywords(config.detection?.keywords || []);
        setPreRollSeconds(config.split?.pre_seconds || 0);
        setSplitPreSeconds(config.split?.pre_seconds || 0);
        setSplitPostSeconds(config.split?.post_seconds || 0);
      } catch {
        setDetectionKeywords([]);
        setPreRollSeconds(0);
        setSplitPreSeconds(0);
        setSplitPostSeconds(0);
      }
    };

    loadConfig();
  }, []);

  useEffect(() => {
    if (!vodPath) {
      setError("No VOD path provided");
      setLoading(false);
      return;
    }

    const loadVodData = async () => {
      try {
        const response = await fetch("/api/vods?all=1");
        const data = await response.json();
        const vod = (data.vods || []).find((entry) => entry.path === vodPath);

        if (!vod) {
          setError("VOD not found");
          setVodMeta(null);
          return;
        }

        setVodMeta(vod);
        setSessions(vod.sessions || []);
        if (!selectedSession && vod.sessions && vod.sessions.length > 0) {
          setSelectedSession(vod.sessions[0].path);
        }
      } catch {
        setError("Failed to load VOD data");
      }
    };

    loadVodData();
  }, [vodPath, selectedSession]);

  useEffect(() => {
    if (!selectedSession) {
      setLoading(false);
      return;
    }

    const loadBookmarks = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/session-data?path=${encodeURIComponent(selectedSession)}`
        );
        const data = await response.json();

        if (data.ok) {
          setBookmarks(data.bookmarks || []);
          setError(null);
        } else {
          setError(data.error || "Failed to load bookmarks");
          setBookmarks([]);
        }
      } catch {
        setError("Failed to fetch bookmark data");
        setBookmarks([]);
      } finally {
        setLoading(false);
      }
    };

    loadBookmarks();
  }, [selectedSession]);

  useEffect(() => {
    if (!markersStorageKey) return;
    setManualMarkers(loadStored(markersStorageKey, []));
  }, [markersStorageKey]);

  useEffect(() => {
    if (!markersStorageKey) return;
    saveStored(markersStorageKey, manualMarkers);
  }, [manualMarkers, markersStorageKey]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolume = () => {
      setIsMuted(Boolean(video.muted));
      setVolumeValue(video.volume ?? 1);
    };
    const handleRate = () => setPlaybackRate(video.playbackRate || 1);

    const initialVolume = Math.max(0, Math.min(1, volumeValue));
    video.volume = initialVolume;
    video.muted = Boolean(isMuted);

    setIsPlaying(!video.paused);
    setIsMuted(Boolean(video.muted));
    setVolumeValue(video.volume ?? initialVolume);
    setPlaybackRate(video.playbackRate || 1);

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("volumechange", handleVolume);
    video.addEventListener("ratechange", handleRate);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("volumechange", handleVolume);
      video.removeEventListener("ratechange", handleRate);
    };
  }, [vodMediaUrl, isMuted, volumeValue]);

  useEffect(() => {
    saveStored(SETTINGS_KEYS.collapsed, bookmarksCollapsed);
  }, [bookmarksCollapsed]);

  useEffect(() => {
    saveStored(SETTINGS_KEYS.zoom, scrubHalfSeconds);
  }, [scrubHalfSeconds]);

  useEffect(() => {
    saveStored(SETTINGS_KEYS.snap, snapToEvent);
  }, [snapToEvent]);

  useEffect(() => {
    saveStored(SETTINGS_KEYS.filters, eventFilters);
  }, [eventFilters]);

  useEffect(() => {
    saveStored(SETTINGS_KEYS.volume, volumeValue);
  }, [volumeValue]);

  useEffect(() => {
    saveStored(SETTINGS_KEYS.muted, isMuted);
  }, [isMuted]);

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const total = videoRef.current.duration;
    setDuration(total);
    durationRef.current = total;
    if (!clipEnd || clipEnd < 1) {
      setClipEnd(Math.min(total, 30 * 60));
    }
    videoRef.current.play().catch(() => {});
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    currentTimeRef.current = time;
    setCurrentTime(time);
  };

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    clipStartRef.current = clipStart;
  }, [clipStart]);

  useEffect(() => {
    clipEndRef.current = clipEnd;
  }, [clipEnd]);

  useEffect(() => {
    if (!showClipTools) {
      clipDefaultsRef.current = false;
      return;
    }
    if (durationRef.current <= 0 || clipDefaultsRef.current) return;

    const center = currentTimeRef.current || 0;
    const start = Math.max(scrubWindowStart, center - splitPreSeconds);
    const end = Math.min(scrubWindowEnd, center + splitPostSeconds);
    setClipStart(start);
    setClipEnd(Math.max(end, start + 1));
    clipDefaultsRef.current = true;
  }, [showClipTools, splitPreSeconds, splitPostSeconds, scrubWindowStart, scrubWindowEnd]);

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!dragStateRef.current.handle || !timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      dragStateRef.current.pendingTime = fromWindowPercent(pct);
      if (dragStateRef.current.raf) return;

      dragStateRef.current.raf = requestAnimationFrame(() => {
        const time = dragStateRef.current.pendingTime;
        dragStateRef.current.raf = 0;
        if (time == null) return;

        if (dragStateRef.current.handle === "start") {
          setClipStart(Math.max(scrubWindowStart, Math.min(time, clipEndRef.current - 1)));
        } else if (dragStateRef.current.handle === "end") {
          setClipEnd(Math.min(scrubWindowEnd, Math.max(time, clipStartRef.current + 1)));
        }
      });
    };

    const handlePointerUp = () => {
      dragStateRef.current.handle = null;
      setDraggingHandle(null);
    };

    if (draggingHandle) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    }

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [draggingHandle, scrubWindowStart, scrubWindowEnd]);

  useEffect(() => {
    const handleRangeMove = (e) => {
      if (!rangeDragging || !timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const time = fromWindowPercent(pct) - rangeDragOffsetRef.current;
      const span = clipEndRef.current - clipStartRef.current;
      const nextStart = Math.max(scrubWindowStart, Math.min(scrubWindowEnd - span, time));
      setClipStart(nextStart);
      setClipEnd(nextStart + span);
    };

    const handleRangeUp = () => {
      setRangeDragging(false);
    };

    if (rangeDragging) {
      window.addEventListener("pointermove", handleRangeMove);
      window.addEventListener("pointerup", handleRangeUp);
      window.addEventListener("pointercancel", handleRangeUp);
    }

    return () => {
      window.removeEventListener("pointermove", handleRangeMove);
      window.removeEventListener("pointerup", handleRangeUp);
      window.removeEventListener("pointercancel", handleRangeUp);
    };
  }, [rangeDragging, scrubWindowStart, scrubWindowEnd]);

  useEffect(() => {
    const handleScrubMove = (e) => {
      if (!scrubDragging || !timelineRef.current || !videoRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const time = snapTime(fromWindowPercent(pct));
      videoRef.current.currentTime = time;
      currentTimeRef.current = time;
      setCurrentTime(time);
    };

    const handleScrubUp = () => {
      setScrubDragging(false);
    };

    if (scrubDragging) {
      window.addEventListener("pointermove", handleScrubMove);
      window.addEventListener("pointerup", handleScrubUp);
      window.addEventListener("pointercancel", handleScrubUp);
    }

    return () => {
      window.removeEventListener("pointermove", handleScrubMove);
      window.removeEventListener("pointerup", handleScrubUp);
      window.removeEventListener("pointercancel", handleScrubUp);
    };
  }, [scrubDragging, snapToEvent, scrubWindowSpan, filteredEvents]);

  useEffect(() => {
    const handleKey = (event) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
        return;
      }
      if (event.key === "[") {
        event.preventDefault();
        jumpToAdjacentEvent(-1);
      } else if (event.key === "]") {
        event.preventDefault();
        jumpToAdjacentEvent(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        seekRelative(event.shiftKey ? -300 : -5);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        seekRelative(event.shiftKey ? 300 : 5);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [filteredEvents]);

  useEffect(() => {
    const handleOverviewMove = (event) => {
      if (!overviewDragging || !durationRef.current) return;
      const overviewElement = document.querySelector("[data-overview-timeline='true']");
      if (!overviewElement) return;
      const rect = overviewElement.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const pointerTime = pct * durationRef.current;
      const windowSpan = Math.max(1, scrubWindowEnd - scrubWindowStart);
      const maxStart = Math.max(0, durationRef.current - windowSpan);
      const nextStart = Math.max(0, Math.min(maxStart, pointerTime - overviewDragOffsetRef.current));
      const nextTime = Math.max(
        0,
        Math.min(durationRef.current, nextStart + overviewCursorOffsetRef.current)
      );

      if (videoRef.current) {
        videoRef.current.currentTime = nextTime;
      }
      currentTimeRef.current = nextTime;
      setCurrentTime(nextTime);
    };

    const handleOverviewUp = () => {
      setOverviewDragging(false);
    };

    if (overviewDragging) {
      window.addEventListener("pointermove", handleOverviewMove);
      window.addEventListener("pointerup", handleOverviewUp);
      window.addEventListener("pointercancel", handleOverviewUp);
    }

    return () => {
      window.removeEventListener("pointermove", handleOverviewMove);
      window.removeEventListener("pointerup", handleOverviewUp);
      window.removeEventListener("pointercancel", handleOverviewUp);
    };
  }, [overviewDragging, scrubWindowStart, scrubWindowEnd]);

  const handleSessionChange = (e) => {
    const newSession = e.target.value;
    setSelectedSession(newSession);
    navigate(`/vods/view?path=${encodeURIComponent(vodPath)}&session=${encodeURIComponent(newSession)}`);
  };

  const handleZoomWheel = (event) => {
    event.preventDefault();
    const currentIndex = Math.max(
      0,
      ZOOM_OPTIONS.findIndex((option) => option.halfSeconds === scrubHalfSeconds)
    );
    const nextIndex = event.deltaY < 0
      ? Math.max(0, currentIndex - 1)
      : Math.min(ZOOM_OPTIONS.length - 1, currentIndex + 1);
    setScrubHalfSeconds(ZOOM_OPTIONS[nextIndex].halfSeconds);
  };

  const handleTimelinePointerDown = (event) => {
    if (!timelineRef.current || !videoRef.current) return;
    const target = event.target;
    if (
      target.closest(".timeline-marker") ||
      target.closest(".timeline-scrub-handle") ||
      target.closest(".timeline-range-handle") ||
      target.closest(".timeline-range-bar")
    ) {
      return;
    }

    const rect = timelineRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    seekToExact(fromWindowPercent(pct));
  };

  const handleOverviewPointerDown = (event) => {
    if (!durationRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    seekToExact(pct * durationRef.current);
  };

  if (error) {
    return (
      <section className="grid">
        <div className="card">
          <button onClick={() => navigate("/vods")} className="tertiary" style={{ marginBottom: "1rem" }}>
            ← Back to VODs
          </button>
          <div style={{ color: "var(--accent-2)", textAlign: "center", padding: "2rem" }}>
            {error}
          </div>
        </div>
      </section>
    );
  }

  const viewerTitle =
    vodMeta?.pretty_time
    || vodMeta?.name
    || vodPath?.split(/[/\\]/).pop()
    || "VOD";

  return (
    <section className="vod-viewer-page">
      <div className="vod-viewer">
        <div className="vod-viewer-header">
          <div className="vod-viewer-header-left">
            <div className="vod-viewer-app-title">VOD Insights</div>
            <button onClick={() => navigate("/vods")} className="tertiary">
              ← Back to VODs
            </button>
            <div className="vod-viewer-title-compact">{viewerTitle}</div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button className="secondary" onClick={() => setShowClipTools((prev) => !prev)}>
              {showClipTools ? "Hide Clip" : "Clip"}
            </button>
            <button
              className="secondary"
              onClick={addManualMarker}
              title="Add a manual event marker at the current timestamp"
            >
              Add Marker
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setBookmarksCollapsed((prev) => !prev)}
              title={bookmarksCollapsed ? "Expand bookmarks" : "Collapse bookmarks"}
            >
              {bookmarksCollapsed ? "Show Bookmarks" : "Hide Bookmarks"}
            </button>
            <button
              type="button"
              className="icon-button danger"
              onClick={deleteVod}
              title="Delete VOD"
              aria-label="Delete VOD"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M3 6h18M9 6V4h6v2m-7 4v8m4-8v8m4-8v8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M6 6l1 14h10l1-14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="vod-content-wrapper">
          <div className="vod-left-section">
            <div className="video-player-container" style={{ position: "relative" }}>
              <video
                ref={videoRef}
                className="vod-video"
                src={vodMediaUrl}
                autoPlay
                onClick={togglePlayPause}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onError={() => setError("Unable to load this VOD in the viewer.")}
              />
              {loading && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(8, 15, 18, 0.55)",
                    color: "var(--text)",
                    fontSize: "14px",
                    letterSpacing: "0.02em",
                  }}
                >
                  Loading bookmarks...
                </div>
              )}
            </div>

            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                marginTop: "8px",
                minHeight: "36px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-start" }}>
                <button
                  className={showZoomMenu ? "primary" : "secondary"}
                  onClick={() => {
                    setShowZoomMenu((prev) => !prev);
                    setShowEventMenu(false);
                  }}
                  title="Zoom controls"
                >
                  🔍 Zoom
                </button>

                <button
                  className={showEventMenu ? "primary" : "secondary"}
                  onClick={() => {
                    setShowEventMenu((prev) => !prev);
                    setShowZoomMenu(false);
                  }}
                  title="Event filters"
                >
                  🔎 Events
                </button>
              </div>
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  transform: "translateX(-50%)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                <button className="secondary" onClick={() => jumpToAdjacentEvent(-1)} title="Previous event ([)">
                  Prev Event
                </button>
                <button className="tertiary" onClick={() => seekRelative(-300)}>−5m</button>
                <button className="tertiary" onClick={() => seekRelative(-30)}>−30s</button>
                <button
                  className="primary"
                  onClick={togglePlayPause}
                  title={isPlaying ? "Pause" : "Play"}
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                      <rect x="3" y="2" width="4" height="12" rx="1" fill="currentColor" />
                      <rect x="9" y="2" width="4" height="12" rx="1" fill="currentColor" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                      <polygon points="3,2 13,8 3,14" fill="currentColor" />
                    </svg>
                  )}
                </button>
                <button className="tertiary" onClick={() => seekRelative(10)}>+10s</button>
                <button className="tertiary" onClick={() => seekRelative(300)}>+5m</button>
                <button className="secondary" onClick={() => jumpToAdjacentEvent(1)} title="Next event (])">
                  Next Event
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-end" }}>
                <button
                  className="tertiary"
                  onClick={() => setShowVolume((prev) => !prev)}
                  title={isMuted ? "Unmute" : "Volume"}
                  aria-label={isMuted ? "Unmute" : "Volume"}
                >
                  {isMuted ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M3 6v4h3l4 3V3L6 6H3z" fill="currentColor" />
                      <path d="M12 5l3 3m0-3l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M3 6v4h3l4 3V3L6 6H3z" fill="currentColor" />
                      <path d="M12 4c1.5 1.5 1.5 6.5 0 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
                <button className="tertiary" onClick={cyclePlaybackRate} title="Playback speed">
                  {playbackRate}x
                </button>
                <button className="tertiary" onClick={downloadVod} title="Download VOD" aria-label="Download VOD">
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M8 2v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M5 6l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            {(showZoomMenu || showEventMenu || showVolume) && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "16px",
                  marginTop: "6px",
                  width: "100%",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: "1 1 360px" }}>
                  {showZoomMenu && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      {ZOOM_OPTIONS.map((option) => (
                        <button
                          key={option.label}
                          className={`zoom-button ${option.halfSeconds === scrubHalfSeconds ? "primary" : "secondary"}`}
                          onClick={() => setScrubHalfSeconds(option.halfSeconds)}
                          style={{ height: "32px" }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {showEventMenu && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      {eventFilterOptions.map((option) => (
                        <button
                          key={option.key}
                          className={eventFilters[option.key] !== false ? "primary" : "secondary"}
                          onClick={() => setEventFilters((prev) => ({
                            ...prev,
                            [option.key]: !(prev[option.key] ?? true),
                          }))}
                          style={{ height: "30px", padding: "0 10px" }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: "8px",
                              height: "8px",
                              borderRadius: "999px",
                              background: getEventColor(option.key),
                              boxShadow: "0 0 4px rgba(0, 0, 0, 0.3)",
                              marginRight: "6px",
                              transform: "translateY(1px)",
                            }}
                          />
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {showVolume && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      justifyContent: "flex-end",
                      flex: "0 0 auto",
                    }}
                  >
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={volumeValue}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setVolumeValue(next);
                        if (videoRef.current) {
                          videoRef.current.volume = next;
                          videoRef.current.muted = next === 0;
                        }
                      }}
                      style={{ width: "180px" }}
                    />
                    <button
                      className="tertiary"
                      onClick={toggleMute}
                      title={isMuted ? "Unmute" : "Mute"}
                    >
                      {isMuted ? "Unmute" : "Mute"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {duration > 0 && (
              <div style={{ marginTop: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", gap: "8px", flexWrap: "wrap" }}>
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                    Overview heatmap: <strong style={{ color: "var(--text)" }}>event density over time</strong> (based on current event filters)
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {filteredEvents.length} events across {heatmapActiveBinCount} active zones
                  </div>
                </div>
                <div
                  data-overview-timeline="true"
                  style={{
                    position: "relative",
                    height: "20px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "rgba(12, 23, 27, 0.65)",
                    overflow: "hidden",
                    cursor: "pointer",
                  }}
                  onPointerDown={handleOverviewPointerDown}
                  title="Overview timeline"
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: 0,
                      bottom: 0,
                      background: heatmapGradient,
                    }}
                  />
                  {filteredEvents.map((entry) => (
                    <button
                      key={`overview-${entry.id}`}
                      type="button"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        seekToExact(entry.seconds);
                      }}
                      title={`${formatTime(entry.seconds)} - ${normalizeEvent(entry.event)}`}
                      style={{
                        position: "absolute",
                        left: `${duration > 0 ? (entry.seconds / duration) * 100 : 0}%`,
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        width: "7px",
                        height: "7px",
                        borderRadius: "999px",
                        border: "1px solid rgba(8, 15, 18, 0.75)",
                        background: getEventColor(entry.filterKey),
                        boxShadow: nearbyEventIds.has(entry.id)
                          ? "0 0 6px rgba(109, 255, 155, 0.75)"
                          : "0 0 4px rgba(0, 0, 0, 0.2)",
                        zIndex: 3,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    />
                  ))}
                  <div
                    className="overview-window"
                    style={{
                      position: "absolute",
                      left: `${duration > 0 ? (scrubWindowStart / duration) * 100 : 0}%`,
                      width: `${duration > 0 ? ((scrubWindowEnd - scrubWindowStart) / Math.max(1, duration)) * 100 : 100}%`,
                      top: 0,
                      bottom: 0,
                      border: "1px solid rgba(255, 214, 109, 0.9)",
                      background: "rgba(255, 214, 109, 0.12)",
                      pointerEvents: "auto",
                      cursor: overviewDragging ? "grabbing" : "grab",
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (!durationRef.current) return;
                      const rect = event.currentTarget.parentElement?.getBoundingClientRect();
                      if (!rect) return;
                      const pct = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
                      const pointerTime = pct * durationRef.current;
                      overviewDragOffsetRef.current = pointerTime - scrubWindowStart;
                      overviewCursorOffsetRef.current = currentTimeRef.current - scrubWindowStart;
                      setOverviewDragging(true);
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                      top: 0,
                      bottom: 0,
                      width: "2px",
                      background: "#ffd46a",
                      pointerEvents: "none",
                    }}
                  />
                </div>
              </div>
            )}

            {duration > 0 && (
              (() => {
                const windowClipStart = Math.max(scrubWindowStart, Math.min(scrubWindowEnd, clipStart));
                const windowClipEnd = Math.max(windowClipStart, Math.min(scrubWindowEnd, clipEnd));
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "12px 0" }}>
                    <div style={{ minWidth: "58px", textAlign: "right", fontSize: "12px", color: "var(--muted)" }}>
                      {formatTime(scrubWindowStart)}
                    </div>
                    <div
                      className="timeline-range-container"
                      ref={timelineRef}
                      onWheel={handleZoomWheel}
                      onPointerDown={handleTimelinePointerDown}
                      style={{ position: "relative", height: "32px", margin: 0, flex: 1 }}
                    >
                      <div
                        className="timeline-scrub-line"
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: "15px",
                          height: "2px",
                          background: "rgba(255, 255, 255, 0.2)",
                          borderRadius: "2px",
                          zIndex: 1,
                        }}
                      />

                      {windowEvents.map((entry) => {
                        const isNear = Math.abs(currentTime - entry.seconds) < 2;
                        const isNearby = nearbyEventIds.has(entry.id);
                        const markerColor = getEventColor(entry.filterKey);
                        return (
                          <div
                            key={entry.id}
                            className={`timeline-marker scrub-marker ${isNear ? "active" : ""} ${isNearby ? "nearby" : ""}`}
                            style={{
                              left: `${toWindowPercent(entry.seconds)}%`,
                              top: "50%",
                              transform: "translate(-50%, -50%)",
                              zIndex: 4,
                              background: markerColor,
                            }}
                            onClick={() => seekToExact(entry.seconds)}
                            title={`${formatTime(entry.seconds)} - ${normalizeEvent(entry.event)}`}
                          />
                        );
                      })}

                      <div
                        className="timeline-range-bar"
                        hidden={!showClipTools}
                        style={{
                          position: "absolute",
                          left: `${toWindowPercent(windowClipStart)}%`,
                          width: `${Math.max(0, ((windowClipEnd - windowClipStart) / scrubWindowSpan) * 100)}%`,
                          top: "12px",
                          height: "8px",
                          background: "#e34b6c",
                          borderRadius: "4px",
                          zIndex: 2,
                          cursor: "grab",
                        }}
                        onPointerDown={(e) => {
                          if (!showClipTools || !timelineRef.current) return;
                          e.preventDefault();
                          const rect = timelineRef.current.getBoundingClientRect();
                          const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                          const time = fromWindowPercent(pct);
                          rangeDragOffsetRef.current = time - clipStartRef.current;
                          setRangeDragging(true);
                        }}
                      />

                      <div
                        className="timeline-scrub-handle"
                        style={{
                          position: "absolute",
                          left: `${toWindowPercent(currentTime)}%`,
                          top: "6px",
                          width: "8px",
                          height: "20px",
                          background: "#ffd46a",
                          borderRadius: "4px",
                          transform: "translateX(-50%)",
                          cursor: "ew-resize",
                          zIndex: 5,
                        }}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setScrubDragging(true);
                        }}
                        title="Drag to scrub"
                      />

                      <div
                        className="timeline-range-handle start"
                        hidden={!showClipTools}
                        style={{
                          position: "absolute",
                          left: `${toWindowPercent(windowClipStart)}%`,
                          top: "8px",
                          width: "12px",
                          height: "16px",
                          background: draggingHandle === "start" ? "#e34b6c" : "#fff",
                          border: "2px solid #e34b6c",
                          borderRadius: "4px",
                          cursor: "ew-resize",
                          zIndex: 4,
                        }}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          dragStateRef.current.handle = "start";
                          setDraggingHandle("start");
                        }}
                        title="Drag to set clip start"
                      />

                      <div
                        className="timeline-range-handle end"
                        hidden={!showClipTools}
                        style={{
                          position: "absolute",
                          left: `${toWindowPercent(windowClipEnd)}%`,
                          top: "8px",
                          width: "12px",
                          height: "16px",
                          background: draggingHandle === "end" ? "#e34b6c" : "#fff",
                          border: "2px solid #e34b6c",
                          borderRadius: "4px",
                          cursor: "ew-resize",
                          zIndex: 4,
                        }}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          dragStateRef.current.handle = "end";
                          setDraggingHandle("end");
                        }}
                        title="Drag to set clip end"
                      />
                    </div>
                    <div style={{ minWidth: "58px", textAlign: "left", fontSize: "12px", color: "var(--muted)" }}>
                      {formatTime(scrubWindowEnd)}
                    </div>
                  </div>
                );
              })()
            )}

            {duration > 0 && showClipTools && (
              <div className="clip-controls" style={{ margin: "16px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    Start
                    <input
                      type="text"
                      value={formatTime(clipStart)}
                      onChange={(e) => {
                        const parts = e.target.value.split(":").map(Number);
                        let seconds = 0;
                        if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                        else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
                        else if (parts.length === 1) seconds = parts[0];
                        setClipStart(Math.max(scrubWindowStart, Math.min(seconds, clipEnd - 1, scrubWindowEnd)));
                      }}
                      style={{ width: "80px" }}
                    />
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    End
                    <input
                      type="text"
                      value={formatTime(clipEnd)}
                      onChange={(e) => {
                        const parts = e.target.value.split(":").map(Number);
                        let seconds = 0;
                        if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                        else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
                        else if (parts.length === 1) seconds = parts[0];
                        setClipEnd(Math.min(scrubWindowEnd, Math.max(seconds, clipStart + 1, scrubWindowStart)));
                      }}
                      style={{ width: "80px" }}
                    />
                  </label>

                  <button
                    className="primary"
                    disabled={clipEnd <= clipStart + 1 || clipStatus === "working"}
                    title="Create clip from selected range"
                    onClick={async () => {
                      setClipStatus("working");
                      setClipResult(null);
                      try {
                        const resp = await fetch("/api/clip-range", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ vod_path: vodPath, start: clipStart, end: clipEnd }),
                        });
                        const text = await resp.text();
                        let data = null;
                        try {
                          data = JSON.parse(text);
                        } catch {
                          data = {
                            ok: false,
                            error: "Clip API unavailable. Make sure the backend is running and restarted.",
                          };
                        }
                        if (data.ok) {
                          setClipStatus("done");
                          setClipResult(data.clip_path);
                        } else {
                          setClipStatus("error");
                          setClipResult(data.error || "Unknown error");
                        }
                      } catch (err) {
                        setClipStatus("error");
                        setClipResult(err.message || "Request failed");
                      }
                    }}
                  >
                    {clipStatus === "working" ? "Creating..." : "Create Clip"}
                  </button>
                </div>

                {clipStatus === "done" && clipResult && (
                  <div style={{ marginTop: "12px", color: "#2e8b57" }}>
                    Clip created! <a href="/clips">View clips</a>
                  </div>
                )}
                {clipStatus === "error" && (
                  <div style={{ marginTop: "12px", color: "#e34b6c" }}>
                    Error: {clipResult}
                  </div>
                )}
              </div>
            )}
          </div>

          {!bookmarksCollapsed && (
            <div className="bookmark-list-container expanded">
              <div className="bookmark-panel-header">
                <h3>Bookmarks ({filteredEvents.length})</h3>
              </div>

              {loading ? (
                <p className="hint">Loading bookmarks...</p>
              ) : filteredEvents.length === 0 ? (
                <p className="hint">No events found with current filters.</p>
              ) : (
                <div className="bookmark-list" ref={bookmarkListRef}>
                  {filteredEvents.map((entry) => {
                    const isNear = Math.abs(currentTime - entry.seconds) < 2;
                    const isNearby = nearbyEventIds.has(entry.id);

                    return (
                      <div
                        key={entry.id}
                        ref={isNear ? activeBookmarkRef : null}
                        className={`bookmark-item ${isNear ? "active" : ""} ${isNearby ? "nearby" : ""}`}
                        onClick={() => seekTo(entry.seconds)}
                      >
                        <div className="bookmark-time">{formatTime(entry.seconds)}</div>
                        <div className="bookmark-content">
                          <div className="bookmark-event">{normalizeEvent(entry.event)}</div>
                          {entry.ocr ? <div className="bookmark-ocr">{entry.ocr}</div> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
