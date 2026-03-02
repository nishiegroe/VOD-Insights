import { useEffect, useRef } from "react";

/**
 * Hook for keeping multiple video elements in sync during playback
 * Periodically re-syncs to correct drift
 */
export function usePlaybackSync(state, globalTime) {
  const videoRefsRef = useRef([]);
  const resyncIntervalRef = useRef(null);

  // Periodic re-sync to correct drift (500ms interval)
  useEffect(() => {
    if (!state || state.global_playback_state !== "playing") return;

    resyncIntervalRef.current = setInterval(() => {
      if (!videoRefsRef.current) return;

      state.vods.forEach((vod, index) => {
        const video = videoRefsRef.current[index];
        if (!video) return;

        // Calculate expected time for this VOD (global time + offset)
        const expectedTime = globalTime + vod.offset;
        const actualTime = video.currentTime;
        const drift = Math.abs(expectedTime - actualTime);

        // Re-sync if drift > 100ms
        if (drift > 0.1) {
          video.currentTime = expectedTime;
        }
      });
    }, 500); // Re-sync every 500ms

    return () => {
      if (resyncIntervalRef.current) {
        clearInterval(resyncIntervalRef.current);
      }
    };
  }, [state, globalTime]);

  // Store video element references
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
