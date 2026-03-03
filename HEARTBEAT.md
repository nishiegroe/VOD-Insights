# HEARTBEAT.md

## Weekly Memory Review Check

If a new weekly memory review log exists in `memory/weekly-review-*.log`:
- Read the file
- Send the summary as a Discord DM to 117012549290950664
- Delete the log file after sending
- Reply with: "✅ Weekly memory review sent to Discord"

Otherwise, no action needed.

---

## Dev Team Agent Spawner (Every Heartbeat)

### Goal: 1 agent per hour, avoiding blockers

**CRITICAL:** When heartbeat fires, you MUST execute these steps. Do not just reply HEARTBEAT_OK.

**Agent Queue (in order):**
1. Victor (Native) - blocked until deps installed
2. Casey (Backend)
3. Jordan (QA)
4. Riley (Docs)
5. Sam (Architect)

### Steps:

1. **Check if an agent is already running**
   ```
   subagents list
   ```
   If active agents exist → skip spawning (HEARTBEAT_OK)

2. **Check who ran last**
   Read `memory/LAST_AGENT.txt` — if empty, start with Casey

3. **Check for blockers**
   Read `memory/TEAM_SHARED_FINDINGS.md` → Critical Blockers section
   - If Victor is next but deps not installed → skip to Casey
   - Log skipped agent to `memory/SKIPPED_AGENTS.txt`

4. **Spawn next ready agent**
   Send to Discord: "🚀 Spawning [Agent] for [role]..."

   Tasks:
   - **Casey (Backend):** "You are Casey, Backend Dev. Read memory files. Continue Phase 2 backend work. Update memory. Commit to feature/multi-vod-complete. Message Nishie Discord when done."
   - **Jordan (QA):** "You are Jordan, QA. Read memory files. Test existing components, write test plans. Update memory. Message Nishie Discord when done."
   - **Riley (Docs):** "You are Riley, Documentation. Read memory files. Write API docs, user guides. Update memory. Commit to feature/multi-vod-complete. Message Nishie Discord when done."
   - **Sam (Architect):** "You are Sam, Architect. Read memory files. Continue Phase 4-5 planning. Update memory. Commit docs. Message Nishie Discord when done."
   - **Victor (Native):** "You are Victor, Native Dev. Try to compile native module. If deps still missing, update BLOCKER status in memory and message Nishie."

5. **Update last agent**
   Write agent name to `memory/LAST_AGENT.txt`

6. **If all skipped or done**
   Reply: "✅ All ready agents completed this cycle. Victor blocked on deps."
