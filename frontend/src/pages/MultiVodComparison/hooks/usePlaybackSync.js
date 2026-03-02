import { useEffect, useRef } from "react";

export function usePlaybackSync(state, globalTime) {
  const videoRefsRef = useRef([]);
  const resyncIntervalRef = useRef(null);

  useEffect(() => {
    if (!state || state.global_playback_state !== "playing") return;

    resyncIntervalRef.current = setInterval(() => {
      if (!videoRefsRef.current) return;

      state.vods.forEach((vod, index) => {
        const video = videoRefsRef.current[index];
        if (!video) return;

        const expectedTime = globalTime + vod.offset;
        const actualTime = video.currentTime;
        const drift = Math.abs(expectedTime - actualTime);

        if (drift > 0.1) {
          video.currentTime = expectedTime;
        }
      });
    }, 500);

    return () => {
      if (resyncIntervalRef.current) {
        clearInterval(resyncIntervalRef.current);
      }
    };
  }, [state, globalTime]);

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
