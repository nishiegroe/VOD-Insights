from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List

from app.runtime_paths import resolve_log_path


def get_backend_log_path(config: Dict[str, Any], config_path: Path) -> Path:
    return resolve_log_path(config_path, config.get("logging", {}).get("file", "app.log"))


def tail_lines(path: Path, max_lines: int = 200) -> List[str]:
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    return lines[-max_lines:]


def open_backend_log(log_path: Path) -> None:
    if sys.platform.startswith("win"):
        subprocess.Popen(["notepad", str(log_path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    elif sys.platform == "darwin":
        subprocess.Popen(["open", "-a", "TextEdit", str(log_path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        subprocess.Popen(["xdg-open", str(log_path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)