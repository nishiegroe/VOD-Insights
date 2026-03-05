import React from "react";

export default function VodViewerHeader({
  viewerTitle,
  onBack,
  showClipTools,
  onToggleClipTools,
  nearbyManualMarker,
  onToggleManualMarker,
  bookmarksCollapsed,
  onToggleBookmarksCollapsed,
  onDeleteVod,
}) {
  return (
    <div className="vod-viewer-header">
      <div className="vod-viewer-header-left">
        <div className="vod-viewer-app-title">
          <img src="/logo.png" alt="" className="brand-logo brand-logo-compact" aria-hidden="true" />
          <span>VOD Insights</span>
        </div>
        <button onClick={onBack} className="tertiary">
          ← Back to VODs
        </button>
        <div className="vod-viewer-title-compact">{viewerTitle}</div>
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button className="secondary" onClick={onToggleClipTools}>
          {showClipTools ? "Hide Clip" : "Clip"}
        </button>
        <button
          className="secondary"
          onClick={onToggleManualMarker}
          title={
            nearbyManualMarker
              ? "Remove the nearest manual marker (within 10 seconds)"
              : "Add a manual event marker at the current timestamp"
          }
        >
          {nearbyManualMarker ? "Remove Marker" : "Add Marker"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={onToggleBookmarksCollapsed}
          title={bookmarksCollapsed ? "Expand bookmarks" : "Collapse bookmarks"}
        >
          {bookmarksCollapsed ? "Show Bookmarks" : "Hide Bookmarks"}
        </button>
        <button
          type="button"
          className="icon-button danger"
          onClick={onDeleteVod}
          title="Delete VOD"
          aria-label="Delete VOD"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3 6h18M9 6V4h6v2m-7 4v8m4-8v8m4-8v8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M6 6l1 14h10l1-14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
