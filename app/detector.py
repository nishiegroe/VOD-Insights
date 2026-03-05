from __future__ import annotations

from dataclasses import dataclass
import time
from typing import Iterable, Sequence


@dataclass
class DetectionResult:
    matched: bool
    matched_line: str


def normalize_for_detection(text: str) -> str:
    return "".join(ch for ch in text.lower() if ch.isalnum() or ch.isspace())


def detect_event_line(lines: Iterable[str], keywords: Iterable[str]) -> DetectionResult:
    normalized_keywords = [normalize_for_detection(keyword) for keyword in keywords]
    for line in lines:
        normalized_line = normalize_for_detection(line)
        for keyword in normalized_keywords:
            if keyword and keyword in normalized_line:
                return DetectionResult(True, line)
    return DetectionResult(False, "")


def cooldown_elapsed(now: float, last_trigger: float, cooldown_seconds: float) -> bool:
    return now - last_trigger >= cooldown_seconds


class EventDetector:
    def __init__(self, keywords: Iterable[str], cooldown_seconds: float):
        self.keywords = [k for k in keywords]
        self.cooldown_seconds = cooldown_seconds
        self._last_trigger = 0.0

    def detect_at(self, lines: Sequence[str], now: float) -> DetectionResult:
        if not cooldown_elapsed(now, self._last_trigger, self.cooldown_seconds):
            return DetectionResult(False, "")

        result = detect_event_line(lines, self.keywords)
        if result.matched:
            self._last_trigger = now
        return result

    def detect(self, lines: list[str]) -> DetectionResult:
        return self.detect_at(lines, now=time.time())
