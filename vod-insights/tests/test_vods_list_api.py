"""
Test script for VOD listing API endpoints

Run with: python tests/test_vods_list_api.py

Tests the /api/vods/list endpoint without requiring actual VOD files.
"""

import json
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock
import sys

# Add app directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.webui import app


def test_vods_list_endpoint():
    """Test the /api/vods/list endpoint"""

    print("\n" + "="*60)
    print("Testing /api/vods/list Endpoint")
    print("="*60)

    with app.test_client() as client:
        # Test 1: List VODs when no directories are configured
        print("\n[TEST 1] GET /api/sessions/multi-vod/vods/list (no directories configured)")
        with tempfile.TemporaryDirectory() as tmpdir:
            mock_config = {
                "replay": {"directory": ""},
                "split": {"extensions": [".mp4", ".mov"]}
            }
            
            with patch('app.multi_vod_api._load_config', return_value=mock_config):
                with patch('app.multi_vod_api.get_downloads_dir', return_value=Path()):
                    response = client.get("/api/sessions/multi-vod/vods/list")
                    print(f"Status: {response.status_code}")
                    data = response.get_json()
                    print(f"Response: {json.dumps(data, indent=2)}")
                    assert response.status_code == 500
                    assert not data.get("ok")
                    assert "No VOD directories configured" in data.get("error", "")

        # Test 2: List VODs with empty directory
        print("\n[TEST 2] GET /api/sessions/multi-vod/vods/list (empty directory)")
        with tempfile.TemporaryDirectory() as tmpdir:
            test_dir = Path(tmpdir)
            mock_config = {
                "replay": {"directory": str(test_dir)},
                "split": {"extensions": [".mp4", ".mov"]}
            }
            
            with patch('app.multi_vod_api._load_config', return_value=mock_config):
                with patch('app.multi_vod_api.get_downloads_dir', return_value=Path(tmpdir) / "downloads"):
                    response = client.get("/api/sessions/multi-vod/vods/list")
                    print(f"Status: {response.status_code}")
                    data = response.get_json()
                    print(f"Response: {json.dumps(data, indent=2)}")
                    assert response.status_code == 200
                    assert data.get("ok") == True
                    assert data.get("vods") == []

        # Test 3: List VODs with sample VOD files (mocked)
        print("\n[TEST 3] GET /api/sessions/multi-vod/vods/list (with sample VODs)")
        with tempfile.TemporaryDirectory() as tmpdir:
            test_dir = Path(tmpdir)
            
            # Create sample VOD files
            vod1 = test_dir / "match1.mp4"
            vod2 = test_dir / "match2.mp4"
            vod1.write_bytes(b"fake video data" * 1000)
            vod2.write_bytes(b"fake video data" * 2000)
            
            mock_config = {
                "replay": {"directory": str(test_dir)},
                "split": {"extensions": [".mp4", ".mov"]}
            }
            
            # Mock metadata extraction
            mock_metadata = {
                "duration": 3600.0,
                "fps": 60.0,
                "resolution": "1920x1080",
                "codec": "h264"
            }
            
            with patch('app.multi_vod_api._load_config', return_value=mock_config):
                with patch('app.multi_vod_api.get_downloads_dir', return_value=Path(tmpdir) / "downloads"):
                    with patch('app.multi_vod_api._get_vod_metadata', return_value=mock_metadata):
                        response = client.get("/api/sessions/multi-vod/vods/list")
                        print(f"Status: {response.status_code}")
                        data = response.get_json()
                        print(f"Response: {json.dumps(data, indent=2)}")
                        
                        assert response.status_code == 200
                        assert data.get("ok") == True
                        assert len(data.get("vods", [])) == 2
                        
                        # Verify VOD structure
                        vod = data["vods"][0]
                        assert "vod_id" in vod
                        assert "name" in vod
                        assert "path" in vod
                        assert "duration" in vod
                        assert "fps" in vod
                        assert "resolution" in vod
                        assert "codec" in vod
                        assert "created_at" in vod
                        assert "file_size_mb" in vod
                        assert "mtime" in vod
                        
                        # Verify sorting (most recent first)
                        assert vod["mtime"] >= data["vods"][1]["mtime"]

        # Test 4: Test with multiple VODs
        print("\n[TEST 4] GET /api/sessions/multi-vod/vods/list (3+ VODs)")
        with tempfile.TemporaryDirectory() as tmpdir:
            test_dir = Path(tmpdir)
            
            # Create 5 sample VOD files
            for i in range(5):
                vod = test_dir / f"match{i}.mp4"
                vod.write_bytes(b"fake video data" * (i + 1) * 100)
            
            mock_config = {
                "replay": {"directory": str(test_dir)},
                "split": {"extensions": [".mp4", ".mov"]}
            }
            
            mock_metadata = {
                "duration": 3600.0,
                "fps": 60.0,
                "resolution": "1920x1080",
                "codec": "h264"
            }
            
            with patch('app.multi_vod_api._load_config', return_value=mock_config):
                with patch('app.multi_vod_api.get_downloads_dir', return_value=Path(tmpdir) / "downloads"):
                    with patch('app.multi_vod_api._get_vod_metadata', return_value=mock_metadata):
                        response = client.get("/api/sessions/multi-vod/vods/list")
                        print(f"Status: {response.status_code}")
                        data = response.get_json()
                        print(f"Response: {json.dumps(data, indent=2)}")
                        
                        assert response.status_code == 200
                        assert data.get("ok") == True
                        assert len(data.get("vods", [])) == 5
                        
                        # Verify sorting
                        vods = data["vods"]
                        for i in range(len(vods) - 1):
                            assert vods[i]["mtime"] >= vods[i + 1]["mtime"]

        # Test 5: Test metadata extraction error handling
        print("\n[TEST 5] GET /api/sessions/multi-vod/vods/list (metadata extraction skips bad files)")
        with tempfile.TemporaryDirectory() as tmpdir:
            test_dir = Path(tmpdir)
            
            # Create files
            good_vod = test_dir / "good.mp4"
            bad_vod = test_dir / "bad.mp4"
            good_vod.write_bytes(b"fake video data" * 1000)
            bad_vod.write_bytes(b"invalid data")
            
            mock_config = {
                "replay": {"directory": str(test_dir)},
                "split": {"extensions": [".mp4", ".mov"]}
            }
            
            # Return metadata for good file, None for bad
            def mock_get_metadata(path):
                if "good" in path:
                    return {
                        "duration": 3600.0,
                        "fps": 60.0,
                        "resolution": "1920x1080",
                        "codec": "h264"
                    }
                return None
            
            with patch('app.multi_vod_api._load_config', return_value=mock_config):
                with patch('app.multi_vod_api.get_downloads_dir', return_value=Path(tmpdir) / "downloads"):
                    with patch('app.multi_vod_api._get_vod_metadata', side_effect=mock_get_metadata):
                        response = client.get("/api/sessions/multi-vod/vods/list")
                        print(f"Status: {response.status_code}")
                        data = response.get_json()
                        print(f"Response: {json.dumps(data, indent=2)}")
                        
                        assert response.status_code == 200
                        assert data.get("ok") == True
                        # Only the good file should be returned
                        assert len(data.get("vods", [])) == 1
                        assert "good" in data["vods"][0]["path"]

    print("\n" + "="*60)
    print("✅ All VOD listing tests passed!")
    print("="*60)


if __name__ == "__main__":
    test_vods_list_endpoint()
