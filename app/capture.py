from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

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


class CaptureBackend:
    def __init__(self, region: CaptureRegion, backend: str = "auto"):
        self.region = region
        self._dxcam = None
        self._mss = None
        self._use_dxcam = False
        self._backend = backend

        if backend in ("auto", "dxcam"):
            try:
                import dxcam  # type: ignore

                self._dxcam = dxcam.create(output_color="BGR")
                self._use_dxcam = True
            except Exception:
                self._use_dxcam = False

        if not self._use_dxcam:
            if backend in ("auto", "mss"):
                try:
                    import mss  # type: ignore

                    self._mss = mss.mss()
                except Exception as exc:
                    raise RuntimeError(
                        "No capture backend available. Install dxcam or mss."
                    ) from exc
            else:
                raise RuntimeError("Requested capture backend is unavailable.")

    def grab(self) -> Optional[np.ndarray]:
        if self._use_dxcam and self._dxcam is not None:
            try:
                frame = self._dxcam.grab(
                    region=(
                        self.region.left,
                        self.region.top,
                        self.region.right,
                        self.region.bottom,
                    )
                )
                return frame
            except MemoryError:
                self._use_dxcam = False

        if self._mss is None:
            return None

        monitor = {
            "left": self.region.left,
            "top": self.region.top,
            "width": self.region.width,
            "height": self.region.height,
        }
        screenshot = self._mss.grab(monitor)
        frame = np.asarray(screenshot)
        return frame[:, :, :3]
