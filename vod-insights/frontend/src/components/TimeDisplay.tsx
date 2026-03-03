/**
 * TimeDisplay.tsx
 * 
 * Time display component showing current time and duration.
 * Supports multiple formats and styling options.
 * Part of Phase 2: React UI Components for Native Video (Days 6-10)
 */

import React, { useMemo } from "react";
import "./TimeDisplay.css";

export interface TimeDisplayProps {
  /** Current playback time in milliseconds */
  currentTime: number;

  /** Total duration in milliseconds */
  duration: number;

  /** Time format: "short" (MM:SS), "long" (HH:MM:SS), or "auto" (smart choice) */
  format?: "short" | "long" | "auto";

  /** Show time as negative countdown instead of elapsed */
  showAsCountdown?: boolean;

  /** Display separator between times */
  separator?: string;

  /** CSS class for styling */
  className?: string;

  /** Additional styling */
  style?: React.CSSProperties;

  /** Show current time only (omit duration) */
  currentTimeOnly?: boolean;

  /** Custom text for no duration */
  noDurationText?: string;
}

/**
 * Format milliseconds to HH:MM:SS or MM:SS
 */
function formatTime(ms: number, format: "short" | "long" = "short"): string {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const isNegative = ms < 0;
  const sign = isNegative ? "-" : "";

  if (format === "long" || hours > 0) {
    return `${sign}${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${sign}${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Determine appropriate time format based on duration
 */
function getAutoFormat(duration: number): "short" | "long" {
  // Use long format if duration is > 1 hour
  return duration > 3600000 ? "long" : "short";
}

/**
 * TimeDisplay: Shows current playback time and duration
 * 
 * Features:
 * - Multiple time formats (MM:SS, HH:MM:SS)
 * - Countdown mode
 * - Auto-format detection
 * - Compact display
 * - Accessible
 * 
 * @example
 * <TimeDisplay
 *   currentTime={30500}
 *   duration={120000}
 *   format="auto"
 * />
 * // Displays: 0:30 / 2:00
 */
export const TimeDisplay = React.forwardRef<HTMLDivElement, TimeDisplayProps>(
  (
    {
      currentTime,
      duration,
      format = "auto",
      showAsCountdown = false,
      separator = " / ",
      className = "",
      style = {},
      currentTimeOnly = false,
      noDurationText = "--:--",
    },
    ref
  ) => {
    // Determine format
    const actualFormat = useMemo(() => {
      if (format === "auto") {
        return getAutoFormat(duration);
      }
      return format;
    }, [format, duration]);

    // Format current time
    const currentTimeText = useMemo(() => {
      if (showAsCountdown && duration > 0) {
        // Show remaining time as negative
        const remaining = duration - currentTime;
        return formatTime(remaining, actualFormat);
      }
      return formatTime(currentTime, actualFormat);
    }, [currentTime, duration, showAsCountdown, actualFormat]);

    // Format duration
    const durationText = useMemo(() => {
      if (duration === 0) {
        return noDurationText;
      }
      return formatTime(duration, actualFormat);
    }, [duration, actualFormat, noDurationText]);

    // Calculate percentage for accessibility
    const percentage = useMemo(() => {
      if (duration === 0) return 0;
      return Math.round((currentTime / duration) * 100);
    }, [currentTime, duration]);

    return (
      <div
        ref={ref}
        className={`time-display ${className} ${showAsCountdown ? "countdown" : ""}`}
        style={style}
        role="status"
        aria-live="polite"
        aria-label={`Video progress: ${currentTimeText}${!currentTimeOnly ? " of " + durationText : ""}`}
        data-testid="time-display"
      >
        <span
          className="time-display__current"
          data-testid="time-display-current"
          title={`Current time: ${currentTimeText}`}
        >
          {currentTimeText}
        </span>

        {!currentTimeOnly && duration > 0 && (
          <>
            <span
              className="time-display__separator"
              aria-hidden="true"
              data-testid="time-display-separator"
            >
              {separator}
            </span>

            <span
              className="time-display__duration"
              data-testid="time-display-duration"
              title={`Duration: ${durationText}`}
            >
              {durationText}
            </span>
          </>
        )}

        {!currentTimeOnly && duration === 0 && (
          <>
            <span
              className="time-display__separator"
              aria-hidden="true"
              data-testid="time-display-separator"
            >
              {separator}
            </span>

            <span
              className="time-display__duration"
              data-testid="time-display-duration"
            >
              {noDurationText}
            </span>
          </>
        )}

        {/* Hidden element for screen readers */}
        <span className="sr-only" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
          {percentage}% played
        </span>
      </div>
    );
  }
);

TimeDisplay.displayName = "TimeDisplay";

export default TimeDisplay;
