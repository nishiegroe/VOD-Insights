import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import VodBookmarkList from "../components/VodBookmarkList";
import VodClipControls from "../components/VodClipControls";
import VodOverviewTimeline from "../components/VodOverviewTimeline";
import VodPlaybackControlsPanel from "../components/VodPlaybackControlsPanel";
import VodScrubTimeline from "../components/VodScrubTimeline";
import VodVideoPlayer from "../components/VodVideoPlayer";
import VodViewerHeader from "../components/VodViewerHeader";
import useVodViewerData from "../hooks/useVodViewerData";
import {
  createClipRange,
  deleteVod as deleteVodRequest,
} from "../api/vodViewer";
import {
  ZOOM_OPTIONS,
  DEFAULT_FILTERS,
  MANUAL_FILTER_KEY,
  OTHER_FILTER_KEY,
  SETTINGS_KEYS,
  loadStored,
  saveStored,
  keywordFilterKey,
  classifyEventByKeywords,
} from "../utils/vodViewer";

export default function VodViewer() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const timelineRef = useRef(null);
  const bookmarkListRef = useRef(null);
  const activeBookmarkRef = useRef(null);

  const vodPath = searchParams.get("path");
  const sessionPath = searchParams.get("session");

  const {
    bookmarks,
    setBookmarks,
    vodMeta,
    sessions,
    selectedSession,
    setSelectedSession,
    loading,
    error,
    setError,
    detectionKeywords,
    defaultPreRollSeconds,
    defaultPostRollSeconds,
    eventWindowMap,
    overlayConfig,
  } = useVodViewerData(vodPath, sessionPath);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

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
  const [videoContentRect, setVideoContentRect] = useState(null);
  const containerRef = useRef(null);
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
  const windowClipStart = Math.max(scrubWindowStart, Math.min(scrubWindowEnd, clipStart));
  const windowClipEnd = Math.max(windowClipStart, Math.min(scrubWindowEnd, clipEnd));

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
    const getWindow = (entry) => {
      if (!entry || entry.source === "manual") {
        return { pre: defaultPreRollSeconds, post: defaultPostRollSeconds };
      }
      return eventWindowMap[entry.filterKey] || { pre: defaultPreRollSeconds, post: defaultPostRollSeconds };
    };

    const primaryNearby = filteredEvents.filter(
      (entry) => {
        const window = getWindow(entry);
        return entry.seconds >= currentTime - window.pre && entry.seconds <= currentTime + window.post;
      }
    );

    const secondaryNearby = new Set();
    primaryNearby.forEach((primary) => {
      const primaryWindow = getWindow(primary);
      filteredEvents.forEach((entry) => {
        if (
          entry.seconds >= primary.seconds - primaryWindow.pre &&
          entry.seconds <= primary.seconds + primaryWindow.post
        ) {
          secondaryNearby.add(entry.id);
        }
      });
    });

    return secondaryNearby;
  }, [filteredEvents, currentTime, eventWindowMap, defaultPreRollSeconds, defaultPostRollSeconds]);

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

  const seekTo = (entryOrSeconds) => {
    const isEntry = typeof entryOrSeconds === "object" && entryOrSeconds !== null;
    const seconds = isEntry ? Number(entryOrSeconds.seconds || 0) : Number(entryOrSeconds || 0);
    const eventWindow = isEntry
      ? eventWindowMap[entryOrSeconds.filterKey] || { pre: defaultPreRollSeconds, post: defaultPostRollSeconds }
      : { pre: defaultPreRollSeconds, post: defaultPostRollSeconds };
    const targetTime = Math.max(0, seconds - eventWindow.pre);
    seekToExact(targetTime);
  };

  const seekRelative = (delta) => {
    seekToExact((videoRef.current?.currentTime || currentTimeRef.current || 0) + delta);
  };

  const jumpToAdjacentEvent = (direction) => {
    if (!filteredEvents.length) return;
    const now = currentTimeRef.current || currentTime;
    const effectiveNow = now;
    if (direction < 0) {
      const previous = [...filteredEvents]
        .reverse()
        .find((entry) => entry.seconds < effectiveNow - 0.2);
      if (previous) seekTo(previous);
      return;
    }
    const next = filteredEvents.find((entry) => entry.seconds > effectiveNow + 0.2);
    if (next) seekTo(next);
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
      const response = await deleteVodRequest(vodPath);
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

  const nearbyManualMarker = useMemo(() => {
    if (!manualMarkers.length) return null;
    const now = currentTimeRef.current || currentTime;
    let nearestIndex = -1;
    let nearestDiff = Number.POSITIVE_INFINITY;

    manualMarkers.forEach((marker, index) => {
      const diff = Math.abs((marker?.seconds ?? 0) - now);
      if (diff < nearestDiff) {
        nearestDiff = diff;
        nearestIndex = index;
      }
    });

    if (nearestIndex < 0 || nearestDiff > 10) return null;
    return {
      index: nearestIndex,
      marker: manualMarkers[nearestIndex],
      diff: nearestDiff,
    };
  }, [manualMarkers, currentTime]);

  const toggleManualMarker = () => {
    if (nearbyManualMarker) {
      setManualMarkers((prev) => prev.filter((_, index) => index !== nearbyManualMarker.index));
      return;
    }
    addManualMarker();
  };

  const handleCreateClip = async () => {
    setClipStatus("working");
    setClipResult(null);
    try {
      const resp = await createClipRange(vodPath, clipStart, clipEnd);
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
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    const computeRect = () => {
      const vW = video.videoWidth;
      const vH = video.videoHeight;
      if (!vW || !vH) return;
      const elW = video.offsetWidth;
      const elH = video.offsetHeight;
      const scale = Math.min(elW / vW, elH / vH);
      const rW = vW * scale;
      const rH = vH * scale;
      setVideoContentRect({
        left: video.offsetLeft + (elW - rW) / 2,
        top: video.offsetTop + (elH - rH) / 2,
        width: rW,
        height: rH,
      });
    };

    video.addEventListener("loadedmetadata", computeRect);
    const observer = new ResizeObserver(computeRect);
    observer.observe(container);
    if (video.readyState >= 1 && video.videoWidth) computeRect();

    return () => {
      video.removeEventListener("loadedmetadata", computeRect);
      observer.disconnect();
    };
  }, [vodMediaUrl]);

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
    const nearest = filteredEvents.reduce(
      (best, entry) => {
        const distance = Math.abs(entry.seconds - center);
        if (!best || distance < best.distance) {
          return { entry, distance };
        }
        return best;
      },
      null
    );
    const baseWindow =
      nearest && nearest.distance <= 12
        ? eventWindowMap[nearest.entry.filterKey] || { pre: defaultPreRollSeconds, post: defaultPostRollSeconds }
        : { pre: defaultPreRollSeconds, post: defaultPostRollSeconds };
    const start = Math.max(scrubWindowStart, center - baseWindow.pre);
    const end = Math.min(scrubWindowEnd, center + baseWindow.post);
    setClipStart(start);
    setClipEnd(Math.max(end, start + 1));
    clipDefaultsRef.current = true;
  }, [showClipTools, scrubWindowStart, scrubWindowEnd, filteredEvents, eventWindowMap, defaultPreRollSeconds, defaultPostRollSeconds]);

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

  const handleOverviewWindowPointerDown = (event) => {
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
  };

  const handleRangeBarPointerDown = (event) => {
    if (!showClipTools || !timelineRef.current) return;
    event.preventDefault();
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const time = fromWindowPercent(pct);
    rangeDragOffsetRef.current = time - clipStartRef.current;
    setRangeDragging(true);
  };

  const handleScrubHandlePointerDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setScrubDragging(true);
  };

  const handleClipStartHandlePointerDown = (event) => {
    event.preventDefault();
    dragStateRef.current.handle = "start";
    setDraggingHandle("start");
  };

  const handleClipEndHandlePointerDown = (event) => {
    event.preventDefault();
    dragStateRef.current.handle = "end";
    setDraggingHandle("end");
  };

  const handleToggleZoomMenu = () => {
    setShowZoomMenu((prev) => !prev);
    setShowEventMenu(false);
  };

  const handleToggleEventMenu = () => {
    setShowEventMenu((prev) => !prev);
    setShowZoomMenu(false);
  };

  const handleToggleVolume = () => {
    setShowVolume((prev) => !prev);
  };

  const handleSelectZoom = (halfSeconds) => {
    setScrubHalfSeconds(halfSeconds);
  };

  const handleToggleEventFilter = (filterKey) => {
    setEventFilters((prev) => ({
      ...prev,
      [filterKey]: !(prev[filterKey] ?? true),
    }));
  };

  const handleVolumeChange = (event) => {
    const next = Number(event.target.value);
    setVolumeValue(next);
    if (videoRef.current) {
      videoRef.current.volume = next;
      videoRef.current.muted = next === 0;
    }
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
    vodMeta?.display_title
    || vodMeta?.pretty_time
    || vodMeta?.name
    || vodPath?.split(/[/\\]/).pop()
    || "VOD";

  return (
    <section className="vod-viewer-page">
      <div className="vod-viewer">
        <VodViewerHeader
          viewerTitle={viewerTitle}
          onBack={() => navigate("/vods")}
          showClipTools={showClipTools}
          onToggleClipTools={() => setShowClipTools((prev) => !prev)}
          nearbyManualMarker={nearbyManualMarker}
          onToggleManualMarker={toggleManualMarker}
          bookmarksCollapsed={bookmarksCollapsed}
          onToggleBookmarksCollapsed={() => setBookmarksCollapsed((prev) => !prev)}
          onDeleteVod={deleteVod}
        />

        <div className="vod-content-wrapper">
          <div className="vod-left-section">
            <VodVideoPlayer
              containerRef={containerRef}
              videoRef={videoRef}
              vodMediaUrl={vodMediaUrl}
              togglePlayPause={togglePlayPause}
              handleLoadedMetadata={handleLoadedMetadata}
              handleTimeUpdate={handleTimeUpdate}
              onVideoError={() => setError("Unable to load this VOD in the viewer.")}
              overlayConfig={overlayConfig}
              videoContentRect={videoContentRect}
              loading={loading}
            />

            <VodPlaybackControlsPanel
              showZoomMenu={showZoomMenu}
              showEventMenu={showEventMenu}
              showVolume={showVolume}
              onToggleZoomMenu={handleToggleZoomMenu}
              onToggleEventMenu={handleToggleEventMenu}
              jumpToAdjacentEvent={jumpToAdjacentEvent}
              seekRelative={seekRelative}
              togglePlayPause={togglePlayPause}
              isPlaying={isPlaying}
              onToggleVolume={handleToggleVolume}
              isMuted={isMuted}
              cyclePlaybackRate={cyclePlaybackRate}
              playbackRate={playbackRate}
              downloadVod={downloadVod}
              scrubHalfSeconds={scrubHalfSeconds}
              onSelectZoom={handleSelectZoom}
              eventFilterOptions={eventFilterOptions}
              eventFilters={eventFilters}
              onToggleEventFilter={handleToggleEventFilter}
              volumeValue={volumeValue}
              onVolumeChange={handleVolumeChange}
              toggleMute={toggleMute}
            />

            <VodOverviewTimeline
              duration={duration}
              filteredEvents={filteredEvents}
              heatmapActiveBinCount={heatmapActiveBinCount}
              heatmapGradient={heatmapGradient}
              handleOverviewPointerDown={handleOverviewPointerDown}
              seekToExact={seekToExact}
              formatTime={formatTime}
              normalizeEvent={normalizeEvent}
              nearbyEventIds={nearbyEventIds}
              scrubWindowStart={scrubWindowStart}
              scrubWindowEnd={scrubWindowEnd}
              overviewDragging={overviewDragging}
              handleOverviewWindowPointerDown={handleOverviewWindowPointerDown}
              currentTime={currentTime}
            />

            <VodScrubTimeline
              duration={duration}
              scrubWindowStart={scrubWindowStart}
              scrubWindowEnd={scrubWindowEnd}
              formatTime={formatTime}
              timelineRef={timelineRef}
              handleZoomWheel={handleZoomWheel}
              handleTimelinePointerDown={handleTimelinePointerDown}
              windowEvents={windowEvents}
              currentTime={currentTime}
              nearbyEventIds={nearbyEventIds}
              toWindowPercent={toWindowPercent}
              seekToExact={seekToExact}
              normalizeEvent={normalizeEvent}
              showClipTools={showClipTools}
              windowClipStart={windowClipStart}
              windowClipEnd={windowClipEnd}
              scrubWindowSpan={scrubWindowSpan}
              draggingHandle={draggingHandle}
              handleRangeBarPointerDown={handleRangeBarPointerDown}
              handleScrubHandlePointerDown={handleScrubHandlePointerDown}
              handleClipStartHandlePointerDown={handleClipStartHandlePointerDown}
              handleClipEndHandlePointerDown={handleClipEndHandlePointerDown}
            />

            <VodClipControls
              duration={duration}
              showClipTools={showClipTools}
              formatTime={formatTime}
              clipStart={clipStart}
              clipEnd={clipEnd}
              scrubWindowStart={scrubWindowStart}
              scrubWindowEnd={scrubWindowEnd}
              setClipStart={setClipStart}
              setClipEnd={setClipEnd}
              clipStatus={clipStatus}
              clipResult={clipResult}
              onCreateClip={handleCreateClip}
            />
          </div>

          <VodBookmarkList
            bookmarksCollapsed={bookmarksCollapsed}
            filteredEvents={filteredEvents}
            loading={loading}
            bookmarkListRef={bookmarkListRef}
            currentTime={currentTime}
            nearbyEventIds={nearbyEventIds}
            activeBookmarkRef={activeBookmarkRef}
            seekTo={seekTo}
            formatTime={formatTime}
            normalizeEvent={normalizeEvent}
          />
        </div>
      </div>
    </section>
  );
}
