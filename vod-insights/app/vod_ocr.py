from __future__ import annotations

import argparse
import json
import logging
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Iterable, Optional

import cv2

from app.bookmark_writer import BookmarkSettings, BookmarkWriter
from app.config import load_config
from app.ocr import OcrSettings, preprocess, run_ocr
from app.split_bookmarks import split_from_config
from app.runtime_paths import get_config_path, resolve_log_path, get_app_data_dir, reset_log_file


def sanitize_stem(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", value).strip("_")


def detect_match(lines: Iterable[str], keywords: Iterable[str]) -> str:
    for line in lines:
        normalized = "".join(ch for ch in line.lower() if ch.isalnum() or ch.isspace())
        for keyword in keywords:
            if keyword in normalized:
                return line
    return ""


def build_crop_region(
    video_width: int,
    video_height: int,
    left: int,
    top: int,
    width: int,
    height: int,
    target_width: int,
    target_height: int,
) -> tuple[int, int, int, int]:
    scale_x = 1.0
    scale_y = 1.0
    if target_width > 0 and target_height > 0:
        scale_x = video_width / target_width
        scale_y = video_height / target_height

    crop_left = int(round(left * scale_x))
    crop_top = int(round(top * scale_y))
    crop_width = int(round(width * scale_x))
    crop_height = int(round(height * scale_y))

    crop_left = max(0, min(crop_left, video_width - 1))
    crop_top = max(0, min(crop_top, video_height - 1))
    crop_width = max(1, min(crop_width, video_width - crop_left))
    crop_height = max(1, min(crop_height, video_height - crop_top))

    return crop_left, crop_top, crop_width, crop_height


def ensure_session_file(path: Path, fmt: str) -> None:
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    if fmt.lower() == "csv":
        path.write_text("timestamp,seconds_since_start,event,ocr\n", encoding="utf-8")
    else:
        path.write_text("", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Scan a VOD for OCR events and auto-split")
    parser.add_argument(
        "--config",
        default=str(get_config_path()),
        help="Path to config.json",
    )
    parser.add_argument("--vod", required=True, help="Path to the VOD file")
    parser.add_argument("--fps", type=float, default=None, help="OCR sample rate in fps")
    parser.add_argument("--no-split", action="store_true", help="Skip auto split")
    parser.add_argument("--resume", action="store_true", help="Resume from paused scan")
    args = parser.parse_args()

    config_path = Path(args.config)
    config = load_config(config_path)

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

    vod_path = Path(args.vod)
    if not vod_path.exists():
        logging.error("VOD not found: %s", vod_path)
        return

    sample_fps = args.fps if args.fps is not None else config.vod_ocr.fps
    sample_fps = max(0.1, float(sample_fps))

    cap = cv2.VideoCapture(str(vod_path))
    if not cap.isOpened():
        logging.error("Failed to open VOD: %s", vod_path)
        return

    video_fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
    sample_interval = 1
    if video_fps > 0:
        sample_interval = max(1, int(round(video_fps / sample_fps)))

    video_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    video_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    crop_left, crop_top, crop_width, crop_height = build_crop_region(
        video_width,
        video_height,
        config.capture.left,
        config.capture.top,
        config.capture.width,
        config.capture.height,
        config.capture.target_width,
        config.capture.target_height,
    )

    ocr_settings = OcrSettings(psm=config.ocr.psm, lang=config.ocr.lang, engine=config.ocr.engine)

    session_start = datetime.now()
    bookmarks_dir = Path(config.bookmarks.directory)
    # If path is relative, resolve it to app data directory
    if not bookmarks_dir.is_absolute():
        bookmarks_dir = get_app_data_dir() / bookmarks_dir
    bookmarks_dir.mkdir(parents=True, exist_ok=True)
    session_id = session_start.strftime("%Y%m%d_%H%M%S")
    safe_stem = sanitize_stem(vod_path.stem) or "vod"
    
    # Check if resuming from a paused scan
    paused_marker = bookmarks_dir / f"{config.bookmarks.session_prefix}_{safe_stem}.paused"
    start_frame = 0
    resume_session_file = None
    
    if args.resume and paused_marker.exists():
        try:
            paused_data = json.loads(paused_marker.read_text(encoding="utf-8"))
            start_frame = paused_data.get("frame_index", 0)
            resume_session_file = Path(paused_data.get("session_file", ""))
            if resume_session_file.exists():
                logging.info("Resuming scan from frame %d using session file %s", start_frame, resume_session_file)
            else:
                resume_session_file = None
                start_frame = 0
            # Remove paused marker as we're resuming
            paused_marker.unlink()
        except Exception as e:
            logging.warning("Failed to read paused state: %s", e)
            start_frame = 0
            resume_session_file = None
    
    # Determine session file
    if resume_session_file and resume_session_file.exists():
        session_file = resume_session_file
    else:
        session_file = bookmarks_dir / f"{config.bookmarks.session_prefix}_{safe_stem}_{session_id}.{config.bookmarks.format}"
    
    scanning_marker = bookmarks_dir / f"{config.bookmarks.session_prefix}_{safe_stem}.scanning"
    scanning_marker.write_text(json.dumps({"progress": 0}), encoding="utf-8")
    ensure_session_file(session_file, config.bookmarks.format)

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

    cooldown_seconds = float(config.detection.cooldown_seconds)
    last_match_time: Optional[float] = None

    frame_index = 0
    processed_frames = 0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    last_progress = -1
    last_pause_check = 0.0
    pause_check_interval = 1.0  # Check for pause every second
    
    logging.info(
        "Scanning %s at %.2f fps (video fps: %.2f)%s",
        vod_path.name,
        sample_fps,
        video_fps,
        f" (resuming from frame {start_frame})" if start_frame > 0 else "",
    )

    try:
        while True:
            # Check for pause marker periodically
            current_time = time.time()
            if current_time - last_pause_check >= pause_check_interval:
                last_pause_check = current_time
                if paused_marker.exists():
                    logging.info("Pause detected at frame %d, saving state...", frame_index)
                    # Save current state
                    paused_data = {
                        "frame_index": frame_index,
                        "session_file": str(session_file),
                        "progress": min(100, int(frame_index * 100 / total_frames)) if total_frames > 0 else 0,
                    }
                    paused_marker.write_text(json.dumps(paused_data), encoding="utf-8")
                    # Keep scanning marker but update it to show paused status
                    scanning_marker.write_text(
                        json.dumps({"progress": paused_data["progress"], "paused": True}),
                        encoding="utf-8",
                    )
                    logging.info("Scan paused. Use --resume to continue.")
                    return
            
            grabbed = cap.grab()
            if not grabbed:
                break
            frame_index += 1
            
            # Skip frames if resuming
            if frame_index <= start_frame:
                continue
            
            if frame_index % sample_interval != 0:
                continue

            ok, frame = cap.retrieve()
            if not ok or frame is None:
                continue

            if video_fps > 0:
                seconds_since_start = max(0.0, float(frame_index) / float(video_fps))
            else:
                timestamp_ms = cap.get(cv2.CAP_PROP_POS_MSEC)
                seconds_since_start = max(0.0, float(timestamp_ms) / 1000.0)

            crop = frame[crop_top : crop_top + crop_height, crop_left : crop_left + crop_width]
            processed = preprocess(crop, config.capture.scale, config.capture.threshold)
            lines = run_ocr(processed, ocr_settings)

            if config.logging.log_ocr and lines:
                logging.info("OCR @ %.2fs: %s", seconds_since_start, " | ".join(lines))

            matched_line = detect_match(lines, config.detection.keywords)
            if matched_line:
                if last_match_time is None or seconds_since_start - last_match_time >= cooldown_seconds:
                    last_match_time = seconds_since_start
                    bookmark_writer.write(matched_line, lines, seconds_since_start)
                    logging.info("Bookmark @ %.2fs: %s", seconds_since_start, matched_line)

            processed_frames += 1
            if total_frames > 0:
                progress = min(100, int(frame_index * 100 / total_frames))
                if progress > last_progress:
                    scanning_marker.write_text(
                        json.dumps({"progress": progress}),
                        encoding="utf-8",
                    )
                    last_progress = progress
            if processed_frames % 200 == 0:
                logging.info("Processed %d samples...", processed_frames)
    finally:
        cap.release()
        # Only remove scanning marker if we're not paused
        if not paused_marker.exists():
            if scanning_marker.exists():
                scanning_marker.unlink(missing_ok=True)

    logging.info("VOD scan complete. Bookmarks saved to %s", session_file)

    if config.vod_ocr.auto_split and not args.no_split:
        logging.info("Running split on %s", vod_path.name)
        split_from_config(config_path, bookmarks_override=session_file, input_override=vod_path)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
