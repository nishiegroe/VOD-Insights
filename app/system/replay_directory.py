from __future__ import annotations

from pathlib import Path
from typing import Any, Callable, Dict


def choose_and_save_replay_dir(
    config: Dict[str, Any],
    choose_directory: Callable[[str | None], str],
    save_config: Callable[[Dict[str, Any]], None],
) -> str:
    replay_dir = config.get("replay", {}).get("directory")
    recordings_dir = config.get("split", {}).get("recordings_dir")
    initial_dir = None
    if replay_dir and Path(replay_dir).exists():
        initial_dir = replay_dir
    elif recordings_dir and Path(recordings_dir).exists():
        initial_dir = recordings_dir

    selected = choose_directory(initial_dir)
    if selected:
        config.setdefault("replay", {})["directory"] = selected
        save_config(config)
    return selected or ""