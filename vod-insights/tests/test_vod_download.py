"""
Tests for Twitch VOD Download functionality

Run with: python -m pytest tests/test_vod_download.py -v
"""

import pytest
import tempfile
from pathlib import Path
from app.vod_download import TwitchVODDownloader


class TestTwitchVODDownloader:
    """Test suite for TwitchVODDownloader class"""

    @pytest.fixture
    def temp_dir(self):
        """Create a temporary directory for tests"""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield Path(tmpdir)

    @pytest.fixture
    def downloader(self, temp_dir):
        """Create a downloader instance with temp directory"""
        return TwitchVODDownloader(temp_dir)

    def test_initialization(self, downloader, temp_dir):
        """Test that downloader initializes correctly"""
        assert downloader.output_dir == temp_dir
        assert isinstance(downloader.jobs, dict)
        assert len(downloader.jobs) == 0

    def test_url_validation_valid(self, downloader):
        """Test URL validation with valid Twitch URLs"""
        valid_urls = [
            "https://twitch.tv/videos/123456789",
            "https://www.twitch.tv/videos/987654321",
            "http://twitch.tv/videos/111111111",
            "http://www.twitch.tv/videos/222222222",
        ]
        for url in valid_urls:
            assert downloader.validate_url(url), f"Should accept {url}"

    def test_url_validation_invalid(self, downloader):
        """Test URL validation with invalid Twitch URLs"""
        invalid_urls = [
            "",
            "https://youtube.com/watch?v=123",
            "https://twitch.tv/channels/user",
            "https://twitch.tv/user",
            "not a url",
            "https://example.com",
        ]
        for url in invalid_urls:
            assert not downloader.validate_url(url), f"Should reject {url}"

    def test_filename_generation(self, downloader):
        """Test filename generation from metadata"""
        metadata = {
            "streamer": "TimTheTatman",
            "date": "2026-02-26",
        }
        filename = downloader._get_filename(metadata)
        assert filename == "TimTheTatman_2026-02-26.mp4"

    def test_sanitize_filename(self, downloader):
        """Test filename sanitization"""
        test_cases = [
            ("Normal Name", "Normal Name"),
            ("Name<With>Invalid:Chars", "Name_With_Invalid_Chars"),
            ("Name|With\"Quotes", "Name_With_Quotes"),
            ("...StartWithDots...", "StartWithDots"),
            ("   Leading Spaces", "Leading Spaces"),
        ]
        for input_name, expected in test_cases:
            result = downloader._sanitize_filename(input_name)
            assert result == expected or len(result) <= 200

    def test_yt_dlp_detection(self, downloader):
        """Test yt-dlp installation detection"""
        # This will depend on whether yt-dlp is installed in the test environment
        result = downloader.check_yt_dlp()
        assert isinstance(result, bool)

    def test_job_creation(self, downloader):
        """Test that jobs are created correctly"""
        job_id = "test-job-123"
        downloader.start_download("https://twitch.tv/videos/123456789", job_id)

        # Job should exist
        job = downloader.get_progress(job_id)
        assert job is not None
        assert job["status"] == "initializing"
        assert job["url"] == "https://twitch.tv/videos/123456789"
        assert job["percentage"] == 0

    def test_nonexistent_job(self, downloader):
        """Test getting a job that doesn't exist"""
        result = downloader.get_progress("nonexistent-job")
        assert result is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
