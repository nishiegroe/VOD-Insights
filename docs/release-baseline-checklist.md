# Release Baseline Checklist (Kickoff)

Last updated: 2026-03-04

## Purpose
Capture current build/release behavior before migration changes so regressions are obvious.

## Baseline Commands
- `npm run sync:meta`
- `npm run release:prep -- --dry-run`

## Record for Each Run
- Git commit SHA
- Command duration
- Produced artifacts (names and paths)
- Warnings/errors
- Any version or metadata file diffs

## Expected Invariants
- `app_meta.json` remains single source of truth
- Sync updates only intended package/version files
- Dry-run release generation completes without modifying runtime behavior

## Sign-off
- Date:
- Operator:
- Outcome: Pass / Fail
- Notes:
