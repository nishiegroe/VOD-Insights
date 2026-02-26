"""
Test script for Twitch VOD Download API endpoints

Run with: python tests/test_vod_api.py

This tests the API without actually downloading VODs (which would be slow).
"""

import json
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock
import sys

# Add app directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.webui import app, _vod_downloader, TwitchVODDownloader


def test_api_endpoints():
    """Test the VOD download API endpoints"""

    # Create test client
    with app.test_client() as client:
        # Initialize the downloader for tests
        import app.webui
        with tempfile.TemporaryDirectory() as tmpdir:
            app.webui._vod_downloader = TwitchVODDownloader(Path(tmpdir))

            print("\n" + "="*60)
            print("Testing Twitch VOD Download API")
            print("="*60)

            # Test 1: Check tools endpoint
            print("\n[TEST 1] GET /api/vod/check-tools")
            response = client.get("/api/vod/check-tools")
            print(f"Status: {response.status_code}")
            data = response.get_json()
            print(f"Response: {json.dumps(data, indent=2)}")
            assert response.status_code == 200
            assert "yt_dlp_installed" in data

            # Test 2: Invalid URL submission
            print("\n[TEST 2] POST /api/vod/download (invalid URL)")
            response = client.post(
                "/api/vod/download",
                json={"url": "https://youtube.com/watch?v=123"},
                content_type="application/json"
            )
            print(f"Status: {response.status_code}")
            data = response.get_json()
            print(f"Response: {json.dumps(data, indent=2)}")
            assert response.status_code == 400
            assert "Invalid Twitch VOD URL" in data.get("error", "")

            # Test 3: Missing URL
            print("\n[TEST 3] POST /api/vod/download (missing URL)")
            response = client.post(
                "/api/vod/download",
                json={},
                content_type="application/json"
            )
            print(f"Status: {response.status_code}")
            data = response.get_json()
            print(f"Response: {json.dumps(data, indent=2)}")
            assert response.status_code == 400

            # Test 4: Valid URL submission (mocked)
            print("\n[TEST 4] POST /api/vod/download (valid URL)")
            with patch.object(
                TwitchVODDownloader, 'check_yt_dlp', return_value=True
            ):
                response = client.post(
                    "/api/vod/download",
                    json={"url": "https://twitch.tv/videos/123456789"},
                    content_type="application/json"
                )
                print(f"Status: {response.status_code}")
                data = response.get_json()
                print(f"Response: {json.dumps(data, indent=2)}")
                assert response.status_code == 202
                assert "job_id" in data
                assert data["status"] == "initializing"

                job_id = data["job_id"]

                # Test 5: Get progress for created job
                print(f"\n[TEST 5] GET /api/vod/progress/{job_id}")
                response = client.get(f"/api/vod/progress/{job_id}")
                print(f"Status: {response.status_code}")
                data = response.get_json()
                print(f"Response: {json.dumps(data, indent=2)}")
                assert response.status_code == 200
                assert data["status"] in ["initializing", "downloading", "error"]

            # Test 6: Invalid job ID
            print("\n[TEST 6] GET /api/vod/progress/invalid-job-id")
            response = client.get("/api/vod/progress/invalid-job-id")
            print(f"Status: {response.status_code}")
            data = response.get_json()
            print(f"Response: {json.dumps(data, indent=2)}")
            assert response.status_code == 404

            # Test 7: Missing JSON body
            print("\n[TEST 7] POST /api/vod/download (no JSON)")
            response = client.post("/api/vod/download")
            print(f"Status: {response.status_code}")
            data = response.get_json()
            print(f"Response: {json.dumps(data, indent=2)}")
            assert response.status_code == 400

    print("\n" + "="*60)
    print("✅ All API tests passed!")
    print("="*60)


if __name__ == "__main__":
    test_api_endpoints()
