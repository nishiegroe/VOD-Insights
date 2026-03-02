import React, { forwardRef } from "react";

const VideoElement = forwardRef(({ src, className, muted = true, volume = 0.5 }, ref) => {
  return (
    <video
      ref={ref}
      src={src}
      className={className}
      controls={false}
      muted={muted}
      crossOrigin="anonymous"
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
