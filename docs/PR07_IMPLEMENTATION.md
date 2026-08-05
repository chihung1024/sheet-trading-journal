# PR-07 Calculation Job Contract

- `POST /api/trigger-update` accepts an optional `Idempotency-Key` and returns an opaque job ID.
- Repeated keys from the same authenticated user within the active window resolve to the same job.
- `GET /api/calculation-jobs/:id` is user-scoped and never accepts an owner override.
- `POST /api/calculation-jobs/status` is system-only and enforces queued → running → succeeded/failed transitions.
- Terminal states are immutable; duplicate lifecycle callbacks are idempotent.
- GitHub Actions reports running and terminal status using the existing protected `API_KEY`.
- D1 schema version 2 is introduced by additive migration `0002_calculation_jobs.sql`.
