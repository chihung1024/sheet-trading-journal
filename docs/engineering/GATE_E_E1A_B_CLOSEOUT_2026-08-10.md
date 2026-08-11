# Gate E / E1a-B Closeout — Email-Free Production Privacy Cutover

Status: **CLOSED / PRODUCTION VERIFIED**  
Closeout date: **2026-08-10**  
Repository: `chihung1024/sheet-trading-journal`

## 1. Closed Contract

E1a-B required the normal authenticated calculation path to stop carrying tenant email through GitHub dispatch/log evidence while preserving the existing financial calculation and tenant-isolation behavior.

Final production path:

`authenticated user -> Worker creates durable opaque calculation job -> GitHub dispatch(job id + non-tenant parameters) -> workflow marks job running -> trusted runner resolves owner + durable benchmark through Worker -> unchanged financial calculation -> snapshot upload -> succeeded callback`

The trusted process/API boundary may internally carry the resolved owner where required for tenant isolation. The GitHub normal dispatch and application log evidence must not expose tenant email material.

## 2. Implementation and Runtime

Implementation PR:

- PR #186 — `Gate E E1a-B: remove tenant email from normal calculation dispatch`;
- merged runtime source: `R_B = 0e2ea514bfa1f0640f620db35490d2a1f728ec7e`;
- no D1 schema migration;
- financial `main.py` formulas unchanged;
- canonical Worker owns the trusted-system opaque-job lookup;
- temporary E1a-A compatibility shim removed after canonical ownership was established.

Runtime evidence before activation:

- Production Identity Evidence run #13 / `31413549090`: PASS against exact `R_B`;
- PR #187 created production activation authority for exact `R_B`;
- authority protected-main SHA: `A_B = fddbf65b18ae11b8b166c1f82346bc44431d057a`.

Production activation:

- Deploy Worker run #2 / `31415404201`: **SUCCESS**;
- workflow was dispatched from authority SHA `A_B` and deployed exact runtime `R_B` under the existing production gates.

## 3. Production Contract Verification

Reviewer-protected Production Contract Audit run #41 / `31415865919`: **SUCCESS**.

Verified after E1a-B deployment:

- expected runtime source matched `R_B`;
- generic version/health/schema/auth/CORS contract passed;
- trusted-system checks executed;
- valid-format intentionally nonexistent opaque job returned `404 NOT_FOUND`;
- compatibility/system proof returned no tenant identity.

## 4. Initial User Smoke and Privacy Blocker

Post-deploy normal user smoke:

- Update Portfolio Data #3226 / `31416468298`: functional **SUCCESS**;
- opaque calculation-job targeting worked;
- running -> calculation/upload -> succeeded lifecycle worked;
- canonical Daily PnL reconciliation passed;
- split-adjusted ledger parity passed.

However, application logs still displayed masked tenant email material such as a masked local-part plus domain. The dispatch was email-free, but the log evidence was not fully de-identified.

This was correctly classified as an E1a-B privacy BLOCKER rather than being waived as cosmetic.

## 5. Privacy Log Hotfix

PR #188 — `E1a-B hotfix: remove tenant email material from verified-job logs`.

Scope was limited to the verified opaque-job runner logging boundary plus deterministic tests. It did not change Worker runtime, authorization, tenant selection, benchmark provenance, financial calculations, D1/schema, frontend, or production authority.

R3 review found and fixed an initial generic-regex-only weakness. Final logic removes:

1. the exact trusted owner resolved for the current opaque job;
2. the repository's existing legacy masked representation;
3. additional email-shaped log tokens as defense in depth;
4. matching material in exception traceback and stack-info output.

Final PR #188 candidate:

`08809bac36227fc6b4d24e97ac2b3e39929fe34b`

Merged protected main:

`f6cf1769955dc18a093733a2e29b129b2443ddf0`

Post-main verification:

- CI #604: PASS;
- Pages #1474 / `31417821783`: SUCCESS;
- recovery: `backup-post-e1a-b-log-privacy-f6cf176`.

No Worker redeploy was required because #188 changed the GitHub runner logging boundary only. Production Worker remains exact `R_B`.

## 6. Final Post-Hotfix Production Smoke

Existing post-hotfix normal smoke was found during closeout re-baseline, so no additional manual trigger was necessary:

- Update Portfolio Data #3228 / `31433418502`;
- source SHA: exact post-hotfix main `f6cf1769955dc18a093733a2e29b129b2443ddf0`;
- event: `workflow_dispatch` through the normal calculation path;
- conclusion: **SUCCESS**.

Observed contract:

- opaque `CALCULATION_JOB_ID` present;
- normal calculation environment contains no tenant `TARGET_USER_ID` dispatch input;
- legacy email-only targeting guard not used;
- running callback passed;
- durable owner and durable benchmark resolved successfully;
- application log owner rendered only as `opaque-job-user`;
- calculation/upload passed;
- Canonical Daily PnL reconciliation passed;
- split-adjusted ledger parity passed;
- snapshot upload passed;
- terminal callback reported `succeeded`.

Sanitized durable evidence:

`docs/governance/evidence/GATE_E_E1A_B_FINAL_PRIVACY_SMOKE_2026-08-10.json`

No tenant identifier, calculation job id, API key, raw transaction data, or user-specific benchmark value is copied into the repository evidence.

## 7. Closeout Decision

All E1a-B production gates are now satisfied.

**Decision:**

- E1a-A: `CLOSED / PRODUCTION VERIFIED`;
- E1a-B: `CLOSED / PRODUCTION VERIFIED`;
- E1a overall privacy cutover: `CLOSED`;
- next single active Gate-E batch: **E1b**.

Do not repeat E1a production activation, identity evidence, production contract audit, or user smoke merely to restate the same already-proven state. Reopen E1a only for a new evidence-backed regression, production identity/runtime change affecting this contract, security/privacy incident, or explicit requirement change.

## 8. Next Batch — E1b

E1b remains the previously locked market-data integrity correction:

> Do not overwrite immutable historical EOD data with a realtime quote without proving date equivalence.

Direction:

- preserve immutable EOD historical series;
- keep realtime/current valuation as a separate explicit data channel;
- record provenance/as-of semantics;
- avoid changing unrelated provider architecture or broad ledger design;
- continue under normal risk-proportional implementation/review controls rather than reopening E1a governance.
