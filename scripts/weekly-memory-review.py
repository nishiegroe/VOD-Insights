#!/usr/bin/env python3
"""
Weekly memory synthesis task
Reads SESSION_TAKEAWAYS.md and synthesizes important items into MEMORY.md
Then sends a Discord DM with the summary
"""

import sys
import os
sys.path.insert(0, '/home/owner/.nvm/versions/node/v24.14.0/lib/node_modules/openclaw')

from pathlib import Path

# Setup workspace paths
WORKSPACE = Path("/home/owner/.openclaw/workspace")
TAKEAWAYS_FILE = WORKSPACE / "memory" / "SESSION_TAKEAWAYS.md"
MEMORY_FILE = WORKSPACE / "memory" / "MEMORY.md"

def read_takeaways():
    """Read SESSION_TAKEAWAYS.md"""
    if not TAKEAWAYS_FILE.exists():
        return "No takeaways file found"
    
    with open(TAKEAWAYS_FILE, 'r') as f:
        return f.read()

def synthesize_memory(takeaways_content):
    """
    Extract key items from takeaways and synthesize into MEMORY.md
    Returns a summary of what was added
    """
    # Parse takeaways
    lines = takeaways_content.split('\n')
    summary_items = []
    
    # Extract all Decision, Blocker, and Learning sections
    current_section = None
    for i, line in enumerate(lines):
        if '**Key Decisions:**' in line:
            current_section = 'Decision'
        elif '**Blockers:**' in line:
            current_section = 'Blocker'
        elif '**Learnings:**' in line:
            current_section = 'Learning'
        elif line.strip().startswith('- ') and current_section:
            summary_items.append(f"[{current_section}] {line.strip()}")
    
    return "\n".join(summary_items[:10])  # Return top 10 items

def send_discord_dm(summary):
    """Send Discord DM with the memory review summary"""
    try:
        # Import the message tool
        import sys
        sys.path.insert(0, '/home/owner/.nvm/versions/node/v24.14.0/lib/node_modules/openclaw')
        
        # Use a direct HTTP call to send the message
        import subprocess
        
        message_text = f"""📝 **Weekly Memory Review** (Monday 11am CST)

{summary}

---
Session takeaways have been synthesized into long-term memory."""
        
        # Call openclaw message command
        result = subprocess.run([
            'openclaw', 'message',
            '--action', 'send',
            '--channel', 'discord',
            '--target', '117012549290950664',
            '--message', message_text
        ], capture_output=True, text=True)
        
        return "DM sent successfully" if result.returncode == 0 else f"Error: {result.stderr}"
    except Exception as e:
        return f"Error sending DM: {str(e)}"

if __name__ == "__main__":
    # Read takeaways
    takeaways = read_takeaways()
    
    # Synthesize into memory
    summary = synthesize_memory(takeaways)
    
    # Send Discord notification
    status = send_discord_dm(summary)
    
    print(status)
