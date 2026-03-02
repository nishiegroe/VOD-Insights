"""
Multi-VOD Session Models

Defines the data structures for multi-VOD comparison sessions.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Any, Dict, List, Optional


@dataclass
class VodOffsetHistoryEntry:
    """Audit trail entry for offset changes."""
    timestamp: float  # Unix timestamp (seconds)
    old_offset: float
    new_offset: float
    source: str  # "manual" | "timer_ocr"
    confidence: Optional[float] = None  # Only for timer_ocr
    changed_by: str = "system"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> VodOffsetHistoryEntry:
        """Create from dictionary."""
        return cls(**data)


@dataclass
class MultiVodSessionVod:
    """Single VOD within a multi-VOD session."""
    vod_id: str  # Foreign key to existing VOD
    name: str  # Friendly name
    path: str  # File path
    
    # Metadata (computed once at session creation)
    duration: float  # seconds
    fps: float
    resolution: str  # "1920x1080" etc.
    codec: str  # "h264", etc.
    filesize_mb: float
    
    # Timing
    offset: float = 0.0  # seconds, relative to VOD 0 (reference VOD)
    offset_confidence: float = 1.0  # 1.0 if manual, <1.0 if from OCR
    offset_source: str = "manual"  # "manual" | "timer_ocr"
    offset_set_at: float = field(default_factory=lambda: datetime.now().timestamp())
    offset_history: List[VodOffsetHistoryEntry] = field(default_factory=list)
    
    # Playback state (ephemeral, not persisted)
    current_time: float = 0.0  # seconds
    playback_state: str = "paused"  # "playing" | "paused" | "seeking"
    
    # Events inherited from VOD
    events: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        data = asdict(self)
        data['offset_history'] = [h.to_dict() if isinstance(h, VodOffsetHistoryEntry) else h 
                                  for h in self.offset_history]
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> MultiVodSessionVod:
        """Create from dictionary."""
        # Convert offset_history entries
        history = data.pop('offset_history', [])
        offset_history = [
            VodOffsetHistoryEntry.from_dict(h) if isinstance(h, dict) else h
            for h in history
        ]
        
        vod = cls(**data)
        vod.offset_history = offset_history
        return vod


@dataclass
class MultiVodSession:
    """Multi-VOD Comparison Session State."""
    
    # Session Metadata
    session_id: str = field(default_factory=lambda: f"comp-{uuid.uuid4().hex[:8]}")
    name: str = ""
    description: str = ""
    created_at: float = field(default_factory=lambda: datetime.now().timestamp())
    updated_at: float = field(default_factory=lambda: datetime.now().timestamp())
    created_by: str = "system"
    
    # VOD References
    vods: List[MultiVodSessionVod] = field(default_factory=list)
    
    # Synchronization Control
    sync_mode: str = "global"  # "independent" | "global"
    sync_config: Dict[str, Any] = field(default_factory=lambda: {
        "shared_clock_enabled": True,
        "clock_sync_interval_ms": 500,
        "drift_tolerance_ms": 100,
        "speed": 1.0,
    })
    
    # Global Playback State
    global_time: float = 0.0  # Current position in seconds
    global_playback_state: str = "paused"  # "playing" | "paused"
    playback_started_at: float = field(default_factory=lambda: datetime.now().timestamp())
    
    # UI & UX State
    ui_state: Dict[str, Any] = field(default_factory=lambda: {
        "focused_vod_index": 0,
        "layout": "3-col",  # "3-col" | "2-col-main" | "pip"
        "show_event_markers": True,
        "show_offset_indicators": True,
        "player_volume": [1.0, 1.0, 1.0],
    })
    
    # Phase 2 Auto-Sync Results (optional, only if Phase 2 completed)
    auto_sync_result: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        data = asdict(self)
        data['vods'] = [v.to_dict() if isinstance(v, MultiVodSessionVod) else v 
                        for v in self.vods]
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> MultiVodSession:
        """Create from dictionary."""
        # Convert VOD objects
        vods_data = data.pop('vods', [])
        vods = [
            MultiVodSessionVod.from_dict(v) if isinstance(v, dict) else v
            for v in vods_data
        ]
        
        session = cls(**data)
        session.vods = vods
        return session
    
    def get_vod_by_id(self, vod_id: str) -> Optional[MultiVodSessionVod]:
        """Get VOD by ID."""
        for vod in self.vods:
            if vod.vod_id == vod_id:
                return vod
        return None
    
    def get_vod_by_index(self, index: int) -> Optional[MultiVodSessionVod]:
        """Get VOD by index."""
        if 0 <= index < len(self.vods):
            return self.vods[index]
        return None
    
    def validate(self) -> tuple[bool, str]:
        """Validate session state. Returns (is_valid, error_message)."""
        if len(self.vods) < 2 or len(self.vods) > 3:
            return False, "Session must have 2-3 VODs"
        
        for i, vod in enumerate(self.vods):
            if not vod.path or not vod.vod_id:
                return False, f"VOD {i} missing path or ID"
            if vod.duration <= 0:
                return False, f"VOD {i} has invalid duration"
        
        return True, ""
