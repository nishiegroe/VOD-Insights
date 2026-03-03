"""
Tests for Telemetry API Endpoints

Tests recording, querying, and exporting playback telemetry data.
"""

import json
import pytest
from pathlib import Path
from datetime import datetime
import tempfile
import shutil
from unittest.mock import patch, MagicMock

from flask import Flask
from app.telemetry_api import (
    telemetry_bp,
    _get_telemetry_dir,
    _get_session_telemetry_path,
    _load_session_telemetry,
    _save_session_telemetry,
)
from app.telemetry_models import (
    PlaybackEvent,
    PlaybackSession,
    SessionTelemetry,
    VodTelemetryFrame,
)


@pytest.fixture
def app():
    """Create a test Flask app with telemetry blueprint."""
    app = Flask(__name__)
    app.config['TESTING'] = True
    app.register_blueprint(telemetry_bp)
    return app


@pytest.fixture
def client(app):
    """Create a test client."""
    return app.test_client()


@pytest.fixture
def temp_telemetry_dir():
    """Create a temporary directory for telemetry files."""
    temp_dir = tempfile.mkdtemp()
    yield Path(temp_dir)
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
def mock_telemetry_dir(temp_telemetry_dir):
    """Mock the telemetry directory."""
    with patch('app.telemetry_api._get_telemetry_dir') as mock:
        mock.return_value = temp_telemetry_dir
        yield temp_telemetry_dir


@pytest.fixture
def sample_session_id():
    """Sample session ID."""
    return "session-abc123def456"


@pytest.fixture
def sample_vod_id():
    """Sample VOD ID."""
    return "vod-xyz789"


@pytest.fixture
def sample_session_telemetry(sample_session_id):
    """Create a sample SessionTelemetry object."""
    telemetry = SessionTelemetry(session_id=sample_session_id)
    telemetry.session_started_at = 1700000000.0
    return telemetry


class TestRecordPlaybackEvent:
    """Test recording playback events."""
    
    def test_record_play_event(self, client, mock_telemetry_dir, sample_session_id, sample_vod_id):
        """Test recording a play event."""
        response = client.post(
            f'/api/telemetry/sessions/{sample_session_id}/events',
            json={
                'event_type': 'play',
                'timestamp_in_video': 10.5,
                'vod_id': sample_vod_id,
                'data': {}
            }
        )
        
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['ok'] is True
        assert data['event']['event_type'] == 'play'
        assert data['event']['timestamp_in_video'] == 10.5
    
    def test_record_seek_event(self, client, mock_telemetry_dir, sample_session_id, sample_vod_id):
        """Test recording a seek event."""
        response = client.post(
            f'/api/telemetry/sessions/{sample_session_id}/events',
            json={
                'event_type': 'seek',
                'timestamp_in_video': 20.3,
                'vod_id': sample_vod_id,
                'data': {
                    'from': 10.5,
                    'to': 20.3,
                    'duration_ms': 145
                }
            }
        )
        
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['ok'] is True
        assert data['event']['event_type'] == 'seek'
        assert data['event']['data']['duration_ms'] == 145
    
    def test_record_rate_change_event(self, client, mock_telemetry_dir, sample_session_id, sample_vod_id):
        """Test recording a playback rate change event."""
        response = client.post(
            f'/api/telemetry/sessions/{sample_session_id}/events',
            json={
                'event_type': 'rate_change',
                'timestamp_in_video': 15.0,
                'vod_id': sample_vod_id,
                'data': {
                    'from': 1.0,
                    'to': 2.0
                }
            }
        )
        
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['event']['data']['to'] == 2.0
    
    def test_missing_event_type(self, client, mock_telemetry_dir, sample_session_id, sample_vod_id):
        """Test that missing event_type returns 400."""
        response = client.post(
            f'/api/telemetry/sessions/{sample_session_id}/events',
            json={
                'timestamp_in_video': 10.5,
                'vod_id': sample_vod_id,
            }
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['ok'] is False
    
    def test_missing_vod_id(self, client, mock_telemetry_dir, sample_session_id):
        """Test that missing vod_id returns 400."""
        response = client.post(
            f'/api/telemetry/sessions/{sample_session_id}/events',
            json={
                'event_type': 'play',
                'timestamp_in_video': 10.5,
            }
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['ok'] is False
    
    def test_invalid_event_type(self, client, mock_telemetry_dir, sample_session_id, sample_vod_id):
        """Test that invalid event_type returns 400."""
        response = client.post(
            f'/api/telemetry/sessions/{sample_session_id}/events',
            json={
                'event_type': 'invalid_type',
                'timestamp_in_video': 10.5,
                'vod_id': sample_vod_id,
            }
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'Invalid event_type' in data['error']


class TestPlaybackSession:
    """Test playback session management."""
    
    def test_create_playback_session(self, client, mock_telemetry_dir, sample_session_id, sample_vod_id):
        """Test creating a playback session."""
        response = client.post(
            f'/api/telemetry/sessions/{sample_session_id}/vod/{sample_vod_id}/session',
            json={
                'duration_seconds': 3600.0
            }
        )
        
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['ok'] is True
        assert data['session']['duration_seconds'] == 3600.0
        assert data['session']['vod_id'] == sample_vod_id
    
    def test_create_playback_session_invalid_duration(self, client, mock_telemetry_dir, sample_session_id, sample_vod_id):
        """Test that invalid duration returns 400."""
        response = client.post(
            f'/api/telemetry/sessions/{sample_session_id}/vod/{sample_vod_id}/session',
            json={
                'duration_seconds': 0
            }
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['ok'] is False
    
    def test_end_playback_session(self, client, mock_telemetry_dir, sample_session_id, sample_vod_id):
        """Test ending a playback session."""
        # First create a session
        client.post(
            f'/api/telemetry/sessions/{sample_session_id}/vod/{sample_vod_id}/session',
            json={'duration_seconds': 3600.0}
        )
        
        # Then end it
        response = client.post(
            f'/api/telemetry/sessions/{sample_session_id}/vod/{sample_vod_id}/session/end',
            json={
                'final_position': 2400.5,
                'watch_time_ms': 1800000.0
            }
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['ok'] is True
        assert data['session']['final_position'] == 2400.5
        assert data['session']['watch_time_ms'] == 1800000.0


class TestTelemetrySummary:
    """Test telemetry summary endpoints."""
    
    def test_get_session_telemetry_summary(self, client, mock_telemetry_dir, sample_session_id):
        """Test getting session telemetry summary."""
        # Create a telemetry session
        telemetry = SessionTelemetry(session_id=sample_session_id)
        telemetry.session_started_at = 1700000000.0
        from app.telemetry_api import _save_session_telemetry
        _save_session_telemetry(telemetry)
        
        response = client.get(f'/api/telemetry/sessions/{sample_session_id}/summary')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['ok'] is True
        assert data['summary']['session_id'] == sample_session_id
    
    def test_get_nonexistent_session_summary(self, client, mock_telemetry_dir):
        """Test that nonexistent session returns 404."""
        response = client.get('/api/telemetry/sessions/nonexistent/summary')
        
        assert response.status_code == 404
        data = json.loads(response.data)
        assert data['ok'] is False


class TestPlaybackEvents:
    """Test playback event queries."""
    
    def test_get_playback_events(self, client, mock_telemetry_dir, sample_session_id, sample_vod_id):
        """Test getting playback events."""
        # Record some events
        client.post(
            f'/api/telemetry/sessions/{sample_session_id}/events',
            json={
                'event_type': 'play',
                'timestamp_in_video': 10.0,
                'vod_id': sample_vod_id,
                'data': {}
            }
        )
        
        client.post(
            f'/api/telemetry/sessions/{sample_session_id}/events',
            json={
                'event_type': 'pause',
                'timestamp_in_video': 20.0,
                'vod_id': sample_vod_id,
                'data': {}
            }
        )
        
        # Get events
        response = client.get(f'/api/telemetry/sessions/{sample_session_id}/events')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['ok'] is True
        assert len(data['events']) >= 2
    
    def test_filter_events_by_type(self, client, mock_telemetry_dir, sample_session_id, sample_vod_id):
        """Test filtering events by type."""
        # Record mixed events
        client.post(
            f'/api/telemetry/sessions/{sample_session_id}/events',
            json={
                'event_type': 'play',
                'timestamp_in_video': 10.0,
                'vod_id': sample_vod_id,
                'data': {}
            }
        )
        
        client.post(
            f'/api/telemetry/sessions/{sample_session_id}/events',
            json={
                'event_type': 'seek',
                'timestamp_in_video': 20.0,
                'vod_id': sample_vod_id,
                'data': {'from': 10, 'to': 20}
            }
        )
        
        # Filter by type
        response = client.get(
            f'/api/telemetry/sessions/{sample_session_id}/events?event_type=play'
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert all(e['event_type'] == 'play' for e in data['events'])
    
    def test_pagination(self, client, mock_telemetry_dir, sample_session_id, sample_vod_id):
        """Test event pagination."""
        # Record 5 events
        for i in range(5):
            client.post(
                f'/api/telemetry/sessions/{sample_session_id}/events',
                json={
                    'event_type': 'play',
                    'timestamp_in_video': float(i * 10),
                    'vod_id': sample_vod_id,
                    'data': {}
                }
            )
        
        # Get with limit
        response = client.get(
            f'/api/telemetry/sessions/{sample_session_id}/events?limit=2'
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data['events']) <= 2
        assert data['has_more'] is True


class TestRewatchHeatmap:
    """Test rewatch heatmap generation."""
    
    def test_get_rewatch_heatmap(self, client, mock_telemetry_dir, sample_session_id):
        """Test getting rewatch heatmap."""
        # Create a telemetry session with heatmap data
        telemetry = SessionTelemetry(session_id=sample_session_id)
        
        # Add a playback session with rewatch data
        playback_session = PlaybackSession(
            session_id=sample_session_id,
            vod_id='vod-1',
            started_at=1700000000.0,
            duration_seconds=3600.0,
        )
        playback_session.rewatch_heatmap = {
            10.0: 2,
            20.0: 3,
            30.0: 1,
        }
        
        telemetry.vod_sessions['vod-1'] = [playback_session]
        
        from app.telemetry_api import _save_session_telemetry
        _save_session_telemetry(telemetry)
        
        response = client.get(f'/api/telemetry/sessions/{sample_session_id}/heatmap')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['ok'] is True
        assert len(data['heatmap']) > 0


class TestSessionStats:
    """Test session statistics."""
    
    def test_get_session_stats(self, client, mock_telemetry_dir, sample_session_id):
        """Test getting session statistics."""
        telemetry = SessionTelemetry(session_id=sample_session_id)
        telemetry.session_started_at = 1700000000.0
        
        from app.telemetry_api import _save_session_telemetry
        _save_session_telemetry(telemetry)
        
        response = client.get(f'/api/telemetry/sessions/{sample_session_id}/stats')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['ok'] is True
        assert 'stats' in data


class TestExportTelemetry:
    """Test telemetry export."""
    
    def test_export_as_json(self, client, mock_telemetry_dir, sample_session_id):
        """Test exporting telemetry as JSON."""
        telemetry = SessionTelemetry(session_id=sample_session_id)
        
        from app.telemetry_api import _save_session_telemetry
        _save_session_telemetry(telemetry)
        
        response = client.get(
            f'/api/telemetry/sessions/{sample_session_id}/export?format=json'
        )
        
        assert response.status_code == 200
        assert 'application/json' in response.content_type
        data = json.loads(response.data)
        assert data['session_id'] == sample_session_id
    
    def test_export_as_csv(self, client, mock_telemetry_dir, sample_session_id, sample_vod_id):
        """Test exporting telemetry as CSV."""
        # Create telemetry with events
        telemetry = SessionTelemetry(session_id=sample_session_id)
        
        playback_session = PlaybackSession(
            session_id=sample_session_id,
            vod_id=sample_vod_id,
            started_at=1700000000.0,
            duration_seconds=3600.0,
        )
        
        event = PlaybackEvent(
            event_type='play',
            timestamp=1700000000.0,
            timestamp_in_video=10.0,
            session_elapsed_ms=1000.0,
            vod_id=sample_vod_id,
            data={}
        )
        playback_session.add_event(event)
        
        telemetry.vod_sessions[sample_vod_id] = [playback_session]
        
        from app.telemetry_api import _save_session_telemetry
        _save_session_telemetry(telemetry)
        
        response = client.get(
            f'/api/telemetry/sessions/{sample_session_id}/export?format=csv'
        )
        
        assert response.status_code == 200
        assert 'text/csv' in response.content_type


class TestSessionManagement:
    """Test session management endpoints."""
    
    def test_list_telemetry_sessions(self, client, mock_telemetry_dir):
        """Test listing telemetry sessions."""
        # Create a few sessions
        for i in range(3):
            telemetry = SessionTelemetry(session_id=f'session-{i}')
            from app.telemetry_api import _save_session_telemetry
            _save_session_telemetry(telemetry)
        
        response = client.get('/api/telemetry/sessions')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['ok'] is True
        assert len(data['sessions']) >= 3
    
    def test_end_session(self, client, mock_telemetry_dir, sample_session_id):
        """Test ending a telemetry session."""
        telemetry = SessionTelemetry(session_id=sample_session_id)
        telemetry.session_started_at = 1700000000.0
        
        from app.telemetry_api import _save_session_telemetry
        _save_session_telemetry(telemetry)
        
        response = client.post(f'/api/telemetry/sessions/{sample_session_id}/end')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['ok'] is True
        assert data['telemetry']['session_ended_at'] is not None
    
    def test_delete_telemetry_session(self, client, mock_telemetry_dir, sample_session_id):
        """Test deleting telemetry data."""
        telemetry = SessionTelemetry(session_id=sample_session_id)
        
        from app.telemetry_api import _save_session_telemetry
        _save_session_telemetry(telemetry)
        
        response = client.delete(f'/api/telemetry/sessions/{sample_session_id}')
        
        assert response.status_code == 204
    
    def test_delete_nonexistent_session(self, client, mock_telemetry_dir):
        """Test that deleting nonexistent session returns 404."""
        response = client.delete('/api/telemetry/sessions/nonexistent')
        
        assert response.status_code == 404
        data = json.loads(response.data)
        assert data['ok'] is False


class TestTelemetryModels:
    """Test telemetry data models."""
    
    def test_playback_event_serialization(self):
        """Test PlaybackEvent serialization."""
        event = PlaybackEvent(
            event_type='play',
            timestamp=1700000000.0,
            timestamp_in_video=10.0,
            session_elapsed_ms=1000.0,
            vod_id='vod-123',
            data={'test': 'data'}
        )
        
        # Serialize
        data = event.to_dict()
        
        # Deserialize
        event2 = PlaybackEvent.from_dict(data)
        
        assert event2.event_type == 'play'
        assert event2.timestamp_in_video == 10.0
    
    def test_playback_session_add_event(self):
        """Test adding events to playback session."""
        session = PlaybackSession(
            session_id='session-123',
            vod_id='vod-456',
            started_at=1700000000.0,
            duration_seconds=3600.0,
        )
        
        event1 = PlaybackEvent(
            event_type='play',
            timestamp=1700000000.0,
            timestamp_in_video=10.0,
            session_elapsed_ms=0,
            vod_id='vod-456',
            data={}
        )
        
        event2 = PlaybackEvent(
            event_type='seek',
            timestamp=1700000001.0,
            timestamp_in_video=20.0,
            session_elapsed_ms=1000,
            vod_id='vod-456',
            data={'from': 10, 'to': 20}
        )
        
        session.add_event(event1)
        session.add_event(event2)
        
        assert session.total_plays == 1
        assert session.total_seeks == 1
        assert session.max_position_reached == 20.0
    
    def test_session_telemetry_calculations(self):
        """Test SessionTelemetry calculations."""
        telemetry = SessionTelemetry(session_id='session-123')
        
        session1 = PlaybackSession(
            session_id='session-123',
            vod_id='vod-1',
            started_at=1700000000.0,
            duration_seconds=3600.0,
            watch_time_ms=1800000.0,
        )
        
        telemetry.add_playback_session('vod-1', session1)
        
        assert telemetry.total_watch_time_ms == 1800000.0
        assert telemetry.total_playback_events == 0


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
