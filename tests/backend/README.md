# Backend Test Structure

This folder groups backend tests by concern so modularization and coverage work can scale cleanly.

## Folders

- `api/` — endpoint contract and response behavior tests.
- `services/` — unit tests for extracted helpers/services (pure or mostly pure logic).
- `security/` — path policy, allowlists, host restrictions, and trust-boundary tests.
- `integration/` — multi-module workflow tests (e.g., VOD download lifecycle).

## Coverage Gates

PR coverage checks run in CI using:

- Modularization-scope coverage gate: `>=67%`
- Diff coverage gate against `main`: `>=67%`

Local command:

```bash
python -m pytest tests/backend -q \
  --cov=app.clip_range \
  --cov=app.session_data \
  --cov=app.dependency_bootstrap_ops \
  --cov=app.vod_download_utils \
  --cov=app.split_export \
  --cov=app.webui_app_shell \
  --cov-report=xml \
  --cov-report=term \
  --cov-fail-under=67
```
