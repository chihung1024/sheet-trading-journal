# TO-DO / UPDATE LIST — Current Execution Handoff

> **FIRST-READ CURRENT STATE.** Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this file, then re-check GitHub remote truth before acting. Historical detail belongs in dedicated evidence/closeout records and Git history. Remote truth overrides stale prose.

Last updated: **2026-08-11**

---

## 1. Current Stable Runtime / Repository State

Repository: `chihung1024/sheet-trading-journal`

Current protected-main baseline after E1b implementation merge:

`419ef87604bd35485c1df6dfce963016cb7aa0cb`

Current production Worker runtime remains intentionally pinned to the E1a-B runtime source:

`R_B = 0e2ea514bfa1f0640f620db35490d2a1f728ec7e`

Production activation authority used for E1a-B deployment:

`A_B = fddbf65b18ae11b8b166c1f82346bc44431d057a`

Important:

> Protected-main HEAD and deployed Worker runtime SHA are intentionally allowed to differ. Do not redeploy merely because `main` is newer than `R_B`.

Runtime contract remains Worker `4.07` / API `2.60` / D1 Schema `2` unless a later explicit runtime change says otherwise.

---

## 2. Current Phase

### Gate E

- E0 architecture re-baseline: `CLOSED`.
- E1a-A compatibility activation: `CLOSED / PRODUCTION VERIFIED`.
- E1a-B email-free privacy cutover: `CLOSED / PRODUCTION VERIFIED`.
- E1b market-data historical/realtime separation: **`CLOSED / PRODUCTION VERIFIED`**.
- **E1c active-job lifecycle/idempotency: `ACTIVE / NEXT IMPLEMENTATION BATCH`.**
- E1d cursor-signing secret separation: `PLANNED`.
- Schema 3 / E2: `DEFERRED` until E1 + E2-pre conditions.

E1a closeout authority:

`docs/engineering/GATE_E_E1A_B_CLOSEOUT_2026-08-10.md`

Final sanitized E1a privacy-smoke evidence:

`docs/governance/evidence/GATE_E_E1A_B_FINAL_PRIVACY_SMOKE_2026-08-10.json`

E1b closeout authority:

`docs/engineering/GATE_E_E1B_MARKET_DATA_INTEGRITY_2026-08-11.md`

Final sanitized E1b production-smoke evidence:

`docs/governance/evidence/GATE_E_E1B_PRODUCTION_SMOKE_2026-08-11.json`

---

## 3. Governance Baseline

`AI_PROJECT_PLAYBOOK.md` V3.0 remains the locked governance constitution.

```text
GOVERNANCE BASELINE LOCKED
Governance Architecture: FROZEN
```

Use risk-proportional governance. Do not reopen completed E1a/E1b loops merely to restate already-proven production state. Reopen only for a new evidence-backed regression, production/runtime identity change affecting the contract, security/privacy/data-integrity incident, or explicit requirement change.

### Execution-convergence rule

For completed batches:

1. reuse valid fresh evidence when it already proves the required condition;
2. do not request a new manual GitHub Action solely because the previous conversational checkpoint was missed;
3. distinguish implementation verification from documentation closeout;
4. once a gate is closed, advance to the next planned batch instead of recursively re-auditing the prior gate.

---

## 4. E1a Production Evidence Summary

### E1a-A

E1a-A established the temporary compatibility capability and safely activated it through the production identity/authority/deployment chain.

Key production evidence:

- Production Identity Evidence #11 / `31364597982`: PASS;
- production D1 identity pinned;
- runtime `R = 2d1fc1cd7190651c64b764c58f58d67826d408e8`;
- Production Identity Evidence #12 / `31366644577`: PASS against exact `R`;
- activation authority `A = 0d4896d3161eebfea3dd9bec16b57b6e061cbf04`;
- Deploy Worker #1 / `31368153511`: deploy succeeded; final verifier race later root-caused/fixed;
- Production Contract Audit #40 / `31386148724`: PASS;
- authenticated legacy-path smoke #3222 / `31386988867`: PASS;
- PR #185 closed E1a-A.

### E1a-B implementation

PR #186 removed tenant email from the normal GitHub calculation dispatch and made durable opaque-job owner + benchmark context authoritative/fail-closed.

Merged runtime:

`R_B = 0e2ea514bfa1f0640f620db35490d2a1f728ec7e`

Production activation chain:

- Production Identity Evidence #13 / `31413549090`: PASS against exact `R_B`;
- PR #187 authorized exact `R_B`;
- authority `A_B = fddbf65b18ae11b8b166c1f82346bc44431d057a`;
- Deploy Worker #2 / `31415404201`: SUCCESS;
- Production Contract Audit #41 / `31415865919`: SUCCESS against exact `R_B`, including trusted-system opaque-job `404 NOT_FOUND` proof with no tenant identity.

Initial post-deploy smoke #3226 / `31416468298` was functionally successful but exposed masked tenant email material in application logs. That was correctly treated as a privacy blocker.

PR #188 fixed the verified opaque-job logging boundary without changing Worker runtime/authorization/financial behavior. Final merge:

`f6cf1769955dc18a093733a2e29b129b2443ddf0`

Post-main:

- CI #604: PASS;
- Pages #1474 / `31417821783`: SUCCESS;
- recovery `backup-post-e1a-b-log-privacy-f6cf176`.

Final post-hotfix normal production smoke:

- Update Portfolio Data #3228 / `31433418502`;
- exact source `f6cf1769955dc18a093733a2e29b129b2443ddf0`;
- normal opaque calculation-job path;
- no tenant email dispatch input;
- application tenant label only `opaque-job-user`;
- running -> durable context -> calculation/upload -> reconciliation -> snapshot upload -> succeeded callback;
- conclusion: SUCCESS.

---

## 5. E1b Production Evidence Summary

### Root cause closed

Legacy market-data ingestion could overwrite the final downloaded historical EOD row with an undated/current stock quote without proving date equivalence.

E1b now enforces:

- downloaded historical daily rows are immutable with respect to realtime stock quotes;
- undated stock scalar quotes cannot mutate historical EOD;
- newer-date synthetic `realtime_quote` rows require provider timestamp/date proof;
- quote-date corporate-action evidence must be complete and zero-action, otherwise fail closed;
- same-date/older/stale evidence never overwrites or appends;
- synthetic realtime valuation carries explicit provenance and enters deterministic market-input identity.

### R3 implementation / review / merge

- first candidate `f47900901d93dc59f7f1c985c4382b408ea2c523` passed CI #609 but R3 review found a corporate-action-date BLOCKER;
- blocker was fixed by requiring complete zero-action intraday evidence;
- final candidate `1e0f40b2491dfdcdc5e6fa150d86b760f270d66f`;
- CI #612 / `31449796567`: PASS, including 444 Python tests + 18 subtests and unchanged raw-count coverage policy;
- fresh R3 Same-AI Independent Review: PASS / no BLOCKER;
- PR #190 expected-head merge: `419ef87604bd35485c1df6dfce963016cb7aa0cb`;
- post-main CI #613 / `31450139272`: SUCCESS;
- Pages #1476 / `31450139000`: SUCCESS;
- post-merge recovery `backup-post-e1b-market-data-integrity-419ef87`.

### Production smoke

Update Portfolio Data #3230 / `31453892608`:

- exact source `419ef87604bd35485c1df6dfce963016cb7aa0cb`;
- normal workflow-dispatch opaque calculation-job path;
- 108 transaction records;
- 33 requested market symbols;
- no legacy realtime historical-overwrite application log;
- no unnecessary realtime synthetic row under the observed market state;
- transaction-prefix integrity PASS;
- canonical Daily PnL reconciliation PASS for 2 groups, formula = components = `-24975.10`;
- legacy Daily PnL diagnostics 0;
- split-adjusted ledger parity PASS for 108 BUY/SELL rows;
- snapshot upload SUCCESS;
- successful users 1 / failed users 0;
- durable job terminal status `succeeded`;
- workflow conclusion SUCCESS.

E1b is therefore **CLOSED / PRODUCTION VERIFIED**. Do not repeat the smoke unless a new E1b-specific regression is evidenced.

---

## 6. Current Primary Batch — E1c

### Problem

Current calculation-job duplicate/idempotency semantics use a fixed pending-age window while the real workflow can remain legitimately queued/running longer than that window.

That creates a correctness risk: an old-enough but still active queued/running job may be treated as no longer active, allowing a duplicate calculation dispatch or inconsistent frontend/job state.

### Locked direction

Do **not** solve E1c by merely increasing a TTL.

Required semantic direction:

1. queued/running lifecycle state is authoritative for active-job status independently of age;
2. terminal states are explicitly distinguished from active states;
3. retry/recovery behavior must be explicit and fail closed where job ownership/state is ambiguous;
4. duplicate dispatch prevention must align Worker, frontend pending semantics, GitHub workflow callbacks, and durable D1 state;
5. preserve existing E1a opaque-job privacy/authorization boundaries;
6. do not expand into E1d cursor-secret work, Schema 3, broad ledger/provider redesign, Decimal migration, tenant UUID migration, or derivatives.

### Required E1c execution order

```text
remote-truth re-baseline
-> map job creation / duplicate detection / status transitions / timeout-age checks
-> identify Worker + frontend + workflow + D1 lifecycle consumers
-> define active / terminal / recovery invariants
-> narrow implementation + regression tests
-> risk-proportional exact-head CI/review
-> expected-head merge
-> required deployment/production verification based on actual runtime boundary
-> update this handoff
-> E1d ACTIVE
```

Do not assume a Worker production deployment is or is not required before the exact E1c changed-runtime boundary is known.

---

## 7. Later Locked Findings

### E1d

Separate cursor-signing secret from system API authentication secret/rotation boundary.

### Schema 3 / E2

Remain deferred. Do not reopen broad ledger/provider/tenant migration work until E1 completes and E2-pre supplies evidence.

---

## 8. Recovery / Evidence References

Preserve at minimum:

- `backup-post-gate-e-e1a-a-c312408`;
- `backup-post-gate-e-a2-2d1fc1c`;
- `backup-post-gate-e-a4-0d4896d`;
- `backup-post-a5-verification-hotfix-4ee0184`;
- `backup-post-a6-compatibility-proof-210e004`;
- E1a-A closeout/recovery refs from PR #185;
- `backup-pre-e1a-b-34a6145`;
- E1a-B runtime/authority evidence from PR #186/#187;
- Deploy Worker #2 / `31415404201`;
- Production Contract Audit #41 / `31415865919`;
- privacy-blocking smoke #3226 / `31416468298`;
- `backup-pre-e1a-b-log-privacy-hotfix-fddbf65`;
- `backup-post-e1a-b-log-privacy-f6cf176`;
- final E1a-B privacy smoke #3228 / `31433418502`;
- `backup-pre-e1a-b-closeout-f6cf176`;
- `backup-pre-e1b-market-data-integrity-82c004c`;
- E1b PR #190 and final candidate `1e0f40b2491dfdcdc5e6fa150d86b760f270d66f`;
- E1b merge `419ef87604bd35485c1df6dfce963016cb7aa0cb`;
- `backup-post-e1b-market-data-integrity-419ef87`;
- E1b production smoke #3230 / `31453892608`;
- `docs/governance/evidence/GATE_E_E1B_PRODUCTION_SMOKE_2026-08-11.json`.

Failed runs and superseded blocker candidates remain forensic evidence; do not erase or reframe them as if they never occurred.

---

## 9. Next Exact Action

**Do not run another E1a or E1b smoke/audit/deploy.**

Start E1c only after this E1b closeout/handoff PR merges and post-main verifies.

First E1c task:

> map exactly where calculation jobs are created, how duplicate/active jobs are detected, where pending-age/TTL logic is applied, every queued/running/terminal status transition, frontend pending semantics, workflow callbacks, and D1 lifecycle fields; then define the smallest lifecycle-based idempotency contract before implementation.
