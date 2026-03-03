/**
 * TypeScript Type Definitions for video_player Native Module
 * 
 * Provides complete type safety for native module usage.
 * Generated from VideoPlayerAddon.cc bindings.
 */

/**
 * Native video player powered by libvlc
 * Thread-safe C++ wrapper exposed to JavaScript
 */
declare class VideoPlayer {
  /**
   * Create a new video player instance
   */
  constructor();

  /**
   * Initialize the video player with a media file
   * 
   * @param filePath - Path to the media file or URL
   * @returns true if initialization successful, false otherwise
   * 
   * @example
   * ```javascript
   * const player = new VideoPlayer();
   * const success = player.initialize('/path/to/video.mp4');
   * if (!success) {
   *   console.error(player.getLastError());
   * }
   * ```
   */
  initialize(filePath: string): boolean;

  /**
   * Start video playback
   * 
   * @returns true if playback started, false otherwise
   * 
   * @example
   * ```javascript
   * player.play();
   * ```
   */
  play(): boolean;

  /**
   * Pause video playback
   * 
   * @returns true if pause successful, false otherwise
   */
  pause(): boolean;

  /**
   * Stop video playback and release resources
   * 
   * @returns true if stop successful, false otherwise
   */
  stop(): boolean;

  /**
   * Seek to a specific time in the video
   * 
   * @param timeMs - Target time in milliseconds
   * @returns true if seek successful, false otherwise
   * 
   * @example
   * ```javascript
   * // Seek to 5 seconds
   * player.seek(5000);
   * 
   * // Seek to 1 minute 30 seconds
   * player.seek(90000);
   * ```
   */
  seek(timeMs: number): boolean;

  /**
   * Set the playback rate (speed)
   * 
   * @param rate - Playback rate multiplier
   *   - 0.25 - quarter speed
   *   - 0.5  - half speed
   *   - 1.0  - normal speed (default)
   *   - 1.5  - 1.5x speed
   *   - 2.0  - double speed
   *   - 4.0  - 4x speed (maximum)
   * 
   * @returns true if rate change successful, false otherwise
   * 
   * @example
   * ```javascript
   * player.setPlaybackRate(1.5);  // 1.5x speed
   * player.setPlaybackRate(0.5);  // 0.5x (slow motion)
   * ```
   */
  setPlaybackRate(rate: number): boolean;

  /**
   * Get the current playback time
   * 
   * @returns Current playback position in milliseconds
   * 
   * @example
   * ```javascript
   * const currentMs = player.getCurrentTime();
   * console.log(`Playing at ${currentMs}ms`);
   * ```
   */
  getCurrentTime(): number;

  /**
   * Get the total duration of the video
   * 
   * @returns Total duration in milliseconds
   * 
   * @example
   * ```javascript
   * const durationMs = player.getDuration();
   * console.log(`Video is ${durationMs}ms long`);
   * ```
   */
  getDuration(): number;

  /**
   * Get the current playback state
   * 
   * @returns One of: "playing", "paused", "stopped"
   * 
   * @example
   * ```javascript
   * const state = player.getState();
   * if (state === 'playing') {
   *   console.log('Video is playing');
   * }
   * ```
   */
  getState(): 'playing' | 'paused' | 'stopped';

  /**
   * Check if the video is currently playing
   * 
   * @returns true if currently playing, false otherwise
   * 
   * @example
   * ```javascript
   * if (player.isPlaying()) {
   *   player.pause();
   * } else {
   *   player.play();
   * }
   * ```
   */
  isPlaying(): boolean;

  /**
   * Set a callback for state updates
   * 
   * Called when video state changes during playback.
   * Called approximately every 33ms when playing (30 FPS telemetry).
   * 
   * @param callback - Function to call on state updates
   * 
   * @example
   * ```javascript
   * player.setStateCallback((currentTime, duration, state) => {
   *   console.log(`Playing: ${currentTime}/${duration}ms, state=${state}`);
   * });
   * ```
   */
  setStateCallback(
    callback: (currentTime: number, duration: number, state: string) => void
  ): void;

  /**
   * Process pending events and invoke callbacks
   * 
   * Should be called periodically (e.g., in event loop) to:
   * - Update playback state
   * - Trigger state callbacks
   * - Process pending operations
   * 
   * @example
   * ```javascript
   * // In an Electron IPC handler or timer:
   * setInterval(() => {
   *   player.processEvents();
   * }, 33);  // ~30 FPS
   * ```
   */
  processEvents(): void;

  /**
   * Get the last error message
   * 
   * @returns Error message string (empty if no error)
   * 
   * @example
   * ```javascript
   * if (!player.play()) {
   *   console.error('Play failed:', player.getLastError());
   * }
   * ```
   */
  getLastError(): string;

  /**
   * Clean up and release all resources
   * 
   * Call when done with the player. After shutdown,
   * the player cannot be used again.
   */
  shutdown(): void;
}

/**
 * Frame-accurate multi-video synchronization engine (Phase 3)
 * 
 * Implements master clock-based sync for N videos playing simultaneously.
 * Target: ±1 frame sync tolerance (±16.67ms @ 60fps)
 */
declare class SyncMaster {
  /**
   * State of a single video in the sync cluster
   */
  interface VideoSyncState {
    video_id: number;
    current_frame: number;      // Current frame number
    expected_frame: number;     // Expected frame (from master clock)
    drift_frames: number;       // current_frame - expected_frame
    drift_ms: number;           // drift converted to milliseconds
    fps: number;                // Frames per second
    status: string;             // 'playing', 'paused', etc.
  }

  /**
   * Telemetry snapshot for all synced videos
   */
  interface SyncTelemetry {
    timestamp: number;          // Milliseconds since epoch
    states: VideoSyncState[];   // State of each video
    max_drift_ms: number;       // Peak drift across all videos
    rms_drift_ms: number;       // Root mean square drift
    adjustment_count: number;   // Micro-adjustments made in this cycle
  }

  /**
   * Create sync master with reference FPS
   * 
   * @param referenceFps - Reference frame rate (typically 60.0)
   * 
   * @example
   * ```javascript
   * const syncMaster = new SyncMaster(60.0);
   * ```
   */
  constructor(referenceFps?: number);

  /**
   * Add a video to the sync cluster
   * 
   * @param videoId - Unique identifier for this video
   * @param player - VideoPlayer instance
   * @returns true if successful
   * 
   * @example
   * ```javascript
   * syncMaster.addVideo(1, player1);
   * syncMaster.addVideo(2, player2);
   * syncMaster.addVideo(3, player3);
   * ```
   */
  addVideo(videoId: number, player: VideoPlayer): boolean;

  /**
   * Remove a video from sync cluster
   * 
   * @param videoId - ID of video to remove
   * @returns true if video was removed
   */
  removeVideo(videoId: number): boolean;

  /**
   * Start synchronization (begins master clock, starts update loop)
   * 
   * @param callback - Function called with telemetry after each sync cycle
   * @returns true if started successfully
   * 
   * @example
   * ```javascript
   * syncMaster.start((telemetry) => {
   *   console.log('Max drift:', telemetry.max_drift_ms, 'ms');
   *   console.log('RMS drift:', telemetry.rms_drift_ms, 'ms');
   * });
   * ```
   */
  start(callback: (telemetry: SyncTelemetry) => void): boolean;

  /**
   * Stop synchronization
   */
  stop(): void;

  /**
   * Is synchronization currently running?
   * 
   * @returns true if running, false otherwise
   */
  isRunning(): boolean;

  /**
   * Get current count of synced videos
   * 
   * @returns Number of videos in sync cluster
   */
  getVideoCount(): number;

  /**
   * Calculate current sync state without applying adjustments
   * 
   * @returns Current telemetry snapshot
   */
  measureDrift(): SyncTelemetry;

  /**
   * Manually adjust offset for a single video
   * 
   * Useful for user-initiated fine-tuning in UI
   * 
   * @param videoId - Which video to adjust
   * @param offsetFrames - How many frames to shift (positive = ahead)
   * 
   * @example
   * ```javascript
   * // Shift video 2 back by 5 frames
   * syncMaster.adjustVideoOffset(2, -5);
   * ```
   */
  adjustVideoOffset(videoId: number, offsetFrames: number): void;

  /**
   * Set the sync tolerance (in frames)
   * 
   * Default is 1 frame (16.67ms @ 60fps)
   * 
   * @param frames - Number of frames tolerance
   */
  setSyncTolerance(frames: number): void;

  /**
   * Set telemetry update rate
   * 
   * Default is 16ms (60 FPS updates)
   * 
   * @param milliseconds - Update interval in milliseconds
   */
  setUpdateRate(milliseconds: number): void;

  /**
   * Clean up and release resources
   */
  shutdown(): void;
}

export = VideoPlayer;
export { SyncMaster };

/**
 * Module exports
 * 
 * Usage in JavaScript:
 * ```javascript
 * const VideoPlayer = require('./build/Release/video_player');
 * const { SyncMaster } = require('./build/Release/video_player');
 * const player = new VideoPlayer();
 * const sync = new SyncMaster(60.0);
 * ```
 * 
 * Usage in TypeScript:
 * ```typescript
 * import VideoPlayer, { SyncMaster } from './native/src/index';
 * const player = new VideoPlayer();
 * const sync = new SyncMaster(60.0);
 * ```
 */
