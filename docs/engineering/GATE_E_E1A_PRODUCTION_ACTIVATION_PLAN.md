# Gate E / E1a Production Activation & Zero-Downtime Cutover Plan

Status: **COMPLETED / HISTORICAL OPERATIONAL RECORD — E1a CLOSED**  
Completed: **2026-08-10**  
Runtime contract: Worker `4.07` / API `2.60` / D1 Schema `2`

> This file records the completed E1a activation/cutover sequence. It is no longer the active-batch handoff. Current execution state is `to_do_update_list.md`; E1a closeout authority is `docs/engineering/GATE_E_E1A_B_CLOSEOUT_2026-08-10.md`.

## 1. Goal and Result

E1a had two zero-downtime phases:

1. **E1a-A:** activate a temporary trusted-system opaque calculation-job compatibility path while preserving the existing email-targeted user path;
2. **E1a-B:** move the normal user-triggered GitHub calculation path to opaque job targeting with no tenant email in normal dispatch/log evidence, then remove the temporary compatibility shim after canonical Worker ownership was safe.

Both phases are now **CLOSED / PRODUCTION VERIFIED**.

No Schema 3 migration occurred. Financial `main.py` formulas were not changed by the privacy cutover.

## 2. E1a-A Completed Activation

E1a-A compatibility entered protected main at:

`c312408fec7a27a7b713ad5da79bf93bce62481f`

Production activation used the deliberate runtime/authority split:

- runtime `R = 2d1fc1cd7190651c64b764c58f58d67826d408e8`;
- activation authority `A = 0d4896d3161eebfea3dd9bec16b57b6e061cbf04`.

Primary evidence:

- Production Identity Evidence #11 / `31364597982`: PASS;
- production D1 identity pinned from reviewed evidence;
- Production Identity Evidence #12 / `31366644577`: PASS against exact `R`;
- Deploy Worker #1 / `31368153511`: Worker deploy succeeded; final workflow failure was a stale-edge verification race later fixed by PR #183;
- Production Contract Audit #40 / `31386148724`: PASS;
- trusted-system valid nonexistent opaque job => `404 NOT_FOUND`, no tenant identity;
- authenticated legacy user smoke #3222 / `31386988867`: PASS;
- PR #185 closed E1a-A and handed off to E1a-B.

Historical detailed closeout:

`docs/engineering/GATE_E_E1A_A7_CLOSEOUT_2026-08-10.md`

## 3. E1a-B Completed Privacy Cutover

Implementation PR #186 changed the normal hosted calculation path to:

`authenticated user -> Worker durable opaque job -> GitHub dispatch(job id + non-tenant parameters) -> running callback -> trusted runner resolves owner + durable benchmark -> unchanged financial calculation -> snapshot upload -> succeeded callback`

The normal dispatch no longer carries tenant email. Durable job benchmark is authoritative; dispatch divergence fails closed. Audit-only targeting remains separately scoped.

Merged E1a-B runtime:

`R_B = 0e2ea514bfa1f0640f620db35490d2a1f728ec7e`

Activation/evidence chain:

- Production Identity Evidence #13 / `31413549090`: PASS against exact `R_B`;
- PR #187 authorized exact `R_B`;
- authority `A_B = fddbf65b18ae11b8b166c1f82346bc44431d057a`;
- Deploy Worker #2 / `31415404201`: **SUCCESS**;
- Production Contract Audit #41 / `31415865919`: **SUCCESS** against exact `R_B`, including system checks and opaque-job `404 NOT_FOUND` proof with no tenant identity.

## 4. E1a-B Privacy Log Blocker and Fix

Initial post-deploy smoke #3226 / `31416468298` was functionally successful but still emitted masked tenant email material in application logs. This remained an E1a-B blocker because the target contract covered both dispatch and log evidence.

PR #188 fixed only the verified opaque-job logging boundary:

- exact trusted owner removal;
- exact existing masked variant removal;
- generic email-shaped defense in depth;
- exception traceback and stack-info redaction;
- scheduled/all-user and local legacy paths remain outside the verified-job filter.

Final PR #188 merge:

`f6cf1769955dc18a093733a2e29b129b2443ddf0`

Post-main:

- CI #604: PASS;
- Pages #1474 / `31417821783`: SUCCESS;
- recovery `backup-post-e1a-b-log-privacy-f6cf176`.

No Worker redeploy was needed after #188; production runtime remains exact `R_B`.

## 5. Final Production Privacy Smoke

A valid post-hotfix normal smoke already existed and was discovered during closeout re-baseline:

- Update Portfolio Data #3228 / `31433418502`;
- source `f6cf1769955dc18a093733a2e29b129b2443ddf0`;
- event `workflow_dispatch` from the normal calculation path;
- opaque `CALCULATION_JOB_ID` present;
- no normal tenant email dispatch input;
- application tenant label only `opaque-job-user`;
- running callback: PASS;
- durable owner/benchmark resolution: PASS;
- calculation/upload: PASS;
- Canonical Daily PnL reconciliation: PASS;
- split-adjusted ledger parity: PASS;
- snapshot upload: PASS;
- terminal callback: `succeeded`;
- workflow conclusion: **SUCCESS**.

Sanitized evidence:

`docs/governance/evidence/GATE_E_E1A_B_FINAL_PRIVACY_SMOKE_2026-08-10.json`

Final closeout:

`docs/engineering/GATE_E_E1A_B_CLOSEOUT_2026-08-10.md`

## 6. Convergence / Do Not Repeat

E1a is closed. Do not repeat Production Identity Evidence, Deploy Worker, Production Contract Audit, or user smoke solely to recreate an already-valid checkpoint.

Reopen E1a only if new evidence shows one of the following:

- production runtime/identity changed in a way that affects the privacy contract;
- tenant email reappears in the normal dispatch or application logs;
- opaque-job authorization/ownership/benchmark provenance regresses;
- a production security/privacy incident occurs;
- the user explicitly changes the requirement.

Failed historical runs remain forensic evidence and must not be erased or rewritten.

## 7. Runtime / Main Separation

The production Worker is intentionally pinned to:

`R_B = 0e2ea514bfa1f0640f620db35490d2a1f728ec7e`

Protected main may be newer because later docs, runner-only, or product batches do not necessarily require a Worker redeploy.

Do not interpret `main != R_B` as deployment drift by itself.

## 8. Next Gate-E Batch

**E1b is now ACTIVE.**

Locked problem:

> Historical EOD `Close` / adjusted observations must not be overwritten by a realtime quote unless date equivalence is explicitly proven.

Direction:

- immutable historical EOD series;
- separate realtime/current valuation channel;
- explicit provenance/as-of semantics;
- no broad provider/ledger/Schema-3 expansion unless new evidence justifies it.

Current execution handoff and exact next action are in:

`to_do_update_list.md`
