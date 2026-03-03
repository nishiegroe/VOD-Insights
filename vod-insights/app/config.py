import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List


@dataclass
class CaptureConfig:
    left: int
    top: int
    width: int
    height: int
    target_width: int
    target_height: int
    backend: str
    fps: int
    scale: float
    threshold: int


@dataclass
class OcrConfig:
    psm: int
    lang: str
    interval_seconds: float
    engine: str = "tesseract"


@dataclass
class DetectionConfig:
    keywords: List[str]
    cooldown_seconds: float


@dataclass
class ReplayConfig:
    enabled: bool
    directory: str
    prefix: str
    include_event: bool
    time_format: str
    wait_seconds: float


@dataclass
class BookmarksConfig:
    enabled: bool
    directory: str
    session_prefix: str
    file: str
    format: str
    include_event: bool
    include_ocr_lines: bool


@dataclass
class SplitConfig:
    enabled: bool
    output_dir: str
    extensions: List[str]
    pre_seconds: float
    post_seconds: float
    merge_gap_seconds: float
    input_source: str
    encode_counts: bool
    count_format: str
    event_windows: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    recordings_dir: str = ""


@dataclass
class VodOcrConfig:
    enabled: bool
    fps: float
    auto_split: bool


@dataclass
class LoggingConfig:
    file: str
    level: str
    log_ocr: bool


@dataclass
class AppConfig:
    capture: CaptureConfig
    ocr: OcrConfig
    detection: DetectionConfig
    replay: ReplayConfig
    bookmarks: BookmarksConfig
    split: SplitConfig
    vod_ocr: VodOcrConfig
    logging: LoggingConfig


def load_config(config_path: Path) -> AppConfig:
    data = json.loads(config_path.read_text(encoding="utf-8"))
    capture = CaptureConfig(**data["capture"])
    ocr = OcrConfig(**data["ocr"])
    detection = DetectionConfig(**data["detection"])
    replay = ReplayConfig(**data["replay"])
    bookmarks = BookmarksConfig(**data["bookmarks"])
    split = SplitConfig(**data["split"])
    vod_ocr = VodOcrConfig(**data["vod_ocr"])
    logging_config = LoggingConfig(**data["logging"])
    return AppConfig(
        capture=capture,
        ocr=ocr,
        detection=detection,
        replay=replay,
        bookmarks=bookmarks,
        split=split,
        vod_ocr=vod_ocr,
        logging=logging_config,
    )
