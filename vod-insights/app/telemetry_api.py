"""
Telemetry API Endpoints - Playback Metrics and Session Analytics

Provides REST API for recording and retrieving playback telemetry data.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path
import json
import time
from datetime import datetime

from flask import Blueprint, request, jsonify, Response, abort

from app.telemetry_models import (
    PlaybackEvent,
    PlaybackSession,
    SessionTelemetry,
    TelemetryFrame,
    VodTelemetryFrame,
)
from app.runtime_paths import get_app_data_dir


# Create Blueprint for telemetry routes
telemetry_bp = Blueprint('telemetry', __name__, url_prefix='/api/telemetry')


def _get_telemetry_dir() -> Path:
    """Get the directory where telemetry data is stored."""
    telemetry_dir = get_app_data_dir() / 'telemetry'
    telemetry_dir.mkdir(parents=True, exist_ok=True)
    return telemetry_dir


def _get_session_telemetry_path(session_id: str) -> Path:
    """Get the file path for a session's telemetry data."""
    return _get_telemetry_dir() / f'{session_id}.json'


def _load_session_telemetry(session_id: str) -> Optional[SessionTelemetry]:
    """Load telemetry data for a session."""
    telemetry_path = _get_session_telemetry_path(session_id)
    
    if not telemetry_path.exists():
        return None
    
    try:
        data = json.loads(telemetry_path.read_text(encoding='utf-8'))
        return SessionTelemetry.from_dict(data)
    except (json.JSONDecodeError, Exception) as e:
        print(f"Error loading telemetry for {session_id}: {e}")
        return None


def _save_session_telemetry(telemetry: SessionTelemetry) -> bool:
    """Save telemetry data for a session."""
    telemetry_path = _get_session_telemetry_path(telemetry.session_id)
    
    try:
        data = telemetry.to_dict()
        telemetry_path.write_text(json.dumps(data, indent=2), encoding='utf-8')
        return True
    except Exception as e:
        print(f"Error saving telemetry for {telemetry.session_id}: {e}")
        return False


@telemetry_bp.route('/sessions/<session_id>/events', methods=['POST'])
def record_playback_event(session_id: str) -> Tuple[Any, int]:
    """
    Record a playback event (play, pause, seek, rate change, etc.).
    
    Request body:
    {
        "event_type": "play" | "pause" | "seek" | "rate_change" | "volume_change" | "error",
        "timestamp_in_video": 150.5,  // seconds
        "vod_id": "vod-123",
        "data": {
            // Event-specific data
            "from": 10.5,  // for seek
            "to": 20.3,
            "duration_ms": 145
        }
    }
    
    Response: Updated PlaybackEvent record
    """
    payload = request.get_json(silent=True) or {}
    
    event_type = payload.get('event_type')
    timestamp_in_video = payload.get('timestamp_in_video', 0.0)
    vod_id = payload.get('vod_id')
    data = payload.get('data', {})
    
    # Validate required fields
    if not event_type or not vod_id:
        return jsonify({
            "ok": False,
            "error": "event_type and vod_id are required"
        }), 400
    
    if event_type not in ['play', 'pause', 'seek', 'rate_change', 'volume_change', 'error']:
        return jsonify({
            "ok": False,
            "error": f"Invalid event_type: {event_type}"
        }), 400
    
    # Load or create telemetry
    telemetry = _load_session_telemetry(session_id)
    if not telemetry:
        telemetry = SessionTelemetry(session_id=session_id)
        if not telemetry.session_started_at:
            telemetry.session_started_at = time.time()
    
    # Create event
    event = PlaybackEvent(
        event_type=event_type,
        timestamp=time.time(),
        timestamp_in_video=float(timestamp_in_video),
        session_elapsed_ms=(time.time() - telemetry.session_started_at) * 1000 if telemetry.session_started_at else 0,
        vod_id=vod_id,
        data=data,
    )
    
    # Get or create playback session for this VOD
    if vod_id not in telemetry.vod_sessions:
        telemetry.vod_sessions[vod_id] = []
    
    # Use the most recent playback session, or create new one if none exists
    if not telemetry.vod_sessions[vod_id]:
        playback_session = PlaybackSession(
            session_id=session_id,
            vod_id=vod_id,
            started_at=time.time(),
        )
        telemetry.vod_sessions[vod_id].append(playback_session)
    else:
        playback_session = telemetry.vod_sessions[vod_id][-1]
    
    # Add event to playback session
    playback_session.add_event(event)
    playback_session.final_position = float(timestamp_in_video)
    
    # Update aggregate metrics
    telemetry.total_playback_events += 1
    
    # Save telemetry
    if not _save_session_telemetry(telemetry):
        return jsonify({
            "ok": False,
            "error": "Failed to save telemetry"
        }), 500
    
    return jsonify({
        "ok": True,
        "event": event.to_dict()
    }), 201


@telemetry_bp.route('/sessions/<session_id>/vod/<vod_id>/session', methods=['POST'])
def create_playback_session(session_id: str, vod_id: str) -> Tuple[Any, int]:
    """
    Create a new playback session for a VOD within a multi-VOD session.
    
    This is called when playback starts for a specific VOD.
    
    Request body:
    {
        "duration_seconds": 3600.0
    }
    
    Response: New PlaybackSession record
    """
    payload = request.get_json(silent=True) or {}
    duration = payload.get('duration_seconds', 0.0)
    
    if duration <= 0:
        return jsonify({
            "ok": False,
            "error": "duration_seconds must be > 0"
        }), 400
    
    # Load or create telemetry
    telemetry = _load_session_telemetry(session_id)
    if not telemetry:
        telemetry = SessionTelemetry(session_id=session_id)
        telemetry.session_started_at = time.time()
    
    # Create new playback session
    playback_session = PlaybackSession(
        session_id=session_id,
        vod_id=vod_id,
        started_at=time.time(),
        duration_seconds=float(duration),
    )
    
    # Add to telemetry
    if vod_id not in telemetry.vod_sessions:
        telemetry.vod_sessions[vod_id] = []
    
    telemetry.vod_sessions[vod_id].append(playback_session)
    
    # Save telemetry
    if not _save_session_telemetry(telemetry):
        return jsonify({
            "ok": False,
            "error": "Failed to save telemetry"
        }), 500
    
    return jsonify({
        "ok": True,
        "session": playback_session.to_dict()
    }), 201


@telemetry_bp.route('/sessions/<session_id>/vod/<vod_id>/session/end', methods=['POST'])
def end_playback_session(session_id: str, vod_id: str) -> Tuple[Any, int]:
    """
    Mark the end of a playback session for a VOD.
    
    Request body:
    {
        "final_position": 2400.5,  // seconds
        "watch_time_ms": 1800000.0  // total watch time in milliseconds
    }
    
    Response: Updated PlaybackSession record
    """
    payload = request.get_json(silent=True) or {}
    final_position = payload.get('final_position', 0.0)
    watch_time_ms = payload.get('watch_time_ms', 0.0)
    
    # Load telemetry
    telemetry = _load_session_telemetry(session_id)
    if not telemetry:
        return jsonify({
            "ok": False,
            "error": "Session not found"
        }), 404
    
    # Get the most recent playback session for this VOD
    if vod_id not in telemetry.vod_sessions or not telemetry.vod_sessions[vod_id]:
        return jsonify({
            "ok": False,
            "error": "No playback session found"
        }), 404
    
    playback_session = telemetry.vod_sessions[vod_id][-1]
    
    # Update session
    playback_session.ended_at = time.time()
    playback_session.final_position = float(final_position)
    playback_session.watch_time_ms = float(watch_time_ms)
    
    if playback_session.duration_seconds > 0:
        playback_session.watch_time_percentage = (watch_time_ms / 1000.0) / playback_session.duration_seconds * 100.0
    
    # Save telemetry
    if not _save_session_telemetry(telemetry):
        return jsonify({
            "ok": False,
            "error": "Failed to save telemetry"
        }), 500
    
    return jsonify({
        "ok": True,
        "session": playback_session.to_dict()
    }), 200


@telemetry_bp.route('/sessions/<session_id>/summary', methods=['GET'])
def get_session_telemetry_summary(session_id: str) -> Tuple[Any, int]:
    """
    Get a summary of telemetry data for a session.
    
    Query parameters:
        vod_id (optional): Filter by specific VOD
    
    Response: Summary with aggregate metrics
    """
    vod_id = request.args.get('vod_id')
    
    telemetry = _load_session_telemetry(session_id)
    if not telemetry:
        return jsonify({
            "ok": False,
            "error": "Session not found"
        }), 404
    
    if vod_id:
        # Get summary for specific VOD
        vod_sessions = telemetry.get_vod_sessions(vod_id)
        
        total_watch_time = sum(s.watch_time_ms for s in vod_sessions)
        total_events = sum(len(s.events) for s in vod_sessions)
        total_seeks = sum(s.total_seeks for s in vod_sessions)
        total_pauses = sum(s.total_pauses for s in vod_sessions)
        
        return jsonify({
            "ok": True,
            "summary": {
                "vod_id": vod_id,
                "total_watch_time_ms": total_watch_time,
                "total_events": total_events,
                "total_seeks": total_seeks,
                "total_pauses": total_pauses,
                "num_sessions": len(vod_sessions),
                "sessions": [s.to_dict() for s in vod_sessions],
            }
        }), 200
    else:
        # Get summary for entire session
        telemetry.calculate_aggregate_metrics()
        
        summary = {
            "session_id": session_id,
            "created_at": telemetry.created_at,
            "session_started_at": telemetry.session_started_at,
            "session_ended_at": telemetry.session_ended_at,
            "total_watch_time_ms": telemetry.total_watch_time_ms,
            "total_playback_events": telemetry.total_playback_events,
            "avg_rewatch_percentage": telemetry.avg_rewatch_percentage,
            "num_vods": len(telemetry.vod_sessions),
            "vods": {
                vod_id: {
                    "num_sessions": len(sessions),
                    "total_events": sum(len(s.events) for s in sessions),
                    "total_watch_time_ms": sum(s.watch_time_ms for s in sessions),
                }
                for vod_id, sessions in telemetry.vod_sessions.items()
            },
        }
        
        return jsonify({
            "ok": True,
            "summary": summary
        }), 200


@telemetry_bp.route('/sessions/<session_id>/events', methods=['GET'])
def get_playback_events(session_id: str) -> Tuple[Any, int]:
    """
    Get all playback events for a session.
    
    Query parameters:
        vod_id (optional): Filter by specific VOD
        event_type (optional): Filter by event type
        limit (default 100): Max results
        offset (default 0): Pagination offset
    
    Response: List of PlaybackEvent records
    """
    vod_id = request.args.get('vod_id')
    event_type = request.args.get('event_type')
    limit = int(request.args.get('limit', 100))
    offset_param = int(request.args.get('offset', 0))
    
    telemetry = _load_session_telemetry(session_id)
    if not telemetry:
        return jsonify({
            "ok": False,
            "error": "Session not found"
        }), 404
    
    # Collect events
    events = []
    
    if vod_id:
        sessions = telemetry.get_vod_sessions(vod_id)
        for session in sessions:
            events.extend(session.events)
    else:
        for sessions in telemetry.vod_sessions.values():
            for session in sessions:
                events.extend(session.events)
    
    # Filter by event type if requested
    if event_type:
        events = [e for e in events if e.event_type == event_type]
    
    # Sort by timestamp
    events.sort(key=lambda e: e.timestamp)
    
    # Paginate
    total_events = len(events)
    events = events[offset_param:offset_param + limit]
    
    return jsonify({
        "ok": True,
        "events": [e.to_dict() for e in events],
        "total": total_events,
        "limit": limit,
        "offset": offset_param,
        "has_more": offset_param + limit < total_events,
    }), 200


@telemetry_bp.route('/sessions/<session_id>/heatmap', methods=['GET'])
def get_rewatch_heatmap(session_id: str) -> Tuple[Any, int]:
    """
    Get rewatch heatmap for a session.
    
    Heatmap shows which sections of videos are rewatched most frequently.
    
    Query parameters:
        vod_id (optional): Filter by specific VOD
        bucket_size (default 1): Time bucket size in seconds
    
    Response: Rewatch heatmap data
    """
    vod_id = request.args.get('vod_id')
    bucket_size = int(request.args.get('bucket_size', 1))
    
    if bucket_size < 1:
        return jsonify({
            "ok": False,
            "error": "bucket_size must be >= 1"
        }), 400
    
    telemetry = _load_session_telemetry(session_id)
    if not telemetry:
        return jsonify({
            "ok": False,
            "error": "Session not found"
        }), 404
    
    # Collect heatmap data
    heatmap = {}
    
    if vod_id:
        sessions = telemetry.get_vod_sessions(vod_id)
        for session in sessions:
            for time_point, count in session.rewatch_heatmap.items():
                bucket = int(time_point / bucket_size) * bucket_size
                heatmap[bucket] = heatmap.get(bucket, 0) + count
    else:
        for sessions in telemetry.vod_sessions.values():
            for session in sessions:
                for time_point, count in session.rewatch_heatmap.items():
                    bucket = int(time_point / bucket_size) * bucket_size
                    heatmap[bucket] = heatmap.get(bucket, 0) + count
    
    # Sort by time point
    sorted_heatmap = [
        {"time_seconds": k, "rewatch_count": v}
        for k, v in sorted(heatmap.items())
    ]
    
    return jsonify({
        "ok": True,
        "heatmap": sorted_heatmap,
        "total_rewatch_events": sum(heatmap.values()),
        "bucket_size_seconds": bucket_size,
        "vod_id": vod_id,
    }), 200


@telemetry_bp.route('/sessions/<session_id>/stats', methods=['GET'])
def get_session_stats(session_id: str) -> Tuple[Any, int]:
    """
    Get detailed statistics for a session.
    
    Query parameters:
        vod_id (optional): Filter by specific VOD
    
    Response: Detailed statistics
    """
    vod_id = request.args.get('vod_id')
    
    telemetry = _load_session_telemetry(session_id)
    if not telemetry:
        return jsonify({
            "ok": False,
            "error": "Session not found"
        }), 404
    
    if vod_id:
        sessions = telemetry.get_vod_sessions(vod_id)
        
        total_watch_ms = sum(s.watch_time_ms for s in sessions)
        total_duration = sum(s.duration_seconds for s in sessions)
        total_seeks = sum(s.total_seeks for s in sessions)
        total_pauses = sum(s.total_pauses for s in sessions)
        total_plays = sum(s.total_plays for s in sessions)
        total_events = sum(len(s.events) for s in sessions)
        max_position = max((s.max_position_reached for s in sessions), default=0)
        
        stats = {
            "vod_id": vod_id,
            "total_sessions": len(sessions),
            "total_watch_time_ms": total_watch_ms,
            "total_duration_seconds": total_duration,
            "watch_percentage": (total_watch_ms / 1000.0 / total_duration * 100.0) if total_duration > 0 else 0,
            "total_seeks": total_seeks,
            "total_pauses": total_pauses,
            "total_plays": total_plays,
            "total_events": total_events,
            "max_position_reached": max_position,
            "avg_watch_time_per_session_ms": total_watch_ms / len(sessions) if sessions else 0,
        }
    else:
        telemetry.calculate_aggregate_metrics()
        
        vod_stats = {}
        for vod_id_key, sessions in telemetry.vod_sessions.items():
            total_watch = sum(s.watch_time_ms for s in sessions)
            total_duration = sum(s.duration_seconds for s in sessions)
            vod_stats[vod_id_key] = {
                "sessions": len(sessions),
                "watch_time_ms": total_watch,
                "watch_percentage": (total_watch / 1000.0 / total_duration * 100.0) if total_duration > 0 else 0,
            }
        
        stats = {
            "session_id": session_id,
            "total_watch_time_ms": telemetry.total_watch_time_ms,
            "total_playback_events": telemetry.total_playback_events,
            "avg_rewatch_percentage": telemetry.avg_rewatch_percentage,
            "vods": vod_stats,
        }
    
    return jsonify({
        "ok": True,
        "stats": stats
    }), 200


@telemetry_bp.route('/sessions/<session_id>/export', methods=['GET'])
def export_session_telemetry(session_id: str) -> Any:
    """
    Export complete telemetry data for a session as JSON or CSV.
    
    Query parameters:
        format (default 'json'): 'json' or 'csv'
        vod_id (optional): Filter by specific VOD
    
    Response: File download
    """
    format_type = request.args.get('format', 'json').lower()
    vod_id = request.args.get('vod_id')
    
    if format_type not in ['json', 'csv']:
        return jsonify({
            "ok": False,
            "error": "format must be 'json' or 'csv'"
        }), 400
    
    telemetry = _load_session_telemetry(session_id)
    if not telemetry:
        return jsonify({
            "ok": False,
            "error": "Session not found"
        }), 404
    
    if format_type == 'json':
        # Export as JSON
        data = telemetry.to_dict()
        if vod_id:
            data['vod_sessions'] = {
                vod_id: data['vod_sessions'].get(vod_id, [])
            }
        
        response = Response(
            json.dumps(data, indent=2),
            mimetype='application/json'
        )
        response.headers['Content-Disposition'] = f'attachment; filename="telemetry-{session_id}.json"'
        return response
    
    else:
        # Export as CSV
        import csv
        from io import StringIO
        
        csv_buffer = StringIO()
        writer = csv.writer(csv_buffer)
        
        # Write header
        writer.writerow([
            'vod_id', 'event_type', 'timestamp', 'timestamp_in_video',
            'session_elapsed_ms', 'data'
        ])
        
        # Write events
        for vod_id_key, sessions in telemetry.vod_sessions.items():
            if vod_id and vod_id_key != vod_id:
                continue
            
            for session in sessions:
                for event in session.events:
                    writer.writerow([
                        vod_id_key,
                        event.event_type,
                        event.timestamp,
                        event.timestamp_in_video,
                        event.session_elapsed_ms,
                        json.dumps(event.data),
                    ])
        
        response = Response(
            csv_buffer.getvalue(),
            mimetype='text/csv'
        )
        response.headers['Content-Disposition'] = f'attachment; filename="telemetry-{session_id}.csv"'
        return response


@telemetry_bp.route('/sessions/<session_id>/end', methods=['POST'])
def end_session(session_id: str) -> Tuple[Any, int]:
    """
    Mark the end of a telemetry session.
    
    This finalizes all playback sessions and locks the telemetry data.
    
    Request body: {} (empty)
    
    Response: Updated SessionTelemetry record
    """
    telemetry = _load_session_telemetry(session_id)
    if not telemetry:
        return jsonify({
            "ok": False,
            "error": "Session not found"
        }), 404
    
    # Close all open playback sessions
    for vod_id, sessions in telemetry.vod_sessions.items():
        for session in sessions:
            if session.ended_at is None:
                session.ended_at = time.time()
    
    # Update aggregate metrics
    telemetry.session_ended_at = time.time()
    telemetry.calculate_aggregate_metrics()
    
    # Save telemetry
    if not _save_session_telemetry(telemetry):
        return jsonify({
            "ok": False,
            "error": "Failed to save telemetry"
        }), 500
    
    return jsonify({
        "ok": True,
        "telemetry": telemetry.to_dict()
    }), 200


@telemetry_bp.route('/sessions', methods=['GET'])
def list_telemetry_sessions() -> Tuple[Any, int]:
    """
    List all telemetry sessions.
    
    Query parameters:
        limit (default 20): Max results
        offset (default 0): Pagination offset
    
    Response: List of SessionTelemetry summaries
    """
    limit = int(request.args.get('limit', 20))
    offset_param = int(request.args.get('offset', 0))
    
    telemetry_dir = _get_telemetry_dir()
    
    # List all telemetry files
    telemetry_files = sorted(telemetry_dir.glob('*.json'), reverse=True)
    
    total_sessions = len(telemetry_files)
    telemetry_files = telemetry_files[offset_param:offset_param + limit]
    
    sessions = []
    for telemetry_file in telemetry_files:
        try:
            data = json.loads(telemetry_file.read_text(encoding='utf-8'))
            sessions.append({
                "session_id": data['session_id'],
                "created_at": data['created_at'],
                "total_watch_time_ms": data['total_watch_time_ms'],
                "total_playback_events": data['total_playback_events'],
                "num_vods": data.get('num_vods', len(data.get('vod_sessions', {}))),
            })
        except Exception as e:
            print(f"Error reading {telemetry_file}: {e}")
            continue
    
    return jsonify({
        "ok": True,
        "sessions": sessions,
        "total": total_sessions,
        "limit": limit,
        "offset": offset_param,
        "has_more": offset_param + limit < total_sessions,
    }), 200


@telemetry_bp.route('/sessions/<session_id>', methods=['DELETE'])
def delete_telemetry_session(session_id: str) -> Tuple[Any, int]:
    """
    Delete telemetry data for a session.
    
    Request body: {} (empty)
    
    Response: Confirmation
    """
    telemetry_path = _get_session_telemetry_path(session_id)
    
    if not telemetry_path.exists():
        return jsonify({
            "ok": False,
            "error": "Session not found"
        }), 404
    
    try:
        telemetry_path.unlink()
        return jsonify({"ok": True}), 204
    except Exception as e:
        return jsonify({
            "ok": False,
            "error": f"Failed to delete: {str(e)}"
        }), 500
