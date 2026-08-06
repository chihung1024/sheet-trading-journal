# PR-10C8 Acceptance — Published Benchmark Provenance

## Purpose

This B02 additive batch prevents already-published benchmark return history from being labeled with a newer requested user setting that was not used to calculate that snapshot.

Tracking issue: #91  
Pull request: #92

## Exact baseline and recovery

- Repository: `chihung1024/sheet-trading-journal`
- Main SHA before change: `1f5871cee2035ad1fe6131c282881f724e7ac91d`
- Main tree before change: `7009566d7f21585fb4390fcb33a2e941a93324ab`
- Worker release/API/schema: `4.07` / `2.60` / `2`
- Pre-change backup: `backup-pre-pr10c8-1f5871c`
- Work branch: `pr10c8-benchmark-provenance`

## Verified root cause

`history[].benchmark_twr` and `summary.benchmark_twr` were published without the ticker identity used to produce them. The chart legend used `portfolioStore.selectedBenchmark`, which is the current requested user setting. After a successful settings update but before a replacement calculation is published, old benchmark data could therefore be presented under the new ticker label.

Mutable settings, localStorage, or a current API preference cannot reconstruct the historical calculation identity safely.

## Existing controls preserved

Current main already had several correct controls and they were not reimplemented:

- benchmark text input is component-local rather than direct store `v-model`;
- `fetchAll()` explicitly reads `/api/user-settings`;
- the store updates requested state only after explicit settings API success;
- runner and browser fallback default to `SPY`;
- calculation idempotency and pending-job recovery remain unchanged.

Regression contracts now lock those controls.

## Expand-first snapshot contract

`PortfolioSnapshot` now has optional top-level `benchmark_symbol`.

- Optionality keeps all legacy snapshots valid.
- Old frontend versions ignore the additive field.
- The Worker already stores and returns snapshot JSON opaquely, so no Worker or D1 migration is needed.
- The production runner stamps the effective per-user benchmark immediately after calculation and before reconciliation, validation, and upload.
- The stamped ticker is already normalized by the existing user-settings/environment resolution path.

## Frontend state semantics

A dependency-free benchmark state service separates:

- **published benchmark** — read only from `snapshot.benchmark_symbol`;
- **requested benchmark** — the current server-confirmed user setting;
- **application status**:
  - `applied`: published and requested symbols match;
  - `pending`: requested setting differs from displayed snapshot identity;
  - `unknown`: legacy or invalid snapshot provenance.

No published identity is inferred from `snapshot.settings`, localStorage, or requested state.

## Chart and UI behavior

- TWR benchmark dataset label is derived only from published provenance.
- Chart.js tooltip inherits the same published-only dataset label.
- A pending request displays `待計算套用：<requested>；目前圖表：<published>`.
- A legacy snapshot displays `基準 (身分未知)` and explains that recalculation is required.
- Changing a requested setting cannot relabel the existing history.
- The control retains free-text ticker support and adds common datalist suggestions including `SPY`.
- Invalid ticker input is rejected before trigger dispatch.
- A newly fetched snapshot provenance change redraws TWR labels.

## Deterministic acceptance coverage

Frontend tests cover:

- symbol normalization and Worker-compatible alphabet;
- applied, pending, and unknown states;
- invalid/legacy metadata;
- SPY fallback;
- published-only legend contract;
- requested input separation;
- explicit settings GET in `fetchAll()`;
- requested state publication only after server success;
- redraw on published identity change.

Python tests cover:

- legacy snapshot model validation without provenance;
- new snapshot round-trip with `benchmark_symbol`;
- runner stamping order between calculation and reconciliation/validation/upload;
- environment ticker normalization and SPY default.

## Compatibility and exclusions

Preserved:

- `/api/user-settings` and `/api/trigger-update` request/response shape;
- Worker snapshot upload/read behavior;
- existing snapshot fields and history calculations;
- calculation-job idempotency/recovery;
- browser `user_benchmark` as non-authoritative requested-setting cache;
- Worker release/API/schema `4.07` / `2.60` / `2`.

No change was made to:

- Worker or D1 code/data;
- benchmark calculation formulas or market-data retrieval;
- records, jobs, snapshots retention, OAuth/session, or IBKR;
- dependencies or workflows;
- release, API, or schema versions;
- paid or potentially metered services.

## Rollout states

During rollout:

1. old snapshot + new frontend: data remains visible, benchmark identity is explicitly unknown;
2. new snapshot + old frontend: additive field is ignored;
3. new snapshot + new frontend: applied/pending state is exact;
4. requested setting changes before new snapshot: old data retains its published label and the new request is shown as pending.

## Validation boundary

CI verifies deterministic state contracts, the production frontend build, Python model/runner behavior, Worker regression gates, and local D1 baseline. This batch does not claim an independently verified Cloudflare Pages deployment or a newly executed production calculation run from this environment.

## Rollback

Revert the frontend/Python additive merge or restore prior source/deployment from `backup-pre-pr10c8-1f5871c`.

Snapshots containing `benchmark_symbol` remain readable by older code because the Worker stores opaque JSON and existing consumers ignore unknown properties. No Worker, D1, OAuth, IBKR, record, snapshot-data, or database rollback is required.
