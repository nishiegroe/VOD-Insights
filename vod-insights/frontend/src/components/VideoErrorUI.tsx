/**
 * VideoErrorUI.tsx
 * 
 * Error UI component for displaying video playback errors.
 * Shows user-friendly error messages with recovery options.
 * Part of Phase 2: React UI Components for Native Video (Days 6-10)
 */

import React, { useCallback } from "react";
import { VideoClientError } from "../services/videoClient";
import "./VideoErrorUI.css";

export interface VideoErrorUIProps {
  /** The error to display */
  error: VideoClientError | null;

  /** Called when user clicks retry button */
  onRetry?: () => void | Promise<void>;

  /** Called when user clicks dismiss button */
  onDismiss?: () => void;

  /** Called when user clicks fallback button */
  onFallback?: () => void;

  /** Show error details in development mode */
  debug?: boolean;

  /** CSS class for styling */
  className?: string;

  /** Additional styling */
  style?: React.CSSProperties;

  /** Whether to show the fallback button */
  showFallback?: boolean;
}

/**
 * Map error codes to user-friendly messages
 */
function getErrorMessage(error: VideoClientError): { title: string; description: string } {
  switch (error.code) {
    case "NATIVE_VIDEO_UNAVAILABLE":
      return {
        title: "Native Video Not Available",
        description: "Video playback is not available in this context. The application may need to be restarted.",
      };

    case "INIT_FAILED":
    case "INIT_ERROR":
      return {
        title: "Failed to Initialize Video",
        description: "The video player could not be initialized. Please try again or use an alternative method.",
      };

    case "FILE_NOT_FOUND":
      return {
        title: "Video File Not Found",
        description: "The video file could not be found. Please check the file path and try again.",
      };

    case "CODEC_NOT_SUPPORTED":
      return {
        title: "Unsupported Video Format",
        description: "This video format is not supported by the player. Please use a different format.",
      };

    case "PLAYBACK_ERROR":
      return {
        title: "Playback Error",
        description: "An error occurred during playback. Please try again.",
      };

    case "SEEK_ERROR":
      return {
        title: "Seek Error",
        description: "Could not seek to the requested position. Please try again.",
      };

    case "TIMEOUT":
      return {
        title: "Operation Timed Out",
        description: "The operation took too long. Please try again.",
      };

    case "SYNC_ERROR":
      return {
        title: "Synchronization Error",
        description: "Failed to synchronize multiple videos. Please try again.",
      };

    default:
      return {
        title: "Video Error",
        description: error.message || "An unexpected error occurred.",
      };
  }
}

/**
 * Get appropriate error icon based on error code
 */
function getErrorIcon(error: VideoClientError): string {
  switch (error.code) {
    case "FILE_NOT_FOUND":
      return "🔍";
    case "CODEC_NOT_SUPPORTED":
      return "🎬";
    case "TIMEOUT":
      return "⏱️";
    case "SYNC_ERROR":
      return "🔄";
    default:
      return "⚠️";
  }
}

/**
 * VideoErrorUI: Displays video playback errors
 * 
 * Features:
 * - User-friendly error messages
 * - Retry action
 * - Fallback option
 * - Debug mode for error details
 * - Accessible design
 * 
 * @example
 * <VideoErrorUI
 *   error={error}
 *   onRetry={() => player.retry()}
 *   onFallback={() => switchToHtmlVideo()}
 * />
 */
export const VideoErrorUI = React.forwardRef<HTMLDivElement, VideoErrorUIProps>(
  (
    {
      error,
      onRetry,
      onDismiss,
      onFallback,
      debug = false,
      className = "",
      style = {},
      showFallback = true,
    },
    ref
  ) => {
    const [isRetrying, setIsRetrying] = React.useState(false);
    const [isDismissing, setIsDismissing] = React.useState(false);

    // Handle retry
    const handleRetry = useCallback(async () => {
      if (!onRetry) return;

      try {
        setIsRetrying(true);
        await onRetry();
      } catch (err) {
        console.error("Retry error:", err);
      } finally {
        setIsRetrying(false);
      }
    }, [onRetry]);

    // Handle dismiss
    const handleDismiss = useCallback(() => {
      try {
        setIsDismissing(true);
        onDismiss?.();
      } catch (err) {
        console.error("Dismiss error:", err);
      } finally {
        setIsDismissing(false);
      }
    }, [onDismiss]);

    // Handle fallback
    const handleFallback = useCallback(() => {
      try {
        onFallback?.();
      } catch (err) {
        console.error("Fallback error:", err);
      }
    }, [onFallback]);

    if (!error) {
      return null;
    }

    const { title, description } = getErrorMessage(error);
    const icon = getErrorIcon(error);

    return (
      <div
        ref={ref}
        className={`video-error-ui ${className}`}
        style={style}
        role="alert"
        aria-live="polite"
        data-testid="video-error-ui"
      >
        {/* Background overlay */}
        <div className="video-error-ui__overlay" />

        {/* Error container */}
        <div className="video-error-ui__container">
          {/* Icon */}
          <div className="video-error-ui__icon" aria-hidden="true">
            {icon}
          </div>

          {/* Title */}
          <h2 className="video-error-ui__title" data-testid="error-title">
            {title}
          </h2>

          {/* Description */}
          <p className="video-error-ui__description" data-testid="error-description">
            {description}
          </p>

          {/* Debug information */}
          {debug && error.context && (
            <details className="video-error-ui__debug">
              <summary>Error Details</summary>
              <pre>{JSON.stringify(error, null, 2)}</pre>
            </details>
          )}

          {/* Error message if available */}
          {debug && error.message && (
            <div className="video-error-ui__message">
              <code>{error.message}</code>
            </div>
          )}

          {/* Actions */}
          <div className="video-error-ui__actions">
            {/* Retry button */}
            {onRetry && (
              <button
                className="video-error-ui__button video-error-ui__button--primary"
                onClick={handleRetry}
                disabled={isRetrying}
                data-testid="error-retry-button"
                aria-label="Retry video playback"
              >
                {isRetrying ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <span aria-hidden="true">↻</span>
                    Retry
                  </>
                )}
              </button>
            )}

            {/* Fallback button */}
            {onFallback && showFallback && (
              <button
                className="video-error-ui__button video-error-ui__button--secondary"
                onClick={handleFallback}
                data-testid="error-fallback-button"
                aria-label="Use alternative video player"
              >
                <span aria-hidden="true">🎯</span>
                Use Alternative Player
              </button>
            )}

            {/* Dismiss button */}
            {onDismiss && (
              <button
                className="video-error-ui__button video-error-ui__button--tertiary"
                onClick={handleDismiss}
                disabled={isDismissing}
                data-testid="error-dismiss-button"
                aria-label="Dismiss error"
              >
                {isDismissing ? "Dismissing..." : "Dismiss"}
              </button>
            )}
          </div>

          {/* Help text */}
          <p className="video-error-ui__help-text">
            If the problem persists, please{" "}
            <a href="https://github.com/yourusername/vod-insights/issues" target="_blank" rel="noopener noreferrer">
              report the issue
            </a>
            .
          </p>
        </div>
      </div>
    );
  }
);

VideoErrorUI.displayName = "VideoErrorUI";

export default VideoErrorUI;
