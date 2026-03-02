"""
Tests for Multi-VOD Comparison Backend

Run with: python -m pytest tests/test_multi_vod.py -v
Or:       python tests/test_multi_vod.py
"""

import json
import tempfile
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock
from datetime import datetime

# Add app directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.webui import app
from app.multi_vod_models import (
    MultiVodSession,
    MultiVodSessionVod,
    VodOffsetHistoryEntry,
)
from app.multi_vod_manager import MultiVodSessionManager


class TestMultiVodModels:
    """Test data models for multi-VOD sessions."""
    
    def test_vod_offset_history_entry(self):
        """Test VodOffsetHistoryEntry creation and serialization."""
        entry = VodOffsetHistoryEntry(
            timestamp=1.0,
            old_offset=0.0,
            new_offset=50.0,
            source="manual",
            changed_by="user-1"
        )
        
        # Test to_dict
        data = entry.to_dict()
        assert data['new_offset'] == 50.0
        assert data['source'] == "manual"
        
        # Test from_dict
        restored = VodOffsetHistoryEntry.from_dict(data)
        assert restored.new_offset == 50.0
        assert restored.changed_by == "user-1"
    
    def test_multi_vod_session_vod(self):
        """Test MultiVodSessionVod creation and serialization."""
        vod = MultiVodSessionVod(
            vod_id="vod-1",
            name="Player1",
            path="/path/to/vod1.mp4",
            duration=600.0,
            fps=60.0,
            resolution="1920x1080",
            codec="h264",
            filesize_mb=2500.0,
            offset=0.0,
        )
        
        assert vod.vod_id == "vod-1"
        assert vod.offset == 0.0
        assert vod.playback_state == "paused"
        
        # Test serialization
        data = vod.to_dict()
        restored = MultiVodSessionVod.from_dict(data)
        assert restored.vod_id == "vod-1"
        assert restored.duration == 600.0
    
    def test_multi_vod_session_creation(self):
        """Test MultiVodSession creation and validation."""
        vods = [
            MultiVodSessionVod(
                vod_id="vod-1",
                name="Player1",
                path="/path/to/vod1.mp4",
                duration=600.0,
                fps=60.0,
                resolution="1920x1080",
                codec="h264",
                filesize_mb=2500.0,
            ),
            MultiVodSessionVod(
                vod_id="vod-2",
                name="Player2",
                path="/path/to/vod2.mp4",
                duration=595.0,
                fps=60.0,
                resolution="1920x1080",
                codec="h264",
                filesize_mb=2450.0,
            ),
        ]
        
        session = MultiVodSession(vods=vods)
        
        # Test validation
        is_valid, error = session.validate()
        assert is_valid, error
        
        # Test getters
        assert session.get_vod_by_id("vod-1") is not None
        assert session.get_vod_by_index(0) is not None
        assert session.get_vod_by_id("invalid") is None
    
    def test_session_validation_requires_2_to_3_vods(self):
        """Test that sessions require 2-3 VODs."""
        # Test with 1 VOD (invalid)
        session_1 = MultiVodSession(vods=[
            MultiVodSessionVod(
                vod_id="v1", name="V1", path="/p1", duration=100, fps=60,
                resolution="1920x1080", codec="h264", filesize_mb=100
            )
        ])
        is_valid, error = session_1.validate()
        assert not is_valid
        assert "2-3 VODs" in error
        
        # Test with 2 VODs (valid)
        vods_2 = [
            MultiVodSessionVod(
                vod_id="v1", name="V1", path="/p1", duration=100, fps=60,
                resolution="1920x1080", codec="h264", filesize_mb=100
            ),
            MultiVodSessionVod(
                vod_id="v2", name="V2", path="/p2", duration=100, fps=60,
                resolution="1920x1080", codec="h264", filesize_mb=100
            ),
        ]
        session_2 = MultiVodSession(vods=vods_2)
        is_valid, _ = session_2.validate()
        assert is_valid
        
        # Test with 4 VODs (invalid)
        vods_4 = vods_2 + [
            MultiVodSessionVod(
                vod_id=f"v{i}", name=f"V{i}", path=f"/p{i}", duration=100, fps=60,
                resolution="1920x1080", codec="h264", filesize_mb=100
            )
            for i in range(3, 5)
        ]
        session_4 = MultiVodSession(vods=vods_4)
        is_valid, error = session_4.validate()
        assert not is_valid


class TestMultiVodSessionManager:
    """Test session persistence and operations."""
    
    def setup_method(self):
        """Set up test environment before each test."""
        self.tmp_dir = tempfile.TemporaryDirectory()
        # Mock the sessions directory
        self._original_sessions_dir = MultiVodSessionManager.SESSIONS_DIR
        MultiVodSessionManager.SESSIONS_DIR = Path(self.tmp_dir.name)
    
    def teardown_method(self):
        """Clean up after each test."""
        self.tmp_dir.cleanup()
        MultiVodSessionManager.SESSIONS_DIR = self._original_sessions_dir
    
    def _create_test_vod(self, vod_id: str, offset: float = 0.0) -> MultiVodSessionVod:
        """Helper to create test VOD."""
        return MultiVodSessionVod(
            vod_id=vod_id,
            name=f"VOD {vod_id}",
            path=f"/path/to/{vod_id}.mp4",
            duration=600.0,
            fps=60.0,
            resolution="1920x1080",
            codec="h264",
            filesize_mb=2500.0,
            offset=offset,
        )
    
    def test_create_and_save_session(self):
        """Test creating and saving a session."""
        vods = [
            self._create_test_vod("vod-1"),
            self._create_test_vod("vod-2"),
        ]
        
        session = MultiVodSessionManager.create_session(
            vods=vods,
            name="Test Session"
        )
        
        assert session.session_id
        assert session.name == "Test Session"
        assert len(session.vods) == 2
        
        # Verify file was created
        session_file = MultiVodSessionManager._session_file_path(session.session_id)
        assert session_file.exists()
    
    def test_load_session(self):
        """Test loading a saved session."""
        vods = [
            self._create_test_vod("vod-1"),
            self._create_test_vod("vod-2"),
        ]
        
        session1 = MultiVodSessionManager.create_session(vods=vods, name="Original")
        session_id = session1.session_id
        
        # Load it back
        session2 = MultiVodSessionManager.load_session(session_id)
        assert session2 is not None
        assert session2.name == "Original"
        assert len(session2.vods) == 2
        assert session2.session_id == session_id
    
    def test_delete_session(self):
        """Test deleting a session."""
        vods = [
            self._create_test_vod("vod-1"),
            self._create_test_vod("vod-2"),
        ]
        
        session = MultiVodSessionManager.create_session(vods=vods)
        session_id = session.session_id
        
        # Verify it exists
        assert MultiVodSessionManager.load_session(session_id) is not None
        
        # Delete it
        success = MultiVodSessionManager.delete_session(session_id)
        assert success
        
        # Verify it's gone
        assert MultiVodSessionManager.load_session(session_id) is None
    
    def test_update_offset(self):
        """Test updating a single offset."""
        vods = [
            self._create_test_vod("vod-1"),
            self._create_test_vod("vod-2", offset=0.0),
        ]
        
        session = MultiVodSessionManager.create_session(vods=vods)
        session_id = session.session_id
        
        # Update offset
        updated = MultiVodSessionManager.update_offset(
            session_id=session_id,
            vod_id="vod-2",
            new_offset=50.0,
            source="manual",
            changed_by="user-1"
        )
        
        assert updated is not None
        vod2 = updated.get_vod_by_id("vod-2")
        assert vod2.offset == 50.0
        assert len(vod2.offset_history) == 1
        
        # Verify history
        entry = vod2.offset_history[0]
        assert entry.old_offset == 0.0
        assert entry.new_offset == 50.0
        assert entry.source == "manual"
    
    def test_batch_update_offsets(self):
        """Test updating multiple offsets atomically."""
        vods = [
            self._create_test_vod("vod-1"),
            self._create_test_vod("vod-2"),
            self._create_test_vod("vod-3"),
        ]
        
        session = MultiVodSessionManager.create_session(vods=vods)
        
        # Update multiple offsets
        updated = MultiVodSessionManager.batch_update_offsets(
            session_id=session.session_id,
            offsets={
                "vod-1": 0.0,
                "vod-2": -50.0,
                "vod-3": 37.0,
            },
            source="timer_ocr",
            confidence=0.88
        )
        
        assert updated is not None
        assert updated.get_vod_by_id("vod-2").offset == -50.0
        assert updated.get_vod_by_id("vod-3").offset == 37.0
        
        # Verify history entries
        vod2 = updated.get_vod_by_id("vod-2")
        assert len(vod2.offset_history) == 1
        assert vod2.offset_history[0].confidence == 0.88
    
    def test_get_offset_history(self):
        """Test retrieving offset history."""
        vods = [
            self._create_test_vod("vod-1"),
            self._create_test_vod("vod-2"),
        ]
        
        session = MultiVodSessionManager.create_session(vods=vods)
        session_id = session.session_id
        
        # Make multiple offset changes
        MultiVodSessionManager.update_offset(
            session_id=session_id,
            vod_id="vod-2",
            new_offset=10.0,
            source="manual"
        )
        
        MultiVodSessionManager.update_offset(
            session_id=session_id,
            vod_id="vod-2",
            new_offset=20.0,
            source="manual"
        )
        
        # Get history
        history = MultiVodSessionManager.get_offset_history(session_id)
        
        # Should have 2 entries (sorted by timestamp, most recent first)
        assert len(history) == 2
        assert history[0]['new_offset'] == 20.0
        assert history[1]['new_offset'] == 10.0
    
    def test_list_sessions(self):
        """Test listing sessions."""
        vods_template = [
            self._create_test_vod("vod-1"),
            self._create_test_vod("vod-2"),
        ]
        
        # Create multiple sessions
        for i in range(3):
            vods = [
                MultiVodSessionVod(**vars(v))  # Copy template
                for v in vods_template
            ]
            MultiVodSessionManager.create_session(
                vods=vods,
                name=f"Session {i}",
                created_by="user-1" if i < 2 else "user-2"
            )
        
        # List all
        all_sessions = MultiVodSessionManager.list_sessions()
        assert len(all_sessions) >= 3
        
        # List by user
        user1_sessions = MultiVodSessionManager.list_sessions(created_by="user-1")
        assert len(user1_sessions) == 2


class TestMultiVodAPI:
    """Test REST API endpoints."""
    
    def setup_method(self):
        """Set up test environment."""
        self.tmp_dir = tempfile.TemporaryDirectory()
        self._original_sessions_dir = MultiVodSessionManager.SESSIONS_DIR
        MultiVodSessionManager.SESSIONS_DIR = Path(self.tmp_dir.name)
        self.client = app.test_client()
    
    def teardown_method(self):
        """Clean up after test."""
        self.tmp_dir.cleanup()
        MultiVodSessionManager.SESSIONS_DIR = self._original_sessions_dir
    
    def _create_fake_vod_file(self) -> Path:
        """Create a minimal MP4-like file for testing."""
        tmp = Path(self.tmp_dir.name) / "test_vod.mp4"
        tmp.write_bytes(b"fake mp4 data")
        return tmp
    
    def test_create_session_api(self):
        """Test POST /api/sessions/multi-vod endpoint."""
        vod_file = self._create_fake_vod_file()
        
        with patch('app.multi_vod_api._get_vod_metadata') as mock_metadata:
            mock_metadata.return_value = {
                "duration": 600.0,
                "fps": 60.0,
                "resolution": "1920x1080",
                "codec": "h264",
                "filesize_mb": 2500.0,
            }
            
            response = self.client.post(
                '/api/sessions/multi-vod',
                json={
                    "vods": [
                        {"vod_id": "v1", "name": "VOD 1", "path": str(vod_file)},
                        {"vod_id": "v2", "name": "VOD 2", "path": str(vod_file)},
                    ],
                    "name": "Test Session"
                },
                content_type='application/json'
            )
        
        assert response.status_code == 201
        data = response.get_json()
        assert data['ok']
        assert data['session']['name'] == "Test Session"
        assert len(data['session']['vods']) == 2
    
    def test_create_session_validation(self):
        """Test that session creation validates VOD count."""
        response = self.client.post(
            '/api/sessions/multi-vod',
            json={"vods": []},  # Empty
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert not data['ok']
        assert "2-3 VODs" in data['error']
    
    def test_get_session_api(self):
        """Test GET /api/sessions/multi-vod/{sessionId} endpoint."""
        vod_file = self._create_fake_vod_file()
        
        with patch('app.multi_vod_api._get_vod_metadata') as mock_metadata:
            mock_metadata.return_value = {
                "duration": 600.0,
                "fps": 60.0,
                "resolution": "1920x1080",
                "codec": "h264",
                "filesize_mb": 2500.0,
            }
            
            # Create session
            create_resp = self.client.post(
                '/api/sessions/multi-vod',
                json={
                    "vods": [
                        {"vod_id": "v1", "name": "VOD 1", "path": str(vod_file)},
                        {"vod_id": "v2", "name": "VOD 2", "path": str(vod_file)},
                    ]
                },
                content_type='application/json'
            )
            session_id = create_resp.get_json()['session']['session_id']
            
            # Get session
            get_resp = self.client.get(f'/api/sessions/multi-vod/{session_id}')
            assert get_resp.status_code == 200
            data = get_resp.get_json()
            assert data['ok']
            assert data['session']['session_id'] == session_id
    
    def test_global_seek_api(self):
        """Test PUT /api/sessions/multi-vod/{sessionId}/global-seek endpoint."""
        vod_file = self._create_fake_vod_file()
        
        with patch('app.multi_vod_api._get_vod_metadata') as mock_metadata:
            mock_metadata.return_value = {
                "duration": 600.0,
                "fps": 60.0,
                "resolution": "1920x1080",
                "codec": "h264",
                "filesize_mb": 2500.0,
            }
            
            # Create session
            create_resp = self.client.post(
                '/api/sessions/multi-vod',
                json={
                    "vods": [
                        {"vod_id": "v1", "name": "VOD 1", "path": str(vod_file)},
                        {"vod_id": "v2", "name": "VOD 2", "path": str(vod_file)},
                    ]
                },
                content_type='application/json'
            )
            session_id = create_resp.get_json()['session']['session_id']
            
            # Global seek
            seek_resp = self.client.put(
                f'/api/sessions/multi-vod/{session_id}/global-seek',
                json={"timestamp": 150.5},
                content_type='application/json'
            )
            
            assert seek_resp.status_code == 200
            data = seek_resp.get_json()
            assert data['ok']
            assert data['session']['global_time'] == 150.5
    
    def test_update_offsets_api(self):
        """Test PUT /api/sessions/multi-vod/{sessionId}/offsets endpoint."""
        vod_file = self._create_fake_vod_file()
        
        with patch('app.multi_vod_api._get_vod_metadata') as mock_metadata:
            mock_metadata.return_value = {
                "duration": 600.0,
                "fps": 60.0,
                "resolution": "1920x1080",
                "codec": "h264",
                "filesize_mb": 2500.0,
            }
            
            # Create session with 3 VODs
            create_resp = self.client.post(
                '/api/sessions/multi-vod',
                json={
                    "vods": [
                        {"vod_id": "v1", "name": "VOD 1", "path": str(vod_file)},
                        {"vod_id": "v2", "name": "VOD 2", "path": str(vod_file)},
                        {"vod_id": "v3", "name": "VOD 3", "path": str(vod_file)},
                    ]
                },
                content_type='application/json'
            )
            session_id = create_resp.get_json()['session']['session_id']
            
            # Update offsets
            offset_resp = self.client.put(
                f'/api/sessions/multi-vod/{session_id}/offsets',
                json={
                    "offsets": {
                        "v1": 0.0,
                        "v2": -50.0,
                        "v3": 37.0,
                    },
                    "source": "manual"
                },
                content_type='application/json'
            )
            
            assert offset_resp.status_code == 200
            data = offset_resp.get_json()
            assert data['ok']
            assert data['session']['vods'][1]['offset'] == -50.0
            assert data['session']['vods'][2]['offset'] == 37.0
    
    def test_offset_history_api(self):
        """Test GET /api/sessions/multi-vod/{sessionId}/offset-history endpoint."""
        vod_file = self._create_fake_vod_file()
        
        with patch('app.multi_vod_api._get_vod_metadata') as mock_metadata:
            mock_metadata.return_value = {
                "duration": 600.0,
                "fps": 60.0,
                "resolution": "1920x1080",
                "codec": "h264",
                "filesize_mb": 2500.0,
            }
            
            # Create and modify session
            create_resp = self.client.post(
                '/api/sessions/multi-vod',
                json={
                    "vods": [
                        {"vod_id": "v1", "name": "VOD 1", "path": str(vod_file)},
                        {"vod_id": "v2", "name": "VOD 2", "path": str(vod_file)},
                    ]
                },
                content_type='application/json'
            )
            session_id = create_resp.get_json()['session']['session_id']
            
            # Make offset changes
            self.client.put(
                f'/api/sessions/multi-vod/{session_id}/offsets',
                json={"offsets": {"v2": 10.0}, "source": "manual"},
                content_type='application/json'
            )
            
            self.client.put(
                f'/api/sessions/multi-vod/{session_id}/offsets',
                json={"offsets": {"v2": 20.0}, "source": "manual"},
                content_type='application/json'
            )
            
            # Get history
            history_resp = self.client.get(
                f'/api/sessions/multi-vod/{session_id}/offset-history'
            )
            
            assert history_resp.status_code == 200
            data = history_resp.get_json()
            assert data['ok']
            assert len(data['history']) == 2


def run_tests():
    """Run all tests."""
    print("\n" + "="*60)
    print("Testing Multi-VOD Backend")
    print("="*60)
    
    # Test models
    print("\n[Testing Models]")
    test_models = TestMultiVodModels()
    test_models.test_vod_offset_history_entry()
    print("✓ VodOffsetHistoryEntry")
    
    test_models.test_multi_vod_session_vod()
    print("✓ MultiVodSessionVod")
    
    test_models.test_multi_vod_session_creation()
    print("✓ MultiVodSession creation")
    
    test_models.test_session_validation_requires_2_to_3_vods()
    print("✓ Session validation")
    
    # Test manager
    print("\n[Testing Session Manager]")
    test_mgr = TestMultiVodSessionManager()
    
    test_mgr.setup_method()
    test_mgr.test_create_and_save_session()
    test_mgr.teardown_method()
    print("✓ Create and save session")
    
    test_mgr.setup_method()
    test_mgr.test_load_session()
    test_mgr.teardown_method()
    print("✓ Load session")
    
    test_mgr.setup_method()
    test_mgr.test_delete_session()
    test_mgr.teardown_method()
    print("✓ Delete session")
    
    test_mgr.setup_method()
    test_mgr.test_update_offset()
    test_mgr.teardown_method()
    print("✓ Update offset")
    
    test_mgr.setup_method()
    test_mgr.test_batch_update_offsets()
    test_mgr.teardown_method()
    print("✓ Batch update offsets")
    
    test_mgr.setup_method()
    test_mgr.test_get_offset_history()
    test_mgr.teardown_method()
    print("✓ Get offset history")
    
    test_mgr.setup_method()
    test_mgr.test_list_sessions()
    test_mgr.teardown_method()
    print("✓ List sessions")
    
    # Test API
    print("\n[Testing REST API]")
    test_api = TestMultiVodAPI()
    
    test_api.setup_method()
    test_api.test_create_session_api()
    test_api.teardown_method()
    print("✓ Create session API")
    
    test_api.setup_method()
    test_api.test_create_session_validation()
    test_api.teardown_method()
    print("✓ Session validation API")
    
    test_api.setup_method()
    test_api.test_get_session_api()
    test_api.teardown_method()
    print("✓ Get session API")
    
    test_api.setup_method()
    test_api.test_global_seek_api()
    test_api.teardown_method()
    print("✓ Global seek API")
    
    test_api.setup_method()
    test_api.test_update_offsets_api()
    test_api.teardown_method()
    print("✓ Update offsets API")
    
    test_api.setup_method()
    test_api.test_offset_history_api()
    test_api.teardown_method()
    print("✓ Offset history API")
    
    print("\n" + "="*60)
    print("✅ All tests passed!")
    print("="*60)


if __name__ == "__main__":
    run_tests()
