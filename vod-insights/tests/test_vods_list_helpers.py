"""
Test helper functions for VOD listing

Tests the helper functions without requiring Flask to be installed.
"""

import json
import tempfile
from pathlib import Path
import sys

# Add app directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))


def test_vod_listing_helpers():
    """Test the VOD listing helper functions"""

    print("\n" + "="*60)
    print("Testing VOD Listing Helper Functions")
    print("="*60)

    # Test 1: get_vod_paths function
    print("\n[TEST 1] get_vod_paths with empty directory")
    with tempfile.TemporaryDirectory() as tmpdir:
        test_dir = Path(tmpdir)
        
        # Test with empty directory
        from app.multi_vod_api import _get_vod_paths
        
        paths = _get_vod_paths([test_dir])
        print(f"Empty directory result: {len(paths)} files")
        assert len(paths) == 0, "Should return empty list for empty directory"
        print("✅ Empty directory test passed")

    # Test 2: get_vod_paths with multiple extensions
    print("\n[TEST 2] get_vod_paths with various extensions")
    with tempfile.TemporaryDirectory() as tmpdir:
        test_dir = Path(tmpdir)
        
        # Create test files
        (test_dir / "video1.mp4").write_bytes(b"test" * 100)
        (test_dir / "video2.mov").write_bytes(b"test" * 200)
        (test_dir / "video3.mkv").write_bytes(b"test" * 150)
        (test_dir / "document.txt").write_bytes(b"test")  # Should be ignored
        (test_dir / "temp.mp4.temp").write_bytes(b"test")  # Should be ignored (temp file)
        
        from app.multi_vod_api import _get_vod_paths
        
        paths = _get_vod_paths([test_dir], [".mp4", ".mov", ".mkv"])
        print(f"Found {len(paths)} video files")
        assert len(paths) == 3, f"Should find 3 video files, found {len(paths)}"
        
        # Verify only video files are returned
        for path in paths:
            assert path.suffix in [".mp4", ".mov", ".mkv"], f"Unexpected file: {path}"
            assert not path.stem.endswith(".temp"), "Should skip temp files"
        
        print("✅ Extension filtering test passed")

    # Test 3: get_vod_paths sorting (newest first)
    print("\n[TEST 3] get_vod_paths sorting by mtime")
    with tempfile.TemporaryDirectory() as tmpdir:
        test_dir = Path(tmpdir)
        
        # Create files with specific mtimes
        import time
        file1 = test_dir / "old.mp4"
        file2 = test_dir / "new.mp4"
        
        file1.write_bytes(b"test" * 100)
        time.sleep(0.1)
        file2.write_bytes(b"test" * 200)
        
        from app.multi_vod_api import _get_vod_paths
        
        paths = _get_vod_paths([test_dir])
        print(f"Files sorted: {[p.name for p in paths]}")
        
        # Newer file should come first
        assert paths[0].name == "new.mp4", "Newest file should be first"
        assert paths[1].name == "old.mp4", "Oldest file should be second"
        print("✅ Sorting test passed")

    # Test 4: get_vods_dir from config
    print("\n[TEST 4] get_vods_dir from config")
    from app.multi_vod_api import _get_vods_dir
    
    # Test with valid path
    config = {"replay": {"directory": "/path/to/vods"}}
    result = _get_vods_dir(config)
    assert result == Path("/path/to/vods"), "Should return configured path"
    print(f"Config path result: {result}")
    
    # Test with empty config
    config = {"replay": {"directory": ""}}
    result = _get_vods_dir(config)
    assert result == Path(), "Should return empty Path for empty config"
    print(f"Empty config result: {result}")
    print("✅ Config parsing test passed")

    # Test 5: get_vod_dirs combines multiple directories
    print("\n[TEST 5] get_vod_dirs combines multiple directories")
    from app.multi_vod_api import _get_vod_dirs
    from unittest.mock import patch
    
    with tempfile.TemporaryDirectory() as tmpdir:
        test_dir = Path(tmpdir)
        downloads_dir = Path(tmpdir) / "downloads"
        downloads_dir.mkdir()
        
        config = {"replay": {"directory": str(test_dir)}}
        
        with patch('app.multi_vod_api.get_downloads_dir', return_value=downloads_dir):
            dirs = _get_vod_dirs(config)
            print(f"Combined directories: {[str(d) for d in dirs]}")
            assert len(dirs) == 2, "Should have 2 directories"
            assert test_dir in dirs, "Should include replay directory"
            assert downloads_dir in dirs, "Should include downloads directory"
        
        print("✅ Multiple directory test passed")

    # Test 6: Metadata extraction with cv2
    print("\n[TEST 6] VOD metadata extraction")
    try:
        import cv2
        with tempfile.TemporaryDirectory() as tmpdir:
            test_dir = Path(tmpdir)
            
            # Note: We can't create a real video file easily, so we'll test the function's error handling
            from app.multi_vod_api import _get_vod_metadata
            
            # Test with non-existent file
            result = _get_vod_metadata("/nonexistent/file.mp4")
            print(f"Non-existent file result: {result}")
            assert result is None, "Should return None for non-existent file"
            
            print("✅ Metadata extraction test passed")
    except ImportError:
        print("⚠️  cv2 not available, skipping metadata extraction test")

    # Test 7: load_config
    print("\n[TEST 7] load_config from disk")
    from app.multi_vod_api import _load_config
    
    with tempfile.TemporaryDirectory() as tmpdir:
        config_path = Path(tmpdir) / "config.json"
        test_config = {"replay": {"directory": "/test"}, "split": {"extensions": [".mp4"]}}
        config_path.write_text(json.dumps(test_config))
        
        with patch('app.multi_vod_api.get_config_path', return_value=config_path):
            loaded = _load_config()
            print(f"Loaded config: {loaded}")
            assert loaded == test_config, "Should load correct config"
        
        print("✅ Config loading test passed")

    print("\n" + "="*60)
    print("✅ All helper function tests passed!")
    print("="*60)


if __name__ == "__main__":
    test_vod_listing_helpers()
