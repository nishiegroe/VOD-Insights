import React, { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useMultiVodState } from "./hooks/useMultiVodState";
import { useGlobalSync } from "./hooks/useGlobalSync";
import { usePlaybackSync } from "./hooks/usePlaybackSync";
import MultiVodViewer from "./components/MultiVodViewer";
import EventTimeline from "./components/EventTimeline";
import styles from "./styles/MultiVodComparison.module.scss";

export default function MultiVodComparison() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session");
  const [layout, setLayout] = useState("3-col"); // 3-col, 2-col, 1-col

  // Core state management
  const { state: multiVodState, loading, error, updateOffset, updatePlayback } = useMultiVodState(sessionId);

  // Global sync logic (scrubber drag, seek)
  const { globalTime, syncMode, setSyncMode, handleGlobalSeek, handleIndividualSeek } = useGlobalSync(
    multiVodState,
    updatePlayback
  );

  // Playback sync (keep videos in sync during playback)
  usePlaybackSync(multiVodState, globalTime);

  // Handle responsive layout
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width >= 1920) {
        setLayout("3-col");
      } else if (width >= 768) {
        setLayout("2-col");
      } else {
        setLayout("1-col");
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (loading) {
    return <div className={styles.loading}>Loading VODs...</div>;
  }

  if (error) {
    return <div className={styles.error}>Error: {error}</div>;
  }

  if (!multiVodState) {
    return <div className={styles.error}>No session found</div>;
  }

  return (
    <div className={`${styles.container} ${styles[`layout-${layout}`]}`}>
      {/* Main viewer area */}
      <div className={styles.viewerSection}>
        <MultiVodViewer
          state={multiVodState}
          globalTime={globalTime}
          syncMode={syncMode}
          onGlobalSeek={handleGlobalSeek}
          onIndividualSeek={handleIndividualSeek}
          onOffsetChange={updateOffset}
          onPlaybackChange={updatePlayback}
          onSyncModeChange={setSyncMode}
        />
      </div>

      {/* Event timeline (collapsible) */}
      <div className={styles.eventSection}>
        <EventTimeline vods={multiVodState.vods} globalTime={globalTime} />
      </div>
    </div>
  );
}
