"""
Multi-VOD Comparison API Endpoints

Provides REST API for multi-VOD session management and playback control.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path
import os

from flask import Blueprint, request, jsonify

from app.multi_vod_manager import MultiVodSessionManager
from app.multi_vod_models import MultiVodSession, MultiVodSessionVod


# Create Blueprint for multi-VOD routes
multi_vod_bp = Blueprint('multi_vod', __name__, url_prefix='/api/sessions/multi-vod')


def _serialize_session(session: MultiVodSession) -> Dict[str, Any]:
    """Serialize a MultiVodSession to JSON-safe dict."""
    return session.to_dict()


def _get_vod_metadata(vod_path: str) -> Optional[Dict[str, Any]]:
    """Extract metadata from VOD file."""
    import cv2
    
    vod_path = Path(vod_path)
    if not vod_path.exists():
        return None
    
    try:
        cap = cv2.VideoCapture(str(vod_path))
        if not cap.isOpened():
            return None
        
        fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        duration = frame_count / fps if fps > 0 else 0
        resolution = f"{width}x{height}"
        filesize_mb = vod_path.stat().st_size / (1024 * 1024)
        
        cap.release()
        
        return {
            "duration": duration,
            "fps": fps,
            "resolution": resolution,
            "codec": "h264",  # Could be detected from ffprobe
            "filesize_mb": filesize_mb,
        }
    except Exception as e:
        print(f"Error getting VOD metadata: {e}")
        return None


@multi_vod_bp.route('', methods=['POST'])
def create_session() -> Tuple[Any, int]:
    """
    Create a new multi-VOD comparison session.
    
    Request body:
    {
        "vods": [
            {"vod_id": "vod-1", "name": "Player1", "path": "/path/to/vod1.mp4"},
            {"vod_id": "vod-2", "name": "Player2", "path": "/path/to/vod2.mp4"},
            {"vod_id": "vod-3", "name": "Player3", "path": "/path/to/vod3.mp4"}
        ],
        "name": "Optional session name",
        "description": "Optional description"
    }
    
    Response: MultiVodSession (201 Created)
    """
    payload = request.get_json(silent=True) or {}
    
    vods_data = payload.get('vods', [])
    if not vods_data or len(vods_data) < 2 or len(vods_data) > 3:
        return jsonify({
            "ok": False,
            "error": "Must provide 2-3 VODs"
        }), 400
    
    # Extract VOD metadata
    vods = []
    for vod_data in vods_data:
        vod_path = vod_data.get('path', '')
        vod_id = vod_data.get('vod_id', '')
        vod_name = vod_data.get('name', '')
        
        if not vod_path or not vod_id:
            return jsonify({
                "ok": False,
                "error": "Each VOD must have 'path' and 'vod_id'"
            }), 400
        
        # Get VOD metadata
        metadata = _get_vod_metadata(vod_path)
        if not metadata:
            return jsonify({
                "ok": False,
                "error": f"Cannot open VOD: {vod_path}"
            }), 400
        
        vod = MultiVodSessionVod(
            vod_id=vod_id,
            name=vod_name or vod_id,
            path=vod_path,
            **metadata
        )
        vods.append(vod)
    
    try:
        session = MultiVodSessionManager.create_session(
            vods=vods,
            name=payload.get('name', ''),
            description=payload.get('description', ''),
            created_by=payload.get('created_by', 'system'),
        )
        
        return jsonify({
            "ok": True,
            "session": _serialize_session(session)
        }), 201
    
    except Exception as e:
        return jsonify({
            "ok": False,
            "error": str(e)
        }), 500


@multi_vod_bp.route('/<session_id>', methods=['GET'])
def get_session(session_id: str) -> Tuple[Any, int]:
    """
    Fetch full state of a multi-VOD session.
    
    Response: MultiVodSession (200 OK) or error (404)
    """
    session = MultiVodSessionManager.load_session(session_id)
    if not session:
        return jsonify({
            "ok": False,
            "error": "Session not found"
        }), 404
    
    return jsonify({
        "ok": True,
        "session": _serialize_session(session)
    }), 200


@multi_vod_bp.route('/<session_id>', methods=['DELETE'])
def delete_session(session_id: str) -> Tuple[Any, int]:
    """Delete a session."""
    success = MultiVodSessionManager.delete_session(session_id)
    
    if not success:
        return jsonify({
            "ok": False,
            "error": "Session not found"
        }), 404
    
    return jsonify({"ok": True}), 204


@multi_vod_bp.route('/<session_id>/global-seek', methods=['PUT'])
def global_seek(session_id: str) -> Tuple[Any, int]:
    """
    Seek all VODs to same global timestamp (respecting offsets).
    
    Request body:
    {
        "timestamp": 150.5  // seconds
    }
    
    Response: Updated session state
    """
    payload = request.get_json(silent=True) or {}
    timestamp = payload.get('timestamp')
    
    if timestamp is None or timestamp < 0:
        return jsonify({
            "ok": False,
            "error": "Invalid timestamp"
        }), 400
    
    session = MultiVodSessionManager.load_session(session_id)
    if not session:
        return jsonify({
            "ok": False,
            "error": "Session not found"
        }), 404
    
    # Update global time and all VOD times
    session.global_time = timestamp
    session.global_playback_state = "seeking"
    
    for i, vod in enumerate(session.vods):
        # VOD time = global time + offset
        # For VOD 0 (reference), offset is always 0
        # For others, subtract their offset
        vod_time = timestamp - vod.offset
        
        # Clamp to valid range [0, duration]
        vod_time = max(0, min(vod_time, vod.duration))
        
        vod.current_time = vod_time
        vod.playback_state = "seeking"
    
    MultiVodSessionManager.save_session(session)
    
    return jsonify({
        "ok": True,
        "session": _serialize_session(session)
    }), 200


@multi_vod_bp.route('/<session_id>/vods/<vod_id>/seek', methods=['PUT'])
def seek_vod(session_id: str, vod_id: str) -> Tuple[Any, int]:
    """
    Seek a single VOD independently (no global sync).
    
    Request body:
    {
        "timestamp": 150.5  // seconds
    }
    
    Response: Updated session state
    """
    payload = request.get_json(silent=True) or {}
    timestamp = payload.get('timestamp')
    
    if timestamp is None or timestamp < 0:
        return jsonify({
            "ok": False,
            "error": "Invalid timestamp"
        }), 400
    
    session = MultiVodSessionManager.load_session(session_id)
    if not session:
        return jsonify({
            "ok": False,
            "error": "Session not found"
        }), 404
    
    vod = session.get_vod_by_id(vod_id)
    if not vod:
        return jsonify({
            "ok": False,
            "error": "VOD not found"
        }), 404
    
    # Clamp to valid range
    timestamp = max(0, min(timestamp, vod.duration))
    
    vod.current_time = timestamp
    vod.playback_state = "seeking"
    
    # Update global time to match the first VOD that's being independently scrubbed
    # (or keep it at the previously synced time, depending on UX choice)
    # For now, we'll update global_time to this VOD's time minus its offset
    session.global_time = timestamp + vod.offset
    
    MultiVodSessionManager.save_session(session)
    
    return jsonify({
        "ok": True,
        "session": _serialize_session(session)
    }), 200


@multi_vod_bp.route('/<session_id>/offsets', methods=['PUT'])
def update_offsets(session_id: str) -> Tuple[Any, int]:
    """
    Update one or more offsets (batch operation).
    
    Request body:
    {
        "offsets": {
            "vod-1": 0,
            "vod-2": -50,
            "vod-3": 37
        },
        "source": "manual" | "timer_ocr",  // optional, default "manual"
        "confidence": 0.88  // optional, required if source=timer_ocr
    }
    
    Response: Updated session state
    """
    payload = request.get_json(silent=True) or {}
    offsets = payload.get('offsets', {})
    source = payload.get('source', 'manual')
    confidence = payload.get('confidence')
    
    if not isinstance(offsets, dict) or not offsets:
        return jsonify({
            "ok": False,
            "error": "Invalid offsets"
        }), 400
    
    if source == 'timer_ocr' and confidence is None:
        return jsonify({
            "ok": False,
            "error": "confidence required for timer_ocr source"
        }), 400
    
    session = MultiVodSessionManager.batch_update_offsets(
        session_id=session_id,
        offsets=offsets,
        source=source,
        confidence=confidence,
    )
    
    if not session:
        return jsonify({
            "ok": False,
            "error": "Session not found"
        }), 404
    
    return jsonify({
        "ok": True,
        "session": _serialize_session(session)
    }), 200


@multi_vod_bp.route('/<session_id>/offset-history', methods=['GET'])
def get_offset_history(session_id: str) -> Tuple[Any, int]:
    """
    Get audit trail of offset changes.
    
    Query params:
        vod_id (optional): Filter by specific VOD
    
    Response: List of offset history entries
    """
    vod_id = request.args.get('vod_id')
    
    history = MultiVodSessionManager.get_offset_history(
        session_id=session_id,
        vod_id=vod_id,
    )
    
    if history is None:
        return jsonify({
            "ok": False,
            "error": "Session not found"
        }), 404
    
    return jsonify({
        "ok": True,
        "history": history
    }), 200


@multi_vod_bp.route('/list', methods=['GET'])
def list_sessions() -> Tuple[Any, int]:
    """
    List all comparison sessions for authenticated user.
    
    Query params:
        limit (default 20): Max results
        offset (default 0): Pagination offset
        created_by (optional): Filter by user
    
    Response: List of session summaries
    """
    limit = int(request.args.get('limit', 20))
    offset_param = int(request.args.get('offset', 0))
    created_by = request.args.get('created_by')
    
    sessions = MultiVodSessionManager.list_sessions(
        created_by=created_by,
        limit=limit,
        offset=offset_param,
    )
    
    return jsonify({
        "ok": True,
        "sessions": sessions
    }), 200
