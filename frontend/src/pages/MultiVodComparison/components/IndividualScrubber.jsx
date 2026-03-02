import React, { useEffect, useState } from "react";
import styles from "../styles/Scrubber.module.scss";

/**
 * Individual scrubber for single VOD
 * Includes event markers, track, and playhead
 */
export default function IndividualScrubber({
  vod,
  vodIndex,
  vodScrubber,
  onSeek,
}) {
  const [eventMarkers, setEventMarkers] = useState([]);

  // Extract and position event markers
  useEffect(() => {
    if (!vod.events || !vod.duration) return;

    const markers = vod.events.map((event) => ({
      ...event,
      percentage: (event.timestamp / vod.duration) * 100,
    }));

    setEventMarkers(markers);
  }, [vod.events, vod.duration]);

  if (!vod.duration) {
    return <div className={styles.scrubberEmpty}>Loading...</div>;
  }

  const currentPercentage = (vod.current_time / vod.duration) * 100;

  return (
    <div
      className={styles.scrubberContainer}
      ref={vodScrubber.scrubberRef}
      role="slider"
      aria-label={`${vod.name} timeline`}
      aria-valuemin={0}
      aria-valuemax={vod.duration}
      aria-valuenow={vod.current_time || 0}
      aria-valuetext={`${Math.floor(vod.current_time || 0)} seconds out of ${Math.floor(vod.duration)} seconds`}
      tabIndex={0}
      onKeyDown={vodScrubber.handleKeyDown}
      onMouseDown={vodScrubber.handleMouseDown}
      onMouseMove={vodScrubber.handleMouseMove}
      onMouseUp={vodScrubber.handleMouseUp}
      onMouseLeave={vodScrubber.handleMouseUp}
    >
      {/* Event markers layer */}
      <div className={styles.eventMarkersLayer}>
        {eventMarkers.map((marker) => (
          <div
            key={marker.event_id}
            className={styles.eventMarker}
            style={{
              left: `${marker.percentage}%`,
              backgroundColor: marker.color || "#FFD700",
            }}
            title={marker.label}
            role="img"
            aria-label={`${marker.label} at ${Math.floor(marker.timestamp)} seconds`}
          >
            <span className={styles.markerIcon}>{marker.type === "kill" ? "⚡" : "💀"}</span>
          </div>
        ))}
      </div>

      {/* Scrubber track */}
      <div className={styles.track}>
        <div
          className={styles.played}
          style={{
            width: `${currentPercentage}%`,
            backgroundColor: `hsl(${vodIndex * 120}, 70%, 60%)`, // VOD color
          }}
        />
      </div>

      {/* Scrubber thumb (playhead) */}
      <div
        className={`${styles.thumb} ${vodScrubber.isDragging ? styles.dragging : ""}`}
        style={{
          left: `${currentPercentage}%`,
          backgroundColor: `hsl(${vodIndex * 120}, 70%, 60%)`,
        }}
        aria-hidden="true"
      />

      {/* Hover preview */}
      {vodScrubber.hoverTime !== null && (
        <div
          className={styles.hoverPreview}
          style={{ left: `${(vodScrubber.hoverTime / vod.duration) * 100}%` }}
        >
          {Math.floor(vodScrubber.hoverTime / 60)}:
          {Math.floor(vodScrubber.hoverTime % 60)
            .toString()
            .padStart(2, "0")}
        </div>
      )}
    </div>
  );
}
