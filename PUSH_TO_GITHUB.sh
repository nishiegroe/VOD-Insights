#!/bin/bash
set -e

echo "🚀 VOD Insights Multi-VOD Frontend - Push to GitHub"
echo "=================================================="
echo ""

cd /home/owner/.openclaw/workspace/vod-insights

# Check branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Current branch: $CURRENT_BRANCH"
echo ""

# Show commits ready to push
echo "Commits ready to push:"
git log origin/main..$CURRENT_BRANCH --oneline | head -10
echo ""

# Instructions
echo "=================================================="
echo "To push and create PR, run these commands:"
echo "=================================================="
echo ""
echo "Step 1: Authenticate with GitHub"
echo "  npx gh auth login"
echo ""
echo "Step 2: Push the branch"
echo "  git push -u origin feature/multi-vod-backend"
echo ""
echo "Step 3: Create the PR"
echo "  npx gh pr create --title 'feat: multi-VOD comparison frontend (Phase 1)' --draft"
echo ""
echo "=================================================="
echo "Or manually:"
echo "1. Visit: https://github.com/nishiegroe/VOD-Insights/compare/main...feature/multi-vod-backend"
echo "2. Click 'Create pull request'"
echo "3. Use title: feat: multi-VOD comparison frontend (Phase 1)"
echo "4. Copy description from /home/owner/.openclaw/workspace/PR_READY.md"
echo "=================================================="
