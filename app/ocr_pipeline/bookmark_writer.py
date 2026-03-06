from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable, Optional


@dataclass
class BookmarkSettings:
    enabled: bool
    file: Path
    format: str
    include_event: bool
    include_ocr_lines: bool


class BookmarkWriter:
    def __init__(self, settings: BookmarkSettings, session_start: datetime):
        self.settings = settings
        self.session_start = session_start
        self._initialized = False

    def write(self, event_text: str, ocr_lines: Iterable[str], seconds_since_start: float) -> None:
        if not self.settings.enabled:
            return
        self.settings.file.parent.mkdir(parents=True, exist_ok=True)

        payload = {
            "timestamp": datetime.now().isoformat(timespec="seconds"),
            "seconds_since_start": round(seconds_since_start, 2),
            "event": event_text if self.settings.include_event else "",
            "ocr": list(ocr_lines) if self.settings.include_ocr_lines else [],
        }

        if self.settings.format.lower() == "jsonl":
            self._write_jsonl(payload)
        else:
            self._write_csv(payload)

    def _write_csv(self, payload: dict[str, object]) -> None:
        file_exists = self.settings.file.exists()
        with self.settings.file.open("a", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            if not file_exists:
                writer.writerow(["timestamp", "seconds_since_start", "event", "ocr"])
            writer.writerow(
                [
                    payload["timestamp"],
                    payload["seconds_since_start"],
                    payload["event"],
                    " | ".join(payload["ocr"]) if payload["ocr"] else "",
                ]
            )

    def _write_jsonl(self, payload: dict[str, object]) -> None:
        with self.settings.file.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload) + "\n")
