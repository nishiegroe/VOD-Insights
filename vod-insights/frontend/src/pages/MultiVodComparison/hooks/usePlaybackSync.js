import { useRef } from "react";

/**
 * DISABLED: Playback sync hook (duplicate sync pattern)
 * 
 * This hook has been superseded by useGlobalSync which now uses
 * requestAnimationFrame for efficient single-source synchronization.
 * 
 * Keeping this hook for backward compatibility, but it's now a no-op.
 * All video sync is handled by useGlobalSync's RAF-based clock.
 * 
 * @deprecated Use useGlobalSync instead - it provides all sync via RAF
 * @param {Object} state - MultiVodState with vods and offsets
 * @param {number} globalTime - Current time from playback clock (seconds)
 */
export function usePlaybackSync(state, globalTime) {
  const videoRefsRef = useRef([]);

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
