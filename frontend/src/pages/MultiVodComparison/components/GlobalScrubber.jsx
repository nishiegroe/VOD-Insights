import React, { useState, useRef, useEffect } from "react";
import styles from "../styles/Scrubber.module.scss";

/**
 * Global scrubber that syncs all 3 VODs
 * Shows combined event markers from all VODs
 */
export default function GlobalScrubber({
  state,
  globalTime,
  onSeek,
  syncMode,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState(null);
  const scrubberRef = useRef(null);

  if (!state || !state.vods || state.vods.length === 0) {
    return null;
  }

  // Use longest VOD duration as global duration
  const globalDuration = Math.max(
    ...state.vods.map((v) => v.duration || 0)
  );

  // Collect all event markers from all VODs with color-coding
  const allEventMarkers = state.vods.flatMap((vod, vodIndex) =>
    (vod.events || []).map((event) => ({
      ...event,
      vodIndex,
      vodColor: `hsl(${vodIndex * 120}, 70%, 60%)`,
      percentage: (event.timestamp / globalDuration) * 100,
    }))
  );

  const handleMouseDown = (e) => {
    setIsDragging(true);
    updateTimeFromEvent(e);
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      updateTimeFromEvent(e);
    }

    // Update hover preview
    if (scrubberRef.current) {
      const rect = scrubberRef.current.getBoundingClientRect();
      const percentage = (e.clientX - rect.left) / rect.width;
      setHoverTime(Math.max(0, Math.min(globalDuration, percentage * globalDuration)));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const updateTimeFromEvent = (e) => {
    if (!scrubberRef.current) return;

    const rect = scrubberRef.current.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(globalDuration, percentage * globalDuration));
    onSeek(newTime);
  };

  const handleKeyDown = (e) => {
    let newTime = globalTime;
    let increment = 1;

    if (e.shiftKey) increment = 10;
    if (e.ctrlKey || e.metaKey) increment = 30;

    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        newTime = Math.max(0, globalTime - increment);
        onSeek(newTime);
        break;
      case "ArrowRight":
        e.preventDefault();
        newTime = Math.min(globalDuration, globalTime + increment);
        onSeek(newTime);
        break;
      case "Home":
        e.preventDefault();
        onSeek(0);
        break;
      case "End":
        e.preventDefault();
        onSeek(globalDuration);
        break;
      default:
        break;
    }
  };

  const currentPercentage = (globalTime / globalDuration) * 100;

  return (
    <div className={styles.globalScrubberContainer}>
      <div className={styles.label}>Global Scrubber (Syncs All VODs)</div>

      <div
        className={styles.scrubberContainer}
        ref={scrubberRef}
        role="slider"
        aria-label="Global timeline - syncs all 3 VODs"
        aria-valuemin={0}
        aria-valuemax={globalDuration}
        aria-valuenow={globalTime}
        aria-valuetext={`${Math.floor(globalTime)} seconds out of ${Math.floor(globalDuration)} seconds`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Event markers layer - color-coded by VOD */}
        <div className={styles.eventMarkersLayer}>
          {allEventMarkers.map((marker, idx) => (
            <div
              key={`${marker.vodIndex}-${marker.event_id}-${idx}`}
              className={styles.eventMarker}
              style={{
                left: `${marker.percentage}%`,
                backgroundColor: marker.vodColor,
                opacity: 0.8,
              }}
              title={`${marker.label} (VOD ${marker.vodIndex + 1})`}
              role="img"
              aria-label={`${marker.label} in VOD ${marker.vodIndex + 1} at ${Math.floor(marker.timestamp)} seconds`}
            >
              {marker.type === "kill" ? "⚡" : "💀"}
            </div>
          ))}
        </div>

        {/* Track */}
        <div className={styles.track}>
          <div
            className={styles.played}
            style={{
              width: `${currentPercentage}%`,
              background: "linear-gradient(90deg, #d4a500, #c41e3a, #0066cc)",
            }}
          />
        </div>

        {/* Playhead */}
        <div
          className={`${styles.thumb} ${isDragging ? styles.dragging : ""}`}
          style={{
            left: `${currentPercentage}%`,
            backgroundColor: "#FFD700",
          }}
          aria-hidden="true"
        />

        {/* Hover preview */}
        {hoverTime !== null && (
          <div
            className={styles.hoverPreview}
            style={{ left: `${(hoverTime / globalDuration) * 100}%` }}
          >
            {Math.floor(hoverTime / 60)}:
            {Math.floor(hoverTime % 60)
              .toString()
              .padStart(2, "0")}
          </div>
        )}
      </div>

      {/* Time display */}
      <div className={styles.timeDisplay}>
        <span>
          {Math.floor(globalTime / 60)}:
          {Math.floor(globalTime % 60)
            .toString()
            .padStart(2, "0")}
        </span>
        <span>/</span>
        <span>
          {Math.floor(globalDuration / 60)}:
          {Math.floor(globalDuration % 60)
            .toString()
            .padStart(2, "0")}
        </span>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        {state.vods.map((vod, idx) => (
          <span key={vod.vod_id} className={styles.legendItem}>
            <span
              className={styles.legendColor}
              style={{ backgroundColor: `hsl(${idx * 120}, 70%, 60%)` }}
            />
            VOD {idx + 1}
          </span>
        ))}
      </div>
    </div>
  );
}
