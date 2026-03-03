/**
 * VodPanelWithNativeSupport.jsx
 * 
 * Enhanced VOD panel that supports both native and HTML5 video playback.
 * Conditionally renders NativeVideoContainer or VideoElement based on:
 * - Feature flag (enableNativeVideo)
 * - vodIndex (first video gets native, others HTML5)
 * - Error handling (falls back to HTML5 on native errors)
 * 
 * Phase 2: Updated comparison view with native video support
 */

import React, { useRef, useEffect, useState } from "react";
import { useVodScrubber } from "../hooks/useVodScrubber";
import { isNativeVideoEnabled } from "../../../config/videoFeatureFlags";
import NativeVideoContainer from "../../../components/NativeVideoContainer";
import IndividualScrubber from "./IndividualScrubber";
import VideoElement from "./VideoElement";
import styles from "../styles/VodPanel.module.scss";

/**
 * Determine if this VOD panel should use native video
 * - Only first video (index 0) uses native
 * - Feature flag must be enabled
 * - User hasn't seen errors on this video
 */
function shouldUseNativeVideo(vodIndex, nativeVideoEnabled, hasNativeError) {
  // Only first video uses native
  if (vodIndex !== 0) return false;
  
  // Feature flag must be enabled
  if (!nativeVideoEnabled) return false;
  
  // Fallback if we've seen errors
  if (hasNativeError) return false;
  
  return true;
}

export default function VodPanelWithNativeSupport({
  vod,
  vodIndex,
  globalTime,
  syncMode,
  onSeek,
  enablePerformanceMonitoring = false,
  enableDebugOverlay = false,
}) {
  const videoRef = useRef(null);
  const nativeVideoRef = useRef(null);
  
  // Feature flag state
  const [nativeVideoEnabled] = useState(() => isNativeVideoEnabled());
  const [hasNativeError, setHasNativeError] = useState(false);
  
  // Determine which video type to use
  const useNative = shouldUseNativeVideo(vodIndex, nativeVideoEnabled, hasNativeError);
  
  // Add null-safety check for vod
  if (!vod) {
    return <div className={styles.panel}>No VOD data available</div>;
  }
  
  const vodScrubber = useVodScrubber(
    vod.duration || 0,
    vod.current_time || 0,
    onSeek
  );

  // Update video element currentTime based on VOD's offset and global time (HTML5 only)
  useEffect(() => {
    if (useNative) return; // Skip for native video
    
    if (!videoRef.current || !vod) return;

    const expectedTime = globalTime + vod.offset;
    const clampedTime = Math.max(0, Math.min(vod.duration || 0, expectedTime));
    const currentTime = videoRef.current.currentTime;

    // Only update if drift > 100ms (reduces jitter, matches 40Hz refresh rate)
    if (Math.abs(currentTime - clampedTime) > 0.1) {
      videoRef.current.currentTime = clampedTime;
    }
  }, [globalTime, vod, useNative]);

  const formatTime = (seconds) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle native video errors - fallback to HTML5
  const handleNativeError = (error) => {
    console.error(`[VOD ${vodIndex}] Native video error:`, error);
    setHasNativeError(true);
    
    // Show error message briefly
    const errorEl = document.createElement("div");
    errorEl.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255, 0, 0, 0.8);
      color: white;
      padding: 20px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 999;
    `;
    errorEl.textContent = `Native playback failed, using HTML5\n${error.message}`;
    
    const panel = document.querySelector(`[data-vod-index="${vodIndex}"]`);
    if (panel) {
      panel.appendChild(errorEl);
      setTimeout(() => errorEl.remove(), 3000);
    }
  };

  return (
    <div 
      className={styles.panel} 
      tabIndex={0}
      data-vod-index={vodIndex}
      data-use-native={useNative}
    >
      {/* VOD Title */}
      <div className={styles.title}>
        <h3>
          {vod.name}
          {useNative && <span style={{ marginLeft: "8px", fontSize: "12px", color: "#0f0" }}>● Native</span>}
        </h3>
        <span className={styles.subtitle}>
          {vod.offset !== 0 && (
            <span className={styles.offset}>
              Offset: {vod.offset > 0 ? "+" : ""}{vod.offset}s
            </span>
          )}
        </span>
      </div>

      {/* Video Element - Native or HTML5 */}
      {useNative ? (
        <NativeVideoContainer
          ref={nativeVideoRef}
          src={vod.path}
          vodIndex={vodIndex}
          vodId={vod.vod_id}
          globalTime={globalTime}
          playbackRate={1.0}
          className={styles.video}
          onError={handleNativeError}
          enablePerformanceMonitoring={enablePerformanceMonitoring}
          enableDebugOverlay={enableDebugOverlay}
        />
      ) : (
        <VideoElement
          ref={videoRef}
          src={vod.path}
          className={styles.video}
        />
      )}

      {/* Individual Scrubber */}
      <IndividualScrubber
        vod={vod}
        vodIndex={vodIndex}
        vodScrubber={vodScrubber}
        onSeek={onSeek}
      />

      {/* Time Display */}
      <div className={styles.timeInfo}>
        <span className={styles.currentTime}>
          {formatTime(vod.current_time || 0)}
        </span>
        <span className={styles.separator}>/</span>
        <span className={styles.duration}>
          {formatTime(vod.duration || 0)}
        </span>
      </div>
    </div>
  );
}
