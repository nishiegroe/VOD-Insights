from __future__ import annotations

import subprocess
from pathlib import Path


def reveal_file_in_explorer(file_path: Path) -> None:
    subprocess.run(
        [
            "explorer",
            "/select,",
            str(file_path),
        ],
        check=False,
    )