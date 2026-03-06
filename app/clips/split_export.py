from __future__ import annotations

import logging
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Callable, Iterable, List

from app.system.subprocess_policy import UnsafePathError, normalize_process_path


def export_clip_windows(
    input_file: Path,
    windows: Iterable[Any],
    events: Iterable[Any],
    output_dir: Path,
    vod_start: datetime,
    encode_counts: bool,
    count_format: str,
    run_ffmpeg_fn: Callable[[Path, Path, float, float], None],
    validate_clip_fn: Callable[[Path], bool],
    count_events_fn: Callable[[Iterable[Any]], dict[str, int]],
) -> List[str]:
    failed_clips: List[str] = []
    try:
        safe_input_file = normalize_process_path(input_file)
        safe_output_dir = normalize_process_path(output_dir, must_exist=False, expect_file=False)
    except UnsafePathError as exc:
        logging.error("Invalid clip export path: %s", exc)
        return [f"{input_file.name}: invalid export path"]

    events_list = list(events)
    for index, window in enumerate(windows, start=1):
        duration = max(0.1, window.end - window.start)
        offset_seconds = int(round(window.start))
        clip_time = vod_start + timedelta(seconds=window.start)
        timestamp = clip_time.strftime("%Y%m%d_%H%M%S")
        output_name = f"clip_{timestamp}_{index:02d}_t{offset_seconds}s"
        if encode_counts:
            window_events = [event for event in events_list if window.start <= event.time <= window.end]
            counts = count_events_fn(window_events)
            output_name = f"{output_name}_{count_format.format(**counts)}"
        output_file = safe_output_dir / f"{output_name}{safe_input_file.suffix}"
        logging.info("Exporting %s (%.2fs to %.2fs)", output_file, window.start, window.end)
        try:
            run_ffmpeg_fn(safe_input_file, output_file, window.start, duration)
            if not validate_clip_fn(output_file):
                logging.error("Clip validation failed: %s (corrupt or invalid metadata)", output_file)
                failed_clips.append(output_file.name)
                try:
                    output_file.unlink()
                except OSError:
                    pass
            else:
                logging.info("Clip created successfully: %s", output_file.name)
        except (subprocess.CalledProcessError, RuntimeError) as exc:
            logging.error("Clip encoding failed for %s: %s", output_file.name, exc)
            failed_clips.append(output_file.name)
            try:
                output_file.unlink()
            except OSError:
                pass
    return failed_clips
