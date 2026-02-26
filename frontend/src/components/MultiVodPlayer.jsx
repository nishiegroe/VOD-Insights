/**
 * MultiVodPlayer Component
 * Renders multiple VOD players with independent scrubbing and sync controls
 */

import React, { useEffect, useMemo, useRef, useState } from "react";

export function MultiVodPlayer({
  vodData = [],
  primaryVodId = null,
  isLinkedPlayback = false,
  activePreviewVodId = null,
  onVodSelect = () => {},
  onVodAdded = () => {},
  onVodRemoved = () => {},
  onPrimaryChange = () => {},
  onLinkedPlaybackChange = () => {},
  onTimeUpdate = () => {},
  onDurationUpdate = () => {},
  className = "",
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState("twitch"); // "twitch" or "local"
  const [newVodUrl, setNewVodUrl] = useState("");
  const [newVodLabel, setNewVodLabel] = useState("");
  const [availableVods, setAvailableVods] = useState([]);
  const [selectedLocalVod, setSelectedLocalVod] = useState("");
  const videoRefs = useRef({});

  const orderedVods = useMemo(() => {
    const primary = vodData.find((vod) => vod.id === primaryVodId);
    const secondary = vodData.filter((vod) => vod.id !== primaryVodId);
    return primary ? [primary, ...secondary] : vodData;
  }, [vodData, primaryVodId]);

  const areAllSynced = useMemo(
    () => vodData.length > 1 && vodData.every((vod) => vod.syncStatus === "synced"),
    [vodData]
  );

  useEffect(() => {
    const nextRefs = {};
    vodData.forEach((vod) => {
      if (videoRefs.current[vod.id]) {
        nextRefs[vod.id] = videoRefs.current[vod.id];
      }
    });
    videoRefs.current = nextRefs;
  }, [vodData]);

  const getVodSrc = (url) => {
    if (/^https?:\/\//i.test(url)) {
      return url;
    }
    return `/media-path?path=${encodeURIComponent(url)}`;
  };

  // Fetch available VODs from the VOD directory
  const fetchAvailableVods = async () => {
    try {
      const response = await fetch("/api/vods?all=1");
      const data = await response.json();
      setAvailableVods(data.vods || []);
    } catch (error) {
      console.error("Error fetching available VODs:", error);
    }
  };

  // Fetch VODs when modal opens
  useEffect(() => {
    if (showAddModal && addMode === "local") {
      fetchAvailableVods();
    }
  }, [showAddModal, addMode]);

  const handleAddVod = () => {
    if (addMode === "twitch") {
      // Add from Twitch URL
      if (!newVodUrl.trim()) {
        alert("Please enter a Twitch VOD URL or select a local VOD");
        return;
      }

      onVodAdded({
        url: newVodUrl.trim(),
        label: newVodLabel.trim() || "Twitch VOD",
      });

      setNewVodUrl("");
      setNewVodLabel("");
      setShowAddModal(false);
    } else {
      // Add from local VOD directory
      if (!selectedLocalVod) {
        alert("Please select a VOD from your library");
        return;
      }

      const vodPath = selectedLocalVod;
      const vodName = vodPath.split("/").pop() || "Local VOD";

      onVodAdded({
        url: vodPath,
        label: newVodLabel.trim() || vodName,
      });

      setNewVodLabel("");
      setSelectedLocalVod("");
      setShowAddModal(false);
    }
  };

  const handleRemoveVod = (vodId) => {
    const vod = vodData.find((v) => v.id === vodId);
    onVodRemoved(vod);
  };

  const handleSetPrimary = (vodId) => {
    onPrimaryChange(vodId);
  };

  const handleTimeUpdate = (vodId, currentTime) => {
    onTimeUpdate({ vodId, currentTime });
  };

  const handleDurationUpdate = (vodId, duration) => {
    onDurationUpdate({ vodId, duration });
  };

  const handleToggleLinkedPlayback = () => {
    onLinkedPlaybackChange(!isLinkedPlayback);
  };

  const handleScrubInput = (vodId, nextTime) => {
    const video = videoRefs.current[vodId];
    if (video) {
      video.currentTime = nextTime;
    }
    handleTimeUpdate(vodId, nextTime);
  };

  const isPrimary = (vodId) => vodId === primaryVodId;

  return (
    <div className={`multi-vod-player ${className}`}>
      {/* Header Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ margin: "0 0 8px 0", color: "var(--text)" }}>
            VODs ({vodData.length})
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              color: "var(--muted)",
            }}
          >
            {areAllSynced
              ? "✓ All VODs synced"
              : vodData.length > 1
                ? "Sync status: " +
                  vodData
                    .filter((v) => v.id !== primaryVodId)
                    .map((v) => v.syncStatus)
                    .join(", ")
                : "Add another VOD to enable sync"}
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            className="secondary"
            onClick={() => setShowAddModal(true)}
            title="Add another VOD"
          >
            + Add VOD
          </button>

          {vodData.length > 1 && (
            <button
              className={isLinkedPlayback ? "primary" : "secondary"}
              onClick={handleToggleLinkedPlayback}
              title={
                isLinkedPlayback
                  ? "Unlink playback (play independently)"
                  : "Link playback (play synchronized)"
              }
            >
              {isLinkedPlayback ? "🔗 Linked" : "⛓️ Unlinked"}
            </button>
          )}

          {vodData.length > 0 && (
            <button
              className="secondary"
              onClick={() => {
                vodData.forEach((vod) => onVodRemoved(vod));
              }}
              title="Remove all VODs"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* VOD Grid */}
      {vodData.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "32px",
            color: "var(--muted)",
            borderRadius: "8px",
            background: "rgba(0, 0, 0, 0.2)",
          }}
        >
          <p>No VODs added yet</p>
          <button
            className="primary"
            onClick={() => setShowAddModal(true)}
            style={{ marginTop: "12px" }}
          >
            + Add Your First VOD
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              vodData.length === 1
                ? "1fr"
                : vodData.length === 2
                  ? "1fr 1fr"
                  : "repeat(auto-fit, minmax(400px, 1fr))",
            gap: "16px",
            marginBottom: "16px",
          }}
        >
          {orderedVods.map((vod) => (
            <div
              key={vod.id}
              style={{
                padding: "12px",
                borderRadius: "8px",
                background: activePreviewVodId === vod.url
                  ? "rgba(125, 211, 252, 0.08)"
                  : isPrimary(vod.id)
                  ? "rgba(255, 179, 71, 0.1)"
                  : "rgba(0, 0, 0, 0.3)",
                border: activePreviewVodId === vod.url
                  ? "2px solid #7dd3fc"
                  : isPrimary(vod.id)
                  ? "2px solid #ffb347"
                  : "1px solid #1f3640",
              }}
            >
              {/* VOD Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                  gap: "8px",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4
                    style={{
                      margin: "0 0 4px 0",
                      color: "#f4f7f8",
                      fontSize: "14px",
                      fontWeight: "600",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {vod.label}
                    {isPrimary(vod.id) && (
                      <span
                        style={{
                          marginLeft: "8px",
                          fontSize: "12px",
                          color: "#ffb347",
                          fontWeight: "normal",
                        }}
                      >
                        (Primary)
                      </span>
                    )}
                  </h4>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "11px",
                      color: "var(--muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {vod.url}
                  </p>
                </div>

                <button
                  className={activePreviewVodId === vod.url ? "primary" : "tertiary"}
                  onClick={() => onVodSelect(vod.url)}
                  title={
                    activePreviewVodId === vod.url
                      ? "Currently viewing — click to return to primary"
                      : "View this VOD in the main player"
                  }
                  style={{ padding: "4px 8px", fontSize: "12px" }}
                >
                  {activePreviewVodId === vod.url ? "Viewing" : "View"}
                </button>

                {!isPrimary(vod.id) && (
                  <button
                    className="tertiary"
                    onClick={() => handleSetPrimary(vod.id)}
                    title="Set as primary VOD"
                    style={{ padding: "4px 8px", fontSize: "12px" }}
                  >
                    Primary
                  </button>
                )}

                <button
                  className="tertiary"
                  onClick={() => handleRemoveVod(vod.id)}
                  title="Remove this VOD"
                  style={{ padding: "4px 8px", fontSize: "12px" }}
                >
                  ✕
                </button>
              </div>

              <div
                style={{
                  borderRadius: "8px",
                  overflow: "hidden",
                  background: "#000",
                  marginBottom: "10px",
                  border: "1px solid #1f3640",
                }}
              >
                <video
                  ref={(el) => {
                    if (el) {
                      videoRefs.current[vod.id] = el;
                    }
                  }}
                  src={getVodSrc(vod.url)}
                  controls
                  preload="metadata"
                  style={{ width: "100%", display: "block", maxHeight: "240px" }}
                  onLoadedMetadata={(event) =>
                    handleDurationUpdate(vod.id, event.currentTarget.duration || 0)
                  }
                  onTimeUpdate={(event) =>
                    handleTimeUpdate(vod.id, event.currentTarget.currentTime || 0)
                  }
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, Number(vod.duration) || 0)}
                  step={0.1}
                  value={Math.min(
                    Math.max(0, Number(vod.currentTime) || 0),
                    Math.max(0, Number(vod.duration) || 0)
                  )}
                  onChange={(event) => handleScrubInput(vod.id, Number(event.target.value || 0))}
                  style={{ width: "100%" }}
                  disabled={(Number(vod.duration) || 0) <= 0}
                />
              </div>

              {/* VOD Status & Timers */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "12px",
                  marginBottom: "12px",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ color: "var(--muted)" }}>
                  <span>
                    {Math.floor(vod.currentTime / 60)}:
                    {String(Math.floor(vod.currentTime % 60)).padStart(
                      2,
                      "0"
                    )}
                  </span>
                  <span style={{ color: "#666" }}> / </span>
                  <span>
                    {Math.floor(vod.duration / 60)}:
                    {String(Math.floor(vod.duration % 60)).padStart(2, "0")}
                  </span>
                </div>

                <div
                  style={{
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background:
                      vod.syncStatus === "synced"
                        ? "rgba(46, 139, 87, 0.3)"
                        : vod.syncStatus === "syncing"
                          ? "rgba(255, 179, 71, 0.3)"
                          : vod.syncStatus === "error"
                            ? "rgba(227, 75, 108, 0.3)"
                            : "rgba(100, 116, 139, 0.3)",
                    color:
                      vod.syncStatus === "synced"
                        ? "#2e8b57"
                        : vod.syncStatus === "syncing"
                          ? "#ffb347"
                          : vod.syncStatus === "error"
                            ? "#e34b6c"
                            : "#64748b",
                    fontSize: "11px",
                    fontWeight: "500",
                  }}
                >
                  {vod.syncStatus === "synced" && "✓ Synced"}
                  {vod.syncStatus === "syncing" && "⏳ Syncing..."}
                  {vod.syncStatus === "error" && "✕ Error"}
                  {vod.syncStatus === "unsync" && "—"}
                </div>
              </div>

              {/* Sync Info */}
              {!isPrimary(vod.id) && vod.syncOffset !== 0 && (
                <div
                  style={{
                    padding: "8px",
                    borderRadius: "4px",
                    background: "rgba(100, 116, 139, 0.1)",
                    fontSize: "11px",
                    color: "var(--muted)",
                    marginTop: "8px",
                  }}
                >
                  Offset: {(vod.syncOffset / 1000).toFixed(2)}s
                  {vod.detectedTimers.length > 0 && (
                    <>
                      <br />
                      Last detected:{" "}
                      {vod.detectedTimers[vod.detectedTimers.length - 1].value}{" "}
                      (
                      {(
                        vod.detectedTimers[vod.detectedTimers.length - 1]
                          .confidence * 100
                      ).toFixed(0)}
                      %)
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add VOD Modal */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false);
            }
          }}
        >
          <div
            style={{
              background: "#13242a",
              borderRadius: "8px",
              padding: "24px",
              maxWidth: "500px",
              width: "90%",
              border: "1px solid #1f3640",
            }}
          >
            <h3 style={{ margin: "0 0 16px 0", color: "#f4f7f8" }}>
              Add Another VOD
            </h3>

            {/* Mode Toggle */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "13px",
                  color: "#9fb0b7",
                  fontWeight: "600",
                }}
              >
                VOD Source
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className={addMode === "twitch" ? "primary" : "secondary"}
                  onClick={() => setAddMode("twitch")}
                  style={{ flex: 1 }}
                >
                  From Twitch
                </button>
                <button
                  className={addMode === "local" ? "primary" : "secondary"}
                  onClick={() => setAddMode("local")}
                  style={{ flex: 1 }}
                >
                  From Library
                </button>
              </div>
            </div>

            {/* Twitch Mode */}
            {addMode === "twitch" && (
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "13px",
                    color: "#9fb0b7",
                    fontWeight: "600",
                  }}
                >
                  Twitch VOD URL
                </label>
                <input
                  type="text"
                  placeholder="https://twitch.tv/videos/123456789"
                  value={newVodUrl}
                  onChange={(e) => setNewVodUrl(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "#0c171b",
                    border: "1px solid #1f3640",
                    borderRadius: "8px",
                    color: "#f4f7f8",
                    fontFamily: "monospace",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleAddVod();
                    }
                  }}
                />
              </div>
            )}

            {/* Local Mode */}
            {addMode === "local" && (
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "13px",
                    color: "#9fb0b7",
                    fontWeight: "600",
                  }}
                >
                  Select VOD from Library
                </label>
                <select
                  value={selectedLocalVod}
                  onChange={(e) => setSelectedLocalVod(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "#0c171b",
                    border: "1px solid #1f3640",
                    borderRadius: "8px",
                    color: "#f4f7f8",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="">-- Choose a VOD --</option>
                  {availableVods.map((vod) => (
                    <option key={vod.path} value={vod.path}>
                      {vod.name || vod.path.split("/").pop()}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Label (for both modes) */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "13px",
                  color: "#9fb0b7",
                  fontWeight: "600",
                }}
              >
                Label (optional)
              </label>
              <input
                type="text"
                placeholder="e.g., Alt Angle, Overlay, POV 2"
                value={newVodLabel}
                onChange={(e) => setNewVodLabel(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "#0c171b",
                  border: "1px solid #1f3640",
                  borderRadius: "8px",
                  color: "#f4f7f8",
                  fontFamily: "monospace",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                className="secondary"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button className="primary" onClick={handleAddVod}>
                Add VOD
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
