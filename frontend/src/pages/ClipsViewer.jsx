import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function ClipsViewer() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const clipPath = searchParams.get("path") || "";

  const videoRef = useRef(null);
  const containerRef = useRef(null);

  const [clip, setClip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [overlayConfig, setOverlayConfig] = useState(null);
  const [videoContentRect, setVideoContentRect] = useState(null);

  const formatDuration = (seconds) => {
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
        const res = await fetch(`/api/clips/lookup?path=${encodeURIComponent(clipPath)}`);
        const payload = await res.json();
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
    fetch("/api/config")
      .then((r) => r.json())
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

  const handleOpenFolder = async () => {
    if (!clip?.path) return;
    await fetch(`/open-folder-path?path=${encodeURIComponent(clip.path)}`, { method: "POST" });
  };

  const handleDownload = () => {
    if (!clip?.path) return;
    window.location.href = `/download-path?path=${encodeURIComponent(clip.path)}`;
  };

  const handleDelete = async () => {
    if (!clip?.path) return;
    const label = clip.display_name || clip.details?.pretty_time || clip.name || "this clip";
    const confirmed = window.confirm(`Delete ${label}? This will remove the file from disk.`);
    if (!confirmed) return;
    const response = await fetch(`/delete-path?path=${encodeURIComponent(clip.path)}`, { method: "POST" });
    if (response.ok) {
      navigate("/clips");
    }
  };

  const saveRename = async () => {
    if (!clip?.path) return;
    setRenameSaving(true);
    try {
      const response = await fetch("/api/clip-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: clip.path, name: renameValue }),
      });
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
    return (
      <section className="card clip-viewer clip-reimagined">
        <div className="clip-meta">Loading clip...</div>
      </section>
    );
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
    <section className="card clip-viewer clip-reimagined clip-viewer-page">
      <div className="clips-header">
        <div>
          <h2>Clip Viewer</h2>
          <div className="clips-subtitle">
            {clip?.details?.pretty_time || clip?.name || ""}
          </div>
        </div>
        <div className="clips-header-actions">
          <button type="button" className="secondary" onClick={() => navigate("/clips")}
            style={{ padding: "0.5rem 1rem" }}>
            Back to Clips
          </button>
        </div>
      </div>

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
        </div>
        <div className="clip-preview-subtitle">
          {clip?.details?.session_offset || ""}
        </div>
        <div className="clips-preview-meta">
          {clip?.details?.pretty_time ? (
            <span className="clips-meta-pill">{clip.details.pretty_time}</span>
          ) : null}
          {clip?.duration ? (
            <span className="clips-meta-pill">Duration: {formatDuration(clip.duration)}</span>
          ) : null}
        </div>
        <div className="clip-preview-actions">
          <button type="button" className="icon-button" onClick={() => setShowRename((prev) => !prev)}>
            {showRename ? "Cancel Rename" : "Rename"}
          </button>
          <button type="button" className="icon-button" onClick={handleOpenFolder}>
            Open Folder
          </button>
          <button type="button" className="icon-button" onClick={handleDownload}>
            Download
          </button>
          <button type="button" className="icon-button danger" onClick={handleDelete}>
            Delete
          </button>
        </div>
        {showRename ? (
          <div className="clip-actions" style={{ alignSelf: "stretch" }}>
            <input
              type="text"
              autoFocus
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              placeholder="Display name"
              style={{ flex: 1, minWidth: 0 }}
            />
            <button
              type="button"
              className="icon-button"
              disabled={renameSaving}
              onClick={saveRename}
            >
              Save
            </button>
          </div>
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
        {clip ? (
          <div ref={containerRef} style={{ position: "relative", display: "inline-block", width: "100%" }}>
            <video
              ref={videoRef}
              controls
              preload="metadata"
              src={`/media-path?path=${encodeURIComponent(clip.path)}`}
              style={{ display: "block", width: "100%" }}
            ></video>
            {overlayConfig && videoContentRect && (
              <div
                style={{
                  position: "absolute",
                  left: videoContentRect.left,
                  top: videoContentRect.top,
                  width: videoContentRect.width,
                  height: videoContentRect.height,
                  pointerEvents: "none",
                  overflow: "hidden",
                }}
              >
                <img
                  src={overlayConfig.url}
                  alt=""
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: `${overlayConfig.x * 100}%`,
                    top: `${overlayConfig.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                    width: `${overlayConfig.width * 100}%`,
                    height: "auto",
                    opacity: overlayConfig.opacity,
                  }}
                />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
