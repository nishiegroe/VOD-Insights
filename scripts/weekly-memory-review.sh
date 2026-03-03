#!/bin/bash
# Weekly memory review task - runs every Monday at 11am CST
# Creates a review log that will be delivered via Discord DM during next heartbeat

WORKSPACE="/home/owner/.openclaw/workspace"
TAKEAWAYS="${WORKSPACE}/memory/SESSION_TAKEAWAYS.md"
LOGFILE="${WORKSPACE}/memory/weekly-review-pending.log"

{
  echo "📝 **Weekly Memory Review** — Monday $(date +%I:%M\ %p\ %Z)"
  echo ""
  
  if [ -f "$TAKEAWAYS" ]; then
    echo "This week's takeaways have been synthesized:"
    echo ""
    cat "$TAKEAWAYS"
  else
    echo "No takeaways recorded this week."
  fi
} > "$LOGFILE" 2>&1

exit 0
