/**
 * ProgressBar.tsx
 * 
 * Progress bar component for video playback progress visualization.
 * Features: Draggable scrubber, visual progress indication, buffer status.
 * Part of Phase 2: React UI Components for Native Video (Days 6-10)
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import "./ProgressBar.css";

export interface ProgressBarProps {
  /** Current playback time in milliseconds */
  currentTime: number;

  /** Total duration in milliseconds */
  duration: number;

  /** Percentage of video buffered (0-100) */
  buffered?: number;

  /** Called when user drags the scrubber */
  onSeek: (timeMs: number) => void | Promise<void>;

  /** Whether seeking is allowed */
  canSeek?: boolean;

  /** Show/hide timestamps on hover */
  showTimestampPreview?: boolean;

  /** CSS class for styling */
  className?: string;

  /** Additional styling */
  style?: React.CSSProperties;

  /** Disabled state */
  disabled?: boolean;
}

/**
 * Format milliseconds to HH:MM:SS or MM:SS format
 */
function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

/**
 * ProgressBar: Draggable progress indicator for video playback
 * 
 * Features:
 * - Visual progress bar
 * - Draggable scrubber thumb
 * - Buffer/loaded progress indication
 * - Timestamp preview on hover
 * - Keyboard support (arrow keys when focused)
 * - Touch-friendly
 * 
 * @example
 * <ProgressBar
 *   currentTime={30500}
 *   duration={120000}
 *   buffered={65}
 *   onSeek={(timeMs) => player.seek(timeMs)}
 * />
 */
export const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  (
    {
      currentTime,
      duration,
      buffered = 0,
      onSeek,
      canSeek = true,
      showTimestampPreview = true,
      className = "",
      style = {},
      disabled = false,
    },
    ref
  ) => {
    const [isDragging, setIsDragging] = useState(false);
    const [hoverTime, setHoverTime] = useState<number | null>(null);
    const [hoverX, setHoverX] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isSeekingRef = useRef(false);

    // Calculate progress percentage
    const progressPercent = useMemo(() => {
      if (duration === 0) return 0;
      return (currentTime / duration) * 100;
    }, [currentTime, duration]);

    // Calculate buffered percentage
    const bufferedPercent = useMemo(() => {
      return Math.min(buffered, 100);
    }, [buffered]);

    // Handle mouse move on progress bar
    const handleMouseMove = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!canSeek || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const timeMs = percent * duration;

        setHoverTime(timeMs);
        setHoverX(e.clientX - rect.left);
      },
      [duration, canSeek]
    );

    const handleMouseLeave = useCallback(() => {
      setHoverTime(null);
      setHoverX(null);
    }, []);

    // Handle mouse down (start dragging)
    const handleMouseDown = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!canSeek || disabled) return;

        isSeekingRef.current = true;
        setIsDragging(true);

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const percent = (e.clientX - rect.left) / rect.width;
        const timeMs = Math.max(0, Math.min(percent * duration, duration));

        onSeek(timeMs).catch(error => {
          console.error("Seek error during drag:", error);
        });
      },
      [canSeek, disabled, duration, onSeek]
    );

    // Handle global mouse move while dragging
    const handleGlobalMouseMove = useCallback(
      (e: MouseEvent) => {
        if (!isDragging || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const timeMs = Math.max(0, Math.min(percent * duration, duration));

        onSeek(timeMs).catch(error => {
          console.error("Seek error while dragging:", error);
        });
      },
      [isDragging, duration, onSeek]
    );

    // Handle global mouse up (stop dragging)
    const handleGlobalMouseUp = useCallback(() => {
      if (isDragging) {
        setIsDragging(false);
        isSeekingRef.current = false;
      }
    }, [isDragging]);

    // Attach global event listeners
    React.useEffect(() => {
      if (!isDragging) return;

      window.addEventListener("mousemove", handleGlobalMouseMove);
      window.addEventListener("mouseup", handleGlobalMouseUp);

      return () => {
        window.removeEventListener("mousemove", handleGlobalMouseMove);
        window.removeEventListener("mouseup", handleGlobalMouseUp);
      };
    }, [isDragging, handleGlobalMouseMove, handleGlobalMouseUp]);

    // Handle keyboard navigation
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!canSeek || disabled) return;

        const step = 5000; // 5 seconds
        let newTime = currentTime;

        switch (e.key) {
          case "ArrowLeft":
            e.preventDefault();
            newTime = Math.max(0, currentTime - step);
            break;
          case "ArrowRight":
            e.preventDefault();
            newTime = Math.min(duration, currentTime + step);
            break;
          case "Home":
            e.preventDefault();
            newTime = 0;
            break;
          case "End":
            e.preventDefault();
            newTime = duration;
            break;
          default:
            return;
        }

        onSeek(newTime).catch(error => {
          console.error("Seek error on keyboard input:", error);
        });
      },
      [canSeek, disabled, currentTime, duration, onSeek]
    );

    // Combine refs
    React.useEffect(() => {
      if (ref) {
        if (typeof ref === "function") {
          ref(containerRef.current);
        } else {
          ref.current = containerRef.current;
        }
      }
    }, [ref]);

    return (
      <div
        ref={containerRef}
        className={`progress-bar ${className} ${isDragging ? "dragging" : ""}`}
        style={style}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
        role="slider"
        aria-label="Video progress"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`}
        tabIndex={canSeek && !disabled ? 0 : -1}
        data-testid="progress-bar"
      >
        {/* Background track */}
        <div className="progress-bar__track">
          {/* Buffered portion */}
          <div
            className="progress-bar__buffered"
            style={{ width: `${bufferedPercent}%` }}
            data-testid="progress-bar-buffered"
          />

          {/* Played portion */}
          <div
            className="progress-bar__played"
            style={{ width: `${progressPercent}%` }}
            data-testid="progress-bar-played"
          />

          {/* Draggable scrubber thumb */}
          <div
            className="progress-bar__thumb"
            style={{ left: `${progressPercent}%` }}
            role="presentation"
            data-testid="progress-bar-thumb"
          />
        </div>

        {/* Timestamp preview on hover */}
        {showTimestampPreview && hoverTime !== null && hoverX !== null && canSeek && (
          <div
            className="progress-bar__timestamp-preview"
            style={{ left: `${hoverX}px` }}
            data-testid="progress-bar-timestamp-preview"
          >
            {formatTime(hoverTime)}
          </div>
        )}
      </div>
    );
  }
);

ProgressBar.displayName = "ProgressBar";

export default ProgressBar;
