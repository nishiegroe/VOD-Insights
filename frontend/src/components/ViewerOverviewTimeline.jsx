import React from "react";
import { getEventColor } from "../utils/vodViewer";

export default function ViewerOverviewTimeline({
  duration,
  filteredEvents,
  heatmapActiveBinCount,
  heatmapGradient,
  handleOverviewPointerDown,
  seekToExact,
  formatTime,
  normalizeEvent,
  nearbyEventIds,
  scrubWindowStart,
  scrubWindowEnd,
  overviewDragging,
  handleOverviewWindowPointerDown,
  currentTime,
}) {
  if (duration <= 0) {
    return null;
  }

  return (
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
          onPointerDown={handleOverviewWindowPointerDown}
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
  );
}