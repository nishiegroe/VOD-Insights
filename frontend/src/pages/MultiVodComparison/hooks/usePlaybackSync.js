import { useEffect, useRef } from "react";

// ====== Configuration Constants ======
/** Maximum allowed drift (seconds) before re-syncing video element */
const DRIFT_THRESHOLD_SECONDS = 0.1; // 100ms

/** How often to check for drift and re-sync (milliseconds) */
const RESYNC_INTERVAL_MS = 500; // Check every 500ms

/**
 * Hook for keeping multiple video elements in sync during playback
 * Periodically re-syncs to correct drift between videos
 * 
 * @param {Object} state - MultiVodState with vods and offsets
 * @param {number} globalTime - Current time from playback clock (seconds)
 */
export function usePlaybackSync(state, globalTime) {
  const videoRefsRef = useRef([]);
  const resyncIntervalRef = useRef(null);

  // Periodic re-sync to keep videos in sync during playback
  useEffect(() => {
    if (!state || state.global_playback_state !== "playing") return;

    resyncIntervalRef.current = setInterval(() => {
      if (!videoRefsRef.current) return;

      state.vods.forEach((vod, index) => {
        const video = videoRefsRef.current[index];
        if (!video) return;

        // Calculate expected time based on global time + this VOD's offset
        const expectedTime = globalTime + vod.offset;
        const actualTime = video.currentTime;
        const drift = Math.abs(expectedTime - actualTime);

        // Re-sync if drift exceeds threshold
        if (drift > DRIFT_THRESHOLD_SECONDS) {
          console.warn(
            `Re-syncing VOD ${index + 1} (drift: ${(drift * 1000).toFixed(0)}ms)`
          );
          video.currentTime = expectedTime;
        }
      });
    }, RESYNC_INTERVAL_MS);

    return () => {
      if (resyncIntervalRef.current) {
        clearInterval(resyncIntervalRef.current);
      }
    };
  }, [state, globalTime]);

  /**
   * Register a video element for sync management
   * @param {number} index - VOD index (0, 1, or 2)
   * @param {HTMLVideoElement} element - Video element to register
   */
  const registerVideoRef = (index, element) => {
    if (!videoRefsRef.current) {
      videoRefsRef.current = [];
    }
    videoRefsRef.current[index] = element;
  };

  return {
    registerVideoRef,
    videoRefsRef,
  };
}
