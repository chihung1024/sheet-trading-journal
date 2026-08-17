# R3.1A — Broker-Neutral Export & Backup Foundation — Production Closeout

Date: 2026-08-17 (Asia/Taipei)

Status: **CLOSED / PRODUCTION VERIFIED**

## Primary Goal

Give the authenticated user a deterministic, user-controlled backup of authoritative journal source data without relying on browser-local state, derived portfolio projections, or broker-specific assumptions.

## Delivered product behavior

R3.1A added a `資料備份` action on the authenticated overview that:

- freshly reads all tenant-scoped transaction pages from `/api/records`;
- freshly reads tenant-scoped `/api/cash-events`;
- preserves the server's durable transaction note envelope instead of exporting the UI-projected IBKR journal note;
- serializes a versioned JSON package;
- includes authoritative transaction records and explicit cash events;
- strips tenant identity and internal idempotency/hash fields;
- excludes access credentials, browser-local state, and derived portfolio snapshots;
- fails closed on malformed responses, pagination cursor cycles, duplicate IDs, or unreviewed future server fields;
- retries one authentication 401 through the existing auth refresh authority;
- creates only a user download and introduces no restore/import mutation.

## Authority boundary

The production data direction is:

```text
authenticated tenant-scoped durable reads
→ reviewed export contract
→ deterministic validation/serialization
→ user-controlled download
```

The frontend portfolio store is not backup authority. Existing UI record projection helpers are intentionally bypassed because they are presentation-oriented and can transform the durable note envelope.

## Security / privacy boundary

The backup contract deliberately does not export:

- bearer/access/refresh credentials;
- unnecessary tenant identity;
- server idempotency/internal hashes;
- localStorage or browser cache state;
- derived portfolio snapshot/cache data.

The public repository closeout records only that the production download succeeded. It does not record the user's exported financial contents or transaction/cash counts.

## Implementation / review evidence

Feature PR: **#337 — `feat: add broker-neutral journal backup export`**

Frozen exact head: `089c18be09fc7066a31ace3c57e2bebcd10f4a4b`

Feature merge commit: `1a770a2e0f40588f95e2410ec91db5e0dd43ab70`

Evidence:

- exact-head CI #1152: SUCCESS;
- frontend contracts + production build: SUCCESS;
- Python tests + branch-coverage baseline: SUCCESS;
- Worker security/recovery + D1 baseline: SUCCESS;
- frozen exact-head review: PASS / BLOCKER 0 / FOLLOW-UP 0;
- post-main CI #1153: SUCCESS;
- Pages #1617 on the feature merge head: SUCCESS.

An earlier CI #1151 failed only because a regression-test regex treated the negative manifest key `derived_portfolio_snapshot_included:false` as though snapshot data were exported. The production implementation was unchanged; the test was corrected to assert the contract semantically. CI #1152 then passed on the frozen head.

## Production evidence

After Pages #1617 completed successfully, the authenticated user executed the new production `下載備份` action and confirmed that the backup downloaded successfully.

This proves the production path reached the real authenticated APIs, validated/serialized the returned durable data, and completed the browser download lifecycle.

No backup file, credentials, personal transaction values, cash values, or counts are required or versioned for this gate.

## Runtime boundary

R3.1A is frontend/service-only.

- no Worker behavior change;
- no D1 schema change;
- no Worker deployment;
- no accounting/cash/FX/performance methodology change;
- no broker parser;
- no restore write path.

## Exit-criteria result

All R3.1A exit criteria are satisfied:

1. explicit versioned export contract — PASS;
2. authoritative vs derived boundary documented/tested — PASS;
3. tenant-scoped authenticated reads — PASS;
4. durable financial fields preserved without inference — PASS;
5. one-action user backup UX — PASS;
6. incomplete/unreviewed responses fail closed — PASS;
7. full CI + frozen exact-head review — PASS;
8. production Pages + real authenticated download evidence — PASS;
9. restore mutation / broker-specific parser excluded — PASS.

## Convergence decision

R3.1A is closed. Do not continue expanding export formats merely for technical neatness.

The next product gap is that a backup is not yet recoverable inside the product. The next Primary Active Batch is therefore:

**R3.1B — Safe Restore / Import Foundation**

Primary objective: define and implement a deterministic, reviewable restore/import path that validates a versioned journal backup, previews effects before mutation, preserves tenant isolation, and uses idempotent writes without destructive overwrite or financial inference.

Before any production write path is implemented, R3.1B must trace existing transaction/cash mutation contracts and decide explicit semantics for:

- backup schema/version validation;
- duplicate recognition and idempotency;
- empty tenant vs existing tenant behavior;
- ID recreation vs durable business-field reconstruction;
- transaction and cash-event ordering constraints;
- conflict handling;
- dry-run/preview UX;
- partial failure / retry recovery.

Destructive replace-all restore, guessed financial facts, broker-specific core assumptions, and whole-account performance-methodology changes remain rejected unless separately promoted by evidence.
