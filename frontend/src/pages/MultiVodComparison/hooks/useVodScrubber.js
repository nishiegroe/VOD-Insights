import { useState, useCallback, useRef } from "react";

export function useVodScrubber(duration, currentTime, onSeek) {
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState(null);
  const [focusedEventId, setFocusedEventId] = useState(null);
  const scrubberRef = useRef(null);

  const handleMouseDown = useCallback((e) => {
    setIsDragging(true);
    updateTimeFromEvent(e);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      updateTimeFromEvent(e);
    }
    if (scrubberRef.current) {
      const rect = scrubberRef.current.getBoundingClientRect();
      const percentage = (e.clientX - rect.left) / rect.width;
      setHoverTime(Math.max(0, Math.min(duration, percentage * duration)));
    }
  }, [isDragging, duration]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const updateTimeFromEvent = (e) => {
    if (!scrubberRef.current) return;

    const rect = scrubberRef.current.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(duration, percentage * duration));
    onSeek(newTime);
  };

  const handleKeyDown = useCallback(
    (e) => {
      let newTime = currentTime;
      let increment = 1;

      if (e.shiftKey) increment = 10;
      if (e.ctrlKey || e.metaKey) increment = 30;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          newTime = Math.max(0, currentTime - increment);
          onSeek(newTime);
          break;
        case "ArrowRight":
          e.preventDefault();
          newTime = Math.min(duration, currentTime + increment);
          onSeek(newTime);
          break;
        case "Home":
          e.preventDefault();
          onSeek(0);
          break;
        case "End":
          e.preventDefault();
          onSeek(duration);
          break;
        default:
          break;
      }
    },
    [currentTime, duration, onSeek]
  );

  return {
    scrubberRef,
    isDragging,
    hoverTime,
    focusedEventId,
    setFocusedEventId,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleKeyDown,
  };
}
