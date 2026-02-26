"""
OCR Sync API Routes
Endpoints for detecting timers and synchronizing multiple VODs
"""

from flask import Blueprint, request, jsonify
from pathlib import Path
import logging
from app.ocr_timer_detector import detect_timer_in_video, get_timer_detector

logger = logging.getLogger(__name__)

ocr_sync_bp = Blueprint("ocr_sync", __name__, url_prefix="/api/ocr")


@ocr_sync_bp.route("/detect-timer", methods=["POST"])
def detect_timer():
    """
    Detect timer in video at given timestamp

    Request JSON:
    {
        "vod_path": "/path/to/vod.mp4",
        "timestamp": 245.5,
        "game": "apex"  // optional, defaults to apex
    }

    Response:
    {
        "success": true,
        "timer": "14:32",
        "confidence": 0.95,
        "region": [x, y, w, h],
        "timestamp": 245.5,
        "processing_time_ms": 450
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({"success": False, "error": "No JSON data provided"}), 400

        vod_path = data.get("vod_path")
        timestamp = data.get("timestamp", 0)
        game = data.get("game", "apex")

        if not vod_path:
            return jsonify({"success": False, "error": "vod_path is required"}), 400

        # Validate file exists
        if not Path(vod_path).exists():
            return jsonify({"success": False, "error": f"File not found: {vod_path}"}), 404

        # Detect timer
        result = detect_timer_in_video(vod_path, timestamp, game)

        # Format response
        response = {
            "success": result["success"],
            "timer": result["timer"],
            "confidence": round(result["confidence"], 3),
            "timestamp": timestamp,
            "game": game,
        }

        if result["region"]:
            x, y, w, h = result["region"]
            response["region"] = {"x": x, "y": y, "width": w, "height": h}

        if not result["success"]:
            response["error"] = "Could not detect timer in frame"

        return jsonify(response), 200

    except Exception as e:
        logger.error(f"Error in detect_timer: {e}")
        return (
            jsonify({"success": False, "error": str(e)}),
            500,
        )


@ocr_sync_bp.route("/sync-vods", methods=["POST"])
def sync_vods():
    """
    Detect timers in two VODs and calculate sync offset

    Request JSON:
    {
        "primary_vod_path": "/path/to/vod1.mp4",
        "secondary_vod_path": "/path/to/vod2.mp4",
        "primary_timestamp": 245.5,
        "secondary_timestamp": 245.5,
        "game": "apex"
    }

    Response:
    {
        "success": true,
        "primary_timer": "14:32",
        "secondary_timer": "14:32",
        "sync_offset_ms": 2000,
        "confidence": 0.92,
        "timers_match": true
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({"success": False, "error": "No JSON data provided"}), 400

        primary_path = data.get("primary_vod_path")
        secondary_path = data.get("secondary_vod_path")
        primary_ts = data.get("primary_timestamp", 0)
        secondary_ts = data.get("secondary_timestamp", 0)
        game = data.get("game", "apex")

        if not primary_path or not secondary_path:
            return (
                jsonify(
                    {"success": False, "error": "primary_vod_path and secondary_vod_path are required"}
                ),
                400,
            )

        # Validate files exist
        if not Path(primary_path).exists():
            return (
                jsonify({"success": False, "error": f"File not found: {primary_path}"}),
                404,
            )
        if not Path(secondary_path).exists():
            return (
                jsonify({"success": False, "error": f"File not found: {secondary_path}"}),
                404,
            )

        # Detect timers in both VODs
        primary_result = detect_timer_in_video(primary_path, primary_ts, game)
        secondary_result = detect_timer_in_video(secondary_path, secondary_ts, game)

        primary_timer = primary_result["timer"]
        secondary_timer = secondary_result["timer"]
        primary_conf = primary_result["confidence"]
        secondary_conf = secondary_result["confidence"]

        # Calculate sync offset if timers match
        sync_offset = None
        timers_match = False

        if primary_timer and secondary_timer:
            # Parse timer strings to seconds
            def timer_to_seconds(timer_str):
                parts = timer_str.split(":")
                total = 0
                for i, part in enumerate(parts):
                    total = total * 60 + int(part)
                return total

            try:
                primary_seconds = timer_to_seconds(primary_timer)
                secondary_seconds = timer_to_seconds(secondary_timer)

                # Timers match if within 2 seconds
                if abs(primary_seconds - secondary_seconds) <= 2:
                    timers_match = True
                    # Calculate offset: how many seconds does secondary need to be shifted?
                    sync_offset = (secondary_seconds - primary_seconds) * 1000  # Convert to ms

            except ValueError:
                timers_match = False

        # Average confidence
        avg_confidence = (primary_conf + secondary_conf) / 2

        response = {
            "success": timers_match,
            "primary_timer": primary_timer,
            "secondary_timer": secondary_timer,
            "primary_confidence": round(primary_conf, 3),
            "secondary_confidence": round(secondary_conf, 3),
            "timers_match": timers_match,
            "sync_offset_ms": sync_offset,
            "average_confidence": round(avg_confidence, 3),
        }

        return jsonify(response), 200

    except Exception as e:
        logger.error(f"Error in sync_vods: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@ocr_sync_bp.route("/supported-games", methods=["GET"])
def supported_games():
    """Get list of supported games for timer detection"""
    return (
        jsonify(
            {
                "supported_games": [
                    {
                        "name": "apex",
                        "display_name": "Apex Legends",
                        "timer_location": "Bottom-left (under minimap)",
                        "timer_format": "MM:SS",
                    },
                    {
                        "name": "valorant",
                        "display_name": "Valorant",
                        "timer_location": "Center-bottom",
                        "timer_format": "MM:SS",
                    },
                ]
            }
        ),
        200,
    )


@ocr_sync_bp.route("/health", methods=["GET"])
def health():
    """Health check for OCR service"""
    try:
        # Try to load a detector to verify OCR is working
        detector = get_timer_detector("apex")
        return jsonify({"status": "healthy", "ocr_ready": True}), 200
    except Exception as e:
        return (
            jsonify({"status": "unhealthy", "ocr_ready": False, "error": str(e)}),
            503,
        )
