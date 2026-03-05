import pytest
import zipfile
from pathlib import Path

import app.bootstrap.dependency_bootstrap_ops as ops


def test_validate_dependency_host_allows_whitelist() -> None:
    ops.validate_dependency_host("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe")
    ops.validate_dependency_host("https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip")


def test_validate_dependency_host_rejects_unknown() -> None:
    with pytest.raises(RuntimeError):
        ops.validate_dependency_host("https://malicious.example.com/tool.exe")


def test_install_dependency_file_ytdlp(tmp_path: Path) -> None:
    src = tmp_path / "yt-dlp.exe.part"
    src.write_bytes(b"exe")
    target = tmp_path / "tools" / "yt-dlp.exe"

    ops.install_dependency_file("yt-dlp", target, src)

    assert target.exists()
    assert not src.exists()


def test_install_dependency_file_ffmpeg(tmp_path: Path) -> None:
    archive = tmp_path / "ffmpeg.zip"
    with zipfile.ZipFile(archive, "w") as zipf:
        zipf.writestr("ffmpeg/bin/ffmpeg.exe", b"binary")

    target = tmp_path / "tools" / "ffmpeg"
    ops.install_dependency_file("ffmpeg", target, archive)
    assert (target / "ffmpeg" / "bin" / "ffmpeg.exe").exists()


def test_is_python_package_installed() -> None:
    assert ops.is_python_package_installed("json")
    assert not ops.is_python_package_installed("definitely_nonexistent_package_name")


def test_install_python_package_invokes_pip(monkeypatch) -> None:
    events = []

    class FakeStream:
        def __init__(self, content: str):
            self._content = content
            self._index = 0

        def read(self, size: int = 1):
            if self._index >= len(self._content):
                return ""
            chunk = self._content[self._index : self._index + size]
            self._index += len(chunk)
            return chunk

    class FakeProcess:
        def __init__(self):
            self.stderr = FakeStream("line1\nline2\n")

        def wait(self):
            return 0

    def fake_popen(*args, **kwargs):
        return FakeProcess()

    monkeypatch.setattr(ops.subprocess, "Popen", fake_popen)

    ops.install_python_package("example", lambda **fields: events.append(fields))

    assert any("Installing Python package" in evt.get("message", "") for evt in events)

