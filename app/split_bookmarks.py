from __future__ import annotations

import argparse
import csv
import json
import logging
import re
import subprocess
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterable, List, Optional

from app.config import load_config
from app.runtime_paths import get_app_data_dir, get_config_path, resolve_log_path, resolve_tool, reset_log_file


@dataclass
class ClipWindow:
    start: float
    end: float


@dataclass
class BookmarkEvent:
    time: float
    event: str


def load_bookmarks(bookmark_path: Path) -> List[BookmarkEvent]:
    if not bookmark_path.exists():
        raise FileNotFoundError(f"Bookmarks file not found: {bookmark_path}")

    if bookmark_path.suffix.lower() == ".jsonl":
        events = []
        with bookmark_path.open("r", encoding="utf-8") as handle:
            for line in handle:
                if not line.strip():
                    continue
                payload = json.loads(line)
                events.append(
                    BookmarkEvent(
                        time=float(payload.get("seconds_since_start", 0)),
                        event=str(payload.get("event", "")),
                    )
                )
        return events

    events = []
    with bookmark_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            events.append(
                BookmarkEvent(
                    time=float(row.get("seconds_since_start", 0)),
                    event=str(row.get("event", "")),
                )
            )
    return events


def build_windows(
    events: Iterable[BookmarkEvent], pre: float, post: float
) -> List[ClipWindow]:
    windows = []
    for event in events:
        windows.append(
            ClipWindow(max(0.0, event.time - pre), max(0.0, event.time + post))
        )
    windows.sort(key=lambda w: w.start)
    return windows


def merge_windows(windows: List[ClipWindow], gap: float) -> List[ClipWindow]:
    if not windows:
        return []
    merged = [windows[0]]
    for current in windows[1:]:
        last = merged[-1]
        if current.start <= last.end + gap:
            last.end = max(last.end, current.end)
        else:
            merged.append(current)
    return merged


def find_newest_recording(directory: Path, extensions: Iterable[str]) -> Optional[Path]:
    files = [
        p
        for p in directory.iterdir()
        if p.is_file() and p.suffix.lower() in {ext.lower() for ext in extensions}
    ]
    if not files:
        return None
    files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return files[0]


def run_ffmpeg(input_file: Path, output_file: Path, start: float, duration: float) -> None:
    ffmpeg_path = resolve_tool("ffmpeg", ["ffmpeg.exe"])
    if not ffmpeg_path:
        raise RuntimeError("FFmpeg not found. Install it or bundle tools/ffmpeg.exe.")
    cmd = [
        ffmpeg_path,
        "-y",
        "-ss",
        f"{start:.3f}",
        "-i",
        str(input_file),
        "-t",
        f"{duration:.3f}",
        "-c",
        "copy",
        str(output_file),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def count_events(events: Iterable[BookmarkEvent]) -> dict[str, int]:
    counts = {"kills": 0, "assists": 0, "deaths": 0}
    for event in events:
        text = event.event.lower()
        if "assist" in text:
            counts["assists"] += 1
        elif "death" in text:
            counts["deaths"] += 1
        elif any(word in text for word in ["kill", "killed", "knocked", "elimination"]):
            counts["kills"] += 1
    return counts


def parse_vod_start_time(path: Path) -> Optional[datetime]:
    match = re.search(r"(\d{8}_\d{6})", path.stem)
    if not match:
        return None
    try:
        return datetime.strptime(match.group(1), "%Y%m%d_%H%M%S")
    except ValueError:
        return None


def split_from_config(config_path: Path, bookmarks_override: Optional[Path] = None, input_override: Optional[Path] = None) -> None:
    config = load_config(config_path)
    if not config.split.enabled:
        logging.info("Split is disabled in config.")
        return

    log_path = resolve_log_path(config_path, config.logging.file)
    reset_log_file(log_path)
    logging.basicConfig(
        level=getattr(logging, config.logging.level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[
            logging.FileHandler(log_path, encoding="utf-8"),
            logging.StreamHandler(),
        ],
    )

    bookmark_path = bookmarks_override or resolve_bookmarks_path(config)
    events = load_bookmarks(bookmark_path)
    if not events:
        logging.info("No bookmarks found in %s", bookmark_path)
        return

    input_file = input_override
    if input_file is None:
        recordings_dir = Path(config.split.recordings_dir)
        if config.split.input_source == "path":
            input_file = recordings_dir
        else:
            input_file = find_newest_recording(recordings_dir, config.split.extensions)

    if input_file is None or not input_file.exists():
        logging.error("Recording file not found.")
        return

    windows = build_windows(events, config.split.pre_seconds, config.split.post_seconds)
    windows = merge_windows(windows, config.split.merge_gap_seconds)

    output_dir = Path(config.split.output_dir)
    vod_dir = input_file.parent if input_file.is_file() else input_file
    # Output is relative to the VOD directory unless explicitly absolute.
    if not output_dir.name:
        output_dir = vod_dir / "clips"
    elif not output_dir.is_absolute():
        output_dir = vod_dir / output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    vod_start = parse_vod_start_time(input_file)
    if vod_start is None:
        vod_start = datetime.fromtimestamp(input_file.stat().st_mtime)

    for index, window in enumerate(windows, start=1):
        duration = max(0.1, window.end - window.start)
        offset_seconds = int(round(window.start))
        clip_time = vod_start + timedelta(seconds=window.start)
        timestamp = clip_time.strftime("%Y%m%d_%H%M%S")
        output_name = f"clip_{timestamp}_{index:02d}_t{offset_seconds}s"
        if config.split.encode_counts:
            window_events = [e for e in events if window.start <= e.time <= window.end]
            counts = count_events(window_events)
            output_name = f"{output_name}_{config.split.count_format.format(**counts)}"
        output_file = output_dir / f"{output_name}{input_file.suffix}"
        logging.info("Exporting %s (%.2fs to %.2fs)", output_file, window.start, window.end)
        try:
            run_ffmpeg(input_file, output_file, window.start, duration)
        except (subprocess.CalledProcessError, RuntimeError) as exc:
            logging.error("FFmpeg failed: %s", exc)
            return

    logging.info("Split completed. %d clips written to %s", len(windows), output_dir)


def resolve_bookmarks_path(config: object) -> Path:
    directory = Path(getattr(config.bookmarks, "directory", ""))
    # If path is relative, resolve it to app data directory
    if not directory.is_absolute():
        directory = get_app_data_dir() / directory
    if directory.exists():
        candidates = sorted(directory.glob("*.csv")) + sorted(directory.glob("*.jsonl"))
        if candidates:
            return max(candidates, key=lambda p: p.stat().st_mtime)
    return Path(config.bookmarks.file)


def main() -> None:
    parser = argparse.ArgumentParser(description="Split recording by bookmarks")
    parser.add_argument(
        "--config",
        default=str(get_config_path()),
        help="Path to config.json",
    )
    args = parser.parse_args()
    split_from_config(Path(args.config))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
