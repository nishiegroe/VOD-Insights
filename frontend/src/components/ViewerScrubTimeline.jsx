import React from "react";
import { getEventColor } from "../utils/vodViewer";

export default function ViewerScrubTimeline({
  duration,
  scrubWindowStart,
  scrubWindowEnd,
  formatTime,
  timelineRef,
  handleZoomWheel,
  handleTimelinePointerDown,
  windowEvents,
  currentTime,
  nearbyEventIds,
  toWindowPercent,
  seekToExact,
  normalizeEvent,
  showClipTools,
  windowClipStart,
  windowClipEnd,
  scrubWindowSpan,
  draggingHandle,
  handleRangeBarPointerDown,
  handleScrubHandlePointerDown,
  handleClipStartHandlePointerDown,
  handleClipEndHandlePointerDown,
}) {
  if (duration <= 0) {
    return null;
  }

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
          onPointerDown={handleRangeBarPointerDown}
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
          onPointerDown={handleScrubHandlePointerDown}
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
          onPointerDown={handleClipStartHandlePointerDown}
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
          onPointerDown={handleClipEndHandlePointerDown}
          title="Drag to set clip end"
        />
      </div>
      <div style={{ minWidth: "58px", textAlign: "left", fontSize: "12px", color: "var(--muted)" }}>
        {formatTime(scrubWindowEnd)}
      </div>
    </div>
  );
}
