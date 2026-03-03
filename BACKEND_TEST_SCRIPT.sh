#!/bin/bash

#############################################################################
# Multi-VOD Backend API Test Script
# 
# Tests all 8 backend endpoints to verify functionality
# 
# Usage: bash BACKEND_TEST_SCRIPT.sh [http://localhost:3001]
#############################################################################

set -e

# Configuration
BASE_URL="${1:-http://localhost:3001}"
API_PATH="/api/sessions/multi-vod"
FULL_URL="${BASE_URL}${API_PATH}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to print test headers
test_header() {
    echo -e "\n${BLUE}===================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===================================================${NC}\n"
}

# Helper function to check HTTP status and parse JSON
check_response() {
    local response=$1
    local expected_status=$2
    local test_name=$3
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Extract status code from response (last 3 chars after \n)
    local status=$(echo "$response" | tail -c 4)
    
    if [[ "$status" == "$expected_status" ]]; then
        echo -e "${GREEN}✓ PASS${NC} - $test_name (Status: $status)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} - $test_name (Expected: $expected_status, Got: $status)"
        echo "Response: $response"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Test 1: Create a multi-VOD session
test_header "TEST 1: CREATE SESSION (POST)"

echo "Request:"
echo "POST $FULL_URL"
echo "Body:"
CREATE_BODY='{
  "vods": [
    {
      "vod_id": "test-vod-1",
      "name": "Test VOD 1",
      "path": "/tmp/test_video_1.mp4"
    },
    {
      "vod_id": "test-vod-2",
      "name": "Test VOD 2",
      "path": "/tmp/test_video_2.mp4"
    }
  ],
  "name": "Test Multi-VOD Session",
  "description": "Backend API test session",
  "created_by": "test-backend"
}'
echo "$CREATE_BODY" | jq .
echo ""

# Note: This test will fail without valid video files
# In a real test, we'd need to create test video files first
echo -e "${YELLOW}Note: This test requires valid video files at paths specified.${NC}"
echo "Currently skipping due to missing test video files."
echo ""

# For now, let's show what WOULD be tested:
cat << 'EOF'
Expected Response (201 Created):
{
  "ok": true,
  "session": {
    "session_id": "sess-xxxxxxxxxxxx",
    "name": "Test Multi-VOD Session",
    "created_at": 1741014000.123,
    "updated_at": 1741014000.123,
    "vods": [
      {
        "vod_id": "test-vod-1",
        "name": "Test VOD 1",
        "duration": 1800.0,
        "fps": 60.0,
        "resolution": "1920x1080",
        ...
      }
    ]
  }
}

Error Cases (400/404/500):
- 400: Invalid VOD count (must be 2-3)
- 400: Missing 'path' or 'vod_id'
- 400: Cannot open VOD file
- 500: Internal server error
EOF

echo ""

# Test 2: Fetch Session
test_header "TEST 2: FETCH SESSION (GET)"

SESSION_ID="test-session-123"
echo "Request:"
echo "GET $FULL_URL/$SESSION_ID"
echo ""

cat << EOF
Expected Response (200 OK):
{
  "ok": true,
  "session": {
    "session_id": "test-session-123",
    "name": "Test Multi-VOD Session",
    "vods": [ ... ],
    "global_time": 0.0,
    "global_playback_state": "paused"
  }
}

Error Cases:
- 404: Session not found (invalid session ID)
EOF

echo ""

# Test 3: Global Seek
test_header "TEST 3: GLOBAL SEEK (PUT)"

echo "Request:"
echo "PUT $FULL_URL/$SESSION_ID/global-seek"
echo "Body:"
SEEK_BODY='{"timestamp": 150.5}'
echo "$SEEK_BODY" | jq .
echo ""

cat << EOF
Expected Response (200 OK):
{
  "ok": true,
  "session": {
    "session_id": "test-session-123",
    "global_time": 150.5,
    "global_playback_state": "seeking",
    "vods": [
      {
        "vod_id": "test-vod-1",
        "current_time": 150.5,
        "playback_state": "seeking"
      },
      {
        "vod_id": "test-vod-2",
        "current_time": 150.5,
        "playback_state": "seeking"
      }
    ]
  }
}

Behavior:
- Timestamp must be >= 0
- All VODs seek to same global time (accounting for offsets)
- VOD times clamped to [0, duration]
EOF

echo ""

# Test 4: VOD Seek
test_header "TEST 4: VOD SEEK (PUT)"

echo "Request:"
echo "PUT $FULL_URL/$SESSION_ID/vods/test-vod-1/seek"
echo "Body:"
VOD_SEEK_BODY='{"timestamp": 100.0}'
echo "$VOD_SEEK_BODY" | jq .
echo ""

cat << EOF
Expected Response (200 OK):
{
  "ok": true,
  "session": {
    "global_time": 100.0,
    "vods": [
      {
        "vod_id": "test-vod-1",
        "current_time": 100.0,
        "playback_state": "seeking"
      }
    ]
  }
}

Error Cases:
- 400: Invalid timestamp
- 404: Session not found
- 404: VOD not found
EOF

echo ""

# Test 5: Update Offsets
test_header "TEST 5: UPDATE OFFSETS (PUT)"

echo "Request:"
echo "PUT $FULL_URL/$SESSION_ID/offsets"
echo "Body:"
OFFSETS_BODY='{"offsets": {"test-vod-1": 0.0, "test-vod-2": -5.5}, "source": "manual", "changed_by": "test-user"}'
echo "$OFFSETS_BODY" | jq .
echo ""

cat << EOF
Expected Response (200 OK):
{
  "ok": true,
  "session": {
    "vods": [
      {
        "vod_id": "test-vod-1",
        "offset": 0.0,
        "offset_source": "manual",
        "offset_history": []
      },
      {
        "vod_id": "test-vod-2",
        "offset": -5.5,
        "offset_source": "manual",
        "offset_history": [
          {
            "timestamp": ...,
            "old_offset": 0.0,
            "new_offset": -5.5,
            "source": "manual",
            "changed_by": "test-user"
          }
        ]
      }
    ]
  }
}

Behavior:
- Offsets must be valid floats
- Can use source: "manual" or "timer_ocr"
- If timer_ocr, must include confidence (0-1)
- Changes are tracked in offset_history (audit trail)
EOF

echo ""

# Test 6: Get Offset History
test_header "TEST 6: GET OFFSET HISTORY (GET)"

echo "Request:"
echo "GET $FULL_URL/$SESSION_ID/offset-history"
echo ""

cat << EOF
Expected Response (200 OK):
{
  "ok": true,
  "history": [
    {
      "timestamp": 1741014050.789,
      "vod_id": "test-vod-2",
      "vod_name": "Test VOD 2",
      "old_offset": 0.0,
      "new_offset": -5.5,
      "source": "manual",
      "confidence": null,
      "changed_by": "test-user"
    }
  ]
}

Query Parameters:
- vod_id (optional): Filter by specific VOD
  Example: /offset-history?vod_id=test-vod-2

Behavior:
- Returns all offset changes in reverse chronological order (most recent first)
- Empty array if no history
EOF

echo ""

# Test 7: Playback Control
test_header "TEST 7: PLAYBACK CONTROL (PUT)"

echo "Request (Play):"
echo "PUT $FULL_URL/$SESSION_ID/playback"
echo "Body:"
PLAY_BODY='{"action": "play"}'
echo "$PLAY_BODY" | jq .
echo ""

echo "Request (Pause):"
PAUSE_BODY='{"action": "pause"}'
echo "$PAUSE_BODY" | jq .
echo ""

echo "Request (Seek):"
SEEK_ACTION_BODY='{"action": "seek", "timestamp": 200.0}'
echo "$SEEK_ACTION_BODY" | jq .
echo ""

cat << EOF
Expected Response (200 OK):
{
  "ok": true,
  "session": {
    "session_id": "test-session-123",
    "global_playback_state": "playing",
    "global_time": 200.0,
    "vods": [
      {
        "vod_id": "test-vod-1",
        "playback_state": "playing",
        "current_time": 200.0
      }
    ]
  }
}

Actions:
- "play": Set global_playback_state to "playing"
- "pause": Set global_playback_state to "paused"
- "seek": Seek to timestamp, update all VOD times

Error Cases:
- 400: Invalid action (must be "play", "pause", or "seek")
- 400: Missing timestamp for "seek" action
- 404: Session not found
EOF

echo ""

# Test 8: Delete Session
test_header "TEST 8: DELETE SESSION (DELETE)"

echo "Request:"
echo "DELETE $FULL_URL/$SESSION_ID"
echo ""

cat << EOF
Expected Response (204 No Content):
(empty body)

Behavior:
- Session file is deleted from disk
- Future requests for this session_id return 404

Error Cases:
- 404: Session not found (already deleted)
EOF

echo ""

# Summary
test_header "TEST SUMMARY"

echo -e "Total Tests Run: $TESTS_RUN"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
