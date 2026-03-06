from __future__ import annotations

from pathlib import Path

import app.vod.upload as upload_module
from app.system.subprocess_policy import UnsafePathError


class DummyUploadFile:
    def __init__(self, filename: str, payload: bytes = b"vod") -> None:
        self.filename = filename
        self._payload = payload

    def save(self, dest_path: Path) -> None:
        Path(dest_path).write_bytes(self._payload)


def test_save_uploaded_vod_file_fallback_preserves_original_extension(
    tmp_path: Path,
    monkeypatch,
) -> None:
    replay_dir = tmp_path / "recordings"
    replay_dir.mkdir(parents=True, exist_ok=True)

    # Force the fallback naming path to be used.
    monkeypatch.setattr(upload_module, "resolve_allowed_child_path", lambda _name, _dirs: None)

    vod_file = DummyUploadFile("bad/name.mkv", payload=b"test")
    dest_path = upload_module.save_uploaded_vod_file(
        vod_file,
        {"replay": {"directory": str(replay_dir)}},
    )

    assert dest_path.name == "upload.mkv"
    assert dest_path.read_bytes() == b"test"


def test_start_vod_scan_for_path_handles_unsafe_path_error(monkeypatch, tmp_path: Path) -> None:
    def raise_unsafe(_path: Path) -> Path:
        raise UnsafePathError("invalid")

    def fail_popen(*_args, **_kwargs) -> None:
        raise AssertionError("subprocess.Popen should not be called for unsafe path")

    monkeypatch.setattr(upload_module, "normalize_process_path", raise_unsafe)
    monkeypatch.setattr(upload_module.subprocess, "Popen", fail_popen)

    upload_module.start_vod_scan_for_path(tmp_path / "config.json", tmp_path / "../bad.mp4")
