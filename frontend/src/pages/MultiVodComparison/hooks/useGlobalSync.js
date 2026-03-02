import { useState, useCallback, useRef, useEffect } from "react";

export function useGlobalSync(state, updatePlayback) {
  const [globalTime, setGlobalTime] = useState(0);
  const [syncMode, setSyncMode] = useState("global");
  const playbackClockRef = useRef(null);

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
    if (!state || state.global_playback_state !== "playing") return;

    const interval = setInterval(() => {
      setGlobalTime(calculateGlobalTime());
    }, 50);

    return () => clearInterval(interval);
  }, [state, calculateGlobalTime]);

  const handleGlobalSeek = useCallback(
    async (targetTime) => {
      setGlobalTime(targetTime);

      if (playbackClockRef.current) {
        playbackClockRef.current.baseTime = targetTime;
        playbackClockRef.current.startTime = Date.now();
        if (playbackClockRef.current.isPaused) {
          playbackClockRef.current.pauseTime = targetTime;
        }
      }

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
