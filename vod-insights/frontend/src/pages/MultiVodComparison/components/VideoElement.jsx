import React, { forwardRef, useMemo } from "react";

const VideoElement = forwardRef(({ src, className, muted = true, volume = 0.5 }, ref) => {
  // Convert file path to streaming endpoint URL
  const streamUrl = useMemo(() => {
    if (!src) return "";
    
    // If src is already a URL (starts with http/https), use as-is
    if (src.startsWith("http://") || src.startsWith("https://")) {
      return src;
    }
    
    // Convert file path to streaming endpoint
    // Encode the path to be URL-safe
    const encodedPath = encodeURIComponent(src);
    return `/api/video/stream?path=${encodedPath}`;
  }, [src]);

  return (
    <video
      ref={ref}
      src={streamUrl}
      className={className}
      controls={false}
      muted={muted}
      crossOrigin="anonymous"
      preload="auto"
      playsinline
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
        backgroundColor: "#000",
      }}
    />
  );
});

VideoElement.displayName = "VideoElement";

export default VideoElement;
