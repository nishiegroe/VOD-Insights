"""
OCR Timer Detection Service
Detects and reads in-game timers from video frames for multi-VOD synchronization
"""

import cv2
import numpy as np
import easyocr
import re
from typing import Tuple, Dict, Optional, List
from pathlib import Path


class TimerDetector:
    """Base timer detector for games"""

    def __init__(self):
        self.reader = None
        self._init_ocr()

    def _init_ocr(self):
        """Initialize OCR reader"""
        if self.reader is None:
            self.reader = easyocr.Reader(["en"], gpu=False, verbose=False)

    def extract_timer_from_frame(
        self, image_data: np.ndarray
    ) -> Tuple[Optional[str], float]:
        """
        Extract timer value from video frame

        Args:
            image_data: numpy array representing the video frame (BGR format)

        Returns:
            Tuple of (timer_string, confidence_score)
            Example: ("14:32", 0.95)
        """
        raise NotImplementedError("Subclass must implement extract_timer_from_frame")

    def detect_timer_region(self, image_data: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
        """
        Find the region of interest (timer area) in frame
        Returns: (x, y, width, height) or None
        """
        raise NotImplementedError("Subclass must implement detect_timer_region")

    def parse_timer_string(self, text: str) -> Optional[str]:
        """
        Parse OCR output and extract timer value
        Handles formats: MM:SS, MM:SS:MS, etc.
        """
        # Remove whitespace and special characters
        cleaned = text.strip().replace(" ", "").replace(",", "")

        # Match timer patterns
        # Try MM:SS:MS format first
        match = re.search(r"(\d{1,2}):(\d{2}):(\d{2})", cleaned)
        if match:
            m, s, ms = match.groups()
            return f"{m}:{s}:{ms}"

        # Try MM:SS format
        match = re.search(r"(\d{1,2}):(\d{2})", cleaned)
        if match:
            m, s = match.groups()
            return f"{m}:{s}"

        # Try HH:MM:SS format
        match = re.search(r"(\d{1,2}):(\d{1,2}):(\d{2})", cleaned)
        if match:
            h, m, s = match.groups()
            return f"{h}:{m}:{s}"

        return None

    def _calculate_confidence(self, ocr_result: List) -> float:
        """Calculate confidence score from OCR results"""
        if not ocr_result:
            return 0.0

        # Average confidence of all detected text boxes
        confidences = [detection[2] for detection in ocr_result if len(detection) > 2]
        if not confidences:
            return 0.0

        return float(np.mean(confidences))


class ApexLegendTimerDetector(TimerDetector):
    """Timer detector for Apex Legends (bottom-left timer under minimap)"""

    def __init__(self):
        super().__init__()
        self.timer_region = None  # Will be auto-detected

    def detect_timer_region(self, image_data: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
        """
        Detect timer location in Apex Legends
        Typically appears at bottom-left under minimap
        """
        height, width = image_data.shape[:2]

        # Timer is typically in bottom-left quadrant
        # Minimap is ~200x200 pixels in bottom-left
        # Timer is usually below/right of minimap

        # Define region: left 20%, bottom 20%
        x1 = int(width * 0.0)
        y1 = int(height * 0.75)
        x2 = int(width * 0.25)
        y2 = int(height * 1.0)

        return (x1, y1, x2 - x1, y2 - y1)

    def extract_timer_from_frame(
        self, image_data: np.ndarray
    ) -> Tuple[Optional[str], float]:
        """
        Extract Apex Legends timer from frame
        Timer format: MM:SS
        """
        if image_data is None or image_data.size == 0:
            return None, 0.0

        try:
            # Get timer region
            region = self.detect_timer_region(image_data)
            if not region:
                return None, 0.0

            x, y, w, h = region
            roi = image_data[y : y + h, x : x + w]

            if roi.size == 0:
                return None, 0.0

            # Preprocess image for better OCR
            roi_gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

            # Enhance contrast
            roi_enhanced = cv2.equalizeHist(roi_gray)

            # Thresholding (timers are usually white/bright text)
            _, roi_binary = cv2.threshold(roi_enhanced, 200, 255, cv2.THRESH_BINARY)

            # Run OCR
            ocr_result = self.reader.readtext(roi_binary, detail=1)

            if not ocr_result:
                return None, 0.0

            # Extract timer string
            for detection in ocr_result:
                text = detection[1]
                confidence = detection[2]

                # Try to parse timer
                timer = self.parse_timer_string(text)
                if timer:
                    return timer, confidence

            # If no timer found, return best match
            if ocr_result:
                best_text = ocr_result[0][1]
                timer = self.parse_timer_string(best_text)
                avg_confidence = self._calculate_confidence(ocr_result)
                return timer, avg_confidence

            return None, 0.0

        except Exception as e:
            print(f"Error extracting timer: {e}")
            return None, 0.0


class ValorantTimerDetector(TimerDetector):
    """Timer detector for Valorant (center-bottom timer)"""

    def detect_timer_region(self, image_data: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
        """
        Detect timer location in Valorant
        Typically centered at bottom of screen
        """
        height, width = image_data.shape[:2]

        # Valorant timer is centered horizontally, bottom area
        # Timer width ~100px, positioned bottom-center
        center_x = width // 2
        timer_width = 100
        timer_height = 40

        x1 = center_x - timer_width // 2
        y1 = int(height * 0.92)
        x2 = center_x + timer_width // 2
        y2 = int(height * 1.0)

        return (max(0, x1), max(0, y1), x2 - x1, y2 - y1)

    def extract_timer_from_frame(
        self, image_data: np.ndarray
    ) -> Tuple[Optional[str], float]:
        """Extract Valorant timer from frame"""
        if image_data is None or image_data.size == 0:
            return None, 0.0

        try:
            region = self.detect_timer_region(image_data)
            if not region:
                return None, 0.0

            x, y, w, h = region
            roi = image_data[y : y + h, x : x + w]

            if roi.size == 0:
                return None, 0.0

            # Preprocess
            roi_gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
            roi_enhanced = cv2.equalizeHist(roi_gray)
            _, roi_binary = cv2.threshold(roi_enhanced, 200, 255, cv2.THRESH_BINARY)

            # OCR
            ocr_result = self.reader.readtext(roi_binary, detail=1)

            if not ocr_result:
                return None, 0.0

            for detection in ocr_result:
                text = detection[1]
                confidence = detection[2]
                timer = self.parse_timer_string(text)
                if timer:
                    return timer, confidence

            return None, self._calculate_confidence(ocr_result)

        except Exception as e:
            print(f"Error extracting Valorant timer: {e}")
            return None, 0.0


# Global detector instance cache
_detector_cache = {}


def get_timer_detector(game_name: str = "apex") -> TimerDetector:
    """
    Get appropriate timer detector for game

    Args:
        game_name: Game identifier ('apex', 'valorant', etc.)

    Returns:
        TimerDetector instance
    """
    game_name = game_name.lower()

    if game_name not in _detector_cache:
        if game_name == "apex":
            _detector_cache[game_name] = ApexLegendTimerDetector()
        elif game_name == "valorant":
            _detector_cache[game_name] = ValorantTimerDetector()
        else:
            # Default to Apex
            _detector_cache[game_name] = ApexLegendTimerDetector()

    return _detector_cache[game_name]


def extract_frame_from_video(
    video_path: str, timestamp_seconds: float
) -> Optional[np.ndarray]:
    """
    Extract single frame from video at given timestamp

    Args:
        video_path: Path to video file
        timestamp_seconds: Timestamp in seconds

    Returns:
        Numpy array (BGR format) or None
    """
    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return None

        # Set position
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_num = int(timestamp_seconds * fps)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)

        ret, frame = cap.read()
        cap.release()

        return frame if ret else None

    except Exception as e:
        print(f"Error extracting frame: {e}")
        return None


def detect_timer_in_video(
    video_path: str, timestamp_seconds: float, game_name: str = "apex"
) -> Dict[str, any]:
    """
    Detect timer in video at given timestamp

    Args:
        video_path: Path to video file
        timestamp_seconds: Timestamp in seconds
        game_name: Game identifier

    Returns:
        Dictionary with timer info:
        {
            'timer': '14:32' or None,
            'confidence': 0.95,
            'region': (x, y, w, h),
            'success': True
        }
    """
    try:
        # Extract frame
        frame = extract_frame_from_video(video_path, timestamp_seconds)
        if frame is None:
            return {"timer": None, "confidence": 0.0, "success": False}

        # Get detector
        detector = get_timer_detector(game_name)

        # Extract timer
        timer, confidence = detector.extract_timer_from_frame(frame)

        # Get region
        region = detector.detect_timer_region(frame)
        region_tuple = region if region else None

        return {
            "timer": timer,
            "confidence": confidence,
            "region": region_tuple,
            "success": timer is not None and confidence > 0.5,
        }

    except Exception as e:
        print(f"Error detecting timer: {e}")
        return {"timer": None, "confidence": 0.0, "success": False}
