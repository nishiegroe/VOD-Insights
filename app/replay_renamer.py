from __future__ import annotations

import re
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional


@dataclass
class ReplayRenameSettings:
    enabled: bool
    directory: Path
    prefix: str
    include_event: bool
    time_format: str
    wait_seconds: float


def _slugify(text: str, limit: int = 40) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9 _-]", "", text)
    cleaned = cleaned.strip().replace(" ", "_")
    return cleaned[:limit] if cleaned else "event"


class ReplayRenamer:
    def __init__(self, settings: ReplayRenameSettings):
        self.settings = settings

    def rename_latest(self, trigger_time: float, event_text: str) -> Optional[Path]:
        if not self.settings.enabled:
            return None
        if not self.settings.directory.exists():
            return None

        deadline = time.time() + self.settings.wait_seconds
        newest: Optional[Path] = None
        while time.time() < deadline:
            newest = self._find_newest_after(trigger_time)
            if newest is not None:
                renamed = self._rename_with_retries(newest, event_text, deadline)
                if renamed is not None:
                    return renamed
            time.sleep(0.2)
        return None

    def _find_newest_after(self, trigger_time: float) -> Optional[Path]:
        files = [p for p in self.settings.directory.iterdir() if p.is_file()]
        if not files:
            return None
        files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        newest = files[0]
        if newest.stat().st_mtime >= trigger_time - 0.5:
            return newest
        return None

    def _rename_with_retries(
        self, path: Path, event_text: str, deadline: float
    ) -> Optional[Path]:
        timestamp = datetime.now().strftime(self.settings.time_format)
        parts = [self.settings.prefix, timestamp]
        if self.settings.include_event:
            parts.append(_slugify(event_text))
        name = "_".join(p for p in parts if p)
        new_path = path.with_name(f"{name}{path.suffix}")
        if new_path.exists():
            new_path = path.with_name(f"{name}_{int(time.time())}{path.suffix}")
        while time.time() < deadline:
            try:
                path.rename(new_path)
                return new_path
            except PermissionError:
                time.sleep(0.2)
        return None
