import pytest

from app.dependency_bootstrap_ops import validate_dependency_host


def test_validate_dependency_host_allows_whitelist() -> None:
    validate_dependency_host("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe")
    validate_dependency_host("https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip")


def test_validate_dependency_host_rejects_unknown() -> None:
    with pytest.raises(RuntimeError):
        validate_dependency_host("https://malicious.example.com/tool.exe")
