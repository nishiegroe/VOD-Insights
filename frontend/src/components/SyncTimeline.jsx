/**
 * SyncTimeline Component
 * Displays synchronization events and timeline for multi-VOD playback
 */

import React, { useMemo } from "react";
import { generateSyncTimeline, formatTime } from "../utils/vodSyncUtils";

export function SyncTimeline({
  vods = [],
  currentTime = 0,
  onTimeClick = () => {},
  className = "",
}) {
  const timeline = useMemo(() => generateSyncTimeline(vods), [vods]);

  if (!timeline || timeline.length === 0) {
    return null;
  }

  // Calculate percentage for positioning on timeline
  const maxDuration = Math.max(...vods.map((v) => v.duration), 1);
  const currentPercent = (currentTime / maxDuration) * 100;

  return (
    <div className={`sync-timeline ${className}`}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
          fontSize: "13px",
        }}
      >
        <h4 style={{ margin: 0, color: "#f4f7f8", fontWeight: "600" }}>
          📍 Sync Timeline ({timeline.length} events)
        </h4>
        <span style={{ color: "#9fb0b7", fontSize: "12px" }}>
          Current: {formatTime(currentTime)}
        </span>
      </div>

      {/* Timeline Bar */}
      <div
        style={{
          position: "relative",
          height: "40px",
          background: "linear-gradient(90deg, #0c171b 0%, #1f3640 50%, #0c171b 100%)",
          borderRadius: "6px",
          border: "1px solid #1f3640",
          marginBottom: "12px",
          overflow: "hidden",
          cursor: "pointer",
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const percent = (e.clientX - rect.left) / rect.width;
          const newTime = percent * maxDuration;
          onTimeClick(newTime);
        }}
      >
        {/* Timeline Events */}
        {timeline.map((event, idx) => {
          const percent = (event.timestamp / maxDuration) * 100;
          return (
            <div
              key={idx}
              style={{
                position: "absolute",
                left: `${percent}%`,
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: "12px",
                height: "24px",
                borderRadius: "2px",
                background: "#ffb347",
                border: "1px solid #ff7043",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.width = "16px";
                e.currentTarget.style.height = "28px";
                e.currentTarget.style.background = "#ff7043";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.width = "12px";
                e.currentTarget.style.height = "24px";
                e.currentTarget.style.background = "#ffb347";
              }}
              onClick={(e) => {
                e.stopPropagation();
                onTimeClick(event.timestamp);
              }}
              title={`${event.timer} - ${event.vodCount} VODs match`}
            />
          );
        })}

        {/* Current Time Indicator */}
        <div
          style={{
            position: "absolute",
            left: `${currentPercent}%`,
            top: 0,
            bottom: 0,
            width: "2px",
            background: "#ffd46a",
            transform: "translateX(-50%)",
            zIndex: 10,
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Events List */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          maxHeight: "200px",
          overflowY: "auto",
        }}
      >
        {timeline.map((event, idx) => {
          const isNear = Math.abs(event.timestamp - currentTime) < 5;
          return (
            <div
              key={idx}
              onClick={() => onTimeClick(event.timestamp)}
              style={{
                padding: "8px",
                borderRadius: "6px",
                background: isNear
                  ? "rgba(255, 179, 71, 0.15)"
                  : "rgba(0, 0, 0, 0.2)",
                border: isNear ? "1px solid #ffb347" : "1px solid #1f3640",
                cursor: "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 179, 71, 0.15)";
                e.currentTarget.style.border = "1px solid #ffb347";
              }}
              onMouseLeave={(e) => {
                if (!isNear) {
                  e.currentTarget.style.background = "rgba(0, 0, 0, 0.2)";
                  e.currentTarget.style.border = "1px solid #1f3640";
                }
              }}
            >
              {/* Left: Timer and VODs */}
              <div>
                <div
                  style={{
                    color: "#ffb347",
                    fontWeight: "600",
                    fontSize: "13px",
                    marginBottom: "2px",
                  }}
                >
                  {event.timer}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#9fb0b7",
                  }}
                >
                  {event.vodMatches.map((m) => m.vodLabel).join(", ")}
                </div>
              </div>

              {/* Right: Confidence and Position */}
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#9fb0b7",
                    marginBottom: "2px",
                  }}
                >
                  {formatTime(event.timestamp)}
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    color: "#2e8b57",
                    fontWeight: "500",
                  }}
                >
                  {Math.round(event.avgConfidence * 100)}% match
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info */}
      <div
        style={{
          marginTop: "12px",
          padding: "8px",
          borderRadius: "4px",
          background: "rgba(100, 116, 139, 0.1)",
          fontSize: "11px",
          color: "#9fb0b7",
        }}
      >
        Click on timeline events to jump to sync points where timers match across
        VODs
      </div>
    </div>
  );
}
