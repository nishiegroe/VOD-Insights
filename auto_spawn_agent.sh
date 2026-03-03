#!/bin/bash
# Auto-spawn next agent every hour
# Run by cron

WORKSPACE="/home/owner/.openclaw/workspace"
LAST_AGENT_FILE="$WORKSPACE/memory/LAST_AGENT.txt"
LOG_FILE="$WORKSPACE/logs/agent_spawn.log"

echo "--- $(date) ---" >> $LOG_FILE

# Check if an agent is already running
ACTIVE=$(ps aux | grep -E "subagent|agent:" | grep -v grep | wc -l)
if [ "$ACTIVE" -gt 0 ]; then
    echo "Agent already running, skipping." >> $LOG_FILE
    exit 0
fi

# Get last agent
LAST=$(cat "$LAST_AGENT_FILE" 2>/dev/null)

# Determine next agent (skip Victor if blocked)
case "$LAST" in
    "") NEXT="Casey" ;;
    "Casey") NEXT="Jordan" ;;
    "Jordan") NEXT="Riley" ;;
    "Riley") NEXT="Sam" ;;
    "Sam") NEXT="Casey" ;;
    *) NEXT="Casey" ;;
esac

# Skip Victor if deps not installed (check for blocker file)
if [ "$NEXT" = "Victor" ]; then
    if [ -f "$WORKSPACE/memory/VICTOR_BLOCKED" ]; then
        NEXT="Casey"
        echo "Victor blocked, skipping to $NEXT" >> $LOG_FILE
    fi
fi

echo "Spawning: $NEXT" >> $LOG_FILE

# Spawn via OpenClaw CLI (would need to be implemented)
# For now, just log - actual spawning needs sessions_spawn which requires active session

echo "$(date): Would spawn $NEXT" >> $LOG_FILE
