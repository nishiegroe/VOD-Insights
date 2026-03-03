/**
 * NativeVideoPlayer.tsx
 * 
 * React component for native Electron video playback.
 * Wraps useNativeVideo hook and provides UI for video playback.
 * Falls back gracefully if native video is unavailable.
 */

import React, { useRef, useEffect, useState } from "react";
import { useNativeVideo, UseNativeVideoOptions } from "../hooks/useNativeVideo";
import { VideoClientError } from "../services/videoClient";

export interface NativeVideoPlayerProps {
  src?: string;
  className?: string;
  style?: React.CSSProperties;
  muted?: boolean;
  onError?: (error: VideoClientError) => void;
  onTelemetry?: (data: any) => void;
  debug?: boolean;
  containerStyle?: React.CSSProperties;
  allowFallback?: boolean;
}

/**
 * NativeVideoPlayer component
 * 
 * Renders a native Electron video player with fallback support.
 * When native video is unavailable, can optionally fallback to HTML5 video.
 * 
 * @example
 * <NativeVideoPlayer
 *   src="/path/to/video.mp4"
 *   className="video-container"
 *   onError={(error) => console.error(error)}
 * />
 */
export const NativeVideoPlayer = React.forwardRef<
  HTMLDivElement,
  NativeVideoPlayerProps
>(
  (
    {
      src,
      className,
      style = {},
      muted = true,
      onError,
      onTelemetry,
      debug = false,
      containerStyle = {},
      allowFallback = true,
    },
    ref
  ) => {
    const [state, controls] = useNativeVideo({
      filePath: src,
      autoInitialize: true,
      onError,
      onTelemetry,
      debug,
    });

    const containerRef = useRef<HTMLDivElement>(null);
    const [showDebug, setShowDebug] = useState(debug);

    // Combine refs
    useEffect(() => {
      if (ref) {
        if (typeof ref === "function") {
          ref(containerRef.current);
        } else {
          ref.current = containerRef.current;
        }
      }
    }, [ref]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (controls.cleanup) {
          controls.cleanup().catch((error) =>
            console.warn("Error during cleanup:", error)
          );
        }
      };
    }, [controls]);

    // Render error state
    if (!state.isAvailable) {
      return (
        <div
          ref={containerRef}
          className={className}
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: "14px",
            ...containerStyle,
            ...style,
          }}
        >
          <div
            style={{
              textAlign: "center",
              padding: "20px",
            }}
          >
            <p>Native video not available</p>
            <p style={{ fontSize: "12px", color: "#999", marginTop: "10px" }}>
              {state.lastError?.message || "Check Electron context"}
            </p>
            {allowFallback && (
              <p style={{ fontSize: "12px", color: "#666", marginTop: "10px" }}>
                Fallback to HTML5 video recommended
              </p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#000",
          position: "relative",
          ...containerStyle,
          ...style,
        }}
      >
        {/* Native video container (placeholder for actual native rendering) */}
        <div
          id="native-video-container"
          style={{
            width: "100%",
            height: "100%",
            position: "absolute",
            top: 0,
            left: 0,
          }}
        />

        {/* Debug overlay */}
        {showDebug && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              color: "#0f0",
              fontSize: "11px",
              fontFamily: "monospace",
              padding: "8px",
              maxHeight: "120px",
              overflow: "auto",
              zIndex: 1000,
              cursor: "pointer",
            }}
            onClick={() => setShowDebug(false)}
            title="Click to hide debug info"
          >
            <div>🎬 NativeVideoPlayer Debug</div>
            <div>Available: {state.isAvailable ? "✓" : "✗"}</div>
            <div>Initialized: {state.isInitialized ? "✓" : "✗"}</div>
            <div>State: {state.isPlaying ? "playing" : state.isPaused ? "paused" : "stopped"}</div>
            <div>
              Time: {Math.floor(state.currentTime / 1000)}s / {Math.floor(state.duration / 1000)}s
            </div>
            <div>Rate: {state.playbackRate.toFixed(2)}x</div>
            {state.lastError && (
              <div style={{ color: "#f00" }}>
                Error: {state.lastError.code}
              </div>
            )}
            {state.isLoading && <div>⏳ Loading...</div>}
          </div>
        )}

        {/* Overlay for toggling debug (only visible if not showing debug) */}
        {!showDebug && state.isInitialized && (
          <div
            style={{
              position: "absolute",
              bottom: "8px",
              right: "8px",
              padding: "4px 8px",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              color: "#0f0",
              fontSize: "10px",
              cursor: "pointer",
              borderRadius: "4px",
            }}
            onClick={() => setShowDebug(true)}
            title="Click to show debug info"
          >
              🔍
            </div>
        )}
      </div>
    );
  }
);

NativeVideoPlayer.displayName = "NativeVideoPlayer";

export default NativeVideoPlayer;
