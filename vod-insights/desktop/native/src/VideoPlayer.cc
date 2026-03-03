#include "VideoPlayer.h"
#include <iostream>
#include <cstring>
#include <chrono>

VideoPlayer::VideoPlayer()
    : vlc_instance_(nullptr),
      media_player_(nullptr),
      media_(nullptr),
      current_state_("stopped"),
      last_time_(0),
      last_duration_(0),
      last_telemetry_time_(std::chrono::steady_clock::now()) {}

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

  // Create media player
  media_player_ = libvlc_media_list_player_new(vlc_instance_);
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
  libvlc_media_player_t* vlc_media_player = libvlc_media_player_new(vlc_instance_);
  if (!vlc_media_player) {
    LogError("Initialize", "Failed to create vlc media player");
    libvlc_media_release(media_);
    media_ = nullptr;
    if (vlc_instance_) {
      libvlc_release(vlc_instance_);
      vlc_instance_ = nullptr;
    }
    return false;
  }

  libvlc_media_player_set_media(vlc_media_player, media_);
  media_player_ = vlc_media_player;
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

  // libvlc_media_player_set_time expects milliseconds
  if (libvlc_media_player_set_time(media_player_, time_ms, true) < 0) {
    LogError("Seek", "Failed to seek to " + std::to_string(time_ms) + "ms");
    return false;
  }

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

  // Emit telemetry every ~33ms (30 FPS)
  if (elapsed.count() >= 33 && state_callback_) {
    last_telemetry_time_ = now;

    if (media_player_) {
      int64_t current_time = libvlc_media_player_get_time(media_player_);
      int64_t duration = media_ ? libvlc_media_get_duration(media_) : 0;

      // Update state if changed
      UpdateState();

      // Call callback with current state
      state_callback_(current_time, duration, current_state_);
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
