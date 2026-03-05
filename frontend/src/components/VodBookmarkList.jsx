import React from "react";

export default function VodBookmarkList({
  bookmarksCollapsed,
  filteredEvents,
  loading,
  bookmarkListRef,
  currentTime,
  nearbyEventIds,
  activeBookmarkRef,
  seekTo,
  formatTime,
  normalizeEvent,
}) {
  if (bookmarksCollapsed) {
    return null;
  }

  return (
    <div className="bookmark-list-container expanded">
      <div className="bookmark-panel-header">
        <h3>Bookmarks ({filteredEvents.length})</h3>
      </div>

      {loading ? (
        <p className="hint">Loading bookmarks...</p>
      ) : filteredEvents.length === 0 ? (
        <p className="hint">No events found with current filters.</p>
      ) : (
        <div className="bookmark-list" ref={bookmarkListRef}>
          {filteredEvents.map((entry) => {
            const isNear = Math.abs(currentTime - entry.seconds) < 2;
            const isNearby = nearbyEventIds.has(entry.id);

            return (
              <div
                key={entry.id}
                ref={isNear ? activeBookmarkRef : null}
                className={`bookmark-item ${isNear ? "active" : ""} ${isNearby ? "nearby" : ""}`}
                onClick={() => seekTo(entry)}
              >
                <div className="bookmark-time">{formatTime(entry.seconds)}</div>
                <div className="bookmark-content">
                  <div className="bookmark-event">{normalizeEvent(entry.event)}</div>
                  {entry.ocr ? <div className="bookmark-ocr">{entry.ocr}</div> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
