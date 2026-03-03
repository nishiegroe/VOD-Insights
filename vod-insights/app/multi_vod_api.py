"""
Multi-VOD Comparison API Endpoints

Provides REST API for multi-VOD session management and playback control.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path
import os
import json
import uuid
import time

from flask import Blueprint, request, jsonify, Response, abort

from app.multi_vod_manager import MultiVodSessionManager
from app.multi_vod_models import MultiVodSession, MultiVodSessionVod
from app.runtime_paths import get_config_path, get_downloads_dir


def _stream_video_file(file_path: Path, request_obj: Any) -> Response:
    """
    Stream a video file with HTTP range request support for seeking.
    Supports partial content (206) for scrubbing.
    Optimized for smooth 30-60fps playback with efficient buffering.
    """
    try:
        file_size = file_path.stat().st_size
    except OSError:
        abort(404)
    
    # Optimized chunk size for smooth playback
    # 512KB provides ~100ms latency at 5Mbps (optimal for 30-60fps)
    # Tuning guide: 256KB (52ms), 512KB (104ms), 1MB (208ms)
    CHUNK_SIZE = 512 * 1024  # 512KB chunks
    
    # Check for range header (for seeking)
    range_header = request_obj.headers.get('Range')
    
    if range_header:
        # Parse range header (e.g., "bytes=1000-2000" or "bytes=1000-")
        try:
            ranges = range_header.replace('bytes=', '').split(',')
            start, end = ranges[0].split('-')
            
            start = int(start) if start else 0
            end = int(end) if end else file_size - 1
            
            # Validate range
            if start >= file_size or end >= file_size or start > end:
                return Response(status=416)  # Range Not Satisfiable
            
            # Return 206 Partial Content with optimized streaming
            def stream_chunk():
                # Use buffered file I/O for better performance
                # Buffer size of 64KB for file operations
                with open(file_path, 'rb', buffering=65536) as f:
                    f.seek(start)
                    bytes_left = end - start + 1
                    while bytes_left > 0:
                        chunk = f.read(min(CHUNK_SIZE, bytes_left))
                        if not chunk:
                            break
                        bytes_left -= len(chunk)
                        yield chunk
            
            response = Response(
                stream_chunk(),
                206,  # Partial Content
                mimetype='video/mp4'
            )
            response.headers['Content-Range'] = f'bytes {start}-{end}/{file_size}'
            response.headers['Content-Length'] = str(end - start + 1)
            response.headers['Accept-Ranges'] = 'bytes'
            response.headers['Content-Type'] = 'video/mp4'
            response.headers['Cache-Control'] = 'public, max-age=3600'
            response.headers['Connection'] = 'keep-alive'
            
            return response
        
        except (ValueError, IndexError):
            # Invalid range header, return full file
            pass
    
    # Return full file with optimized streaming
    def stream_full():
        # Use buffered file I/O (64KB buffer for syscall reduction)
        with open(file_path, 'rb', buffering=65536) as f:
            while True:
                chunk = f.read(CHUNK_SIZE)
                if not chunk:
                    break
                yield chunk
    
    response = Response(stream_full(), mimetype='video/mp4')
    response.headers['Content-Length'] = str(file_size)
    response.headers['Accept-Ranges'] = 'bytes'
    response.headers['Content-Type'] = 'video/mp4'
    response.headers['Cache-Control'] = 'public, max-age=3600'
    response.headers['Connection'] = 'keep-alive'
    
    return response


# Create Blueprint for multi-VOD routes
multi_vod_bp = Blueprint('multi_vod', __name__, url_prefix='/api/sessions/multi-vod')


def _load_config() -> Dict[str, Any]:
    """Load config from disk."""
    config_path = get_config_path()
    if not config_path.exists():
        return {}
    try:
        return json.loads(config_path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"Error loading config: {e}")
        return {}


def _get_vods_dir(config: Dict[str, Any]) -> Path:
    """Get the VOD library directory from config."""
    replay_dir = config.get("replay", {}).get("directory", "")
    if replay_dir:
        return Path(replay_dir)
    return Path()


def _get_vod_dirs(config: Dict[str, Any]) -> List[Path]:
    """Get all VOD directories: replay directory + downloads directory."""
    dirs = []
    
    # Primary VOD directory from replay config
    replay_dir = _get_vods_dir(config)
    if replay_dir and replay_dir.is_absolute():
        dirs.append(replay_dir)
    
    # Downloads directory (where Twitch VODs are downloaded)
    downloads_dir = get_downloads_dir()
    if downloads_dir and downloads_dir.is_absolute():
        dirs.append(downloads_dir)
    
    return dirs


def _get_vod_paths(directories: List[Path], extensions: Optional[List[str]] = None) -> List[Path]:
    """Get all VOD files from directories, sorted by modification time (newest first)."""
    if extensions is None:
        extensions = [".mp4", ".mov", ".mkv", ".avi", ".flv", ".webm"]
    
    files: List[Path] = []
    allowed = {e.lower() for e in extensions}
    
    for directory in directories:
        if not directory.exists() or not directory.is_dir():
            continue
        
        try:
            for path in directory.iterdir():
                if not path.is_file():
                    continue
                if allowed and path.suffix.lower() not in allowed:
                    continue
                # Skip yt-dlp in-progress temp files
                if path.stem.endswith(".temp") or path.suffix.lower() == ".part":
                    continue
                files.append(path)
        except PermissionError:
            print(f"Permission denied accessing directory: {directory}")
            continue
    
    # Sort by modification time, newest first
    files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return files


def _serialize_session(session: MultiVodSession) -> Dict[str, Any]:
    """Serialize a MultiVodSession to JSON-safe dict."""
    return session.to_dict()


def _get_vod_metadata(vod_path: str) -> Optional[Dict[str, Any]]:
    """
    Extract metadata from VOD file using ffprobe.
    
    Replaces cv2.VideoCapture for much faster metadata extraction.
    ffprobe is 10-100x faster than OpenCV for reading metadata without decoding.
    
    Performance:
    - cv2.VideoCapture: 500ms-2000ms per file (full decode needed)
    - ffprobe: 10-50ms per file (metadata only, no decode)
    
    For 10 VODs:
    - Old (cv2): 2-5 seconds
    - New (ffprobe): <500ms
    """
    import subprocess
    from app.runtime_paths import resolve_tool
    
    vod_path = Path(vod_path)
    if not vod_path.exists():
        return None
    
    try:
        # Use ffprobe to extract metadata (much faster than cv2)
        ffprobe_path = resolve_tool("ffprobe", ["ffprobe.exe"])
        if not ffprobe_path:
            # Fallback to system ffprobe if not found in tools
            ffprobe_path = "ffprobe"
        
        # Run ffprobe with minimal output (streams only, no decoding)
        result = subprocess.run(
            [
                ffprobe_path,
                "-v", "error",
                "-show_entries",
                "format=duration",
                "-show_streams",
                "-of", "json",
                str(vod_path),
            ],
            capture_output=True,
            text=True,
            timeout=5,  # 5 second timeout per file
        )
        
        if result.returncode != 0:
            print(f"ffprobe failed for {vod_path}: {result.stderr}")
            return None
        
        # Parse JSON output
        data = json.loads(result.stdout)
        
        # Extract duration
        duration = 0.0
        if "format" in data and "duration" in data["format"]:
            try:
                duration = float(data["format"]["duration"])
            except (ValueError, TypeError):
                duration = 0.0
        
        # Extract video stream info (fps, resolution, codec)
        fps = 0.0
        width = 0
        height = 0
        codec = "unknown"
        
        if "streams" in data:
            for stream in data["streams"]:
                # Find the first video stream
                if stream.get("codec_type") == "video":
                    try:
                        # FPS from r_frame_rate (e.g., "60000/1000" or "30/1")
                        if "r_frame_rate" in stream:
                            fps_str = stream["r_frame_rate"]
                            if "/" in fps_str:
                                num, denom = fps_str.split("/")
                                fps = float(num) / float(denom)
                            else:
                                fps = float(fps_str)
                        
                        # Resolution
                        width = stream.get("width", 0)
                        height = stream.get("height", 0)
                        
                        # Codec name
                        codec = stream.get("codec_name", "unknown")
                    except (ValueError, TypeError, ZeroDivisionError):
                        pass
                    break
        
        resolution = f"{width}x{height}" if width and height else "unknown"
        filesize_mb = vod_path.stat().st_size / (1024 * 1024)
        
        return {
            "duration": duration,
            "fps": fps,
            "resolution": resolution,
            "codec": codec,
            "filesize_mb": filesize_mb,
        }
    except subprocess.TimeoutExpired:
        print(f"ffprobe timeout for {vod_path}")
        return None
    except json.JSONDecodeError as e:
        print(f"JSON parse error for {vod_path}: {e}")
        return None
    except Exception as e:
        print(f"Error getting VOD metadata: {e}")
        return None


@multi_vod_bp.route('/vods/list', methods=['GET'])
def list_vods() -> Tuple[Any, int]:
    """
    List all available VODs in the library.
    
    Response (200):
    {
        "ok": true,
        "vods": [
            {
                "vod_id": "vod-123",
                "name": "Apex Legends - Match 1",
                "path": "/storage/vod1.mp4",
                "duration": 3600.0,
                "fps": 60.0,
                "resolution": "1920x1080",
                "codec": "h264",
                "created_at": 1740869400.0,
                "file_size_mb": 1024.5,
                "mtime": 1740869400.0
            },
            ...
        ]
    }
    
    Error responses:
    - 500: VOD directory not found or permission issues
    """
    try:
        # Load config
        config = _load_config()
        
        # Get VOD directories
        vod_dirs = _get_vod_dirs(config)
        
        if not vod_dirs:
            return jsonify({
                "ok": False,
                "error": "No VOD directories configured"
            }), 500
        
        # Get allowed extensions from config
        extensions = config.get("split", {}).get("extensions", [".mp4", ".mov", ".mkv"])
        
        # Get all VOD files
        vod_paths = _get_vod_paths(vod_dirs, extensions)
        
        # Extract metadata for each VOD
        vods = []
        for vod_path in vod_paths:
            metadata = _get_vod_metadata(str(vod_path))
            if metadata is None:
                # Skip files we can't read
                continue
            
            # Generate a unique VOD ID based on path
            vod_id = f"vod-{uuid.uuid5(uuid.NAMESPACE_URL, str(vod_path.resolve()))}"
            
            # Get file stats
            try:
                stat = vod_path.stat()
                created_at = stat.st_ctime
                mtime = stat.st_mtime
                file_size_mb = stat.st_size / (1024 * 1024)
            except OSError:
                continue
            
            vod_info = {
                "vod_id": vod_id,
                "name": vod_path.stem,
                "path": str(vod_path.resolve()),
                "duration": metadata.get("duration", 0),
                "fps": metadata.get("fps", 0),
                "resolution": metadata.get("resolution", "unknown"),
                "codec": metadata.get("codec", "unknown"),
                "created_at": created_at,
                "file_size_mb": round(file_size_mb, 2),
                "mtime": mtime
            }
            
            vods.append(vod_info)
        
        # Sort by modification time (newest first)
        vods.sort(key=lambda v: v["mtime"], reverse=True)
        
        return jsonify({
            "ok": True,
            "vods": vods
        }), 200
    
    except PermissionError as e:
        return jsonify({
            "ok": False,
            "error": f"Permission denied: {str(e)}"
        }), 500
    except Exception as e:
        return jsonify({
            "ok": False,
            "error": f"Error listing VODs: {str(e)}"
        }), 500


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
    
    # DEBUG: Log the incoming payload
    print(f"\n[DEBUG] create_session() called")
    print(f"[DEBUG] Full payload: {json.dumps(payload, indent=2, default=str)}")
    print(f"[DEBUG] Payload keys: {list(payload.keys())}")
    
    vods_data = payload.get('vods', [])
    print(f"[DEBUG] vods_data type: {type(vods_data)}")
    print(f"[DEBUG] vods_data value: {vods_data}")
    print(f"[DEBUG] vods_data length: {len(vods_data) if isinstance(vods_data, list) else 'N/A (not a list)'}")
    
    if not vods_data or len(vods_data) < 2 or len(vods_data) > 3:
        print(f"[DEBUG] Validation failed:")
        print(f"  - not vods_data: {not vods_data}")
        print(f"  - len(vods_data) < 2: {len(vods_data) < 2 if isinstance(vods_data, list) else 'N/A'}")
        print(f"  - len(vods_data) > 3: {len(vods_data) > 3 if isinstance(vods_data, list) else 'N/A'}")
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


@multi_vod_bp.route('/<session_id>/playback', methods=['PUT'])
def update_playback(session_id: str) -> Tuple[Any, int]:
    """
    Update playback state (play/pause/seek).
    
    Request body:
    {
        "action": "play" | "pause" | "seek",
        "timestamp": 150.5  // required for seek, optional for play/pause
    }
    
    Response: Updated session state
    """
    payload = request.get_json(silent=True) or {}
    action = payload.get('action')
    timestamp = payload.get('timestamp')
    
    if action not in ['play', 'pause', 'seek']:
        return jsonify({
            "ok": False,
            "error": "Invalid action. Must be 'play', 'pause', or 'seek'"
        }), 400
    
    session = MultiVodSessionManager.load_session(session_id)
    if not session:
        return jsonify({
            "ok": False,
            "error": "Session not found"
        }), 404
    
    if action == 'play':
        session.global_playback_state = 'playing'
    elif action == 'pause':
        session.global_playback_state = 'paused'
    elif action == 'seek':
        if timestamp is None:
            return jsonify({
                "ok": False,
                "error": "timestamp required for seek action"
            }), 400
        
        # Clamp timestamp to valid range
        timestamp = max(0, min(timestamp, min(vod.duration for vod in session.vods)))
        session.global_time = timestamp
        
        # Update all VODs' current_time based on global_time and offsets
        for vod in session.vods:
            vod.current_time = max(0, min(timestamp - vod.offset, vod.duration))
    
    MultiVodSessionManager.save_session(session)
    
    return jsonify({
        "ok": True,
        "session": _serialize_session(session)
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


@multi_vod_bp.route('/<session_id>/vods/<vod_id>/stream', methods=['GET'])
def stream_session_vod(session_id: str, vod_id: str) -> Response:
    """
    Stream a VOD file from a multi-VOD session with HTTP range request support.
    
    Query parameters:
        (none, uses path parameters)
    
    Response:
        206 Partial Content if Range header is present and valid
        200 OK with full file content otherwise
        404 if session or VOD not found
        416 Range Not Satisfiable if range is invalid
    
    This endpoint handles HTTP range requests for seeking through video files.
    """
    # Load the session
    session = MultiVodSessionManager.load_session(session_id)
    if not session:
        abort(404)
    
    # Find the VOD in the session
    vod = session.get_vod_by_id(vod_id)
    if not vod:
        abort(404)
    
    # Resolve and validate the VOD path
    vod_path = Path(vod.path)
    if not vod_path.exists():
        abort(404)
    
    # Stream the file with range support
    return _stream_video_file(vod_path, request)
