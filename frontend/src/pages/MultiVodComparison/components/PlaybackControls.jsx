import React from "react";
import styles from "../styles/PlaybackControls.module.scss";

/**
 * Playback control buttons (play/pause, sync mode toggle)
 */
export default function PlaybackControls({
  isPlaying,
  onPlayPause,
  onSyncModeChange,
  currentSyncMode,
}) {
  return (
    <div className={styles.controls}>
      {/* Play/Pause button */}
      <button
        className={styles.playPauseButton}
        onClick={() => onPlayPause(isPlaying ? "pause" : "play")}
        aria-label={isPlaying ? "Pause all videos" : "Play all videos"}
        aria-pressed={isPlaying}
        title={isPlaying ? "Pause (Space)" : "Play (Space)"}
      >
        {isPlaying ? "⏸ Pause" : "▶ Play"}
      </button>

      {/* Sync mode toggle */}
      <div className={styles.syncModeGroup}>
        <label htmlFor="sync-mode">Sync Mode:</label>
        <select
          id="sync-mode"
          className={styles.syncModeSelect}
          value={currentSyncMode}
          onChange={(e) => onSyncModeChange(e.target.value)}
          aria-label="Select sync mode: global or independent"
        >
          <option value="global">Global (All Synced)</option>
          <option value="independent">Independent (Manual)</option>
        </select>
      </div>

      {/* Help text */}
      <span className={styles.helpText}>
        {currentSyncMode === "global"
          ? "Scrubbers sync all 3 VODs together"
          : "Each VOD scrubber moves independently"}
      </span>
    </div>
  );
}
