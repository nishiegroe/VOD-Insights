# GitHub Release Runbook

Canonical guide for publishing a GitHub release from this repository.

## Prerequisites

- Windows PowerShell in repo root (any checkout location)
- Node.js and npm installed
- GitHub CLI installed and authenticated: `gh auth status`
- Permissions to push tags and create releases in the target repo
- Build dependencies available (Python, Inno Setup, frontend/desktop deps)

## Version and Tag Policy

- `app_meta.json` is the source of truth for release version.
- `npm run release:github` always derives tag as `v<app_meta.version>`.
- Do not pass `--tag` to `release:github`; update `app_meta.json` first.
- Expected format is `vX.Y.Z` (or `vX.Y.Z-prerelease`).

## Version Update and Commit Workflow

**Before running `npm run release:github`, commit all version changes to main.** The release tag must include these version file updates.

### Step 1: Update Version Source of Truth

Edit `app_meta.json` to set the new version:

```powershell
$meta = Get-Content .\app_meta.json -Raw | ConvertFrom-Json
$meta.version = "1.1.1"  # Update this to your target version

# Ensure patchNotes is an array so we can safely add a new entry
if (-not $meta.patchNotes) {
  $meta.patchNotes = @()
}

$newPatchNote = @{
  version = "1.1.1"
  items   = @("Feature X", "Fix Y")
}

# Prepend the new patch note so the most recent version appears first
$meta.patchNotes = @($newPatchNote) + $meta.patchNotes

$meta | ConvertTo-Json -Depth 10 | Set-Content .\app_meta.json -Encoding UTF8
```

### Step 2: Sync All Package Versions

Running `npm run sync:meta` updates all dependent package files:

```powershell
npm run sync:meta
```

This updates:
- `package.json` (root)
- `frontend/package.json`
- `desktop/package.json`
- `inno/VODInsights.iss` (version string in installer definition)

### Step 2a: Sync Package Lock Files

After `npm run sync:meta`, update the package lock files to match the version bump:

```powershell
npm install --package-lock-only
npm --prefix frontend install --package-lock-only
npm --prefix desktop install --package-lock-only
```

This prevents lockfile version mismatches and ensures consistent dependency metadata across releases.

### Step 3: Review Changes

Always inspect what changed before committing:

```powershell
git diff app_meta.json
git diff package.json
git diff frontend/package.json
git diff desktop/package.json
git diff inno/VODInsights.iss
git status --short
```

Verify only version files are modified (unless other changes were intentional).

### Step 4: Commit to Main

Commit the synced version changes with a clear message:

```powershell
git add app_meta.json package.json frontend/package.json desktop/package.json inno/VODInsights.iss
git commit -m "release: bump to 1.1.1"
```

Or, if only version files were modified:

```powershell
git commit -am "release: bump to 1.1.1"
```

Verify the commit was created:

```powershell
git log --oneline -n 3
```

### Step 5: Push Commit to Main

Push the commit to the remote main branch before creating the release tag:

```powershell
git push origin main
```

Confirm push succeeded:

```powershell
git log origin/main --oneline -n 3
```

### Step 6: Run Preflight and Release (After Commit)

Now that version files are committed, proceed with preflight and publish (see sections below).

**Why this order matters:**
- `npm run release:github` creates tag `v<app_meta.version>` pointing to current HEAD.
- If HEAD does not include the version file commits, the tag will point to a stale commit.
- Pushing main first ensures both the commit and tag are on the remote in sync.

**Summary of files committed in this workflow:**
- `app_meta.json` – canonical version source
- `package.json`, `frontend/package.json`, `desktop/package.json` – synced npm versions
- `inno/VODInsights.iss` – installer version string

## Strict Preflight Checks

Run these checks before any release command.

```powershell
# 1) Clean repo state
git status --short

# 2) Correct branch and remote
git branch --show-current
git remote -v

# 3) GitHub auth and target repo access
gh auth status

# 4) Confirm version in app_meta.json matches what you committed
Get-Content .\app_meta.json | Select-String '"version"'

# 5) Ensure release tag does not already exist
$version = (Get-Content .\app_meta.json -Raw | ConvertFrom-Json).version
$tag = "v$version"
git tag --list $tag
git ls-remote --tags origin "refs/tags/$tag"
gh release view $tag
```

`gh release view $tag` uses the authenticated/default repository context. If needed, override with `--repo <owner>/<repo>`.

Interpretation:

- `git status --short` should be clean or only contain unrelated changes. Do not mix release metadata changes with other work.
- `git tag --list` should return nothing for a brand-new release.
- `git ls-remote --tags` should return nothing for a brand-new release.
- `gh release view` should fail for a brand-new release (that is expected).
- If tag exists but `gh release view` fails, treat as partial prior publish and follow troubleshooting steps below.

## Dry Run

Default dry run:

```powershell
npm run release:github -- --dry-run
```

Dry run with optional overrides:

```powershell
npm run release:github -- --dry-run --owner <owner> --repo <repo> --output-dir dist-desktop/inno --remote origin
```

What dry run validates:

- Tag creation/push steps are printed (not executed)
- `release:prep` command is printed (not executed)
- Release command and notes preview are printed

## Full Publish

Default publish:

```powershell
npm run release:github
```

Publish with optional overrides:

```powershell
npm run release:github -- --owner <owner> --repo <repo> --output-dir dist-desktop/inno --remote origin
```

What the command does:

1. Ensures tag `v<app_meta.version>` exists locally/remotely (if not already present from our commit step).
2. Runs `npm run release:prep -- --tag v<app_meta.version>`.
3. Validates release assets in `dist-desktop/inno`.
4. Creates GitHub release with `gh release create`.

## Expected Artifacts

Output directory: `dist-desktop/inno`

- `VODInsights-Setup-<version>.exe`
- `latest.json`
- `checksums.txt`

`release:github` fails if these files are missing.

## Verification Checklist

After publish, verify all items:

1. Release page exists at `https://github.com/<owner>/<repo>/releases/tag/v<version>`.
2. Assets include installer, `latest.json`, and `checksums.txt`.
3. Installer filename includes `-Setup-<version>`.
4. `latest.json` version/tag match `app_meta.json`.
5. `checksums.txt` contains installer SHA256.
6. Local and remote tags both point to the intended commit.
7. Main branch is updated with committed version changes.

Useful commands:

```powershell
$version = (Get-Content .\app_meta.json -Raw | ConvertFrom-Json).version
$tag = "v$version"
gh release view $tag
gh release view $tag --json url,assets
git rev-list -n 1 $tag
git ls-remote --tags origin "refs/tags/$tag"
git log origin/main --oneline -n 5  # Verify commit is on main
```

To target a specific repository explicitly, add `--repo <owner>/<repo>` to the `gh release view` commands.

## Troubleshooting

### Existing release/tag already present

Symptoms:

- `gh release create ...` fails with an error like: `a release with the tag name already exists`
- Tag checks show local or remote tag already exists

Actions:

1. Stop and do not rerun publish blindly.
2. Inspect existing release: `gh release view <tag> --repo <owner>/<repo>`.
3. If the release is correct, treat publish as complete.
4. If incorrect, follow rollback guidance below before republishing.

### Tag exists but GitHub release is missing

Symptoms:

- `git tag --list` or `git ls-remote --tags` returns `v<version>`
- `gh release view v<version>` returns `release not found`

Actions:

1. Compare tag commit with release target commit:
	- `git rev-list -n 1 v<version>`
	- `git rev-parse HEAD`
	- `git log origin/main -n 1` (check if version commit is on remote main)
2. If tag commit is correct and on main, run dry-run then publish without changing tag:
	- `npm run release:github -- --dry-run --skip-tag`
	- `npm run release:github -- --skip-tag`
3. If tag commit is not correct, stop and coordinate rollback/retag with maintainers before publishing.

### Version mismatch or invalid tag format

Symptoms:

- `Version mismatch: app_meta.json=..., tag=...`
- `app_meta.json version is not valid for tag`

Actions:

1. Fix `app_meta.json` version.
2. Run `npm run sync:meta`.
3. Commit: `git commit -am "release: bump to <corrected-version>"`
4. Push: `git push origin main`
5. Re-run dry-run and publish.

### Missing artifacts in `dist-desktop/inno`

Symptoms:

- `No installer found...`
- `Missing release metadata file: ...latest.json`
- `Missing checksum file: ...checksums.txt`

Actions:

1. Run `npm run release:prep -- --tag v<version>`.
2. Confirm files exist in `dist-desktop/inno`.
3. Re-run publish.

### Version changes not on main branch

Symptoms:

- Version files were updated locally but not committed/pushed.
- Tag exists but latest main branch does not have version changes.

Actions:

1. From the repo root, run the "Version Update and Commit Workflow" section above (steps 3–5).
2. Verify with: `git log origin/main -n 3` and `git diff origin/main app_meta.json`
3. Re-run preflight and dry-run.

## Rollback and Abort Guidance

Use caution and coordinate with maintainers before deleting tags/releases.

Abort before publish:

- If dry-run or preflight fails, stop and fix issues first.

If local tag was created but not pushed:

```powershell
git tag -d v<version>
```

If remote tag exists but release should be redone:

```powershell
git push --delete origin v<version>
git tag -d v<version>
```

If GitHub release exists and must be recreated:

```powershell
gh release delete v<version> --repo <owner>/<repo> --yes --cleanup-tag
```

After rollback:

1. Correct metadata/artifacts.
2. Re-run version commit workflow if needed.
3. Re-run strict preflight.
4. Re-run dry-run.
5. Re-run full publish.

---

**Last Updated:** 2026-03-05  
**Tested With:** v1.1.1 release  
**Maintainer:** VOD Insights team
