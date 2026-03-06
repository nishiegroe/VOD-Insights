import pytest
import zipfile
import hashlib
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


def test_extract_expected_checksum_from_filename_match() -> None:
    good_hash = "a" * 64
    other_hash = "b" * 64
    text = f"{other_hash}  other.exe\n{good_hash}  yt-dlp.exe\n"

    value = ops._extract_expected_checksum(text, "yt-dlp.exe")

    assert value == good_hash


def test_extract_expected_checksum_single_match_fallback() -> None:
    only_hash = "e" * 64
    text = f"{only_hash}  some-other-file.exe\n"
    value = ops._extract_expected_checksum(text, "missing-target.exe")
    assert value == only_hash


def test_extract_expected_checksum_bsd_style_supported() -> None:
    good_hash = "f" * 64
    text = "SHA256 (yt-dlp.exe) = " + good_hash
    value = ops._extract_expected_checksum(text, "yt-dlp.exe")
    assert value == good_hash


def test_extract_expected_checksum_no_matching_artifact_raises() -> None:
    text = ("a" * 64) + "  alpha.bin\n" + ("b" * 64) + "  beta.bin\n"
    with pytest.raises(RuntimeError, match="Could not find checksum"):
        ops._extract_expected_checksum(text, "target.bin")


def test_extract_expected_checksum_plain_single_line() -> None:
    good_hash = "c" * 64
    value = ops._extract_expected_checksum(good_hash, "anything.bin")
    assert value == good_hash


def test_extract_expected_checksum_raises_for_empty_source() -> None:
    with pytest.raises(RuntimeError, match="no data"):
        ops._extract_expected_checksum("\n\n", "file.bin")


def test_verify_dependency_checksum_success(monkeypatch, tmp_path: Path) -> None:
    artifact = tmp_path / "yt-dlp.exe.part"
    artifact.write_bytes(b"hello checksum")
    digest = hashlib.sha256(b"hello checksum").hexdigest()

    def fake_download_text(_: str) -> str:
        return f"{digest}  yt-dlp.exe\n"

    monkeypatch.setattr(ops, "_download_text", fake_download_text)

    ops.verify_dependency_checksum(
        "yt-dlp",
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS",
        artifact,
    )


def test_verify_dependency_checksum_raises_on_mismatch(monkeypatch, tmp_path: Path) -> None:
    artifact = tmp_path / "tool.bin"
    artifact.write_bytes(b"real-bytes")

    def fake_download_text(_: str) -> str:
        return f"{'d' * 64}  tool.bin\n"

    monkeypatch.setattr(ops, "_download_text", fake_download_text)

    with pytest.raises(RuntimeError, match="Checksum verification failed"):
        ops.verify_dependency_checksum(
            "tool",
            "https://objects.githubusercontent.com/tool.bin",
            "https://objects.githubusercontent.com/tool.bin.sha256",
            artifact,
        )


def test_verify_dependency_checksum_requires_checksum_url(tmp_path: Path) -> None:
    artifact = tmp_path / "tool.bin"
    artifact.write_bytes(b"bytes")

    with pytest.raises(RuntimeError, match="Missing checksum URL"):
        ops.verify_dependency_checksum(
            "tool",
            "https://objects.githubusercontent.com/tool.bin",
            "",
            artifact,
        )
