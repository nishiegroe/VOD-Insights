/**
 * PlaybackControls.tsx
 * 
 * Custom playback controls component for native video player.
 * Provides: play/pause button, volume control, playback rate selector.
 * Part of Phase 2: React UI Components for Native Video (Days 6-10)
 */

import React, { useCallback, useMemo } from "react";
import "./PlaybackControls.css";

export interface PlaybackControlsProps {
  /** Whether video is currently playing */
  isPlaying: boolean;

  /** Whether video is paused */
  isPaused: boolean;

  /** Called when play button is clicked */
  onPlay: () => Promise<void>;

  /** Called when pause button is clicked */
  onPause: () => Promise<void>;

  /** Current playback rate (1.0 = normal) */
  playbackRate?: number;

  /** Called when playback rate changes */
  onPlaybackRateChange?: (rate: number) => Promise<void>;

  /** Current volume level (0-1) */
  volume?: number;

  /** Called when volume changes */
  onVolumeChange?: (level: number) => Promise<void>;

  /** Whether controls are disabled */
  disabled?: boolean;

  /** CSS class for styling */
  className?: string;

  /** Show/hide advanced controls */
  showAdvanced?: boolean;
}

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

/**
 * PlaybackControls: Reusable playback control UI component
 * 
 * Features:
 * - Play/Pause toggle button
 * - Playback rate selector (0.25x - 2.0x)
 * - Volume slider
 * - Responsive design
 * 
 * @example
 * <PlaybackControls
 *   isPlaying={true}
 *   isPaused={false}
 *   onPlay={() => player.play()}
 *   onPause={() => player.pause()}
 *   onPlaybackRateChange={(rate) => player.setRate(rate)}
 * />
 */
export const PlaybackControls = React.forwardRef<
  HTMLDivElement,
  PlaybackControlsProps
>(
  (
    {
      isPlaying,
      isPaused,
      onPlay,
      onPause,
      playbackRate = 1.0,
      onPlaybackRateChange,
      volume = 1.0,
      onVolumeChange,
      disabled = false,
      className = "",
      showAdvanced = true,
    },
    ref
  ) => {
    const [isLoading, setIsLoading] = React.useState(false);
    const [showVolumeSlider, setShowVolumeSlider] = React.useState(false);

    // Handle play/pause toggle
    const handlePlayPause = useCallback(async () => {
      try {
        setIsLoading(true);
        if (isPlaying) {
          await onPause();
        } else {
          await onPlay();
        }
      } catch (error) {
        console.error("Play/Pause error:", error);
      } finally {
        setIsLoading(false);
      }
    }, [isPlaying, onPlay, onPause]);

    // Handle playback rate change
    const handleRateChange = useCallback(
      async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const rate = parseFloat(e.target.value);
        try {
          setIsLoading(true);
          await onPlaybackRateChange?.(rate);
        } catch (error) {
          console.error("Playback rate change error:", error);
        } finally {
          setIsLoading(false);
        }
      },
      [onPlaybackRateChange]
    );

    // Handle volume change
    const handleVolumeChange = useCallback(
      async (e: React.ChangeEvent<HTMLInputElement>) => {
        const level = parseFloat(e.target.value);
        try {
          await onVolumeChange?.(level);
        } catch (error) {
          console.error("Volume change error:", error);
        }
      },
      [onVolumeChange]
    );

    // Memoize button classes
    const playPauseButtonClass = useMemo(() => {
      return `playback-controls__play-pause ${isPlaying ? "playing" : "paused"} ${
        isLoading ? "loading" : ""
      }`;
    }, [isPlaying, isLoading]);

    return (
      <div
        ref={ref}
        className={`playback-controls ${className}`}
        data-testid="playback-controls"
      >
        {/* Play/Pause Button */}
        <button
          className={playPauseButtonClass}
          onClick={handlePlayPause}
          disabled={disabled || isLoading}
          title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          aria-label={isPlaying ? "Pause" : "Play"}
          data-testid="play-pause-button"
        >
          {isLoading ? (
            <span className="spinner" />
          ) : isPlaying ? (
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Playback Rate Selector */}
        {showAdvanced && (
          <div className="playback-controls__rate-container">
            <select
              className="playback-controls__rate-select"
              value={playbackRate.toFixed(2)}
              onChange={handleRateChange}
              disabled={disabled || isLoading}
              title="Playback speed"
              aria-label="Playback speed"
              data-testid="rate-select"
            >
              {PLAYBACK_RATES.map((rate) => (
                <option key={rate} value={rate.toFixed(2)}>
                  {rate === 1.0 ? "Normal" : `${rate.toFixed(2)}x`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Volume Control */}
        <div className="playback-controls__volume-container">
          <button
            className="playback-controls__volume-toggle"
            onClick={() => setShowVolumeSlider(!showVolumeSlider)}
            disabled={disabled}
            title="Volume"
            aria-label="Volume"
            aria-expanded={showVolumeSlider}
            data-testid="volume-toggle"
          >
            {volume === 0 ? (
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C23.16 14.49 24 12.88 24 11c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            ) : volume < 0.5 ? (
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M7 9v6h4l5 5V4l-5 5H7z" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            )}
          </button>

          {/* Volume Slider */}
          {showVolumeSlider && (
            <div className="playback-controls__volume-slider-container">
              <input
                type="range"
                className="playback-controls__volume-slider"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={handleVolumeChange}
                disabled={disabled}
                title="Volume level"
                aria-label="Volume level"
                data-testid="volume-slider"
              />
              <span className="playback-controls__volume-label">
                {Math.round(volume * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
);

PlaybackControls.displayName = "PlaybackControls";

export default PlaybackControls;
