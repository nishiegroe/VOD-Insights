import React from "react";

function parseTimeInput(value) {
  const parts = String(value || "").split(":").map(Number);
  let seconds = 0;
  if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
  else if (parts.length === 1) seconds = parts[0];
  return Number.isFinite(seconds) ? seconds : 0;
}

export default function VodClipControls({
  duration,
  showClipTools,
  formatTime,
  clipStart,
  clipEnd,
  scrubWindowStart,
  scrubWindowEnd,
  setClipStart,
  setClipEnd,
  clipStatus,
  clipResult,
  onCreateClip,
}) {
  if (!(duration > 0 && showClipTools)) {
    return null;
  }

  return (
    <div className="clip-controls" style={{ margin: "16px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          Start
          <input
            type="text"
            value={formatTime(clipStart)}
            onChange={(e) => {
              const seconds = parseTimeInput(e.target.value);
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
              const seconds = parseTimeInput(e.target.value);
              setClipEnd(Math.min(scrubWindowEnd, Math.max(seconds, clipStart + 1, scrubWindowStart)));
            }}
            style={{ width: "80px" }}
          />
        </label>

        <button
          className="primary"
          disabled={clipEnd <= clipStart + 1 || clipStatus === "working"}
          title="Create clip from selected range"
          onClick={onCreateClip}
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
  );
}
