#include "VideoPlayer.h"
#include <iostream>
#include <cstring>
#include <chrono>

VideoPlayer::VideoPlayer()
    : vlc_instance_(nullptr),
      media_player_(nullptr),
      media_(nullptr),
      window_handle_(nullptr),
      has_window_attached_(false),
      current_state_("stopped"),
      last_time_(0),
      last_duration_(0),
      last_seek_latency_ms_(0),
      playback_start_time_(std::chrono::steady_clock::now()),
      total_frames_rendered_(0),
      frame_drops_(0),
      telemetry_update_rate_ms_(16),
      last_telemetry_time_(std::chrono::steady_clock::now()) {
  std::memset(&current_metrics_, 0, sizeof(PerformanceMetrics));
}

VideoPlayer::~VideoPlayer() {
  Shutdown();
}

bool VideoPlayer::Initialize(const std::string& file_path) {
  std::lock_guard<std::mutex> lock(state_mutex_);

  // Create libvlc instance
  const char* args[] = {
    "--no-audio",  // We'll handle audio separately if needed
    "--verbose=2"
  };
  vlc_instance_ = libvlc_new(sizeof(args) / sizeof(args[0]), args);

  if (!vlc_instance_) {
    LogError("Initialize", "Failed to create libvlc instance");
    return false;
  }

  // Create a media descriptor from the file path
  media_ = libvlc_media_new_path(vlc_instance_, file_path.c_str());
  if (!media_) {
    LogError("Initialize", "Failed to load media: " + file_path);
    if (vlc_instance_) {
      libvlc_release(vlc_instance_);
      vlc_instance_ = nullptr;
    }
    return false;
  }

  // Create media player (not media list player)
  media_player_ = libvlc_media_player_new(vlc_instance_);
  if (!media_player_) {
    LogError("Initialize", "Failed to create media player");
    libvlc_media_release(media_);
    media_ = nullptr;
    if (vlc_instance_) {
      libvlc_release(vlc_instance_);
      vlc_instance_ = nullptr;
    }
    return false;
  }

  // Set the media
  libvlc_media_player_set_media(media_player_, media_);
  current_state_ = "stopped";

  return true;
}

void VideoPlayer::Shutdown() {
  std::lock_guard<std::mutex> lock(state_mutex_);

  if (media_player_) {
    libvlc_media_player_stop(media_player_);
    libvlc_media_player_release(media_player_);
    media_player_ = nullptr;
  }

  if (media_) {
    libvlc_media_release(media_);
    media_ = nullptr;
  }

  if (vlc_instance_) {
    libvlc_release(vlc_instance_);
    vlc_instance_ = nullptr;
  }

  current_state_ = "stopped";
}

bool VideoPlayer::Play() {
  std::lock_guard<std::mutex> lock(state_mutex_);

  if (!media_player_) {
    LogError("Play", "Media player not initialized");
    return false;
  }

  if (libvlc_media_player_play(media_player_) != 0) {
    LogError("Play", "Failed to start playback");
    return false;
  }

  current_state_ = "playing";
  return true;
}

bool VideoPlayer::Pause() {
  std::lock_guard<std::mutex> lock(state_mutex_);

  if (!media_player_) {
    LogError("Pause", "Media player not initialized");
    return false;
  }

  libvlc_media_player_set_pause(media_player_, 1);
  current_state_ = "paused";
  return true;
}

bool VideoPlayer::Stop() {
  std::lock_guard<std::mutex> lock(state_mutex_);

  if (!media_player_) {
    LogError("Stop", "Media player not initialized");
    return false;
  }

  libvlc_media_player_stop(media_player_);
  current_state_ = "stopped";
  last_time_ = 0;
  return true;
}

bool VideoPlayer::Seek(int64_t time_ms) {
  std::lock_guard<std::mutex> lock(state_mutex_);

  if (!media_player_) {
    LogError("Seek", "Media player not initialized");
    return false;
  }

  // Measure seek latency
  auto seek_start = std::chrono::steady_clock::now();

  // libvlc_media_player_set_time expects milliseconds (no third parameter)
  libvlc_media_player_set_time(media_player_, time_ms);

  auto seek_end = std::chrono::steady_clock::now();
  last_seek_latency_ms_ = std::chrono::duration_cast<std::chrono::milliseconds>(
      seek_end - seek_start).count();

  // Update current metrics with seek latency
  current_metrics_.seek_latency_ms = last_seek_latency_ms_;

  return true;
}

bool VideoPlayer::SetPlaybackRate(float rate) {
  std::lock_guard<std::mutex> lock(state_mutex_);

  if (!media_player_) {
    LogError("SetPlaybackRate", "Media player not initialized");
    return false;
  }

  if (rate <= 0.0f) {
    LogError("SetPlaybackRate", "Invalid rate: " + std::to_string(rate));
    return false;
  }

  if (libvlc_media_player_set_rate(media_player_, rate) != 0) {
    LogError("SetPlaybackRate", "Failed to set rate to " + std::to_string(rate));
    return false;
  }

  return true;
}

int64_t VideoPlayer::GetCurrentTime() const {
  std::lock_guard<std::mutex> lock(state_mutex_);

  if (!media_player_) {
    return 0;
  }

  return libvlc_media_player_get_time(media_player_);
}

int64_t VideoPlayer::GetDuration() const {
  std::lock_guard<std::mutex> lock(state_mutex_);

  if (!media_) {
    return 0;
  }

  return libvlc_media_get_duration(media_);
}

std::string VideoPlayer::GetState() const {
  std::lock_guard<std::mutex> lock(state_mutex_);
  return current_state_;
}

bool VideoPlayer::IsPlaying() const {
  std::lock_guard<std::mutex> lock(state_mutex_);

  if (!media_player_) {
    return false;
  }

  return libvlc_media_player_is_playing(media_player_) == 1;
}

void VideoPlayer::SetStateCallback(StateCallback callback) {
  std::lock_guard<std::mutex> lock(state_mutex_);
  state_callback_ = callback;
}

void VideoPlayer::SetErrorCallback(ErrorCallback callback) {
  std::lock_guard<std::mutex> lock(state_mutex_);
  error_callback_ = callback;
}

std::string VideoPlayer::GetLastError() const {
  std::lock_guard<std::mutex> lock(state_mutex_);
  return last_error_;
}

void VideoPlayer::ProcessEvents() {
  std::lock_guard<std::mutex> lock(state_mutex_);

  auto now = std::chrono::steady_clock::now();
  auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
      now - last_telemetry_time_);

  // Emit telemetry at configured rate (16ms for 60fps, 33ms for 30fps default)
  if (elapsed.count() >= telemetry_update_rate_ms_ && state_callback_) {
    last_telemetry_time_ = now;

    if (media_player_) {
      int64_t current_time = libvlc_media_player_get_time(media_player_);
      int64_t duration = media_ ? libvlc_media_get_duration(media_) : 0;

      // Update state if changed
      UpdateState();

      // Update performance metrics
      UpdatePerformanceMetrics();

      // Increment frame counter if playing
      if (current_state_ == "playing") {
        total_frames_rendered_++;
      }

      // Call callback with current state and metrics
      state_callback_(current_time, duration, current_state_, current_metrics_);
    }
  }
}

void VideoPlayer::LogError(const std::string& context,
                           const std::string& details) {
  last_error_ = "[" + context + "] " + details;

  if (error_callback_) {
    error_callback_(last_error_);
  }

  std::cerr << "VideoPlayer Error: " << last_error_ << std::endl;
}

void VideoPlayer::UpdateState() {
  if (!media_player_) {
    current_state_ = "stopped";
    return;
  }

  int is_playing = libvlc_media_player_is_playing(media_player_);
  if (is_playing) {
    current_state_ = "playing";
  } else {
    // Check if media has ended or is paused
    libvlc_state_t state = libvlc_media_player_get_state(media_player_);
    if (state == libvlc_Ended || state == libvlc_Stopped) {
      current_state_ = "stopped";
    } else if (state == libvlc_Paused) {
      current_state_ = "paused";
    }
  }
}

bool VideoPlayer::SetWindowHandle(void* hwnd) {
  std::lock_guard<std::mutex> lock(state_mutex_);

  if (!media_player_) {
    LogError("SetWindowHandle", "Media player not initialized");
    return false;
  }

  window_handle_ = hwnd;

  // Attach to platform-specific rendering APIs
#ifdef _WIN32
  // Windows: attach to HWND
  libvlc_media_player_set_hwnd(media_player_, hwnd);
#elif __APPLE__
  // macOS: attach to NSView
  libvlc_media_player_set_nsobject(media_player_, hwnd);
#else
  // Linux: attach to X11 Window ID (unsigned long for 64-bit)
  libvlc_media_player_set_xwindow(media_player_, reinterpret_cast<unsigned long>(hwnd));
#endif

  has_window_attached_ = true;
  LogError("SetWindowHandle", "Window handle attached successfully");
  return true;
}

int VideoPlayer::GetCurrentFrame() const {
  std::lock_guard<std::mutex> lock(state_mutex_);

  if (!media_player_) {
    return 0;
  }

  int64_t current_time_ms = libvlc_media_player_get_time(media_player_);
  double fps = GetFps();

  if (fps <= 0) {
    return 0;
  }

  // Convert milliseconds to frame number: frame = (time_ms / 1000) * fps
  return static_cast<int>((current_time_ms / 1000.0) * fps);
}

double VideoPlayer::GetFps() const {
  std::lock_guard<std::mutex> lock(state_mutex_);

  if (!media_player_) {
    return 30.0;  // Default fallback
  }

  // Use libvlc_video_get_fps which is the modern API
  double fps = libvlc_media_player_get_fps(media_player_);
  if (fps > 0) {
    return fps;
  }

  return 30.0;  // Default fallback
}

bool VideoPlayer::GetDimensions(int& width, int& height) const {
  std::lock_guard<std::mutex> lock(state_mutex_);

  width = 0;
  height = 0;

  if (!media_player_) {
    return false;
  }

  // Use libvlc_video_get_size which is the modern API
  // Note: This requires the media to be playing or prepared
  unsigned int w = 0, h = 0;
  if (libvlc_video_get_size(media_player_, 0, &w, &h) == 0 && w > 0 && h > 0) {
    width = static_cast<int>(w);
    height = static_cast<int>(h);
    return true;
  }

  return false;
}

VideoPlayer::PerformanceMetrics VideoPlayer::GetPerformanceMetrics() const {
  std::lock_guard<std::mutex> lock(state_mutex_);
  return current_metrics_;
}

double VideoPlayer::CalculateAverageFps() const {
  if (frame_timings_.size() < 2) {
    return 0.0;
  }

  // Calculate FPS from recent frame timings
  int64_t time_span_ms = frame_timings_.back().timestamp_ms - frame_timings_.front().timestamp_ms;
  int frame_span = frame_timings_.back().frame_number - frame_timings_.front().frame_number;

  if (time_span_ms <= 0 || frame_span <= 0) {
    return 0.0;
  }

  // FPS = frames / (time_ms / 1000)
  return (frame_span * 1000.0) / time_span_ms;
}

void VideoPlayer::UpdatePerformanceMetrics() {
  if (!media_player_) {
    return;
  }

  int64_t current_time_ms = libvlc_media_player_get_time(media_player_);
  int current_frame = GetCurrentFrame();
  double fps = GetFps();

  // Track frame timing
  FrameTiming timing;
  timing.timestamp_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
      std::chrono::steady_clock::now().time_since_epoch()).count();
  timing.frame_number = current_frame;

  frame_timings_.push_back(timing);
  if (frame_timings_.size() > MAX_FRAME_HISTORY) {
    frame_timings_.pop_front();
  }

  // Update metrics
  current_metrics_.current_fps = fps;
  current_metrics_.average_fps = CalculateAverageFps();
  current_metrics_.total_frames_rendered = total_frames_rendered_;

  // Note: CPU and memory metrics would require platform-specific APIs
  // For now, we'll set them to 0 as placeholders
  // TODO: Implement CPU/memory tracking using platform APIs
  current_metrics_.cpu_percent = 0.0;
  current_metrics_.memory_mb = 0.0;
  current_metrics_.frame_drops = frame_drops_;
}
