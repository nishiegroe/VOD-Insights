import React from "react";
import { ZOOM_OPTIONS, getEventColor } from "../utils/vodViewer";

export default function VodPlaybackControlsPanel({
  showZoomMenu,
  showEventMenu,
  showVolume,
  onToggleZoomMenu,
  onToggleEventMenu,
  jumpToAdjacentEvent,
  seekRelative,
  togglePlayPause,
  isPlaying,
  onToggleVolume,
  isMuted,
  cyclePlaybackRate,
  playbackRate,
  downloadVod,
  scrubHalfSeconds,
  onSelectZoom,
  eventFilterOptions,
  eventFilters,
  onToggleEventFilter,
  volumeValue,
  onVolumeChange,
  toggleMute,
}) {
  return (
    <>
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          marginTop: "8px",
          minHeight: "36px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-start" }}>
          <button
            className={showZoomMenu ? "primary" : "secondary"}
            onClick={onToggleZoomMenu}
            title="Zoom controls"
          >
            🔍 Zoom
          </button>

          <button
            className={showEventMenu ? "primary" : "secondary"}
            onClick={onToggleEventMenu}
            title="Event filters"
          >
            🔎 Events
          </button>
        </div>
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <button className="secondary" onClick={() => jumpToAdjacentEvent(-1)} title="Previous event ([)">
            Prev Event
          </button>
          <button className="tertiary" onClick={() => seekRelative(-300)}>−5m</button>
          <button className="tertiary" onClick={() => seekRelative(-30)}>−30s</button>
          <button
            className="primary"
            onClick={togglePlayPause}
            title={isPlaying ? "Pause" : "Play"}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <rect x="3" y="2" width="4" height="12" rx="1" fill="currentColor" />
                <rect x="9" y="2" width="4" height="12" rx="1" fill="currentColor" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <polygon points="3,2 13,8 3,14" fill="currentColor" />
              </svg>
            )}
          </button>
          <button className="tertiary" onClick={() => seekRelative(10)}>+10s</button>
          <button className="tertiary" onClick={() => seekRelative(300)}>+5m</button>
          <button className="secondary" onClick={() => jumpToAdjacentEvent(1)} title="Next event (])">
            Next Event
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-end" }}>
          <button
            className="tertiary"
            onClick={onToggleVolume}
            title={isMuted ? "Unmute" : "Volume"}
            aria-label={isMuted ? "Unmute" : "Volume"}
          >
            {isMuted ? (
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3 6v4h3l4 3V3L6 6H3z" fill="currentColor" />
                <path d="M12 5l3 3m0-3l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3 6v4h3l4 3V3L6 6H3z" fill="currentColor" />
                <path d="M12 4c1.5 1.5 1.5 6.5 0 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </button>
          <button className="tertiary" onClick={cyclePlaybackRate} title="Playback speed">
            {playbackRate}x
          </button>
          <button className="tertiary" onClick={downloadVod} title="Download VOD" aria-label="Download VOD">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 2v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M5 6l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {(showZoomMenu || showEventMenu || showVolume) && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "16px",
            marginTop: "6px",
            width: "100%",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: "1 1 360px" }}>
            {showZoomMenu && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {ZOOM_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    className={`zoom-button ${option.halfSeconds === scrubHalfSeconds ? "primary" : "secondary"}`}
                    onClick={() => onSelectZoom(option.halfSeconds)}
                    style={{ height: "32px" }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            {showEventMenu && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {eventFilterOptions.map((option) => (
                  <button
                    key={option.key}
                    className={eventFilters[option.key] !== false ? "primary" : "secondary"}
                    onClick={() => onToggleEventFilter(option.key)}
                    style={{ height: "30px", padding: "0 10px" }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: "8px",
                        height: "8px",
                        borderRadius: "999px",
                        background: getEventColor(option.key),
                        boxShadow: "0 0 4px rgba(0, 0, 0, 0.3)",
                        marginRight: "6px",
                        transform: "translateY(1px)",
                      }}
                    />
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {showVolume && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                justifyContent: "flex-end",
                flex: "0 0 auto",
              }}
            >
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volumeValue}
                onChange={onVolumeChange}
                style={{ width: "180px" }}
              />
              <button
                className="tertiary"
                onClick={toggleMute}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? "Unmute" : "Mute"}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
