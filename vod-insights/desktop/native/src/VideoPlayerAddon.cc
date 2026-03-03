#include <nan.h>
#include "VideoPlayer.h"
#include <memory>

/**
 * Node.js addon wrapper for VideoPlayer C++ class
 * Exposes VideoPlayer as a JavaScript class using Nan
 */

class VideoPlayerAddon : public Nan::ObjectWrap {
public:
  static void Init(v8::Local<v8::Object> exports);

  VideoPlayerAddon();
  ~VideoPlayerAddon();

private:
  std::unique_ptr<VideoPlayer> player_;

  // Constructor
  static void New(const Nan::FunctionCallbackInfo<v8::Value>& info);

  // Methods
  static void Initialize(const Nan::FunctionCallbackInfo<v8::Value>& info);
  static void Shutdown(const Nan::FunctionCallbackInfo<v8::Value>& info);
  static void Play(const Nan::FunctionCallbackInfo<v8::Value>& info);
  static void Pause(const Nan::FunctionCallbackInfo<v8::Value>& info);
  static void Stop(const Nan::FunctionCallbackInfo<v8::Value>& info);
  static void Seek(const Nan::FunctionCallbackInfo<v8::Value>& info);
  static void SetPlaybackRate(const Nan::FunctionCallbackInfo<v8::Value>& info);
  static void GetCurrentTime(const Nan::FunctionCallbackInfo<v8::Value>& info);
  static void GetDuration(const Nan::FunctionCallbackInfo<v8::Value>& info);
  static void GetState(const Nan::FunctionCallbackInfo<v8::Value>& info);
  static void IsPlaying(const Nan::FunctionCallbackInfo<v8::Value>& info);
  static void SetWindowHandle(const Nan::FunctionCallbackInfo<v8::Value>& info);
  static void GetCurrentFrame(const Nan::FunctionCallbackInfo<v8::Value>& info);
  static void GetFps(const Nan::FunctionCallbackInfo<v8::Value>& info);
  static void GetDimensions(const Nan::FunctionCallbackInfo<v8::Value>& info);
  static void GetPerformanceMetrics(const Nan::FunctionCallbackInfo<v8::Value>& info);
  static void SetStateCallback(const Nan::FunctionCallbackInfo<v8::Value>& info);
  static void ProcessEvents(const Nan::FunctionCallbackInfo<v8::Value>& info);
  static void GetLastError(const Nan::FunctionCallbackInfo<v8::Value>& info);

  static Nan::Persistent<v8::Function> constructor;
  static Nan::Persistent<v8::Function> state_callback;
};

Nan::Persistent<v8::Function> VideoPlayerAddon::constructor;
Nan::Persistent<v8::Function> VideoPlayerAddon::state_callback;

VideoPlayerAddon::VideoPlayerAddon() : player_(std::make_unique<VideoPlayer>()) {}

VideoPlayerAddon::~VideoPlayerAddon() {
  player_.reset();
}

void VideoPlayerAddon::Init(v8::Local<v8::Object> exports) {
  v8::Local<v8::FunctionTemplate> tpl = Nan::New<v8::FunctionTemplate>(New);
  tpl->SetClassName(Nan::New("VideoPlayer").ToLocalChecked());
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  Nan::SetPrototypeMethod(tpl, "initialize", Initialize);
  Nan::SetPrototypeMethod(tpl, "shutdown", Shutdown);
  Nan::SetPrototypeMethod(tpl, "play", Play);
  Nan::SetPrototypeMethod(tpl, "pause", Pause);
  Nan::SetPrototypeMethod(tpl, "stop", Stop);
  Nan::SetPrototypeMethod(tpl, "seek", Seek);
  Nan::SetPrototypeMethod(tpl, "setPlaybackRate", SetPlaybackRate);
  Nan::SetPrototypeMethod(tpl, "getCurrentTime", GetCurrentTime);
  Nan::SetPrototypeMethod(tpl, "getDuration", GetDuration);
  Nan::SetPrototypeMethod(tpl, "getState", GetState);
  Nan::SetPrototypeMethod(tpl, "isPlaying", IsPlaying);
  Nan::SetPrototypeMethod(tpl, "setWindowHandle", SetWindowHandle);
  Nan::SetPrototypeMethod(tpl, "getCurrentFrame", GetCurrentFrame);
  Nan::SetPrototypeMethod(tpl, "getFps", GetFps);
  Nan::SetPrototypeMethod(tpl, "getDimensions", GetDimensions);
  Nan::SetPrototypeMethod(tpl, "getPerformanceMetrics", GetPerformanceMetrics);
  Nan::SetPrototypeMethod(tpl, "setStateCallback", SetStateCallback);
  Nan::SetPrototypeMethod(tpl, "processEvents", ProcessEvents);
  Nan::SetPrototypeMethod(tpl, "getLastError", GetLastError);

  constructor.Reset(tpl->GetFunction(Nan::GetCurrentContext()).ToLocalChecked());
  Nan::Set(exports, Nan::New("VideoPlayer").ToLocalChecked(),
           tpl->GetFunction(Nan::GetCurrentContext()).ToLocalChecked());
}

void VideoPlayerAddon::New(const Nan::FunctionCallbackInfo<v8::Value>& info) {
  if (info.IsConstructCall()) {
    VideoPlayerAddon* obj = new VideoPlayerAddon();
    obj->Wrap(info.This());
    info.GetReturnValue().Set(info.This());
  } else {
    const int argc = 0;
    v8::Local<v8::Value> argv[argc] = {};
    v8::Local<v8::Function> cons = Nan::New(constructor);
    info.GetReturnValue().Set(
        cons->NewInstance(Nan::GetCurrentContext(), argc, argv).ToLocalChecked());
  }
}

void VideoPlayerAddon::Initialize(
    const Nan::FunctionCallbackInfo<v8::Value>& info) {
  if (info.Length() < 1) {
    Nan::ThrowTypeError("Wrong number of arguments");
    return;
  }

  if (!info[0]->IsString()) {
    Nan::ThrowTypeError("Argument must be a string");
    return;
  }

  VideoPlayerAddon* obj = ObjectWrap::Unwrap<VideoPlayerAddon>(info.Holder());
  std::string file_path(*Nan::Utf8String(info[0]));

  bool result = obj->player_->Initialize(file_path);
  info.GetReturnValue().Set(Nan::New(result));
}

void VideoPlayerAddon::Shutdown(const Nan::FunctionCallbackInfo<v8::Value>& info) {
  VideoPlayerAddon* obj = ObjectWrap::Unwrap<VideoPlayerAddon>(info.Holder());
  obj->player_->Shutdown();
  info.GetReturnValue().SetUndefined();
}

void VideoPlayerAddon::Play(const Nan::FunctionCallbackInfo<v8::Value>& info) {
  VideoPlayerAddon* obj = ObjectWrap::Unwrap<VideoPlayerAddon>(info.Holder());
  bool result = obj->player_->Play();
  info.GetReturnValue().Set(Nan::New(result));
}

void VideoPlayerAddon::Pause(const Nan::FunctionCallbackInfo<v8::Value>& info) {
  VideoPlayerAddon* obj = ObjectWrap::Unwrap<VideoPlayerAddon>(info.Holder());
  bool result = obj->player_->Pause();
  info.GetReturnValue().Set(Nan::New(result));
}

void VideoPlayerAddon::Stop(const Nan::FunctionCallbackInfo<v8::Value>& info) {
  VideoPlayerAddon* obj = ObjectWrap::Unwrap<VideoPlayerAddon>(info.Holder());
  bool result = obj->player_->Stop();
  info.GetReturnValue().Set(Nan::New(result));
}

void VideoPlayerAddon::Seek(const Nan::FunctionCallbackInfo<v8::Value>& info) {
  if (info.Length() < 1) {
    Nan::ThrowTypeError("Wrong number of arguments");
    return;
  }

  if (!info[0]->IsNumber()) {
    Nan::ThrowTypeError("Argument must be a number");
    return;
  }

  VideoPlayerAddon* obj = ObjectWrap::Unwrap<VideoPlayerAddon>(info.Holder());
  int64_t time_ms = info[0]->IntegerValue(Nan::GetCurrentContext()).FromJust();

  bool result = obj->player_->Seek(time_ms);
  info.GetReturnValue().Set(Nan::New(result));
}

void VideoPlayerAddon::SetPlaybackRate(
    const Nan::FunctionCallbackInfo<v8::Value>& info) {
  if (info.Length() < 1) {
    Nan::ThrowTypeError("Wrong number of arguments");
    return;
  }

  if (!info[0]->IsNumber()) {
    Nan::ThrowTypeError("Argument must be a number");
    return;
  }

  VideoPlayerAddon* obj = ObjectWrap::Unwrap<VideoPlayerAddon>(info.Holder());
  float rate = static_cast<float>(
      info[0]->NumberValue(Nan::GetCurrentContext()).FromJust());

  bool result = obj->player_->SetPlaybackRate(rate);
  info.GetReturnValue().Set(Nan::New(result));
}

void VideoPlayerAddon::GetCurrentTime(
    const Nan::FunctionCallbackInfo<v8::Value>& info) {
  VideoPlayerAddon* obj = ObjectWrap::Unwrap<VideoPlayerAddon>(info.Holder());
  int64_t time = obj->player_->GetCurrentTime();
  info.GetReturnValue().Set(Nan::New<v8::Number>(static_cast<double>(time)));
}

void VideoPlayerAddon::GetDuration(
    const Nan::FunctionCallbackInfo<v8::Value>& info) {
  VideoPlayerAddon* obj = ObjectWrap::Unwrap<VideoPlayerAddon>(info.Holder());
  int64_t duration = obj->player_->GetDuration();
  info.GetReturnValue().Set(Nan::New<v8::Number>(static_cast<double>(duration)));
}

void VideoPlayerAddon::GetState(const Nan::FunctionCallbackInfo<v8::Value>& info) {
  VideoPlayerAddon* obj = ObjectWrap::Unwrap<VideoPlayerAddon>(info.Holder());
  std::string state = obj->player_->GetState();
  info.GetReturnValue().Set(
      Nan::New(state).ToLocalChecked());
}

void VideoPlayerAddon::IsPlaying(const Nan::FunctionCallbackInfo<v8::Value>& info) {
  VideoPlayerAddon* obj = ObjectWrap::Unwrap<VideoPlayerAddon>(info.Holder());
  bool result = obj->player_->IsPlaying();
  info.GetReturnValue().Set(Nan::New(result));
}

void VideoPlayerAddon::SetStateCallback(
    const Nan::FunctionCallbackInfo<v8::Value>& info) {
  if (info.Length() < 1) {
    Nan::ThrowTypeError("Wrong number of arguments");
    return;
  }

  if (!info[0]->IsFunction()) {
    Nan::ThrowTypeError("Argument must be a function");
    return;
  }

  VideoPlayerAddon* obj = ObjectWrap::Unwrap<VideoPlayerAddon>(info.Holder());

  // Store the callback as a persistent reference
  state_callback.Reset(v8::Local<v8::Function>::Cast(info[0]));

  // Set the C++ callback that will invoke the JavaScript callback
  obj->player_->SetStateCallback(
      [obj](int64_t current_time, int64_t duration, const std::string& state, const VideoPlayer::PerformanceMetrics& metrics) {
        // In production, we'd need proper async handling here
        // For now, this is a placeholder
      });

  info.GetReturnValue().SetUndefined();
}

void VideoPlayerAddon::ProcessEvents(
    const Nan::FunctionCallbackInfo<v8::Value>& info) {
  VideoPlayerAddon* obj = ObjectWrap::Unwrap<VideoPlayerAddon>(info.Holder());
  obj->player_->ProcessEvents();
  info.GetReturnValue().SetUndefined();
}

void VideoPlayerAddon::GetLastError(
    const Nan::FunctionCallbackInfo<v8::Value>& info) {
  VideoPlayerAddon* obj = ObjectWrap::Unwrap<VideoPlayerAddon>(info.Holder());
  std::string error = obj->player_->GetLastError();
  info.GetReturnValue().Set(
      Nan::New(error).ToLocalChecked());
}

void VideoPlayerAddon::SetWindowHandle(
    const Nan::FunctionCallbackInfo<v8::Value>& info) {
  if (info.Length() < 1) {
    Nan::ThrowTypeError("Wrong number of arguments");
    return;
  }

  VideoPlayerAddon* obj = ObjectWrap::Unwrap<VideoPlayerAddon>(info.Holder());
  void* hwnd = nullptr;

  // Handle could be passed as a number (pointer address) or external
  if (info[0]->IsNumber()) {
    hwnd = reinterpret_cast<void*>(
        static_cast<uintptr_t>(info[0]->NumberValue(Nan::GetCurrentContext()).FromJust()));
  } else if (info[0]->IsExternal()) {
    hwnd = v8::External::Cast(*info[0])->Value();
  }

  bool result = obj->player_->SetWindowHandle(hwnd);
  info.GetReturnValue().Set(Nan::New(result));
}

void VideoPlayerAddon::GetCurrentFrame(
    const Nan::FunctionCallbackInfo<v8::Value>& info) {
  VideoPlayerAddon* obj = ObjectWrap::Unwrap<VideoPlayerAddon>(info.Holder());
  int frame = obj->player_->GetCurrentFrame();
  info.GetReturnValue().Set(Nan::New(frame));
}

void VideoPlayerAddon::GetFps(const Nan::FunctionCallbackInfo<v8::Value>& info) {
  VideoPlayerAddon* obj = ObjectWrap::Unwrap<VideoPlayerAddon>(info.Holder());
  double fps = obj->player_->GetFps();
  info.GetReturnValue().Set(Nan::New(fps));
}

void VideoPlayerAddon::GetDimensions(
    const Nan::FunctionCallbackInfo<v8::Value>& info) {
  VideoPlayerAddon* obj = ObjectWrap::Unwrap<VideoPlayerAddon>(info.Holder());
  int width = 0, height = 0;
  bool result = obj->player_->GetDimensions(width, height);

  v8::Local<v8::Object> dimensions = Nan::New<v8::Object>();
  Nan::Set(dimensions, Nan::New("width").ToLocalChecked(), Nan::New(width));
  Nan::Set(dimensions, Nan::New("height").ToLocalChecked(), Nan::New(height));
  Nan::Set(dimensions, Nan::New("success").ToLocalChecked(), Nan::New(result));

  info.GetReturnValue().Set(dimensions);
}

void VideoPlayerAddon::GetPerformanceMetrics(
    const Nan::FunctionCallbackInfo<v8::Value>& info) {
  VideoPlayerAddon* obj = ObjectWrap::Unwrap<VideoPlayerAddon>(info.Holder());
  auto metrics = obj->player_->GetPerformanceMetrics();

  v8::Local<v8::Object> metricsObj = Nan::New<v8::Object>();
  Nan::Set(metricsObj, Nan::New("currentFps").ToLocalChecked(),
           Nan::New(metrics.current_fps));
  Nan::Set(metricsObj, Nan::New("averageFps").ToLocalChecked(),
           Nan::New(metrics.average_fps));
  Nan::Set(metricsObj, Nan::New("cpuPercent").ToLocalChecked(),
           Nan::New(metrics.cpu_percent));
  Nan::Set(metricsObj, Nan::New("memoryMb").ToLocalChecked(),
           Nan::New(metrics.memory_mb));
  Nan::Set(metricsObj, Nan::New("seekLatencyMs").ToLocalChecked(),
           Nan::New<v8::Number>(static_cast<double>(metrics.seek_latency_ms)));
  Nan::Set(metricsObj, Nan::New("frameDrops").ToLocalChecked(),
           Nan::New(metrics.frame_drops));
  Nan::Set(metricsObj, Nan::New("totalFramesRendered").ToLocalChecked(),
           Nan::New(metrics.total_frames_rendered));

  info.GetReturnValue().Set(metricsObj);
}

void InitModule(v8::Local<v8::Object> exports) {
  VideoPlayerAddon::Init(exports);
  // SyncMaster addon will be added in Phase 3.5
}

NODE_MODULE(video_player, InitModule)
