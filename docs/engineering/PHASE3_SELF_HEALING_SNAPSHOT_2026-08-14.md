# Phase 3 — Self-healing Snapshot Lifecycle

Date: 2026-08-14 Asia/Taipei  
Risk: **R2 Significant** — frontend integrity evidence plus bounded orchestration into the existing calculation lifecycle.

## Product objective

A user should not need to diagnose or manually repair a portfolio snapshot that is provably missing, stale against authoritative transactions, or built for a different requested benchmark.

Phase 3 adds a bounded frontend integrity controller:

```text
successful full read
-> authoritative records + published snapshot
-> deterministic source-record identity proof
-> classify fresh / repairable / fail-closed
-> if repairable and Phase 2 is not already dirty:
     create one Phase 2 dirty generation
     yield past the completed read single-flight
     perform one fresh fetchAll handoff
-> Phase 2 owns debounce / trigger / calculation_jobs / coverage / polling
```

Phase 3 does **not** create another backend queue, does not change D1, and does not move financial truth into browser state.

## Prerequisite closure

Phase 2 Automatic Recalculation is already closed on protected `main`:

- PR #232 merged as `a4589667604eb5f03dd4a8b2dfc6bf70b84021b9`;
- post-main CI #799 passed;
- production Pages #1515 passed.

Phase 3 is PR #233 on branch `feat/phase3-self-healing-snapshot`.

## Existing proof reused

The Python calculation engine already publishes:

```text
calculation_manifest
  -> deterministic_identity
     -> source_records
        -> canonicalization_version
        -> sha256
        -> record_count
        -> max_record_id
     -> runtime_config.benchmark_symbol
```

Phase 3 intentionally reuses this existing calculation evidence rather than inventing a D1 revision column or a second snapshot metadata system.

## Browser source-record identity

Implementation: `src/services/snapshotIntegrity.js`.

The browser reproduces the Python `source_records` canonicalization contract:

- material fields only: `id`, `Date`, `Symbol`, `Type`, `Qty`, `Price`, `Commission`, `Tax`, `Tag`;
- unique positive integer record IDs;
- exact calendar dates;
- `Symbol` / `Type` trim + uppercase;
- supported transaction types only;
- finite numeric fields;
- raw optional Tag semantics;
- rows sorted by `(Date, id)`;
- Python-compatible IEEE-754 `float.hex()` representation;
- versioned canonical JSON with recursively sorted object keys and compact separators;
- UTF-8 SHA-256.

The frontend regression suite contains a hard-coded digest calculated from the Python canonical algorithm:

`87d3299660d98bc027a2ee16bcb3dbb246098b5c4e7ca6faf83fa9b3328fdaa4`

This locks browser/Python identity parity rather than merely testing browser self-consistency.

## Integrity classification

`assessSnapshotIntegrity()` classifies one successful full read into:

| Status | Meaning | Auto repair |
|---|---|---|
| `empty` | authoritative record set empty | no |
| `fresh` | source identity + benchmark match | no |
| `missing` | records exist but no materialized snapshot | yes, bounded |
| `stale_source` | published source identity differs | yes, bounded |
| `stale_benchmark` | source matches but published benchmark differs from requested benchmark | yes, bounded |
| `unverifiable_manifest` | current/legacy-compatible manifest is missing required proof or malformed | yes, bounded once |
| `unsupported_manifest` | snapshot explicitly declares a future unsupported manifest/identity/canonicalization version | **no — fail closed** |
| `unverifiable_records` | authoritative records cannot be safely canonicalized | **no — fail closed** |

A cross-device EDIT is detected by SHA even when both `record_count` and `max_record_id` remain unchanged.

## Compatibility boundary

Legacy/current snapshots may omit additive metadata such as top-level `manifest_version` or runtime-config canonicalization version. Absence does not invalidate otherwise valid v1 deterministic evidence.

If one of those fields is explicitly present with a non-supported current value, the snapshot is malformed. If it explicitly declares a future version greater than the frontend-supported contract, the old frontend refuses automatic repair instead of attempting to reinterpret a newer contract.

This is intentional forward compatibility: **old frontend must not repair a snapshot whose semantics it does not understand.**

## Semantic repair fingerprint

Repair attempts are bounded by semantic anomaly fingerprint for one installed controller lifetime.

Fingerprint components use material evidence such as:

- current source SHA;
- manifest source SHA;
- manifest benchmark;
- requested benchmark;
- unsupported component/version.

`updated_at` is deliberately excluded. A calculation that republishes the same malformed/stale semantic evidence with a newer timestamp therefore does not create an unlimited sequence of new repair attempts.

## Phase 2 handoff

Implementation: `src/services/snapshotSelfHealing.js`.

The controller watches only `portfolioReadStatus === 'loaded'`, which means records/settings/snapshot completed through the full portfolio read path.

It does not call `/api/trigger-update` itself.

For a repairable anomaly:

1. normalize signed owner identity;
2. mark displayed snapshot stale;
3. reject repeat fingerprint in the current controller lifetime;
4. read existing Phase 2 durable state;
5. if Phase 2 is already dirty, do not replace its generation;
6. otherwise persist one Phase 2 dirty generation;
7. yield one task boundary so the just-completed `fetchAll` single-flight can release;
8. invoke one fresh `portfolio.fetchAll()` handoff;
9. Phase 2 resumes its existing debounce, active-lane, calculation job, coverage and polling logic.

If the handoff read fails, the durable Phase 2 dirty generation remains available for later safe recovery.

## Bootstrap

`src/main.js` installs exactly one controller using the same Pinia instance as the application:

```text
const auth = useAuthStore(pinia)
const portfolio = usePortfolioStore(pinia)
installSnapshotSelfHealing({ portfolio, auth, storage: localStorage })
```

This bootstrap was initially missing; CI #800 correctly caught that the service existed but the production application would never activate it.

## Failure chronology and root-cause corrections

### CI #800 — bootstrap failure

- Worker: PASS.
- Python: PASS.
- Frontend: 254/255 tests passed.
- Single failure: bootstrap contract.
- Root cause: `src/main.js` did not install the Phase 3 controller.
- Correction: minimal shared-Pinia bootstrap, no store rewrite.

### CI #801 — bootstrap correction

Exact head `53c1f6ed2bb9904337002c2bbf054e75e337743a`: full CI SUCCESS.

### Adversarial review after #801

Two additional correctness issues were found before merge:

1. repair fingerprints contained `updated_at`, allowing timestamp-only churn to evade the once-per-fingerprint bound;
2. future manifest versions were indistinguishable from current malformed manifests and could therefore be auto-repaired by an older frontend.

Both were corrected with executable regressions.

### CI #803 — compatibility over-tightening

The first future-version correction accidentally made two additive metadata fields mandatory. Existing valid legacy/current snapshots may omit them, so fresh evidence was misclassified as malformed.

Root cause correction:

- absent optional version metadata remains compatible;
- explicit supported v1 remains compatible;
- explicit future version fails closed;
- explicit unsupported current value remains malformed.

### CI #804 — code-bearing candidate

Exact head `316a7ba6af1c211a0fdae69232b7520d3b8c648c`: **SUCCESS** across Frontend, Worker and Python.

Frontend included the bootstrap, cross-language SHA, semantic fingerprint, future-version and legacy-compatibility regressions plus production build.

## Safety invariants

Before merge the final docs-bearing head must preserve all of these:

1. no Worker/D1/schema changes;
2. no financial formula, ledger, market-data or reconciliation changes;
3. malformed authoritative records never trigger auto repair;
4. explicit future snapshot contracts fail closed;
5. current/legacy valid deterministic evidence remains readable;
6. semantic fingerprint cannot be refreshed by timestamp-only churn;
7. one semantic anomaly is attempted at most once per installed controller lifetime;
8. existing Phase 2 dirty generation is never replaced;
9. Phase 3 never creates a second trigger/debounce/retry lane;
10. reconciliation begins only after a successful full read;
11. no Phase 3 transaction payload or new persistent browser key;
12. production bootstrap installs exactly one controller on the shared Pinia stores.

## Rollback

Phase 3 is frontend-only. Rollback is an ordinary revert of PR #233 / redeploy of the previous Pages source.

No Worker rollback, D1 migration rollback or financial data mutation is required.

## Merge/closure gate

CI #804 proves the code-bearing candidate only. This document and `to_do_update_list.md` advance the branch head.

Therefore before merging PR #233:

1. re-fetch protected `main` and PR head;
2. require a **fresh full CI on the exact documentation-bearing head**;
3. compare final diff against `main`;
4. perform final R2 adversarial review;
5. update PR body with exact final head and CI;
6. ordinary merge only;
7. require post-main CI success;
8. require production Pages success;
9. no real-user ledger mutation solely for smoke testing.

Only after those gates is Phase 3 `CLOSED` and Phase 4 AI failure triage/recovery allowed to become active.
