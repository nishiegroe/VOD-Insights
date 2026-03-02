import React, { useRef, useEffect } from "react";
import { useVodScrubber } from "../hooks/useVodScrubber";
import IndividualScrubber from "./IndividualScrubber";
import VideoElement from "./VideoElement";
import styles from "../styles/VodPanel.module.scss";

/**
 * Single VOD panel with video element and individual scrubber
 */
export default function VodPanel({
  vod,
  vodIndex,
  globalTime,
  syncMode,
  onSeek,
}) {
  const videoRef = useRef(null);
  const vodScrubber = useVodScrubber(
    vod.duration || 0,
    vod.current_time || 0,
    onSeek
  );

  // Update video element currentTime based on VOD's offset and global time
  useEffect(() => {
    if (!videoRef.current || !vod) return;

    const expectedTime = globalTime + vod.offset;
    const clampedTime = Math.max(0, Math.min(vod.duration || 0, expectedTime));

    // Only update if drift > 50ms (avoid constant updates)
    if (Math.abs(videoRef.current.currentTime - clampedTime) > 0.05) {
      videoRef.current.currentTime = clampedTime;
    }
  }, [globalTime, vod]);

  const formatTime = (seconds) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={styles.panel} tabIndex={0}>
      {/* VOD Title */}
      <div className={styles.title}>
        <h3>{vod.name}</h3>
        <span className={styles.subtitle}>
          {vod.offset !== 0 && (
            <span className={styles.offset}>
              Offset: {vod.offset > 0 ? "+" : ""}{vod.offset}s
            </span>
          )}
        </span>
      </div>

      {/* Video Element */}
      <VideoElement
        ref={videoRef}
        src={vod.path}
        className={styles.video}
      />

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
