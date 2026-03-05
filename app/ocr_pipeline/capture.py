from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Protocol

import numpy as np


@dataclass
class CaptureRegion:
    left: int
    top: int
    width: int
    height: int

    @property
    def right(self) -> int:
        return self.left + self.width

    @property
    def bottom(self) -> int:
        return self.top + self.height


class FrameSource(Protocol):
    def grab(self, region: CaptureRegion) -> Optional[np.ndarray]:
        ...


class DxcamFrameSource:
    def __init__(self, dxcam_instance: object):
        self._dxcam = dxcam_instance

    def grab(self, region: CaptureRegion) -> Optional[np.ndarray]:
        return self._dxcam.grab(
            region=(
                region.left,
                region.top,
                region.right,
                region.bottom,
            )
        )


class MssFrameSource:
    def __init__(self, mss_instance: object):
        self._mss = mss_instance

    def grab(self, region: CaptureRegion) -> Optional[np.ndarray]:
        monitor = {
            "left": region.left,
            "top": region.top,
            "width": region.width,
            "height": region.height,
        }
        screenshot = self._mss.grab(monitor)
        frame = np.asarray(screenshot)
        return frame[:, :, :3]


class CaptureBackend:
    def __init__(self, region: CaptureRegion, backend: str = "auto", frame_source: Optional[FrameSource] = None):
        self.region = region
        self._dxcam = None
        self._mss = None
        self._use_dxcam = False
        self._backend = backend
        self._frame_source: Optional[FrameSource] = frame_source

        if self._frame_source is not None:
            return

        if backend in ("auto", "dxcam"):
            try:
                import dxcam  # type: ignore

                self._dxcam = dxcam.create(output_color="BGR")
                self._use_dxcam = True
                self._frame_source = DxcamFrameSource(self._dxcam)
            except Exception:
                self._use_dxcam = False

        if not self._use_dxcam:
            if backend in ("auto", "mss"):
                try:
                    import mss  # type: ignore

                    self._mss = mss.mss()
                    self._frame_source = MssFrameSource(self._mss)
                except Exception as exc:
                    raise RuntimeError(
                        "No capture backend available. Install dxcam or mss."
                    ) from exc
            else:
                raise RuntimeError("Requested capture backend is unavailable.")

    def grab(self) -> Optional[np.ndarray]:
        if self._frame_source is None:
            return None

        if self._use_dxcam and self._dxcam is not None:
            try:
                return self._frame_source.grab(self.region)
            except MemoryError:
                self._use_dxcam = False
                self._frame_source = None

                if self._mss is not None:
                    self._frame_source = MssFrameSource(self._mss)
                    return self._frame_source.grab(self.region)

                return None

        try:
            return self._frame_source.grab(self.region)
        except MemoryError:
            return None
