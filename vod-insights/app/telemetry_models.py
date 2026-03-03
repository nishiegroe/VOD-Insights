"""
Telemetry Models - Playback Metrics and Session Analytics

Defines data structures for recording and analyzing video playback telemetry.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Any, Dict, List, Optional


@dataclass
class PlaybackEvent:
    """Single playback event (play, pause, seek, rate change, etc.)."""
    event_type: str  # "play" | "pause" | "seek" | "rate_change" | "volume_change" | "error"
    timestamp: float  # Unix timestamp (seconds)
    timestamp_in_video: float  # Current position in video when event occurred (seconds)
    session_elapsed_ms: float  # Time since session start (milliseconds)
    vod_id: str  # Which VOD this event relates to
    
    # Event-specific data
    data: Dict[str, Any] = field(default_factory=dict)
    # For "seek": {"from": 10.5, "to": 20.3, "duration_ms": 145}
    # For "rate_change": {"from": 1.0, "to": 2.0}
    # For "play"/"pause": {}
    # For "error": {"code": "CODEC_NOT_SUPPORTED", "message": "..."}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> PlaybackEvent:
        """Create from dictionary."""
        return cls(**data)


@dataclass
class PlaybackSession:
    """Complete record of a playback session with all events and metrics."""
    session_id: str
    vod_id: str
    started_at: float  # Unix timestamp (seconds)
    ended_at: Optional[float] = None  # Unix timestamp, or None if still playing
    
    # Playback metrics
    duration_seconds: float = 0.0  # Total duration of video
    watch_time_ms: float = 0.0  # Total time user watched (excluding pauses/seeks)
    watch_time_percentage: float = 0.0  # watch_time / duration as percentage
    
    # Position tracking
    max_position_reached: float = 0.0  # Furthest position watched (seconds)
    final_position: float = 0.0  # Final position when session ended (seconds)
    
    # Interaction metrics
    total_seeks: int = 0
    total_pauses: int = 0
    total_plays: int = 0
    total_rate_changes: int = 0
    total_volume_changes: int = 0
    total_errors: int = 0
    
    # Events
    events: List[PlaybackEvent] = field(default_factory=list)
    
    # Heatmap: tracks which sections of video are rewatched
    # Maps time ranges to rewatch count
    rewatch_heatmap: Dict[float, int] = field(default_factory=dict)  # {seconds: count}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        data = asdict(self)
        data['events'] = [e.to_dict() if isinstance(e, PlaybackEvent) else e 
                          for e in self.events]
        data['rewatch_heatmap'] = dict(self.rewatch_heatmap)
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> PlaybackSession:
        """Create from dictionary."""
        events_data = data.pop('events', [])
        events = [
            PlaybackEvent.from_dict(e) if isinstance(e, dict) else e
            for e in events_data
        ]
        
        heatmap = data.pop('rewatch_heatmap', {})
        # Convert string keys to floats if necessary
        heatmap = {float(k): v for k, v in heatmap.items()}
        
        session = cls(**data)
        session.events = events
        session.rewatch_heatmap = heatmap
        return session
    
    def add_event(self, event: PlaybackEvent) -> None:
        """Add a playback event and update metrics."""
        self.events.append(event)
        
        if event.event_type == "play":
            self.total_plays += 1
        elif event.event_type == "pause":
            self.total_pauses += 1
        elif event.event_type == "seek":
            self.total_seeks += 1
        elif event.event_type == "rate_change":
            self.total_rate_changes += 1
        elif event.event_type == "volume_change":
            self.total_volume_changes += 1
        elif event.event_type == "error":
            self.total_errors += 1
        
        # Update max position
        if event.timestamp_in_video > self.max_position_reached:
            self.max_position_reached = event.timestamp_in_video
        
        # Track rewatch (if position decreased without explicit seek)
        if event.event_type == "play" and event.timestamp_in_video > 0:
            time_bucket = int(event.timestamp_in_video)
            if time_bucket in self.rewatch_heatmap:
                self.rewatch_heatmap[time_bucket] += 1
            else:
                self.rewatch_heatmap[time_bucket] = 1


@dataclass
class SessionTelemetry:
    """Aggregated telemetry for a multi-VOD comparison session."""
    session_id: str
    created_at: float = field(default_factory=lambda: datetime.now().timestamp())
    
    # Per-VOD playback sessions
    vod_sessions: Dict[str, List[PlaybackSession]] = field(default_factory=dict)
    # {vod_id: [PlaybackSession, ...]}
    
    # Aggregate metrics
    total_watch_time_ms: float = 0.0  # Sum across all VODs
    total_playback_events: int = 0
    avg_rewatch_percentage: float = 0.0
    
    # Time tracking
    session_started_at: Optional[float] = None
    session_ended_at: Optional[float] = None
    
    def add_playback_session(self, vod_id: str, session: PlaybackSession) -> None:
        """Add a playback session for a VOD."""
        if vod_id not in self.vod_sessions:
            self.vod_sessions[vod_id] = []
        
        self.vod_sessions[vod_id].append(session)
        self.total_watch_time_ms += session.watch_time_ms
        self.total_playback_events += len(session.events)
    
    def get_vod_sessions(self, vod_id: str) -> List[PlaybackSession]:
        """Get all playback sessions for a VOD."""
        return self.vod_sessions.get(vod_id, [])
    
    def calculate_aggregate_metrics(self) -> None:
        """Recalculate aggregate metrics from sessions."""
        total_watch = 0.0
        total_duration = 0.0
        total_events = 0
        
        for sessions in self.vod_sessions.values():
            for session in sessions:
                total_watch += session.watch_time_ms
                total_duration += session.duration_seconds
                total_events += len(session.events)
        
        self.total_watch_time_ms = total_watch
        self.total_playback_events = total_events
        
        if total_duration > 0:
            self.avg_rewatch_percentage = (total_watch / 1000.0) / total_duration * 100.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "session_id": self.session_id,
            "created_at": self.created_at,
            "vod_sessions": {
                vod_id: [s.to_dict() for s in sessions]
                for vod_id, sessions in self.vod_sessions.items()
            },
            "total_watch_time_ms": self.total_watch_time_ms,
            "total_playback_events": self.total_playback_events,
            "avg_rewatch_percentage": self.avg_rewatch_percentage,
            "session_started_at": self.session_started_at,
            "session_ended_at": self.session_ended_at,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> SessionTelemetry:
        """Create from dictionary."""
        vod_sessions_data = data.pop('vod_sessions', {})
        vod_sessions = {}
        
        for vod_id, sessions_list in vod_sessions_data.items():
            vod_sessions[vod_id] = [
                PlaybackSession.from_dict(s) if isinstance(s, dict) else s
                for s in sessions_list
            ]
        
        telemetry = cls(**data)
        telemetry.vod_sessions = vod_sessions
        return telemetry


@dataclass
class TelemetryFrame:
    """Single frame of telemetry data sent at regular intervals (e.g., 30 FPS)."""
    timestamp: float  # Unix timestamp (seconds)
    session_elapsed_ms: float  # Time since session start
    
    # Per-VOD status
    vod_frames: Dict[str, VodTelemetryFrame] = field(default_factory=dict)
    # {vod_id: VodTelemetryFrame}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "timestamp": self.timestamp,
            "session_elapsed_ms": self.session_elapsed_ms,
            "vod_frames": {
                vod_id: frame.to_dict()
                for vod_id, frame in self.vod_frames.items()
            },
        }


@dataclass
class VodTelemetryFrame:
    """Telemetry for a single VOD at a point in time."""
    vod_id: str
    current_time: float  # Current playback position (seconds)
    playback_state: str  # "playing" | "paused" | "seeking"
    playback_rate: float  # 1.0 is normal speed
    volume: float  # 0.0 to 1.0
    buffered_until: float  # How far into video is buffered (seconds)
    fps: int  # Current FPS
    dropped_frames: int  # Number of dropped frames in this session
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)
