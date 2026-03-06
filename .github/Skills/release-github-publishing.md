# Release GitHub Publishing Skill

Use this when asked to publish a GitHub release for this repo.

Canonical source: `docs/release-github-runbook.md`

## Agent Checklist

1. **Version Update & Commit** – Follow the "Version Update and Commit Workflow" section in the runbook.
   - Update `app_meta.json` version
   - Run `npm run sync:meta`
   - Commit and push to main
2. Run strict preflight checks from the runbook.
3. Record preflight interpretation before publish:
   - clean tree awareness (version files already committed)
   - branch/auth/tag/release state
4. Confirm version and tag come from `app_meta.json` (`v<version>`).
5. Run dry-run:
   - `npm run release:github -- --dry-run`
6. If dry-run is clean, run publish:
   - `npm run release:github`
7. Verify release URL and assets (installer, `latest.json`, `checksums.txt`).
8. Report back with:
   - Tag and version
   - Release URL
   - Asset names uploaded from `dist-desktop/inno`
   - Confirmation that main branch has version commit

## Partial-Publish Recovery

If preflight shows tag exists but release is missing:

- Compare tag commit to intended release commit (`git rev-list -n 1 v<version>` vs target commit).
- Ensure version commit is on main: `git log origin/main -n 3`
- If tag commit is correct and on main, publish without re-tagging:
  - `npm run release:github -- --dry-run --skip-tag`
  - `npm run release:github -- --skip-tag`
- If tag commit is wrong, stop and escalate for rollback/retag approval.

## Optional Overrides

Use when user explicitly requests non-default target values:

- `--owner <owner>`
- `--repo <repo>`
- `--output-dir <path>`
- `--remote <remote>`

Example:

```powershell
npm run release:github -- --dry-run --owner nishiegroe --repo VOD-Insights --output-dir dist-desktop/inno --remote origin
```

## Common Failures

- `a release with the tag name already exists`
  - Inspect existing release first; do not republish blindly.
- Missing assets in `dist-desktop/inno`
  - Run `npm run release:prep -- --tag v<version>` and retry.
- `gh` auth/permission errors
  - Recheck `gh auth status` and repository access.
