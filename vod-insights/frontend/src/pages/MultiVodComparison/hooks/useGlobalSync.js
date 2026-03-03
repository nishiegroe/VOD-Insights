import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Hook for managing global scrubber sync logic
 * Optimized with requestAnimationFrame for smooth 55-60fps playback
 * Handles global seeks and determines sync mode (independent vs global)
 * 
 * @param {Object} state - MultiVodState from backend
 * @param {string} sessionId - Session ID from URL query params
 * @param {Function} updatePlayback - Callback to update playback state
 */
export function useGlobalSync(state, sessionId, updatePlayback) {
  const [globalTime, setGlobalTime] = useState(0);
  const [syncMode, setSyncMode] = useState("global");
  const playbackClockRef = useRef(null);
  const rafIdRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);

  useEffect(() => {
    if (!state) return;

    playbackClockRef.current = {
      startTime: Date.now(),
      baseTime: state.vods[0].current_time || 0,
      isPaused: state.global_playback_state === "paused",
      pauseTime: null,
      speed: state.sync_config?.speed || 1.0,
    };
  }, [state]);

  const calculateGlobalTime = useCallback(() => {
    if (!playbackClockRef.current) return 0;

    const clock = playbackClockRef.current;
    if (clock.isPaused) {
      return clock.pauseTime;
    }

    const elapsed = (Date.now() - clock.startTime) / 1000 * clock.speed;
    return Math.max(0, clock.baseTime + elapsed);
  }, []);

  useEffect(() => {
    if (!state || state.global_playback_state !== "playing") {
      // Cancel RAF if not playing
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      return;
    }

    // Use requestAnimationFrame for smooth 55-60fps updates
    // Only update state when time change is significant (>16ms gap = 60fps)
    const updateFrame = () => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
      
      // Update at most once per 16ms (60fps) but allow smaller gaps
      if (timeSinceLastUpdate >= 16) {
        const newTime = calculateGlobalTime();
        setGlobalTime(newTime);
        lastUpdateTimeRef.current = now;
      }
      
      rafIdRef.current = requestAnimationFrame(updateFrame);
    };

    rafIdRef.current = requestAnimationFrame(updateFrame);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [state, calculateGlobalTime]);

  const handleGlobalSeek = useCallback(
    async (targetTime) => {
      // Always update local state
      setGlobalTime(targetTime);
      lastUpdateTimeRef.current = Date.now();

      if (playbackClockRef.current) {
        playbackClockRef.current.baseTime = targetTime;
        playbackClockRef.current.startTime = Date.now();
        if (playbackClockRef.current.isPaused) {
          playbackClockRef.current.pauseTime = targetTime;
        }
      }

      // Only call API if sessionId is available
      if (!sessionId) {
        console.error("Session ID not available for global seek");
        return;
      }

      if (syncMode === "global") {
        try {
          await fetch(`/api/sessions/multi-vod/${sessionId}/global-seek`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timestamp: targetTime }),
          });
        } catch (err) {
          console.error("Error during global seek:", err);
        }
      }
    },
    [sessionId, syncMode]
  );

  const handleIndividualSeek = useCallback(
    async (vodIndex, targetTime) => {
      if (!state || !sessionId) return;

      const vod = state.vods[vodIndex];
      try {
        await fetch(
          `/api/sessions/multi-vod/${sessionId}/vods/${vod.vod_id}/seek`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timestamp: targetTime }),
          }
        );
      } catch (err) {
        console.error("Error during individual seek:", err);
      }
    },
    [state, sessionId]
  );

  return {
    globalTime,
    syncMode,
    setSyncMode,
    handleGlobalSeek,
    handleIndividualSeek,
  };
}
