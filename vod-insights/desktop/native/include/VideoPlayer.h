#ifndef VIDEOPLAYER_H
#define VIDEOPLAYER_H

#include <vlc/vlc.h>
#include <string>
#include <memory>
#include <mutex>
#include <thread>
#include <queue>
#include <functional>
#include <cstdint>
#include <deque>
#include <chrono>

/**
 * @class VideoPlayer
 * @brief Thread-safe libvlc C++ wrapper for Electron native video playback with rendering
 * 
 * Handles:
 * - libvlc instance and media lifecycle management
 * - Native window rendering (HWND on Windows, NSView on macOS, XCB on Linux)
 * - Playback control (play, pause, seek, rate)
 * - Frame-accurate position tracking and metrics
 * - Performance telemetry (FPS, CPU, memory, latency)
 * - State tracking and error handling
 * - Thread-safe design for use with worker threads
 */
class VideoPlayer {
public:
  /**
   * Performance metrics data
   */
  struct PerformanceMetrics {
    double current_fps;           // Current playback FPS
    double average_fps;           // Average FPS over recent frames
    double cpu_percent;           // CPU usage percentage
    double memory_mb;             // Memory usage in MB
    int64_t seek_latency_ms;      // Last seek operation latency
    int frame_drops;              // Frames dropped in current playback
    int total_frames_rendered;    // Total frames rendered since start
  };

  /**
   * Callback for telemetry/state updates
   * Parameters: current_time (ms), duration (ms), state, metrics
   */
  using StateCallback = std::function<void(int64_t, int64_t, const std::string&, const PerformanceMetrics&)>;

  /**
   * Callback for error events
   * Parameters: error message
   */
  using ErrorCallback = std::function<void(const std::string&)>;

  VideoPlayer();
  ~VideoPlayer();

  // Non-copyable, non-movable (unique ownership)
  VideoPlayer(const VideoPlayer&) = delete;
  VideoPlayer& operator=(const VideoPlayer&) = delete;
  VideoPlayer(VideoPlayer&&) = delete;
  VideoPlayer& operator=(VideoPlayer&&) = delete;

  /**
   * Initialize libvlc and create a media instance
   * @param file_path Path to media file or URL
   * @return true if successful, false otherwise
   */
  bool Initialize(const std::string& file_path);

  /**
   * Clean up resources
   */
  void Shutdown();

  /**
   * Start playback
   * @return true if successful, false otherwise
   */
  bool Play();

  /**
   * Pause playback
   * @return true if successful, false otherwise
   */
  bool Pause();

  /**
   * Stop playback and release media
   * @return true if successful, false otherwise
   */
  bool Stop();

  /**
   * Seek to a specific time
   * @param time_ms Time in milliseconds
   * @return true if successful, false otherwise
   */
  bool Seek(int64_t time_ms);

  /**
   * Set playback rate
   * @param rate Playback rate (1.0 = normal, 2.0 = 2x, 0.5 = 0.5x)
   * @return true if successful, false otherwise
   */
  bool SetPlaybackRate(float rate);

  /**
   * Get current playback time
   * @return Current time in milliseconds
   */
  int64_t GetCurrentTime() const;

  /**
   * Get total duration
   * @return Duration in milliseconds
   */
  int64_t GetDuration() const;

  /**
   * Get current playback state
   * @return "playing", "paused", or "stopped"
   */
  std::string GetState() const;

  /**
   * Check if playback is active
   * @return true if playing
   */
  bool IsPlaying() const;

  /**
   * Set native window handle for rendering
   * Windows: HWND (void*)
   * macOS: NSView (void*)
   * Linux: X11 Window ID (uint32_t cast to void*)
   * @param hwnd Window handle
   * @return true if successful
   */
  bool SetWindowHandle(void* hwnd);

  /**
   * Get current frame number based on FPS and time
   * @return Current frame index (0-based)
   */
  int GetCurrentFrame() const;

  /**
   * Get estimated video FPS from media metadata
   * @return FPS (typically 30, 60, etc.)
   */
  double GetFps() const;

  /**
   * Get video dimensions
   * @param width Output: video width in pixels
   * @param height Output: video height in pixels
   * @return true if dimensions available
   */
  bool GetDimensions(int& width, int& height) const;

  /**
   * Get current performance metrics
   * @return Performance metrics struct
   */
  PerformanceMetrics GetPerformanceMetrics() const;

  /**
   * Set state update callback (called on state changes)
   * Called approximately every 16ms (60 FPS telemetry) when window is attached
   */
  void SetStateCallback(StateCallback callback);

  /**
   * Set error callback
   */
  void SetErrorCallback(ErrorCallback callback);

  /**
   * Get last error message
   */
  std::string GetLastError() const;

  /**
   * Process events and fire callbacks
   * Should be called periodically from event loop
   */
  void ProcessEvents();

private:
  /**
   * Helper to format error messages
   */
  void LogError(const std::string& context, const std::string& details);

  /**
   * Update state and trigger callback if changed
   */
  void UpdateState();

  /**
   * Update performance metrics from playback state
   */
  void UpdatePerformanceMetrics();

  /**
   * Calculate FPS from frame timing history
   */
  double CalculateAverageFps() const;

  // libvlc instances
  libvlc_instance_t* vlc_instance_;
  libvlc_media_player_t* media_player_;
  libvlc_media_t* media_;

  // Window handle for rendering
  void* window_handle_;
  bool has_window_attached_;

  // State tracking
  mutable std::mutex state_mutex_;
  std::string current_state_;
  int64_t last_time_;
  int64_t last_duration_;
  std::string last_error_;
  int64_t last_seek_latency_ms_;

  // Frame tracking for FPS calculation
  struct FrameTiming {
    int64_t timestamp_ms;
    int frame_number;
  };
  std::deque<FrameTiming> frame_timings_;  // Keep last 60 frames for FPS calc
  static const size_t MAX_FRAME_HISTORY = 60;

  // Performance metrics
  PerformanceMetrics current_metrics_;
  std::chrono::steady_clock::time_point playback_start_time_;
  int total_frames_rendered_;
  int frame_drops_;

  // Callbacks
  StateCallback state_callback_;
  ErrorCallback error_callback_;

  // Telemetry tracking
  std::chrono::steady_clock::time_point last_telemetry_time_;
  int telemetry_update_rate_ms_;  // 16ms for 60fps, 33ms for 30fps
};

#endif // VIDEOPLAYER_H
