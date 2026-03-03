#ifndef SYNCMASTER_H
#define SYNCMASTER_H

#include "VideoPlayer.h"
#include <vector>
#include <map>
#include <memory>
#include <chrono>
#include <mutex>
#include <cstdint>

/**
 * @class SyncMaster
 * @brief Frame-accurate multi-video synchronization engine
 * 
 * Implements master clock-based synchronization for N videos playing simultaneously.
 * Target: Maintain ±1 frame sync tolerance (±16.67ms @ 60fps)
 * 
 * Algorithm:
 * 1. Track master clock (system time + offset from first video)
 * 2. Calculate expected frame for each video based on master clock
 * 3. Compare current frame vs expected frame (drift detection)
 * 4. Apply micro-adjustments (pause/resume) if drift exceeds tolerance
 * 5. Emit telemetry every sync cycle (~16-33ms)
 */
class SyncMaster {
public:
  /**
   * State of a single video in the sync cluster
   */
  struct VideoSyncState {
    int video_id;
    int current_frame;          // Frame number player is currently on
    int expected_frame;         // Frame player should be on (from master clock)
    int drift_frames;           // current_frame - expected_frame
    double drift_ms;            // drift_frames converted to milliseconds
    double fps;                 // Frames per second of this video
    std::string status;         // "playing", "paused", "adjusting", etc.
  };

  /**
   * Complete telemetry snapshot for all synced videos
   */
  struct SyncTelemetry {
    int64_t timestamp;          // Milliseconds since epoch
    std::vector<VideoSyncState> states;
    double max_drift_ms;        // Peak drift across all videos
    double rms_drift_ms;        // Root mean square drift (quality metric)
    int adjustment_count;       // How many micro-adjustments made in this cycle
  };

  /**
   * Callback for telemetry updates
   * Called after each sync cycle (~16-33ms)
   */
  using TelemetryCallback = std::function<void(const SyncTelemetry&)>;

  /**
   * Create sync master with reference FPS
   * @param reference_fps Reference frame rate (typically 60.0)
   */
  explicit SyncMaster(float reference_fps = 60.0f);
  ~SyncMaster();

  // Non-copyable
  SyncMaster(const SyncMaster&) = delete;
  SyncMaster& operator=(const SyncMaster&) = delete;

  /**
   * Add a video to the sync cluster
   * @param video_id Unique identifier for this video
   * @param player Pointer to VideoPlayer instance
   * @return true if successful
   */
  bool AddVideo(int video_id, std::shared_ptr<VideoPlayer> player);

  /**
   * Remove a video from sync cluster
   * @param video_id ID of video to remove
   * @return true if video was in cluster
   */
  bool RemoveVideo(int video_id);

  /**
   * Start synchronization (begins master clock, starts update loop)
   * @param callback Function called with telemetry after each sync cycle
   * @return true if successful
   */
  bool Start(TelemetryCallback callback);

  /**
   * Stop synchronization (stops update loop)
   */
  void Stop();

  /**
   * Is synchronization currently running?
   */
  bool IsRunning() const;

  /**
   * Get current count of synced videos
   */
  size_t GetVideoCount() const;

  /**
   * Calculate current sync state (current drift for all videos)
   * Does NOT apply adjustments - just returns measurements
   * @return Current telemetry snapshot
   */
  SyncTelemetry MeasureDrift();

  /**
   * Manually adjust offset for a single video (used for fine-tuning in UI)
   * Useful for user-initiated offset corrections
   * @param video_id Which video to adjust
   * @param offset_frames How many frames to shift (positive = ahead, negative = behind)
   */
  void AdjustVideoOffset(int video_id, int offset_frames);

  /**
   * Set the sync tolerance (in frames)
   * Default is 1 frame (16.67ms @ 60fps)
   * @param frames Number of frames tolerance
   */
  void SetSyncTolerance(int frames);

  /**
   * Set telemetry update rate
   * Default is 16ms (60 FPS updates)
   * @param milliseconds Update interval in milliseconds
   */
  void SetUpdateRate(int milliseconds);

private:
  // ===== State =====
  mutable std::mutex state_mutex_;
  std::map<int, std::shared_ptr<VideoPlayer>> videos_;  // All videos in cluster
  std::map<int, int64_t> frame_offsets_;                // Per-video frame offsets
  
  float reference_fps_;              // Reference FPS (typically 60.0)
  int sync_tolerance_frames_;        // Tolerance in frames (default 1)
  int update_rate_ms_;               // Update interval (default 16ms)
  
  int64_t master_clock_start_ms_;    // When master clock started
  std::chrono::steady_clock::time_point
    master_clock_start_steady_;      // Steady clock reference
  
  bool is_running_;
  std::unique_ptr<std::thread> sync_thread_;
  
  TelemetryCallback telemetry_callback_;

  // ===== Methods =====

  /**
   * Main sync loop (runs on worker thread)
   * Calculates drift, applies corrections, emits telemetry
   */
  void SyncLoop();

  /**
   * Calculate expected frame based on master clock
   * @param elapsed_ms Milliseconds elapsed on master clock
   * @param video_fps FPS of the video (may differ from reference)
   * @return Expected frame number
   */
  int64_t CalculateExpectedFrame(int64_t elapsed_ms, double video_fps);

  /**
   * Calculate current frame for a video
   * @param player The VideoPlayer instance
   * @param video_id Video ID (for offset lookup)
   * @return Current frame number
   */
  int64_t GetCurrentFrame(std::shared_ptr<VideoPlayer> player, int video_id);

  /**
   * Apply micro-adjustments to individual video if drift exceeds tolerance
   * @param video_id Which video to adjust
   * @param player The VideoPlayer instance
   * @param drift_frames How far behind/ahead (positive = ahead, negative = behind)
   * @return true if adjustment was made
   */
  bool AdjustPlayback(int video_id, std::shared_ptr<VideoPlayer> player, int drift_frames);

  /**
   * Helper: Sleep for specified milliseconds
   */
  static void SleepMs(int milliseconds);

  /**
   * Helper: Get current time in milliseconds since epoch
   */
  static int64_t GetCurrentTimeMs();

  /**
   * Helper: Get elapsed time since a reference point (using steady_clock)
   */
  static int64_t GetElapsedMs(const std::chrono::steady_clock::time_point& start);

  /**
   * Helper: Calculate RMS (root mean square) of drift values
   */
  static double CalculateRmsDrift(const std::vector<VideoSyncState>& states);
};

#endif  // SYNCMASTER_H
