import React, { useState, useCallback } from 'react';
import './SyncIndicators.css';

/**
 * Phase 3: Per-Video Sync Indicator Component
 * 
 * Shows synchronization status for a single video in a multi-video cluster.
 * Displays:
 * - Current frame vs expected frame
 * - Drift in milliseconds
 * - Adjustment offset slider
 * - Visual drift indicator (arrow showing direction of drift)
 */

interface VideoSyncState {
  videoId: number;
  currentFrame: number;
  expectedFrame: number;
  driftFrames: number;
  driftMs: number;
  fps: number;
  status: string;
}

interface SyncIndicatorsProps {
  videoId: number;
  state?: VideoSyncState;
  offset: number;
  onOffsetChange: (offsetFrames: number) => void;
  showDetails?: boolean;
}

/**
 * Sync indicator for a single video in multi-video comparison
 */
export const SyncIndicators: React.FC<SyncIndicatorsProps> = ({
  videoId,
  state,
  offset,
  onOffsetChange,
  showDetails = false
}) => {
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [localOffset, setLocalOffset] = useState(offset);

  const handleOffsetChange = useCallback((newOffset: number) => {
    setLocalOffset(newOffset);
    onOffsetChange(newOffset);
  }, [onOffsetChange]);

  const handleResetOffset = useCallback(() => {
    handleOffsetChange(0);
  }, [handleOffsetChange]);

  if (!state) {
    return (
      <div className="sync-indicators placeholder">
        <p>Waiting for video {videoId}...</p>
      </div>
    );
  }

  // Determine health status
  const driftAbs = Math.abs(state.driftMs);
  const TOLERANCE_MS = 16.67;  // 1 frame @ 60fps
  const isHealthy = driftAbs < TOLERANCE_MS;
  const isWarning = driftAbs < TOLERANCE_MS * 2;  // 2 frames tolerance
  
  // Determine drift direction
  const driftDirection = state.driftFrames > 0 ? 'ahead' : 'behind';
  const driftIndicator = state.driftFrames > 0 ? '↑' : '↓';

  return (
    <div className={`sync-indicators ${isHealthy ? 'healthy' : isWarning ? 'warning' : 'critical'}`}>
      {/* Status LED */}
      <div className="status-indicator">
        <div className={`led ${isHealthy ? 'green' : isWarning ? 'yellow' : 'red'}`} />
        <span className="status-text">
          {isHealthy ? 'In Sync' : isWarning ? 'Adjusting' : 'Out of Sync'}
        </span>
      </div>

      {/* Drift visualization */}
      <div className="drift-display">
        <div className="drift-value">
          <span className="drift-number">{driftAbs.toFixed(1)}</span>
          <span className="drift-unit">ms</span>
          <span className="drift-direction">{driftIndicator}</span>
        </div>
        <div className="drift-frames">
          Frame {state.currentFrame} / {state.expectedFrame}
          <span className="drift-delta">
            ({state.driftFrames > 0 ? '+' : ''}{state.driftFrames})
          </span>
        </div>
      </div>

      {/* Offset adjustment slider */}
      <div className="offset-adjustment">
        <label htmlFor={`offset-slider-${videoId}`}>
          Offset: <span className="offset-value">{localOffset > 0 ? '+' : ''}{localOffset}</span> frames
        </label>
        <input
          id={`offset-slider-${videoId}`}
          type="range"
          min="-30"
          max="30"
          step="1"
          value={localOffset}
          onChange={(e) => handleOffsetChange(parseInt(e.target.value, 10))}
          className="offset-slider"
          title="Adjust this video's frame offset for fine-tuning sync"
        />
        {localOffset !== 0 && (
          <button
            className="reset-offset"
            onClick={handleResetOffset}
            title="Reset offset to 0"
          >
            Reset
          </button>
        )}
      </div>

      {/* Detailed metrics (debug mode) */}
      {showDetails && (
        <div className="detailed-metrics">
          <div className="metric-row">
            <span className="metric-label">Status:</span>
            <span className="metric-value">{state.status}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">FPS:</span>
            <span className="metric-value">{state.fps.toFixed(1)}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Drift Direction:</span>
            <span className="metric-value">{driftDirection}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Tolerance:</span>
            <span className="metric-value">±{TOLERANCE_MS.toFixed(2)}ms</span>
          </div>
        </div>
      )}

      {/* Micro-adjustment visualization */}
      {Math.abs(state.driftFrames) > 0 && (
        <div className="adjustment-hint">
          {state.driftFrames > 0
            ? 'Video is ahead, pausing...'
            : 'Video is behind, advancing...'}
        </div>
      )}
    </div>
  );
};

export default SyncIndicators;
