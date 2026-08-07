# V5 Execution History — Entry 012 — D3D Phase Closeout and Duplicate-Path Archive

- Closeout time: `2026-08-07T17:55:00+08:00`
- Authoritative baseline before closeout docs: `main@0c3d7162de96b569abbd7c679e09dc29bb9fd2fe`
- Baseline tree: `a98c25828041ebf6d6c5df8e32387fda98bffba1`
- Pre-closeout recovery: `backup-pre-d3d-closeout-0c3d716`
- Closeout branch: `pr-d3d-phase-closeout-20260807`
- Runtime: Worker `4.07` / API `2.60` / Schema `2`
- Runtime/data/schema mutation: **none**

## Why this closeout exists

The D3D governance stream produced substantial deployment-safety value, but continuing to create increasingly overlapping evidence/verifier layers would provide low marginal product value and increase maintenance ambiguity. The user requested a staged stop point with all non-blocking deferred work and recovery history preserved for future AI agents.

This entry therefore does not try to make every D3D finding green. It records a deliberate boundary: production activation remains fail closed, while routine engineering work returns to product/data/calculation/UX priorities.

## Canonical D3D chain

1. PR `#126` — D3D-A production activation gate hardening. Merged at `4dda2dacd05779ec5a53a46a17b5ea4d4d2733b6`. Final reviewed head `0867bca32677b192701f46dda8d56a7fc9df11a5`. This established the fail-closed production activation architecture and Recovery Evidence Gate.
2. PR `#127` — D3D-A closeout evidence/docs. Merged at `3024dde0ea148a3997782614da5ca8100462d010` after protected CI.
3. GitHub release `4.07.4` — governance/evidence checkpoint at exact `3024dde0ea148a3997782614da5ca8100462d010`. It is not a Worker runtime 4.07.4 release.
4. PR `#128` — release-evidence closeout. Merged at `6bf0f4002ac6ed7fead64d49084ac31c1d33fb39`.
5. PR `#129` — canonical D3D-B1 GET-only production identity evidence collector. Final head `d4d83a1ff0dfd30dabbaa989b13b084f695be244`; merged at `0c3d7162de96b569abbd7c679e09dc29bb9fd2fe`.
6. PR `#130` — overlapping second D3D-B implementation. Closed **without merge** after discovering that PR #129 was already the canonical merged path. Preserved branch `pr-10d3d-b-production-readonly-evidence`, head `9f5ca31e496a6af1a4d601a5e6ebc64a41992438`.

## Verification at the stop point

PR #129:

- required CI `31165097984` / CI #315: **SUCCESS**;
- Production Identity Evidence PR workflow `31165100768` / run #9: **SUCCESS**;
- protected merge completed without a production deployment or D1/schema/data mutation.

Post-merge `main@0c3d7162de96b569abbd7c679e09dc29bb9fd2fe`:

- CI `31165272521` / CI #316: **SUCCESS**;
- Pages `31165270021` / Pages #1419: **SUCCESS**.

The closeout deliberately does **not** dispatch the reviewer-protected production control-plane evidence job. That action is deferred until a real production activation is being prepared.

## Duplicate PR #130 history preserved

The overlapping PR #130 public evidence workflow had already demonstrated that its public production proof path could pass. Its later CI failure was not a product/runtime failure; the new workflow had not been registered in the existing GitHub Actions supply-chain inventory. A minimal inventory registration commit `9f5ca31e496a6af1a4d601a5e6ebc64a41992438` was created before the duplication was recognized.

Rather than continue two competing implementations, PR #130 was closed unmerged and marked `SUPERSEDED — DO NOT MERGE`. This is the selected root-level cleanup because maintaining one canonical evidence mechanism is safer than merging redundant verification machinery.

## Deferred, non-blocking items

The following remain intentionally open and must not be interpreted as current application incidents:

- N58: remove production frontend fallback only after explicit Pages environment proof;
- N61: live production CSP evidence, available through the canonical evidence collector when activation work resumes;
- N62: real staging-audience Google ID token rejection test; do not fabricate evidence;
- N64: authoritative production D1 identity proof and later reviewed pinning;
- N69: dedicated least-privilege Cloudflare audit token hardening;
- N59/N60: stricter GitHub approval/admin-bypass governance if desired;
- RISK-032: longer-lived artifact-retention strategy;
- Schema 3: still prohibited until genuine Recovery Evidence Gate proof exists.

## Recovery and continuation

Recovery points that should remain discoverable:

- `backup-pre-10d3d-74fe120`;
- `backup-post-10d3d-4dda2da`;
- `backup-d3d-a-closed-3024dde`;
- D3D-B-specific recovery branches already recorded in PR #129 evidence;
- `backup-pre-d3d-closeout-0c3d716`.

The current navigation document is `docs/governance/V5_CURRENT_HANDOFF.md`. Future AI agents should read it before deciding whether to resume production-governance work.

## Next-program direction

The recommended default next phase is not more D3D governance. It is staged product correctness and usability work: backtest mathematics, market-data quality, corporate actions, FX/calendar alignment, Universe coverage semantics, portfolio valuation/rebalancing, and user-visible frontend/mobile UX. Production activation evidence should resume only when a production activation is actually intended.
