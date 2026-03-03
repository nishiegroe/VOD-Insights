---
name: ollama-usage
description: Track Ollama model usage, running models, and system metrics. Use when asked about Ollama usage, running models, or to check which models are currently active.
metadata:
  {
    "openclaw":
      {
        "emoji": "📊",
        "os": ["linux", "darwin", "win32"],
        "requires": { "bins": ["ollama"] },
        "install": [],
      },
  }
---

# Ollama Usage Tracker

## Overview

Track Ollama model usage, running models, system metrics, and estimate token costs. This skill queries the Ollama API directly to provide real-time usage information.

## Quick Start

```bash
# List all available models
ollama list

# List currently running models
ollama ps

# Check if Ollama is running
curl -s http://localhost:11434/
```

## Available Commands

### List All Models

Shows all installed models with their sizes and details:

```bash
ollama list
```

Output includes:
- Model name
- Model ID
- File size
- Last modified date
- Parameter size
- Quantization level

### List Running Models

Shows currently loaded models:

```bash
ollama ps
```

Output includes:
- Model name
- Model ID
- Size in memory
- Processor (CPU/GPU)
- Context window
- Until (timeout)

### Check Ollama Server Status

```bash
curl -s http://localhost:11434/
```

Returns "Ollama is running" if active.

### Get Model Tags/Details

```bash
curl -s http://localhost:11434/api/tags
```

Returns detailed information about all models.

## Usage Tracking

### Estimate Token Usage

Since Ollama doesn't track tokens directly, estimate based on:

1. **Model size** - Larger models process more tokens
2. **Response length** - Count characters ÷ 4 ≈ tokens
3. **Input length** - Same estimation method

### Track Compute Time

```bash
# Track time for a single request (manual)
time curl -s -X POST http://localhost:11434/api/generate -d '{"model": "qwen2.5-coder:7b", "prompt": "test"}'
```

### Monitor Memory Usage

```bash
# Check RAM usage of running models
ollama ps
```

The SIZE column shows memory per model.

## Cost Estimation (Cloud Models)

For cloud models (marked with `:cloud` suffix), estimate cost based on:

| Model | Parameters | Estimated Cost Tier |
|-------|------------|---------------------|
| minimax-m2.5:cloud | ~? | Low |
| kimi-k2.5:cloud | ~? | Medium |
| qwen3-coder-next:cloud | ~80B | High |
| qwen3-coder:480b-cloud | 480B | Very High |

**Note:** Actual costs depend on Ollama's pricing. Check ollama.com for current rates.

## Common Use Cases

1. **Check if model is running**
   ```bash
   ollama ps | grep qwen2.5-coder:7b
   ```

2. **List all local models sorted by size**
   ```bash
   ollama list | sort -k3 -h
   ```

3. **Get detailed model info**
   ```bash
   ollama show qwen2.5-coder:7b
   ```

4. **Count total installed models**
   ```bash
   ollama list | tail -n +2 | wc -l
   ```

5. **Check total model storage**
   ```bash
   ollama list | tail -n +2 | awk '{sum+=$3} END {print sum}'
   ```

## Integration with OpenClaw

Use this skill to:
- Monitor which models are currently active
- Track storage usage across models
- Estimate resource consumption
- Debug model loading issues

## Ollama Cloud Token Limits (Estimated)

Based on usage tracking (March 2026):

| Metric | Limit | Notes |
|--------|-------|-------|
| **Session limit** | ~3.3M tokens | 5-hour session |
| **Weekly allowance** | ~14M tokens | Per week |

**Current Usage Rates (March 2026):**
- ~1.0% per minute of active use
- ~60k tokens = ~1.8% of session
- ~1 hour = ~4% of session
- Full 5-hour session = ~75% of session limit

**Estimated Weekly Capacity:**
- ~6-7 full 5-hour sessions
- ~30-35 hours total use per week

**Cost Tiers (cloud models):**
| Model | Parameters | Cost Tier |
|-------|------------|-----------|
| minimax-m2.5:cloud | ~? | Low |
| kimi-k2.5:cloud | ~? | Medium |
| qwen3-coder-next:cloud | ~80B | High |
| qwen3-coder:480b-cloud | 480B | Very High |

*Note: These are rough estimates based on usage tracking. Actual limits may vary.*

## Token Usage Tracking

### For Orchestrator (Me)
After each message, I will:
1. Check session token usage via `session_status`
2. Log tokens to the tracker: `token-tracker.sh log <model> <input> <output>`

### For Subagents
When spawning subagents, include these instructions:

```
IMPORTANT: Token Usage Tracking
After completing your task, you MUST log your token usage before finishing:

1. Get your session token count:
   - Run: session_status (or check the tool result)
   - Note the "Tokens:" values (e.g., "1234 in / 5678 out")

2. Log your usage:
   - Run: ~/.openclaw/workspace/skills/ollama-usage/token-tracker.sh log <model> <input_tokens> <output_tokens>
   - Example: token-tracker.sh log qwen2.5-coder:7b 1234 5678

3. Include token count in your completion report

This helps track Ollama cloud model usage across all agents.
```

### Log Format
| Field | Description |
|-------|-------------|
| timestamp | Date/time of log entry |
| model | Model name (e.g., minimax-m2.5:cloud) |
| input_tokens | Tokens in (from user) |
| output_tokens | Tokens out (response) |
| total | Sum of in + out |

## Troubleshooting

**Ollama not responding:**
```bash
ollama serve  # Start Ollama server
```

**Model not found:**
```bash
ollama pull <model-name>  # Download model
```

**Out of memory:**
- Stop unused models: `ollama stop <model-name>`
- Use smaller models (7b instead of 32b)
