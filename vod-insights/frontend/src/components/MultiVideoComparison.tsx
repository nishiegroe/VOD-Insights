import React, { useState, useEffect, useCallback } from 'react';
import { NativeVideoContainer } from './NativeVideoContainer';
import { PlaybackControls } from './PlaybackControls';
import { ProgressBar } from './ProgressBar';
import { TimeDisplay } from './TimeDisplay';
import { SyncIndicators } from './SyncIndicators';
import './MultiVideoComparison.css';

/**
 * Phase 3: Multi-Video Synchronization Component
 * 
 * Displays 2-3 videos side-by-side with synchronized playback.
 * Implements frame-accurate sync (target: ±1 frame = ±16.67ms @ 60fps)
 * 
 * Features:
 * - Synchronized play/pause across all videos
 * - Master clock-based synchronization
 * - Real-time drift monitoring and visualization
 * - Per-video offset adjustment (for fine-tuning)
 * - Shared progress bar and playback controls
 */

interface VideoInfo {
  id: number;
  filePath: string;
  name: string;
}

interface SyncTelemetry {
  timestamp: number;
  states: {
    videoId: number;
    currentFrame: number;
    expectedFrame: number;
    driftFrames: number;
    driftMs: number;
    fps: number;
    status: string;
  }[];
  maxDriftMs: number;
  rmsDriftMs: number;
  adjustmentCount: number;
}

interface MultiVideoComparisonProps {
  videos: VideoInfo[];
  onClose?: () => void;
  sessionId?: string;
}

/**
 * Multi-video comparison viewer with synchronized playback
 */
export const MultiVideoComparison: React.FC<MultiVideoComparisonProps> = ({
  videos,
  onClose,
  sessionId = 'default'
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [telemetry, setTelemetry] = useState<SyncTelemetry | null>(null);
  const [selectedVideoOffsets, setSelectedVideoOffsets] = useState<Map<number, number>>(
    new Map(videos.map(v => [v.id, 0]))
  );

  /**
   * Collect telemetry from first video's state
   * (In production, this would come from native SyncMaster)
   */
  const handleVideoTelemetry = useCallback((videoId: number, newTelemetry: any) => {
    if (videoId === videos[0]?.id) {
      setTelemetry(newTelemetry);
    }
  }, [videos]);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    // In production: IPC call to native engine to play all videos
    // ipcRenderer.invoke('video:play', { videoIds: videos.map(v => v.id) });
  }, [videos]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    // In production: IPC call to native engine
    // ipcRenderer.invoke('video:pause', { videoIds: videos.map(v => v.id) });
  }, [videos]);

  const handleSeek = useCallback((position: number) => {
    setCurrentTime(position);
    // In production: IPC call to native engine
    // videos.forEach(v => {
    //   ipcRenderer.invoke('video:seek', { videoId: v.id, position });
    // });
  }, [videos]);

  const handlePlaybackRateChange = useCallback((newRate: number) => {
    setPlaybackRate(newRate);
    // In production: IPC call to native engine
    // ipcRenderer.invoke('video:setPlaybackRate', {
    //   videoIds: videos.map(v => v.id),
    //   rate: newRate
    // });
  }, [videos]);

  const handleOffsetChange = useCallback((videoId: number, offsetFrames: number) => {
    setSelectedVideoOffsets(prev => new Map(prev).set(videoId, offsetFrames));
    // In production: IPC call to sync master
    // ipcRenderer.invoke('sync:adjustOffset', { videoId, offsetFrames });
  }, []);

  const maxDriftMs = telemetry?.maxDriftMs ?? 0;
  const isSyncHealthy = maxDriftMs < 16.67;  // Less than 1 frame @ 60fps

  return (
    <div className="multi-video-comparison">
      <div className="comparison-header">
        <h2>Multi-VOD Comparison</h2>
        <div className="sync-status">
          <div className={`sync-indicator ${isSyncHealthy ? 'healthy' : 'warning'}`}>
            <span className="indicator-dot" />
            <span className="indicator-text">
              Sync: {maxDriftMs.toFixed(1)}ms
            </span>
          </div>
          {onClose && (
            <button className="close-btn" onClick={onClose}>×</button>
          )}
        </div>
      </div>

      <div className="video-grid">
        {videos.map((video, index) => (
          <div key={video.id} className={`video-tile grid-col-${videos.length}`}>
            <div className="video-wrapper">
              <NativeVideoContainer
                videoId={video.id}
                src={video.filePath}
                isPlaying={isPlaying}
                onTelemetry={(telemetry) => handleVideoTelemetry(video.id, telemetry)}
              />
              <div className="video-label">{video.name}</div>
            </div>

            {/* Per-video sync indicator */}
            {telemetry && (
              <SyncIndicators
                videoId={video.id}
                state={telemetry.states.find(s => s.videoId === video.id)}
                offset={selectedVideoOffsets.get(video.id) ?? 0}
                onOffsetChange={(offset) => handleOffsetChange(video.id, offset)}
              />
            )}
          </div>
        ))}
      </div>

      <div className="playback-section">
        {/* Shared progress bar - synchronized scrubber */}
        <ProgressBar
          currentTime={currentTime}
          duration={duration}
          onSeek={handleSeek}
          className="shared-scrubber"
        />

        {/* Time display */}
        <div className="time-display-container">
          <TimeDisplay
            currentTime={currentTime}
            duration={duration}
            format="HH:MM:SS"
          />
          {telemetry && (
            <div className="sync-info">
              Drift: {telemetry.rmsDriftMs.toFixed(2)}ms RMS
              {telemetry.adjustmentCount > 0 && ` | Adjustments: ${telemetry.adjustmentCount}`}
            </div>
          )}
        </div>

        {/* Shared playback controls */}
        <PlaybackControls
          isPlaying={isPlaying}
          onPlay={handlePlay}
          onPause={handlePause}
          playbackRate={playbackRate}
          onPlaybackRateChange={handlePlaybackRateChange}
          duration={duration}
        />
      </div>

      {/* Detailed telemetry view (for debugging) */}
      {telemetry && process.env.NODE_ENV === 'development' && (
        <div className="telemetry-debug">
          <details>
            <summary>Sync Telemetry (Debug)</summary>
            <pre>{JSON.stringify(telemetry, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
};

export default MultiVideoComparison;
