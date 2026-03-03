#!/bin/bash
# token-tracker.sh - Track token usage for Ollama cloud models

TRACKER_FILE="$HOME/.openclaw/workspace/memory/ollama-token-usage.log"
mkdir -p "$(dirname "$TRACKER_FILE")"

# Get current session token usage if available
get_session_tokens() {
    # This is a placeholder - we'll manually log for now
    echo "manual"
}

# Log token usage entry
log_usage() {
    local model="$1"
    local input_tokens="$2"
    local output_tokens="$3"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local total=$((input_tokens + output_tokens))
    
    echo "$timestamp|$model|$input_tokens|$output_tokens|$total" >> "$TRACKER_FILE"
}

# Show usage summary
show_summary() {
    if [ ! -f "$TRACKER_FILE" ]; then
        echo "No token usage tracked yet."
        echo "Run: token-tracker.sh log <model> <input> <output>"
        return
    fi
    
    echo "=== OLLAMA TOKEN USAGE TRACKING ==="
    echo ""
    
    # Total by model
    echo "By Model:"
    awk -F'|' '{if($2!="") sum[$2]+=$5} END {for(m in sum) printf "  %s: %d tokens\n", m, sum[m]}' "$TRACKER_FILE" | sort
    
    echo ""
    # Grand total
    total=$(awk -F'|' '{sum+=$5} END {print sum}' "$TRACKER_FILE")
    echo "Grand Total: $total tokens"
    
    echo ""
    echo "Log file: $TRACKER_FILE"
}

# Show recent entries
show_recent() {
    local count=${1:-10}
    if [ -f "$TRACKER_FILE" ]; then
        echo "Last $count entries:"
        tail -n "$count" "$TRACKER_FILE" | while read line; do
            echo "  $line" | awk -F'|' '{printf "  %s | %s | in:%d out:%d total:%d\n", $1, $2, $3, $4, $5}'
        done
    else
        echo "No entries yet."
    fi
}

# Clear log
clear_log() {
    if [ -f "$TRACKER_FILE" ]; then
        rm "$TRACKER_FILE"
        echo "Token usage log cleared."
    else
        echo "No log file to clear."
    fi
}

case "$1" in
    log)
        if [ $# -eq 4 ]; then
            log_usage "$2" "$3" "$4"
            echo "Logged: $2 (in:$3 out:$4)"
        else
            echo "Usage: $0 log <model> <input_tokens> <output_tokens>"
        fi
        ;;
    summary)
        show_summary
        ;;
    recent)
        show_recent "${2:-10}"
        ;;
    clear)
        clear_log
        ;;
    *)
        echo "Ollama Token Usage Tracker"
        echo ""
        echo "Usage: $0 <command>"
        echo ""
        echo "Commands:"
        echo "  log <model> <input> <output>  - Log token usage"
        echo "  summary                         - Show usage summary"
        echo "  recent [count]                  - Show recent entries"
        echo "  clear                           - Clear log"
        echo ""
        echo "Example:"
        echo "  $0 log minimax-m2.5:cloud 1000 500"
        ;;
esac
