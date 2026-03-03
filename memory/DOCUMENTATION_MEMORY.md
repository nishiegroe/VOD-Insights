# Riley's Memory — Documentation

## Phase 2-3 Focus
API docs and setup guides for native video feature (multi-VOD sync)

## Documentation Files Created

| File | Status | Description |
|------|--------|-------------|
| `docs/API_DOCUMENTATION.md` | ✅ Complete | Full API reference for Phase 2-3 endpoints |
| `docs/SETUP_DEPLOYMENT_GUIDE.md` | ✅ Complete | Setup, build, and deployment instructions |

## API Documentation Status

### Phase 2 - Multi-VOD Session API ✅
- `POST /api/sessions/multi-vod` - Create session
- `GET /api/sessions/multi-vod/<id>` - Get session
- `DELETE /api/sessions/multi-vod/<id>` - Delete session
- `GET /api/sessions/multi-vod/list` - List sessions
- `PUT /api/sessions/multi-vod/<id>/global-seek` - Sync seek
- `PUT /api/sessions/multi-vod/<id>/vods/<vod_id>/seek` - Independent seek
- `PUT /api/sessions/multi-vod/<id>/offsets` - Update offsets
- `GET /api/sessions/multi-vod/<id>/offset-history` - Offset audit
- `PUT /api/sessions/multi-vod/<id>/playback` - Play/pause control
- `GET /api/sessions/multi-vod/vods/list` - List VODs
- `GET /api/sessions/multi-vod/<id>/vods/<vod_id>/stream` - Stream VOD

### Phase 2 - Telemetry API ✅
- `POST /api/telemetry/sessions/<id>/events` - Record event
- `POST /api/telemetry/sessions/<id>/vod/<vod>/session` - Start session
- `POST /api/telemetry/sessions/<id>/vod/<vod>/session/end` - End session
- `GET /api/telemetry/sessions/<id>/summary` - Session summary
- `GET /api/telemetry/sessions/<id>/events` - Get events
- `GET /api/telemetry/sessions/<id>/heatmap` - Rewatch heatmap
- `GET /api/telemetry/sessions/<id>/stats` - Statistics
- `GET /api/telemetry/sessions/<id>/export` - Export data
- `GET /api/telemetry/sessions` - List sessions
- `DELETE /api/telemetry/sessions/<id>` - Delete session

### Phase 3 - Native Video IPC ✅
- `video:initialize` - Initialize player
- `video:play` - Start playback
- `video:pause` - Pause playback
- `video:stop` - Stop playback
- `video:seek` - Seek to time
- `video:setPlaybackRate` - Set speed
- `video:telemetry` - Telemetry events (push)
- `video:error` - Error events (push)

## User Guides Created

1. **Setup/Deployment Guide** - Covers:
   - System requirements (Windows/macOS/Linux)
   - Build dependency installation
   - Configuration (libvlc paths, feature flags)
   - Running in dev/production
   - Testing procedures
   - Deployment (installers for each platform)
   - Troubleshooting common issues
   - Performance tuning recommendations

## Gaps Found

- No Swagger/OpenAPI spec (would be nice for auto-generated docs)
- No Postman collection (could help API consumers)
- Native module testing documentation is sparse
- Cross-platform build scripts need more detail

## Feedback from Users
_(None yet - docs just created)_

---

**2026-03-03:** Created comprehensive API documentation (Phase 2-3 endpoints) and setup/deployment guide for native video feature. All docs in `docs/` folder.
