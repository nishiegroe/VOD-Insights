#include "SyncMaster.h"
#include <iostream>
#include <cmath>
#include <thread>
#include <chrono>
#include <algorithm>

/**
 * Phase 3: Multi-Video Synchronization Implementation
 * 
 * This file implements frame-accurate sync for N videos.
 * Key algorithm: Master clock + drift detection + micro-adjustments
 */

SyncMaster::SyncMaster(float reference_fps)
    : reference_fps_(reference_fps),
      sync_tolerance_frames_(1),  // ±1 frame @ 60fps = ±16.67ms
      update_rate_ms_(16),        // 60 FPS update rate
      master_clock_start_ms_(0),
      is_running_(false) {
  std::cout << "[SyncMaster] Initialized with reference_fps=" << reference_fps << std::endl;
}

SyncMaster::~SyncMaster() {
  Stop();
}

bool SyncMaster::AddVideo(int video_id, std::shared_ptr<VideoPlayer> player) {
  std::lock_guard<std::mutex> lock(state_mutex_);

  if (!player) {
    std::cerr << "[SyncMaster] Cannot add null player for video " << video_id << std::endl;
    return false;
  }

  if (videos_.find(video_id) != videos_.end()) {
    std::cerr << "[SyncMaster] Video " << video_id << " already in sync cluster" << std::endl;
    return false;
  }

  videos_[video_id] = player;
  frame_offsets_[video_id] = 0;

  std::cout << "[SyncMaster] Added video " << video_id << " (total: " << videos_.size() << ")" << std::endl;
  return true;
}

bool SyncMaster::RemoveVideo(int video_id) {
  std::lock_guard<std::mutex> lock(state_mutex_);

  auto it = videos_.find(video_id);
  if (it == videos_.end()) {
    std::cerr << "[SyncMaster] Video " << video_id << " not found in sync cluster" << std::endl;
    return false;
  }

  videos_.erase(it);
  frame_offsets_.erase(video_id);

  std::cout << "[SyncMaster] Removed video " << video_id << " (remaining: " << videos_.size() << ")" << std::endl;
  return true;
}

bool SyncMaster::Start(TelemetryCallback callback) {
  std::lock_guard<std::mutex> lock(state_mutex_);

  if (is_running_) {
    std::cerr << "[SyncMaster] Already running" << std::endl;
    return false;
  }

  if (videos_.empty()) {
    std::cerr << "[SyncMaster] Cannot start: no videos in cluster" << std::endl;
    return false;
  }

  telemetry_callback_ = callback;
  is_running_ = true;
  master_clock_start_ms_ = GetCurrentTimeMs();
  master_clock_start_steady_ = std::chrono::steady_clock::now();

  // Start sync thread
  sync_thread_ = std::make_unique<std::thread>([this]() { this->SyncLoop(); });

  std::cout << "[SyncMaster] Started synchronization for " << videos_.size() << " videos" << std::endl;
  return true;
}

void SyncMaster::Stop() {
  {
    std::lock_guard<std::mutex> lock(state_mutex_);
    is_running_ = false;
  }

  if (sync_thread_ && sync_thread_->joinable()) {
    sync_thread_->join();
  }

  std::cout << "[SyncMaster] Stopped synchronization" << std::endl;
}

bool SyncMaster::IsRunning() const {
  std::lock_guard<std::mutex> lock(state_mutex_);
  return is_running_;
}

size_t SyncMaster::GetVideoCount() const {
  std::lock_guard<std::mutex> lock(state_mutex_);
  return videos_.size();
}

SyncMaster::SyncTelemetry SyncMaster::MeasureDrift() {
  std::lock_guard<std::mutex> lock(state_mutex_);

  SyncTelemetry telemetry;
  telemetry.timestamp = GetCurrentTimeMs();
  telemetry.adjustment_count = 0;

  if (!is_running_ || videos_.empty()) {
    return telemetry;  // Return empty telemetry
  }

  // Get elapsed time since master clock started
  int64_t elapsed_ms = GetElapsedMs(master_clock_start_steady_);

  // Calculate expected frame for master (reference)
  int64_t master_expected_frame = (elapsed_ms * reference_fps_) / 1000;

  // Measure drift for each video
  for (const auto& [video_id, player] : videos_) {
    if (!player) continue;

    // Get current frame
    int64_t current_frame = GetCurrentFrame(player, video_id);

    // Get FPS from player
    double player_fps = player->GetFps();
    if (player_fps <= 0) player_fps = reference_fps_;

    // Calculate expected frame (scaled to this video's FPS)
    int64_t expected_frame = (elapsed_ms * player_fps) / 1000;

    // Calculate drift
    int64_t drift_frames = current_frame - expected_frame;
    double drift_ms = (drift_frames * 1000.0) / player_fps;

    VideoSyncState state;
    state.video_id = video_id;
    state.current_frame = current_frame;
    state.expected_frame = expected_frame;
    state.drift_frames = drift_frames;
    state.drift_ms = drift_ms;
    state.fps = player_fps;
    state.status = "playing";  // Will be updated by PlaybackControls

    telemetry.states.push_back(state);
  }

  // Calculate max and RMS drift
  if (!telemetry.states.empty()) {
    telemetry.max_drift_ms = 0;
    for (const auto& state : telemetry.states) {
      telemetry.max_drift_ms = std::max(telemetry.max_drift_ms, std::abs(state.drift_ms));
    }
    telemetry.rms_drift_ms = CalculateRmsDrift(telemetry.states);
  }

  return telemetry;
}

void SyncMaster::AdjustVideoOffset(int video_id, int offset_frames) {
  std::lock_guard<std::mutex> lock(state_mutex_);

  auto it = frame_offsets_.find(video_id);
  if (it == frame_offsets_.end()) {
    std::cerr << "[SyncMaster] Video " << video_id << " not found for offset adjustment" << std::endl;
    return;
  }

  it->second += offset_frames;
  std::cout << "[SyncMaster] Adjusted video " << video_id << " offset to " << it->second << " frames" << std::endl;
}

void SyncMaster::SetSyncTolerance(int frames) {
  std::lock_guard<std::mutex> lock(state_mutex_);
  sync_tolerance_frames_ = frames;
  std::cout << "[SyncMaster] Set sync tolerance to " << frames << " frames" << std::endl;
}

void SyncMaster::SetUpdateRate(int milliseconds) {
  std::lock_guard<std::mutex> lock(state_mutex_);
  update_rate_ms_ = std::max(1, milliseconds);
  std::cout << "[SyncMaster] Set update rate to " << update_rate_ms_ << "ms" << std::endl;
}

// ===== PRIVATE IMPLEMENTATION =====

void SyncMaster::SyncLoop() {
  std::cout << "[SyncMaster::SyncLoop] Started (TID: " << std::this_thread::get_id() << ")" << std::endl;

  while (true) {
    // Check if we should exit
    {
      std::lock_guard<std::mutex> lock(state_mutex_);
      if (!is_running_) break;
    }

    // Measure current drift
    SyncTelemetry telemetry = MeasureDrift();

    // Apply micro-adjustments
    {
      std::lock_guard<std::mutex> lock(state_mutex_);
      for (const auto& [video_id, player] : videos_) {
        if (!player) continue;

        // Find this video's state in telemetry
        auto state_it = std::find_if(
            telemetry.states.begin(),
            telemetry.states.end(),
            [video_id](const VideoSyncState& s) { return s.video_id == video_id; }
        );

        if (state_it != telemetry.states.end()) {
          if (AdjustPlayback(video_id, player, state_it->drift_frames)) {
            telemetry.adjustment_count++;
          }
        }
      }
    }

    // Emit telemetry via callback
    if (telemetry_callback_) {
      telemetry_callback_(telemetry);
    }

    // Log periodic stats (every 5 seconds)
    static int loop_count = 0;
    if (++loop_count % (5000 / update_rate_ms_) == 0) {
      std::cout << "[SyncMaster::SyncLoop] Max drift: " << telemetry.max_drift_ms << "ms, "
                << "RMS drift: " << telemetry.rms_drift_ms << "ms" << std::endl;
    }

    // Sleep for update interval
    SleepMs(update_rate_ms_);
  }

  std::cout << "[SyncMaster::SyncLoop] Exited" << std::endl;
}

int64_t SyncMaster::CalculateExpectedFrame(int64_t elapsed_ms, double video_fps) {
  if (video_fps <= 0) return 0;
  return (elapsed_ms * video_fps) / 1000;
}

int64_t SyncMaster::GetCurrentFrame(std::shared_ptr<VideoPlayer> player, int video_id) {
  // Get current time from player
  int64_t current_time_ms = player->GetCurrentTime();

  // Get FPS
  double fps = player->GetFps();
  if (fps <= 0) fps = reference_fps_;

  // Convert to frame number: frame = (time_ms / 1000.0) * fps
  int64_t current_frame = (current_time_ms * fps) / 1000;

  // Apply per-video offset
  int offset = 0;
  {
    auto it = frame_offsets_.find(video_id);
    if (it != frame_offsets_.end()) {
      offset = it->second;
    }
  }

  return current_frame + offset;
}

bool SyncMaster::AdjustPlayback(int video_id, std::shared_ptr<VideoPlayer> player, int drift_frames) {
  // Only adjust if drift exceeds tolerance
  if (std::abs(drift_frames) <= sync_tolerance_frames_) {
    return false;  // No adjustment needed
  }

  bool adjusted = false;

  if (drift_frames > sync_tolerance_frames_) {
    // Video is ahead - pause briefly
    std::cout << "[SyncMaster] Video " << video_id << " is ahead by " << drift_frames
              << " frames, applying micro-pause" << std::endl;

    // Calculate sleep duration
    double fps = player->GetFps();
    if (fps <= 0) fps = reference_fps_;
    int sleep_ms = (drift_frames * 1000) / fps;

    player->Pause();
    SleepMs(std::min(sleep_ms, 100));  // Cap at 100ms per adjustment
    player->Play();

    adjusted = true;

  } else if (drift_frames < -sync_tolerance_frames_) {
    // Video is behind - step forward
    std::cout << "[SyncMaster] Video " << video_id << " is behind by " << -drift_frames
              << " frames, stepping forward" << std::endl;

    // For now, just pause and let master catch up
    // In production, could implement frame stepping
    player->Pause();
    SleepMs(50);  // Brief pause
    player->Play();

    adjusted = true;
  }

  return adjusted;
}

void SyncMaster::SleepMs(int milliseconds) {
  std::this_thread::sleep_for(std::chrono::milliseconds(milliseconds));
}

int64_t SyncMaster::GetCurrentTimeMs() {
  auto now = std::chrono::system_clock::now();
  auto duration = now.time_since_epoch();
  return std::chrono::duration_cast<std::chrono::milliseconds>(duration).count();
}

int64_t SyncMaster::GetElapsedMs(const std::chrono::steady_clock::time_point& start) {
  auto now = std::chrono::steady_clock::now();
  auto duration = now - start;
  return std::chrono::duration_cast<std::chrono::milliseconds>(duration).count();
}

double SyncMaster::CalculateRmsDrift(const std::vector<VideoSyncState>& states) {
  if (states.empty()) return 0.0;

  double sum_squares = 0.0;
  for (const auto& state : states) {
    sum_squares += state.drift_ms * state.drift_ms;
  }

  return std::sqrt(sum_squares / states.size());
}
