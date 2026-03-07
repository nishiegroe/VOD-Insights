import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  deleteClip,
  fetchClipByPath,
  fetchOverlayConfig,
  getClipDownloadUrl,
  openClipFolder,
  renameClip,
} from "../api/clipsViewer";
import ClipViewerHeader from "../components/ClipViewerHeader";
import ViewerClipControls from "../components/ViewerClipControls";
import ViewerPlaybackControlsPanel from "../components/ViewerPlaybackControlsPanel";
import ViewerScrubTimeline from "../components/ViewerScrubTimeline";
import ViewerVideoPlayer from "../components/ViewerVideoPlayer";
import { ClipsViewerPageSkeleton } from "../components/PageSkeletons";
import { createClipRange } from "../api/vodViewer";
import { ZOOM_OPTIONS } from "../utils/vodViewer";

export default function ClipsViewer() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const clipPath = searchParams.get("path") || "";

  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const timelineRef = useRef(null);
  const dragStateRef = useRef({ handle: null, raf: 0, pendingTime: null });
  const durationRef = useRef(0);
  const clipStartRef = useRef(0);
  const clipEndRef = useRef(0);
  const currentTimeRef = useRef(0);
  const rangeDragOffsetRef = useRef(0);
  const overviewDragOffsetRef = useRef(0);
  const overviewCursorOffsetRef = useRef(0);

  const [clip, setClip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [overlayConfig, setOverlayConfig] = useState(null);
  const [videoContentRect, setVideoContentRect] = useState(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const [showEventMenu, setShowEventMenu] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volumeValue, setVolumeValue] = useState(1);
  const [scrubHalfSeconds, setScrubHalfSeconds] = useState(15 * 60);
  const [showClipTools, setShowClipTools] = useState(false);
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(0);
  const [clipStatus, setClipStatus] = useState("");
  const [clipResult, setClipResult] = useState(null);
  const [draggingHandle, setDraggingHandle] = useState(null);
  const [scrubDragging, setScrubDragging] = useState(false);
  const [rangeDragging, setRangeDragging] = useState(false);
  const [overviewDragging, setOverviewDragging] = useState(false);

  const clipMediaUrl = clip?.path
    ? `/media-path?path=${encodeURIComponent(clip.path)}`
    : "";

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

  const windowEvents = useMemo(() => [], []);
  const nearbyEventIds = useMemo(() => new Set(), []);
  const eventFilterOptions = useMemo(() => [], []);
  const eventFilters = useMemo(() => ({}), []);

  const toWindowPercent = (time) => {
    const clamped = Math.max(scrubWindowStart, Math.min(scrubWindowEnd, time));
    return ((clamped - scrubWindowStart) / scrubWindowSpan) * 100;
  };

  const fromWindowPercent = (pct) => scrubWindowStart + pct * scrubWindowSpan;

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

  const normalizeEvent = (eventText) => {
    if (!eventText) return "Event";
    return String(eventText);
  };

  const seekToExact = (seconds) => {
    if (!videoRef.current) return;
    const target = Math.max(0, Math.min(durationRef.current || duration || 0, seconds));
    videoRef.current.currentTime = target;
    currentTimeRef.current = target;
    setCurrentTime(target);
  };

  const seekRelative = (delta) => {
    seekToExact((videoRef.current?.currentTime || currentTimeRef.current || 0) + delta);
  };

  const jumpToAdjacentEvent = () => {};

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
    const rates = [0.5, 1, 1.5, 2];
    const current = videoRef.current.playbackRate || 1;
    const index = rates.indexOf(current);
    const next = rates[(index + 1) % rates.length] || 1;
    videoRef.current.playbackRate = next;
  };

  useEffect(() => {
    const load = async () => {
      if (!clipPath) {
        setError("Missing clip path");
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const payload = await fetchClipByPath(clipPath);
        if (!payload.ok || !payload.clip) {
          throw new Error(payload.error || "Clip not found");
        }
        setClip(payload.clip);
        setRenameValue(payload.clip.display_name || "");
        setError("");
      } catch (err) {
        setError(err.message || "Failed to load clip");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [clipPath]);

  useEffect(() => {
    fetchOverlayConfig()
      .then((data) => {
        const ui = data.ui || {};
        if (ui.overlay_image_path && ui.overlay_enabled !== false) {
          setOverlayConfig({
            url: "/api/overlay/image",
            x: Number.isFinite(Number(ui.overlay_x)) ? Number(ui.overlay_x) : 0.85,
            y: Number.isFinite(Number(ui.overlay_y)) ? Number(ui.overlay_y) : 0.88,
            width: Number.isFinite(Number(ui.overlay_width)) ? Number(ui.overlay_width) : 0.15,
            opacity: Number.isFinite(Number(ui.overlay_opacity)) ? Number(ui.overlay_opacity) : 0.9,
          });
        } else {
          setOverlayConfig(null);
        }
      })
      .catch(() => {});
  }, []);

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
  }, [clip?.path]);

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
  }, [clipMediaUrl, isMuted, volumeValue]);

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
      const time = fromWindowPercent(pct);
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
  }, [scrubDragging, scrubWindowSpan]);

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

  const handleOpenFolder = async () => {
    if (!clip?.path) return;
    await openClipFolder(clip.path);
  };

  const handleDownload = () => {
    if (!clip?.path) return;
    window.location.href = getClipDownloadUrl(clip.path);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const total = videoRef.current.duration;
    setDuration(total);
    durationRef.current = total;
    if (!clipEnd || clipEnd < 1) {
      setClipEnd(Math.min(total, 30 * 60));
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    currentTimeRef.current = time;
    setCurrentTime(time);
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

  const handleVolumeChange = (event) => {
    const next = Number(event.target.value);
    setVolumeValue(next);
    if (videoRef.current) {
      videoRef.current.volume = next;
      videoRef.current.muted = next === 0;
    }
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

  const handleDelete = async () => {
    if (!clip?.path) return;
    const label = clip.display_name || clip.details?.pretty_time || clip.name || "this clip";
    const confirmed = window.confirm(`Delete ${label}? This will remove the file from disk.`);
    if (!confirmed) return;
    const response = await deleteClip(clip.path);
    if (response.ok) {
      navigate("/clips");
    }
  };

  const handleCreateClip = async () => {
    if (!clip?.path) return;

    setClipStatus("working");
    setClipResult(null);
    try {
      const resp = await createClipRange(clip.path, clipStart, clipEnd);
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
        setClipResult(data.clip_path || null);
      } else {
        setClipStatus("error");
        setClipResult(data.error || "Unknown error");
      }
    } catch (err) {
      setClipStatus("error");
      setClipResult(err.message || "Request failed");
    }
  };

  const saveRename = async () => {
    if (!clip?.path) return;
    setRenameSaving(true);
    try {
      const response = await renameClip(clip.path, renameValue);
      if (!response.ok) return;
      const payload = await response.json();
      const displayName = payload.display_name || "";
      setClip((prev) => (prev ? { ...prev, display_name: displayName } : prev));
      setShowRename(false);
    } finally {
      setRenameSaving(false);
    }
  };

  if (loading) {
    return <ClipsViewerPageSkeleton />;
  }

  if (error) {
    return (
      <section className="card clip-viewer clip-reimagined">
        <button type="button" className="secondary" onClick={() => navigate("/clips")}
          style={{ marginBottom: "12px" }}>
          ← Back to Clips
        </button>
        <div className="clip-meta">{error}</div>
      </section>
    );
  }

  return (
    <section className="vod-viewer-page">
      <div className="vod-viewer">
        <ClipViewerHeader
          viewerTitle={clip?.details?.pretty_time || clip?.name || "Clip Viewer"}
          onBack={() => navigate("/clips")}
          showClipTools={showClipTools}
          onToggleClipTools={() => setShowClipTools((prev) => !prev)}
          onDeleteClip={handleDelete}
          onRenameClip={() => setShowRename(true)}
        />

        {showRename && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: 500, width: 'auto' }}>
              <div className="modal-header">
                <h2>Rename Clip</h2>
                <button className="modal-close" onClick={() => setShowRename(false)} disabled={renameSaving} aria-label="Close Rename Popup">
                  ×
                </button>
              </div>
              <input
                type="text"
                autoFocus
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                placeholder="Display name"
                style={{ fontSize: 16, padding: "8px 12px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", marginBottom: 16 }}
              />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowRename(false)}
                  disabled={renameSaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={renameSaving || !renameValue.trim()}
                  onClick={saveRename}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="vod-content-wrapper">
          <div className="vod-left-section">
            <div className="clip-preview clips-preview-card">
              <div className="clip-preview-heading">
                <div className="clip-preview-title">
                  {clip?.display_name || clip?.details?.pretty_time || clip?.name || ""}
                </div>
                {clip?.details?.above_avg ? (
                  <span className="chip highlight" title={clip?.details?.top_reason}>
                    Top
                  </span>
                ) : null}
                <div className="clip-badges">
                  {clip?.details?.counts ? (
                    <>
                      <span className="chip">Kills: {clip.details.counts.kills}</span>
                      <span className="chip">Assists: {clip.details.counts.assists}</span>
                      <span className="chip">Deaths: {clip.details.counts.deaths}</span>
                    </>
                  ) : null}
                </div>
                <div className="clip-preview-subtitle">
                  {clip?.details?.session_offset || ""}
                </div>
              </div>

              {clip ? (
                <>
                  <ViewerVideoPlayer
                    containerRef={containerRef}
                    videoRef={videoRef}
                    mediaUrl={clipMediaUrl}
                    togglePlayPause={togglePlayPause}
                    handleLoadedMetadata={handleLoadedMetadata}
                    handleTimeUpdate={handleTimeUpdate}
                    onVideoError={() => setError("Unable to load this clip in the viewer.")}
                    overlayConfig={overlayConfig}
                    videoContentRect={videoContentRect}
                    loading={loading}
                  />

                  <ViewerPlaybackControlsPanel
                    hideZoom={true}
                    hideEventMenu={true}
                    showZoomMenu={showZoomMenu}
                    showEventMenu={showEventMenu}
                    showVolume={showVolume}
                    onToggleZoomMenu={handleToggleZoomMenu}
                    onToggleEventMenu={handleToggleEventMenu}
                    showEventJumpButtons={false}
                    jumpToAdjacentEvent={jumpToAdjacentEvent}
                    seekRelative={seekRelative}
                    togglePlayPause={togglePlayPause}
                    isPlaying={isPlaying}
                    onToggleVolume={handleToggleVolume}
                    isMuted={isMuted}
                    cyclePlaybackRate={cyclePlaybackRate}
                    playbackRate={playbackRate}
                    onDownloadMedia={handleDownload}
                    scrubHalfSeconds={scrubHalfSeconds}
                    onSelectZoom={handleSelectZoom}
                    eventFilterOptions={eventFilterOptions}
                    eventFilters={eventFilters}
                    onToggleEventFilter={() => {}}
                    volumeValue={volumeValue}
                    onVolumeChange={handleVolumeChange}
                    toggleMute={toggleMute}
                  />

                  <ViewerScrubTimeline
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

                  <ViewerClipControls
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
                    canCreateClip={Boolean(clip?.path)}
                    createClipTitle={
                      clip?.path
                        ? "Create clip from selected range"
                        : "Clip source unavailable"
                    }
                  />
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
