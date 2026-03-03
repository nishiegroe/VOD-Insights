#!/bin/bash
# ollama-usage.sh - Quick Ollama usage summary

echo "=== OLLAMA STATUS ==="
curl -s http://localhost:11434/ 2>/dev/null || echo "Ollama not running"

echo ""
echo "=== RUNNING MODELS ==="
ollama ps

echo ""
echo "=== MODEL COUNT ==="
count=$(ollama list 2>/dev/null | tail -n +2 | wc -l)
echo "Total models: $count"

echo ""
echo "=== LOCAL STORAGE USAGE ==="
# Get local model sizes in GB - output is like "23 GB" or "5.2 GB"
local_size=$(ollama list 2>/dev/null | tail -n +2 | grep -v "cloud" | awk '{if($4=="GB") sum+=$3; else if($4=="MB") sum+=$3/1024; else if($4=="TB") sum+=$3*1024} END {printf "%.1f", sum}')
echo "Local models: ${local_size:-0} GB"

echo ""
echo "=== CLOUD MODELS (potential cost) ==="
ollama list 2>/dev/null | grep "cloud" || echo "No cloud models"
