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

/**
 * @class VideoPlayer
 * @brief Thread-safe libvlc C++ wrapper for Electron native video playback
 * 
 * Handles:
 * - libvlc instance and media lifecycle management
 * - Playback control (play, pause, seek, rate)
 * - State tracking and telemetry
 * - Error handling with graceful degradation
 * - Thread-safe design for use with worker threads
 */
class VideoPlayer {
public:
  /**
   * Callback for telemetry/state updates
   * Parameters: current_time (ms), duration (ms), state (playing/paused/stopped)
   */
  using StateCallback = std::function<void(int64_t, int64_t, const std::string&)>;

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
   * Set state update callback (called on state changes)
   * Called approximately every 33ms (30 FPS telemetry)
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

  // libvlc instances
  libvlc_instance_t* vlc_instance_;
  libvlc_media_player_t* media_player_;
  libvlc_media_t* media_;

  // State tracking
  mutable std::mutex state_mutex_;
  std::string current_state_;
  int64_t last_time_;
  int64_t last_duration_;
  std::string last_error_;

  // Callbacks
  StateCallback state_callback_;
  ErrorCallback error_callback_;

  // Telemetry tracking
  std::chrono::steady_clock::time_point last_telemetry_time_;
};

#endif // VIDEOPLAYER_H
