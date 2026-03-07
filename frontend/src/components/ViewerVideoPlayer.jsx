import React from "react";

export default function ViewerVideoPlayer({
  containerRef,
  videoRef,
  mediaUrl,
  togglePlayPause,
  handleLoadedMetadata,
  handleTimeUpdate,
  onVideoError,
  overlayConfig,
  videoContentRect,
  loading,
}) {
  return (
    <div ref={containerRef} className="video-player-container" style={{ position: "relative" }}>
      <video
        ref={videoRef}
        className="vod-video"
        src={mediaUrl}
        autoPlay
        onClick={togglePlayPause}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onError={onVideoError}
      />
      {overlayConfig && videoContentRect && (
        <div
          style={{
            position: "absolute",
            left: videoContentRect.left,
            top: videoContentRect.top,
            width: videoContentRect.width,
            height: videoContentRect.height,
            pointerEvents: "none",
            overflow: "hidden",
          }}
        >
          <img
            src={overlayConfig.url}
            alt=""
            aria-hidden="true"
            style={{
              position: "absolute",
              left: `${overlayConfig.x * 100}%`,
              top: `${overlayConfig.y * 100}%`,
              transform: "translate(-50%, -50%)",
              width: `${overlayConfig.width * 100}%`,
              height: "auto",
              opacity: overlayConfig.opacity,
            }}
          />
        </div>
      )}
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(8, 15, 18, 0.55)",
            color: "var(--text)",
            fontSize: "14px",
            letterSpacing: "0.02em",
          }}
        >
          Loading media...
        </div>
      )}
    </div>
  );
}
