"""
Multi-VOD Session Manager

Handles CRUD operations and persistence for multi-VOD sessions.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from app.multi_vod_models import (
    MultiVodSession,
    MultiVodSessionVod,
    VodOffsetHistoryEntry,
)
from app.runtime_paths import get_app_data_dir


class MultiVodSessionManager:
    """Manager for multi-VOD sessions."""
    
    SESSIONS_DIR = get_app_data_dir() / "multi_vod_sessions"
    
    @classmethod
    def _ensure_sessions_dir(cls) -> Path:
        """Ensure sessions directory exists."""
        cls.SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
        return cls.SESSIONS_DIR
    
    @classmethod
    def _session_file_path(cls, session_id: str) -> Path:
        """Get the file path for a session."""
        return cls._ensure_sessions_dir() / f"{session_id}.json"
    
    @classmethod
    def create_session(
        cls,
        vods: List[MultiVodSessionVod],
        name: str = "",
        description: str = "",
        created_by: str = "system",
    ) -> MultiVodSession:
        """Create a new multi-VOD session."""
        # Validate VODs
        if len(vods) < 2 or len(vods) > 3:
            raise ValueError("Session must have 2-3 VODs")
        
        # Create session
        session = MultiVodSession(
            vods=vods,
            name=name,
            description=description,
            created_by=created_by,
        )
        
        # Validate
        is_valid, error = session.validate()
        if not is_valid:
            raise ValueError(error)
        
        # Save
        cls.save_session(session)
        
        return session
    
    @classmethod
    def save_session(cls, session: MultiVodSession) -> None:
        """Save session to disk."""
        session.updated_at = datetime.now().timestamp()
        
        file_path = cls._session_file_path(session.session_id)
        file_path.write_text(
            json.dumps(session.to_dict(), indent=2),
            encoding="utf-8"
        )
    
    @classmethod
    def load_session(cls, session_id: str) -> Optional[MultiVodSession]:
        """Load session from disk."""
        file_path = cls._session_file_path(session_id)
        
        if not file_path.exists():
            return None
        
        try:
            data = json.loads(file_path.read_text(encoding="utf-8"))
            return MultiVodSession.from_dict(data)
        except Exception as e:
            print(f"Error loading session {session_id}: {e}")
            return None
    
    @classmethod
    def delete_session(cls, session_id: str) -> bool:
        """Delete session from disk."""
        file_path = cls._session_file_path(session_id)
        
        if not file_path.exists():
            return False
        
        try:
            file_path.unlink()
            return True
        except Exception as e:
            print(f"Error deleting session {session_id}: {e}")
            return False
    
    @classmethod
    def list_sessions(
        cls,
        created_by: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> List[Dict]:
        """List all sessions (or sessions by user)."""
        sessions_dir = cls._ensure_sessions_dir()
        
        sessions = []
        for file_path in sorted(sessions_dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
            try:
                data = json.loads(file_path.read_text(encoding="utf-8"))
                
                # Filter by user if specified
                if created_by and data.get("created_by") != created_by:
                    continue
                
                sessions.append({
                    "session_id": data.get("session_id"),
                    "name": data.get("name", "Untitled"),
                    "created_at": data.get("created_at"),
                    "updated_at": data.get("updated_at"),
                    "vod_count": len(data.get("vods", [])),
                    "created_by": data.get("created_by"),
                })
            except Exception:
                # Skip invalid sessions
                continue
        
        # Apply pagination
        return sessions[offset:offset + limit]
    
    @classmethod
    def update_offset(
        cls,
        session_id: str,
        vod_id: str,
        new_offset: float,
        source: str = "manual",
        confidence: Optional[float] = None,
        changed_by: str = "system",
    ) -> Optional[MultiVodSession]:
        """Update offset for a VOD and track history."""
        session = cls.load_session(session_id)
        if not session:
            return None
        
        vod = session.get_vod_by_id(vod_id)
        if not vod:
            return None
        
        # Record old value for history
        old_offset = vod.offset
        
        # Add to offset history
        entry = VodOffsetHistoryEntry(
            timestamp=datetime.now().timestamp(),
            old_offset=old_offset,
            new_offset=new_offset,
            source=source,
            confidence=confidence,
            changed_by=changed_by,
        )
        vod.offset_history.append(entry)
        
        # Update offset
        vod.offset = new_offset
        vod.offset_source = source
        vod.offset_confidence = confidence if confidence is not None else 1.0
        vod.offset_set_at = datetime.now().timestamp()
        
        # Save
        cls.save_session(session)
        
        return session
    
    @classmethod
    def batch_update_offsets(
        cls,
        session_id: str,
        offsets: Dict[str, float],
        source: str = "manual",
        confidence: Optional[float] = None,
        changed_by: str = "system",
    ) -> Optional[MultiVodSession]:
        """Update multiple offsets atomically."""
        session = cls.load_session(session_id)
        if not session:
            return None
        
        # Validate all VOD IDs exist
        for vod_id in offsets.keys():
            if not session.get_vod_by_id(vod_id):
                return None
        
        # Update all offsets
        for vod_id, new_offset in offsets.items():
            vod = session.get_vod_by_id(vod_id)
            if not vod:
                continue
            
            # Record history
            entry = VodOffsetHistoryEntry(
                timestamp=datetime.now().timestamp(),
                old_offset=vod.offset,
                new_offset=new_offset,
                source=source,
                confidence=confidence,
                changed_by=changed_by,
            )
            vod.offset_history.append(entry)
            
            # Update offset
            vod.offset = new_offset
            vod.offset_source = source
            vod.offset_confidence = confidence if confidence is not None else 1.0
            vod.offset_set_at = datetime.now().timestamp()
        
        # Save once
        cls.save_session(session)
        
        return session
    
    @classmethod
    def update_playback_state(
        cls,
        session_id: str,
        global_time: float,
        playback_state: str,
    ) -> Optional[MultiVodSession]:
        """Update global playback state."""
        session = cls.load_session(session_id)
        if not session:
            return None
        
        session.global_time = global_time
        session.global_playback_state = playback_state
        session.playback_started_at = datetime.now().timestamp()
        
        # Save (NOTE: In production, might batch these updates to reduce I/O)
        cls.save_session(session)
        
        return session
    
    @classmethod
    def get_offset_history(
        cls,
        session_id: str,
        vod_id: Optional[str] = None,
    ) -> List[Dict]:
        """Get offset change history for a session or specific VOD."""
        session = cls.load_session(session_id)
        if not session:
            return []
        
        entries = []
        
        for vod in session.vods:
            if vod_id and vod.vod_id != vod_id:
                continue
            
            for entry in vod.offset_history:
                entries.append({
                    "timestamp": entry.timestamp,
                    "vod_id": vod.vod_id,
                    "vod_name": vod.name,
                    "old_offset": entry.old_offset,
                    "new_offset": entry.new_offset,
                    "source": entry.source,
                    "confidence": entry.confidence,
                    "changed_by": entry.changed_by,
                })
        
        # Sort by timestamp descending (most recent first)
        return sorted(entries, key=lambda x: x["timestamp"], reverse=True)
