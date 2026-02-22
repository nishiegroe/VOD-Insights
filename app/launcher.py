from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Callable

from app import bookmark_main, main as main_app, split_bookmarks, vod_ocr, webui
from app.runtime_paths import get_config_path


def _run_with_args(entry: Callable[[], None], argv: list[str]) -> None:
    original = sys.argv
    try:
        sys.argv = [original[0], *argv]
        entry()
    finally:
        sys.argv = original


def main() -> None:
    parser = argparse.ArgumentParser(description="Apex Event Tracker launcher")
    parser.add_argument(
        "--mode",
        choices=["main", "bookmarks", "split", "vod", "webui"],
        default="webui",
        help="Which mode to run",
    )
    parser.add_argument(
        "--config",
        default=str(get_config_path()),
        help="Path to config.json",
    )
    args, extra = parser.parse_known_args()

    config_path = Path(args.config)
    if args.mode == "webui":
        webui.main()
        return

    argv = ["--config", str(config_path), *extra]
    if args.mode == "main":
        _run_with_args(main_app.main, argv)
    elif args.mode == "bookmarks":
        _run_with_args(bookmark_main.main, argv)
    elif args.mode == "split":
        _run_with_args(split_bookmarks.main, argv)
    elif args.mode == "vod":
        _run_with_args(vod_ocr.main, argv)


if __name__ == "__main__":
    main()
