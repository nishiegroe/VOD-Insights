# Build, Release, and Security Guardrails (Kickoff)

Last updated: 2026-03-04

## Non-Negotiable Guardrails
- Keep backend bound to local interface unless trust boundary is intentionally changed.
- Preserve path allowlist enforcement before file read/write/delete operations.
- Preserve upload filename sanitization and avoid raw user-controlled path usage.
- Keep dependency bootstrap host allowlist behavior intact.
- Treat subprocess invocations (FFmpeg, yt-dlp, pip, shell tools) as security-sensitive.

## Migration Guard Conditions
- No PR may change route contracts and path-security logic in the same step unless explicitly reviewed.
- No PR may introduce network-fetch in release-critical paths without verification plan.
- No PR may remove existing recovery/fallback behavior without parity evidence.

## Validation Expectations
- Use [docs/migration/parity-checklist.md](migration/parity-checklist.md) for runtime parity.
- Add targeted negative-path tests when security-sensitive code moves.
- Document trust-boundary decisions in migration notes when defaults change.

## Ownership
- Primary: Build-Release-Security-Agent
- Reviewers: Backend-WebUI-Agent + Orchestrator-Triage-Agent
