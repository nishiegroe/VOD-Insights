import React from "react";
import VodPanel from "./VodPanel";
import GlobalScrubber from "./GlobalScrubber";
import PlaybackControls from "./PlaybackControls";
import OffsetPanel from "./OffsetPanel";
import styles from "../styles/MultiVodViewer.module.scss";

/**
 * Main layout component for multi-VOD comparison
 * Manages 3-column grid, global scrubber, and controls
 */
export default function MultiVodViewer({
  state,
  globalTime,
  syncMode,
  onGlobalSeek,
  onIndividualSeek,
  onOffsetChange,
  onPlaybackChange,
  onSyncModeChange,
}) {
  if (!state || !state.vods) {
    return <div className={styles.error}>No VODs loaded</div>;
  }

  return (
    <div className={styles.container}>
      {/* VOD Panels Grid */}
      <div className={styles.grid}>
        {state.vods.map((vod, index) => (
          <VodPanel
            key={vod.vod_id}
            vod={vod}
            vodIndex={index}
            globalTime={globalTime}
            syncMode={syncMode}
            onSeek={
              syncMode === "global"
                ? (time) => onGlobalSeek(time)
                : (time) => onIndividualSeek(index, time)
            }
          />
        ))}
      </div>

      {/* Global Scrubber */}
      <div className={styles.globalScrubberContainer}>
        <GlobalScrubber
          state={state}
          globalTime={globalTime}
          onSeek={onGlobalSeek}
          syncMode={syncMode}
        />
      </div>

      {/* Playback Controls */}
      <div className={styles.controlsContainer}>
        <PlaybackControls
          isPlaying={state.global_playback_state === "playing"}
          onPlayPause={(action) => onPlaybackChange(action)}
          onSyncModeChange={onSyncModeChange}
          currentSyncMode={syncMode}
        />
      </div>

      {/* Offset Controls */}
      <div className={styles.offsetContainer}>
        <OffsetPanel
          vods={state.vods}
          onOffsetChange={onOffsetChange}
        />
      </div>
    </div>
  );
}
