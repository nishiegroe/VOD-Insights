import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Hook for managing global scrubber sync logic
 * Handles global seeks and determines sync mode (independent vs global)
 */
export function useGlobalSync(state, updatePlayback) {
  const [globalTime, setGlobalTime] = useState(0);
  const [syncMode, setSyncMode] = useState("global"); // "global" or "independent"
  const playbackClockRef = useRef(null);

  // Initialize playback clock
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

  // Calculate global time from playback clock
  const calculateGlobalTime = useCallback(() => {
    if (!playbackClockRef.current) return 0;

    const clock = playbackClockRef.current;
    if (clock.isPaused) {
      return clock.pauseTime;
    }

    const elapsed = (Date.now() - clock.startTime) / 1000 * clock.speed;
    return Math.max(0, clock.baseTime + elapsed);
  }, []);

  // Update global time continuously during playback
  useEffect(() => {
    if (!state || state.global_playback_state !== "playing") return;

    const interval = setInterval(() => {
      setGlobalTime(calculateGlobalTime());
    }, 50); // Update every 50ms for smooth playback

    return () => clearInterval(interval);
  }, [state, calculateGlobalTime]);

  // Handle global scrubber seek
  const handleGlobalSeek = useCallback(
    async (targetTime) => {
      setGlobalTime(targetTime);

      // Update playback clock
      if (playbackClockRef.current) {
        playbackClockRef.current.baseTime = targetTime;
        playbackClockRef.current.startTime = Date.now();
        if (playbackClockRef.current.isPaused) {
          playbackClockRef.current.pauseTime = targetTime;
        }
      }

      // In global sync mode, seek all VODs
      if (syncMode === "global") {
        try {
          await fetch(`/api/sessions/multi-vod/${state.sessionId}/global-seek`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timestamp: targetTime }),
          });
        } catch (err) {
          console.error("Error during global seek:", err);
        }
      }
    },
    [state, syncMode]
  );

  // Handle individual VOD seek (independent mode)
  const handleIndividualSeek = useCallback(
    async (vodIndex, targetTime) => {
      if (!state) return;

      const vod = state.vods[vodIndex];
      try {
        await fetch(
          `/api/sessions/multi-vod/${state.sessionId}/vods/${vod.vod_id}/seek`,
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
    [state]
  );

  return {
    globalTime,
    syncMode,
    setSyncMode,
    handleGlobalSeek,
    handleIndividualSeek,
  };
}
