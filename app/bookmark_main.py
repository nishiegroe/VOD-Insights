from __future__ import annotations

import argparse
import logging
import time
from datetime import datetime
from pathlib import Path

from app.bookmark_writer import BookmarkSettings, BookmarkWriter
from app.capture import CaptureBackend, CaptureRegion
from app.config import load_config
from app.detector import EventDetector
from app.ocr import OcrSettings, preprocess, run_ocr
from app.runtime_paths import get_config_path, resolve_log_path, reset_log_file


def main() -> None:
    parser = argparse.ArgumentParser(description="Apex OCR -> bookmark logger")
    parser.add_argument(
        "--config",
        default=str(get_config_path()),
        help="Path to config.json",
    )
    args = parser.parse_args()

    config = load_config(Path(args.config))

    log_path = resolve_log_path(Path(args.config), config.logging.file)
    reset_log_file(log_path)
    logging.basicConfig(
        level=getattr(logging, config.logging.level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[
            logging.FileHandler(log_path, encoding="utf-8"),
            logging.StreamHandler(),
        ],
    )

    capture = CaptureBackend(
        CaptureRegion(
            left=config.capture.left,
            top=config.capture.top,
            width=config.capture.width,
            height=config.capture.height,
        ),
        backend=config.capture.backend,
    )

    detector = EventDetector(
        keywords=config.detection.keywords,
        cooldown_seconds=config.detection.cooldown_seconds,
    )

    ocr_settings = OcrSettings(psm=config.ocr.psm, lang=config.ocr.lang, engine=config.ocr.engine)

    session_start = datetime.now()
    bookmarks_dir = Path(config.bookmarks.directory)
    bookmarks_dir.mkdir(parents=True, exist_ok=True)
    session_id = session_start.strftime("%Y%m%d_%H%M%S")
    session_file = bookmarks_dir / f"{config.bookmarks.session_prefix}_{session_id}.{config.bookmarks.format}"

    bookmark_writer = BookmarkWriter(
        BookmarkSettings(
            enabled=config.bookmarks.enabled,
            file=session_file,
            format=config.bookmarks.format,
            include_event=config.bookmarks.include_event,
            include_ocr_lines=config.bookmarks.include_ocr_lines,
        ),
        session_start=session_start,
    )

    frame_interval = 1.0 / max(1, config.capture.fps)
    last_frame = 0.0
    last_ocr_time = 0.0
    start_time = time.time()

    try:
        while True:
            now = time.time()
            if now - last_frame < frame_interval:
                time.sleep(0.001)
                continue
            last_frame = now

            frame = capture.grab()
            if frame is None:
                time.sleep(0.01)
                continue

            if now - last_ocr_time < config.ocr.interval_seconds:
                continue
            last_ocr_time = now

            processed = preprocess(frame, config.capture.scale, config.capture.threshold)
            lines = run_ocr(processed, ocr_settings)
            result = detector.detect(lines)
            if result.matched:
                seconds_since_start = now - start_time
                bookmark_writer.write(result.matched_line, lines, seconds_since_start)
                logging.info("Bookmark: %s", result.matched_line)
    finally:
        pass


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
