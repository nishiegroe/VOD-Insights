from __future__ import annotations

from dataclasses import dataclass
import time
from typing import Iterable, List


@dataclass
class DetectionResult:
    matched: bool
    matched_line: str


class EventDetector:
    def __init__(self, keywords: Iterable[str], cooldown_seconds: float):
        self.keywords = [k.lower() for k in keywords]
        self.cooldown_seconds = cooldown_seconds
        self._last_trigger = 0.0

    def detect(self, lines: List[str]) -> DetectionResult:
        now = time.time()
        if now - self._last_trigger < self.cooldown_seconds:
            return DetectionResult(False, "")

        for line in lines:
            normalized = "".join(ch for ch in line.lower() if ch.isalnum() or ch.isspace())
            for keyword in self.keywords:
                if keyword in normalized:
                    self._last_trigger = now
                    return DetectionResult(True, line)

        return DetectionResult(False, "")
