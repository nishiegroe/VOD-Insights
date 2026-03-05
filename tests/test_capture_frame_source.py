import numpy as np

from app.capture import CaptureBackend, CaptureRegion, DxcamFrameSource, MssFrameSource


class FakeDxcam:
    def __init__(self, frame: np.ndarray):
        self.frame = frame
        self.last_region = None

    def grab(self, region):
        self.last_region = region
        return self.frame


class FakeMss:
    def __init__(self, screenshot: np.ndarray):
        self.screenshot = screenshot
        self.last_monitor = None

    def grab(self, monitor):
        self.last_monitor = monitor
        return self.screenshot


class MemoryErrorSource:
    def grab(self, region):
        raise MemoryError("simulated")


def test_dxcam_frame_source_maps_capture_region_to_tuple():
    frame = np.zeros((10, 20, 3), dtype=np.uint8)
    dxcam = FakeDxcam(frame)
    source = DxcamFrameSource(dxcam)
    region = CaptureRegion(left=11, top=22, width=33, height=44)

    result = source.grab(region)

    assert result is frame
    assert dxcam.last_region == (11, 22, 44, 66)


def test_mss_frame_source_returns_bgr_three_channels():
    screenshot = np.zeros((3, 4, 4), dtype=np.uint8)
    screenshot[:, :, 3] = 255
    mss = FakeMss(screenshot)
    source = MssFrameSource(mss)
    region = CaptureRegion(left=1, top=2, width=3, height=4)

    result = source.grab(region)

    assert result.shape == (3, 4, 3)
    assert mss.last_monitor == {"left": 1, "top": 2, "width": 3, "height": 4}


def test_capture_backend_supports_injected_frame_source():
    expected = np.ones((2, 2, 3), dtype=np.uint8)
    source = DxcamFrameSource(FakeDxcam(expected))
    capture = CaptureBackend(CaptureRegion(0, 0, 2, 2), frame_source=source)

    result = capture.grab()

    assert result is expected


def test_capture_backend_memory_error_returns_none_for_injected_source():
    capture = CaptureBackend(CaptureRegion(0, 0, 1, 1), frame_source=MemoryErrorSource())

    first = capture.grab()
    second = capture.grab()

    assert first is None
    assert second is None
