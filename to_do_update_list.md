# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → re-check GitHub remote truth before consequential action. Remote systems override stale prose. Historical plans and audits are evidence sources, not automatic execution authority. Operational quality aid: `docs/governance/DOCUMENT_QUALITY_STANDARD.md` (subordinate to the Playbook; no independent Gate authority).

Last updated: **2026-08-12 13:20 Asia/Taipei**  
Handoff revision: **E1c-A.1 CLOSED / E1c-B BROWSER RECOVERY PARTIAL PASS / MD-NAN-B1 MERGED + POST-MAIN VERIFIED / PRODUCTION OBSERVATION PENDING**

---

## 1. Primary Product Goal

Deliver a reliable Trading Journal user flow:

```text
login
→ view/manage transactions
→ trigger portfolio update
→ observe durable calculation progress
→ recover after refresh/reopen
→ publish/read correct holdings and performance
→ surface actionable success/failure state
```

The project goal is product correctness and usability. Governance, CI/CD, deployment tooling, audit evidence, and documentation exist only to support that goal.

**Convergence means finish necessary work and stop unnecessary expansion. It does not mean closing a Batch while a known material functional/correctness defect remains unresolved.**

---

## 2. Project Status

| Area | Status | Remote-truth note |
|---|---|---|
| Gate A | DONE | closed |
| Gate B | DONE | closed |
| Gate C | DONE | closed / post-main verified |
| Gate D | DONE | D1a–D1e closed / post-main verified |
| Gate E / E0 | DONE | architecture re-review closed |
| E1a | DONE | production completed |
| E1b | DONE | production completed |
| E1c-A.1 | **CLOSED / PRODUCTION VERIFIED** | do not reopen without new material dispatch-binding evidence |
| E1c-B implementation | **MERGED** | PR #206 merged into `main` |
| E1c-B exact-head review/CI | **VERIFIED** | review PASS; exact-head CI #676 SUCCESS |
| E1c-B post-main CI | **VERIFIED** | CI #677 SUCCESS |
| E1c-B frontend deployment | **VERIFIED** | Pages deployment SUCCESS |
| E1c-B workflow/calculation/snapshot production path | **VERIFIED** | scheduled #3242 SUCCESS; authenticated #3244 SUCCESS |
| E1c-B authenticated browser recovery | **PARTIAL PRODUCTION PASS** | user observed queued/pending state after logout → login during live production activity; terminal browser cleanup still requires direct observation |
| Market-data NaN residual | **MITIGATION MERGED / PRODUCTION VERIFICATION PENDING** | #3243 reproduced blocker; PR #210 bounded same-provider mitigation is now on main |
| MD-NAN-B1 implementation | **MERGED / POST-MAIN VERIFIED** | PR #210 final head `644a2a7...`; merge `a8b03877...`; post-main CI #697 SUCCESS |
| MD-NAN-B1 production observation | **PENDING** | no post-merge `Update Portfolio Data` run observed yet; #3244 predates the fix |

**Primary Active Batch is now MD-NAN-B1 production observation only.** There is no remaining MD-NAN-B1 implementation work unless post-merge production evidence demonstrates a material regression. After that observation, return immediately to the one remaining E1c-B browser terminal-cleanup closeout check.

---

## 3. Stable State

### E1c-B product implementation baseline

PR #206 merged product implementation baseline:

`fdc1199bea47a2e47f38e2737827f1a2e38451f2`

Commit:

`Merge PR #206: E1c-B lifecycle recovery and retained queue`

This SHA is the **E1c-B product-code baseline**, not a durable assertion that it remains the latest `main` after later merges. Always re-check GitHub remote truth for the current `main` head before consequential action.

### E1c-B merge evidence

PR #206 — `E1c-B: retain browser recovery and workflow queue`

- base at implementation start: `edda781e48383d2f185d7d3c2cbe07f3feb21091`;
- final PR head: `7f6eaee6ef0ff1c03501e3e354ae7cd216013e14`;
- merge commit / product baseline: `fdc1199bea47a2e47f38e2737827f1a2e38451f2`;
- changed files: 5;
- Independent Review: **PASS / NO REVIEW BLOCKER** on exact head;
- exact-head CI #676 / run `31559136662`: **SUCCESS**;
- post-main CI #677 / run `31559255388`: **SUCCESS**;
- Pages deployment run `31559254780`: **SUCCESS**.

### Post-merge production workflow evidence

`Update Portfolio Data #3242` / run `31560257260`:

- event: `schedule`;
- head: E1c-B product baseline `fdc1199bea47a2e47f38e2737827f1a2e38451f2`;
- workflow conclusion: **SUCCESS**;
- market-data download: **SUCCESS** for 53 symbols, including `0050.TW` and `2330.TW`;
- portfolio calculation: **SUCCESS**;
- transaction prefix integrity: **PASS** for both users;
- canonical Daily PnL reconciliation: **PASS**;
- split-adjusted ledger parity: **PASS**;
- snapshot upload: **SUCCESS** for both users;
- final result: **2 users succeeded / 0 failed**;
- no `MARKET_DATA_FAILED` or `NaN selected-price provider row` evidence observed.

Because #3242 was a scheduled run, `CALCULATION_JOB_ID` was empty and lifecycle callback steps were correctly skipped. Therefore #3242 verifies the production workflow/calculation/snapshot path but not browser lifecycle recovery.

### Authenticated production lifecycle evidence after PR #206

`Update Portfolio Data #3243` / run `31563691963`:

- event: `workflow_dispatch`;
- head: `1b8ed8f60c804de1964e76dbf0008f093cbb4798`;
- `Mark calculation job running`: **SUCCESS**;
- user production observation while the job lifecycle was active: **logout → login still displayed queued/pending state**;
- calculation result: **FAILED / MARKET_DATA_FAILED** due provider selected-price NaN rows;
- terminal failed lifecycle callback: **SUCCESS**;
- workflow conclusion: **FAILURE**, intentionally reflecting calculation failure rather than callback failure.

This is material evidence that a live pending calculation identity can survive an authentication/session restart and be recovered by the deployed frontend. It does **not** by itself prove browser terminal cleanup because direct post-terminal UI observation has not yet been recorded.

`Update Portfolio Data #3244` / run `31563887062`:

- event: `workflow_dispatch`;
- same pre-fix main head `1b8ed8f60c804de1964e76dbf0008f093cbb4798`;
- `Mark calculation job running`: **SUCCESS**;
- all requested market-data paths downloaded without selected-price NaN diagnostics;
- transaction prefix integrity: **PASS** for 144 rows;
- canonical Daily PnL reconciliation: **PASS** for both groups;
- split-adjusted ledger parity: **PASS** for 144 BUY/SELL rows;
- snapshot upload: **SUCCESS**;
- terminal succeeded lifecycle callback: **SUCCESS**;
- final result: **1 user succeeded / 0 failed**;
- workflow conclusion: **SUCCESS**.

#3244 occurred before MD-NAN-B1 merged and therefore is **not** evidence that the fix works. It proves only that the #3243 provider-row defect was transient under unchanged application code.

### MD-NAN-B1 merged product baseline

PR #210 — `Market data: bounded same-provider re-fetch for transient NaN rows`

- base: `1b8ed8f60c804de1964e76dbf0008f093cbb4798`;
- final PR head: `644a2a7e2ba96dac65ab5c68ba1ceb277ab1501b`;
- runtime/test implementation head: `ecf5873d8c31e93b29c99107649e63b3a16e2eb5`;
- final Independent Review ID `4913241814`: **PASS / NO REVIEW BLOCKER** on exact final head;
- final exact-head CI #696 / run `31565889026`: **SUCCESS**;
- merge commit / MD-NAN-B1 product baseline: `a8b03877449e885df935389e63fc23e6eb765dd2`;
- post-main CI #697 / run `31566063069`: **SUCCESS**;
- Pages #1495 / run `31566062067`: build/deploy **SUCCESS**;
- production `Update Portfolio Data` observation after merge: **PENDING**.

The merged change is limited to same-provider market-data retrieval resilience, regression tests, sanitized evidence, engineering RCA/contract, and handoff state. It does not alter Worker/D1/lifecycle/snapshot/calculation formulas.

### Runtime baseline carried from E1c-A.1

Deployed Worker runtime source:

`fe5f091fdb2c92970dff74c1a7c99052084adb95`

Live Worker version:

`68f32cee-c609-4624-aaff-eaa55ef0c77d`

Runtime contract:

`Worker 4.07 / API 2.60 / D1 Schema 2`

Recovery reference:

`backup-pre-e1c-a1-legacy-reconciliation-67b8735`

Always re-check remote truth before production-affecting action.

---

## 4. Architecture Notes Relevant to Current Work

Current calculation lifecycle remains:

```text
Browser / Vue
→ Cloudflare Worker API
→ GitHub Actions portfolio-update workflow
→ portfolio engine / snapshot publication
→ Worker lifecycle callback
→ browser polling/recovery
```

Authority boundaries:

- durable server lifecycle is authoritative over browser age/TTL;
- browser pending state is recovery metadata, not independent server truth;
- repository-wide portfolio calculation execution remains serialized;
- E1c-B uses GitHub-native retained pending queue semantics and does not introduce a custom scheduler;
- MD-NAN-B1 is confined to market-data ingestion and does not change Worker/D1/lifecycle/snapshot semantics.

Market-data integrity boundary for MD-NAN-B1:

- selected `Close` remains Scheme A valuation authority;
- invalid provider rows are never imputed, dropped, forward-filled, back-filled, or substituted merely to pass validation;
- one fresh request to the **same provider with the same request semantics** is allowed because #3243 → #3244 proves the observed defect can disappear without an application semantic change;
- retry acceptance requires complete required `Dividends` / `Stock Splits` evidence, unchanged selected price source, preservation of every original provider daily date, and a complete selected price;
- row omission is not a valid repair mechanism;
- if the bounded re-fetch remains unacceptable/invalid, the existing validator remains authoritative and the update fails closed.

---

## 5. Master Plan / Working Baseline

Current Working Baseline:

```text
E1c-B implementation merged
→ workflow/calculation/snapshot production path verified
→ authenticated browser recovery partially verified (#3243 user observation)
→ recurring provider selected-price NaN blocker reproduced (#3243)
→ MD-NAN-B1 implemented / independently reviewed / exact-head verified
→ PR #210 merged
→ post-main CI + Pages verified
→ normal post-merge production observation of MD-NAN-B1
→ finish E1c-B terminal browser cleanup observation
→ close E1c-B / E1c when acceptance is actually satisfied
→ focused Product Functionality Review
→ select one next user-impact/correctness batch
→ resume normal feature optimization and development
```

Do not replace this baseline merely because a new model/session/agent begins.

Reopen or redirect only on:

- changed user requirement;
- new material production evidence;
- Critical defect;
- architecture conflict;
- external platform change that invalidates the implementation;
- clearly superior alternative whose benefit materially exceeds migration risk.

---

## 6. Current Phase / Batch

### Current functional phase

`Product stabilization before normal feature development — market-data correctness closeout`

### Current active batch

`MD-NAN-B1 — post-merge production observation only`

Status:

**IMPLEMENTATION MERGED / INDEPENDENT REVIEW PASS / EXACT-HEAD CI PASS / POST-MAIN CI PASS / PAGES PASS / PRODUCTION OBSERVATION PENDING**

PR:

`#210 — Market data: bounded same-provider re-fetch for transient NaN rows`

Final PR head:

`644a2a7e2ba96dac65ab5c68ba1ceb277ab1501b`

Merge / product baseline:

`a8b03877449e885df935389e63fc23e6eb765dd2`

### Reproduction / evidence

#3243 reproduced the defect during an authenticated dispatch:

- failure code: `MARKET_DATA_FAILED`;
- affected date: `2026-08-11`;
- affected symbols: `TMGN, AIHY, ANET, FOTO, AXTX, DRAM, WCLD, SMCX, NCLD, DELL, QCML, SPCH, LAZR, XA, LYTE, GSIB, RAM, SNDK, LUMA, VFLO`;
- common row pattern: Open/High/Low/Volume present; Close + Adj Close NaN; Dividends=0; Stock Splits=0;
- Capital Gains was null for ANET/DELL/LAZR/SNDK and zero for the other captured rows;
- TMGN additionally had `Open > High`, proving at least one row was internally inconsistent beyond missing Close.

Sanitized durable evidence:

`docs/governance/evidence/MARKET_DATA_NAN_RUN_31563691963_2026-08-12.json`

#3244 then succeeded minutes later on unchanged pre-fix application code and the same portfolio path, with no NaN selected-price diagnostics.

### Minimum financially safe root-cause classification

**Transient upstream market-data daily-row incompleteness/inconsistency observed through Yahoo/yfinance retrieval.**

Current evidence does not prove whether the exact responsibility is Yahoo's response, yfinance processing, or yfinance/session/cache behavior. Do not overstate the upstream component.

### MD-NAN-B1 merged implementation contract

1. normal complete provider history is accepted exactly as before;
2. when prepared selected `Close_Adjusted` contains NaN, one fresh ticker request may be attempted;
3. retry uses the same symbol, start date, provider, `auto_adjust=False`, and `actions=True` semantics;
4. first invalid response must contain complete numeric `Dividends` and `Stock Splits` evidence before entering the retry path;
5. fresh response must retain complete numeric `Dividends` and `Stock Splits` evidence;
6. fresh response must retain every provider daily date present in the first invalid response; a missing row cannot count as a repair;
7. fresh response must select the same price source as the first response; `Close` may not silently become `Adj Close`;
8. no row is dropped, repaired, filled, back-filled, forward-filled, or substituted;
9. if the fresh response satisfies the above gates and selected price is complete, accept that fresh provider response normally;
10. if the fresh request is empty, throws, omits a prior date, changes selected source, lacks/malforms required action evidence, or remains NaN, preserve invalid provider evidence and let the existing validator fail closed;
11. no Worker, D1, workflow callback, snapshot, calculator, dividend, split, capital-gain, or benchmark semantic change.

### Independent Review blockers remediated before merge

1. **BLOCKER — invalid evidence could be discarded if fresh re-fetch returned empty/exception.**  
   Remediation: preserve the first invalid provider response so existing validation retains the original fail-closed evidence.
2. **BLOCKER — retry could otherwise become implicit price/action substitution.**  
   Remediation: require same selected price source plus complete numeric `Dividends` / `Stock Splits` evidence; no `Close` → `Adj Close` rescue.
3. **BLOCKER — retry could otherwise appear clean by omitting the original invalid provider date.**  
   Remediation: require the fresh provider daily index to retain all dates from the first invalid provider response.

Final exact-head review `4913241814` verified all three remediations and concluded **PASS / NO REVIEW BLOCKER**.

### Regression tests

`tests/test_market_data_nan_refetch.py` proves:

- first invalid → second clean provider response is accepted from the fresh provider response, not imputed from OHLC/previous close;
- Volume/Dividend evidence comes from the accepted fresh response;
- clean SPY path is not needlessly retried;
- persistent invalid response is attempted only within the bounded policy;
- persistent NaN remains present and `PortfolioValidator.validate_price_data()` still rejects it;
- empty/exceptioning fresh requests preserve the initial invalid response;
- selected source change is rejected;
- missing/malformed required action evidence is rejected;
- provider daily-row omission is rejected;
- initial invalid data without required action evidence is not retried.

`tests/test_market_data_nan_refetch_initial_failures.py` proves:

- an initial empty provider response preserves the existing no-data behavior and is not retried as a NaN case;
- an initial provider exception preserves the existing no-data behavior and is not retried as a NaN case.

### Verification

Runtime/test head `ecf5873d8c31e93b29c99107649e63b3a16e2eb5`:

- CI #693 / run `31565530250`: **SUCCESS**;
- Worker security/deployment tests: **SUCCESS**;
- Frontend contracts/build: **SUCCESS**;
- Python: **458 passed**, 2 warnings, 18 subtests;
- measured statements: 3,798;
- measured branches: 1,474;
- missing lines: **549**;
- missing branches: **307**;
- locked maximum missing branches: **309**;
- coverage policy: **PASS**;
- coverage baseline/gates: **UNCHANGED**.

Final PR head `644a2a7e2ba96dac65ab5c68ba1ceb277ab1501b`:

- Independent Review `4913241814`: **PASS / NO REVIEW BLOCKER**;
- exact-head CI #696 / run `31565889026`: **SUCCESS**;
- mergeability/base/head checked immediately before expected-head merge: **PASS**.

Merge baseline `a8b03877449e885df935389e63fc23e6eb765dd2`:

- post-main CI #697 / run `31566063069`: **SUCCESS**;
- Worker: **SUCCESS**;
- Frontend: **SUCCESS**;
- Python + coverage gate: **SUCCESS**;
- Pages #1495 / run `31566062067`: build/deploy **SUCCESS**.

No post-merge `Update Portfolio Data` run had been observed at the time of this handoff update. Therefore product mitigation production verification remains explicitly **PENDING**.

### E1c-B residual after MD-NAN-B1

E1c-B implementation remains merged and is not reopened. Browser recovery has material production evidence:

- logout → login while pending still showed queued/pending state;
- authenticated dispatch running and terminal callbacks operate correctly.

Remaining E1c-B closeout evidence is narrowed to **direct browser terminal cleanup / normal usable post-terminal state**. Do not broaden this into another lifecycle redesign unless that observation fails.

### E1c-B locked behavior carried forward

These decisions remain authoritative even though MD-NAN-B1 is the current active closeout batch:

1. active calculation recovery must not disappear solely because 15 minutes elapsed;
2. a known `jobId` remains recoverable across refresh/reopen until durable terminal or explicit 404 semantics;
3. ambiguous pre-job mutation state must retain/replay the same idempotency key until server outcome is resolved;
4. generation/tombstone owner and cross-tab protections remain intact;
5. pending workflow runs must not be silently displaced before lifecycle callback while repository-wide serialized calculation execution is preserved.

### E1c-B implementation decisions preserved

- new / explicitly upgraded pending generations carry `lifecyclePersistent: true` and no longer expire by age;
- pre-E1c-B unmarked live generations retain the historical 15-minute rule, preventing rollout resurrection of abandoned state;
- currently-valid legacy pending state is best-effort upgraded in place without changing key / createdAt / jobId;
- cleared tombstones remain durable authority even if written by an old tab without the new marker;
- benchmark intent is scoped so an old exact-key job cannot silently replay for a different explicit benchmark;
- pre-E1c-B records without benchmark remain conservatively replayable during transition;
- server-returned authoritative job benchmark is persisted;
- terminal/404 cleanup and 20-minute active-polling resource cap remain unchanged;
- owner/generation/tombstone cross-tab protections remain intact;
- `portfolio-update` remains serialized with `cancel-in-progress: false` and retained pending queue behavior;
- no Worker, D1, schema, calculation, snapshot, or broad store redesign is implied by E1c-B.

---

## 7. E1c-A.1 Closed Production Baseline

E1c-A.1 is **CLOSED / PRODUCTION VERIFIED**. Durable closeout records:

- engineering: `docs/engineering/GATE_E_E1C_A1_DISPATCH_BINDING_2026-08-11.md`;
- sanitized evidence: `docs/governance/evidence/GATE_E_E1C_A1_CLOSEOUT_2026-08-12.json`;
- deploy evidence: `docs/governance/evidence/GATE_E_E1C_A1_DEPLOY_2026-08-11.json`.

Legacy reconciliation final result:

- `Production Legacy Job Reconciliation` run `31518085574`, attempt 2: **SUCCESS**;
- production job `93984614952`;
- artifact `9126247398`;
- digest `sha256:677f2c6ccea36a0b46c68a40c0f21782ac8301523f0c618d603132eefbc39a20`;
- target cardinality `before=3 / changed=3 / after=0`;
- only terminal transition: `failed / LEGACY_DISPATCH_UNBOUND_RECONCILED`;
- no transaction/snapshot mutation;
- post-contract audit: **PASS**.

Authenticated production smoke:

- `Update Portfolio Data #3239` / run `31557518956`: **SUCCESS**;
- running callback: **SUCCESS**;
- calculation + snapshot upload: **SUCCESS**;
- terminal `succeeded` callback with same GitHub run identity: **SUCCESS**.

The Worker contract rejects conflicting callback run identity, so this remains sufficient evidence for E1c-A.1 durable dispatch binding.

**Locked decision:** do not reopen E1c-A.1 reconciliation unless new material evidence demonstrates a dispatch-binding/server-lifecycle defect.

---

## 8. Product-First Priority Queue

### NOW — MD-NAN-B1 production observation only

Implementation, Independent Review, exact-head CI, merge, post-main CI, and Pages verification are complete. Do not change code speculatively.

Observe the next normal production `Update Portfolio Data` run on/after product baseline `a8b03877449e885df935389e63fc23e6eb765dd2`:

- if first provider responses are clean and the run succeeds, record **no-regression production evidence** but do not claim the retry path itself reproduced;
- if selected-price NaN recurs and the bounded same-provider re-fetch recovers, record **direct production verification of the mitigation**;
- if the retry remains invalid/unacceptable, preserve fail-closed behavior, capture the new sanitized row evidence, and reopen RCA only from that evidence.

### NEXT — finish E1c-B terminal browser closeout

Browser pending recovery across logout/login has production evidence. After MD-NAN-B1 production observation, directly observe that a terminal job clears/resolves queued/pending state and returns the frontend to normal usable portfolio/snapshot display.

If that passes, close E1c-B/E1c without reopening already-verified server/workflow work.

### NEXT — Product Functionality Review

Immediately after E1c-B closeout, review the real user flow:

```text
login
→ records CRUD
→ calculation trigger
→ progress/recovery
→ snapshot refresh
→ holdings
→ realized/unrealized P&L
→ performance/TWR/XIRR
→ benchmark display
→ actionable success/failure UX
```

Classify findings:

- **NOW** — material bug/correctness issue required for current Stable State;
- **NEXT** — important and safely separable user-impact feature/optimization;
- **BACKLOG** — genuinely non-blocking improvement/technical debt;
- **REJECT** — insufficient evidence/value.

Then select exactly one next functional implementation batch.

### BACKLOG

- D1 Schema 3;
- ledger revision / compare-and-publish;
- cursor-secret separation;
- Decimal/fixed-point migration;
- market-data provider redesign;
- tenant UUID migration;
- other historical remediation candidates without current blocker evidence.

### REJECT FOR CURRENT PHASE

- dropping/filling/forward-filling/substituting invalid market price rows to make the workflow green;
- treating provider row omission as a successful repair;
- switching market-data provider without evidence that bounded same-provider retrieval is insufficient;
- reconciliation/scheduler framework expansion without demonstrated current failure mode;
- new scheduler/queue infrastructure;
- CI/CD beautification without a product blocker;
- governance/document proliferation;
- broad architecture rewrite without correctness evidence;
- reopening already-closed E1a/E1b/E1c-A.1 without new material evidence;
- artificial production queue load testing without a demonstrated queue/serialization failure mode.

---

## 9. Decision Log

### D-2026-08-12-01 — E1c-A.1 remains closed

**Decision:** `CLOSED / PRODUCTION VERIFIED` remains authoritative.  
**Evidence:** successful reconciliation + production smoke + dispatch identity binding.  
**Reopen condition:** new material dispatch-binding/server-lifecycle evidence only.  
**Status:** LOCKED.

### D-2026-08-12-02 — E1c-B implementation accepted into main

**Decision:** PR #206 is the current E1c-B product implementation baseline.  
**Evidence:** focused Independent Review PASS, exact-head CI #676 SUCCESS, expected-head merge, post-main CI #677 SUCCESS, Pages deployment SUCCESS.  
**Trade-off:** authenticated browser lifecycle behavior is not inferred from CI; it remains separately verified by production observation.  
**Status:** MERGED / PRODUCTION WORKFLOW PATH VERIFIED / BROWSER RECOVERY PARTIAL PASS.

### D-2026-08-12-03 — Product functionality resumes after closeout

**Decision:** after current material blockers and E1c-B production verification are closed, the project returns to a focused Product Functionality Review and one user-impact/correctness batch.  
**Reason:** product correctness/usability is the Primary Goal; governance and infrastructure are support mechanisms only.  
**Reopen condition:** a newly proven high-impact safety/data/security/production issue may preempt the functional batch.  
**Status:** WORKING BASELINE.

### D-2026-08-12-04 — Do not encode mutable `main` head as durable handoff truth

**Decision:** use immutable product/feature baseline SHAs for durable implementation evidence; retrieve the current `main` head from GitHub remote truth at execution time.  
**Reason:** a documentation-only merge itself advances `main`, so a line claiming `Current protected-main head = <pre-doc-merge SHA>` becomes stale immediately after the document is merged.  
**Status:** LOCKED DOCUMENTATION PRACTICE.

### D-2026-08-12-05 — #3242 narrows E1c-B production verification

**Decision:** treat #3242 as production verification of the E1c-B workflow/calculation/snapshot path while keeping browser lifecycle behavior separately evidence-driven.  
**Evidence:** #3242 ran on `fdc1199...`, completed 2/2 users successfully, uploaded both snapshots, and produced no NaN selected-price failure; lifecycle callbacks were skipped because scheduled runs have no `CALCULATION_JOB_ID`.  
**Status:** LOCKED FOR CURRENT CLOSEOUT.

### D-2026-08-12-06 — #3243 promoted market-data NaN from WATCH to NOW; PR #210 is the merged mitigation

**Decision:** recurring NaN evidence justified one bounded same-provider retrieval retry, with financial-integrity gates and persistent fail-closed semantics.  
**Evidence:** authenticated #3243 failed `MARKET_DATA_FAILED` with 20 exact sanitized provider rows; #3244 succeeded minutes later on unchanged pre-fix code.  
**Minimum-safe classification:** transient upstream daily-row incompleteness/inconsistency observed via Yahoo/yfinance; exact upstream responsibility remains unproven.  
**Merged fix:** PR #210 / merge `a8b03877449e885df935389e63fc23e6eb765dd2`.  
**Verification:** exact-head review PASS; CI #696 PASS; post-main CI #697 PASS; Pages #1495 PASS.  
**Remaining condition:** post-merge normal production observation.  
**Status:** MERGED / POST-MAIN VERIFIED / PRODUCTION OBSERVATION PENDING.

---

## 10. Root Cause Log

### RC-E1c-B-01 — Browser TTL incorrectly acted as lifecycle authority

**Symptom:** pending/recovery identity could disappear after the historical 15-minute browser TTL even while durable work remained active or ambiguous.  
**Root cause:** browser age was overloaded as liveness authority instead of treating durable server lifecycle as authoritative.  
**Related rollout risks found during review:**

- global TTL removal could resurrect pre-E1c-B abandoned live generations;
- permanently reusable pending keys required benchmark intent scoping;
- old-tab tombstone writes required durable authority to prevent cross-tab resurrection;
- default GitHub Actions pending behavior could displace a pending lifecycle run.

**Permanent fix:** PR #206 lifecycle persistence + rollout marker + benchmark intent + durable tombstone handling + retained GitHub-native queue semantics.  
**Verification:** exact-head tests/review/CI PASS; workflow/calculation/snapshot production path PASS; user observed queued state survives logout → login during live production activity; direct browser terminal cleanup observation remains pending.

### RC-MD-NAN-01 — Transient provider selected-price daily-row incompleteness/inconsistency

**Symptom:** #3237/#3238 and authenticated #3243 failed closed with `MARKET_DATA_FAILED` because selected `Close` contained NaN provider rows.  
**Reproduction:** #3243 captured 20 affected US-listed symbols on `2026-08-11`; Open/High/Low/Volume existed while Close/Adj Close were NaN. TMGN additionally had Open > High.  
**Recovery evidence:** #3244 succeeded minutes later on the same pre-fix `main` code and portfolio path with no NaN diagnostics.  
**Minimum-safe root cause:** transient upstream market-data row incompleteness/inconsistency observed through Yahoo/yfinance retrieval; exact responsibility layer is not yet proven.  
**Impact:** authenticated portfolio calculation can fail even though a fresh provider retrieval minutes later is valid.  
**Permanent mitigation:** PR #210 bounded same-provider re-fetch only when selected price contains NaN and first-response action evidence is complete; retry acceptance requires unchanged price source, complete required action evidence, preservation of all prior provider daily dates, and a complete selected price. Persistent/unacceptable invalid data remains fail-closed.  
**Evidence:** `docs/governance/evidence/MARKET_DATA_NAN_RUN_31563691963_2026-08-12.json`.  
**Verification:** exact-head + post-main PASS; production observation pending.  
**Prohibited assumption:** do not drop/fill/substitute/forward-fill the invalid row, treat row omission as repair, or infer financial meaning from incomplete OHLC/action evidence.

### RC-DOC-01 — Mutable main SHA created self-stale handoff prose

**Symptom:** a handoff update correctly recorded the pre-merge `main` head, but merging that documentation PR immediately advanced `main` and made the phrase `Current protected-main head` stale.  
**Root cause:** mutable repository head and immutable product baseline were represented as the same concept.  
**Permanent fix:** record immutable product implementation baseline SHAs in durable prose and require remote lookup for current `main`.

---

## 11. Known Issues / Risks

### K1 — E1c-B terminal browser cleanup evidence gap

Severity: **closeout observation, not a code blocker**.  
Pending recovery has real production evidence because logout → login preserved the queued state. The remaining evidence gap is specifically post-terminal browser cleanup / return to normal usable portfolio display. Do not broaden this back into generic lifecycle architecture work without a failed observation.

### K2 — MD-NAN-B1 production behavior not yet observed after merge

Severity: **production-verification gap, not an implementation blocker**.  
PR #210 is merged and post-main verified. No post-merge normal `Update Portfolio Data` run has yet been observed. Do not claim direct mitigation verification until a run executes on or after product baseline `a8b03877...`.

### K3 — Retained queue production concurrency is not force-tested

Severity: **residual confidence item, not an automatic blocker**.  
Retained queue syntax/semantics are exact-head test/review validated and normal production execution succeeds. Do not generate artificial production contention solely for process completeness. Escalate only if normal production shows pending displacement, duplicate execution, or serialization failure.

---

## 12. Technical Debt / Deferred Candidates

Current deferred candidates remain evidence-driven and must not interrupt the active product line unless reclassified by new evidence:

- Schema 3;
- compare-and-publish / ledger revision;
- Decimal/fixed-point migration;
- provider redesign;
- tenant UUID migration;
- cursor secret separation;
- broader architecture modernization.

These are not current blockers merely because they may be architecturally desirable.

---

## 13. Documentation Quality / Handoff Rules

Documentation exists to prevent project amnesia and distortion, not to become the project.

Use:

- `README.md`: stable product/architecture truth;
- `AI_PROJECT_PLAYBOOK.md`: highest governance/Gate authority;
- `to_do_update_list.md`: current execution truth and handoff state;
- `docs/governance/DOCUMENT_QUALITY_STANDARD.md`: subordinate quality checklist only;
- `docs/engineering/`: durable RCA/contract/decision/closeout evidence;
- `docs/governance/evidence/`: sanitized machine-readable production evidence.

Prefer updating an existing authoritative document over creating a new one. Compress completed operational detail only after durable evidence exists, but never compress away unresolved material defects/risks.

Whenever repository prose conflicts with GitHub/CI/deployment remote truth, remote truth wins and this file should be corrected promptly.

For SHAs, distinguish:

- **immutable implementation/product baseline SHA** — suitable for durable handoff evidence;
- **current mutable `main` SHA** — must be fetched from GitHub at execution time and should not be treated as permanently current prose.

This prevents a documentation-only merge from making its own handoff stale immediately.

Production verification should distinguish evidence layers rather than using one generic `VERIFIED` label:

```text
deployed/merged artifact
≠ exact-head CI
≠ post-main CI
≠ workflow execution
≠ calculation/snapshot success
≠ authenticated browser recovery
≠ browser terminal cleanup
```

Credit each layer once proven; keep only the truly missing layer open.

---

## 14. Functional Closeout Integrity

Before E1c-B, E1c, or MD-NAN-B1 is marked `CLOSED`, confirm at appropriate risk level:

1. required behavior is actually satisfied;
2. applicable regression/build/production verification passes;
3. known BLOCKERs are zero;
4. no known material functional/data/correctness bug is being deferred merely to converge;
5. closely related defects are impact-classified;
6. deferred work is explicitly safe to defer;
7. residual limitations remain visible in the handoff.

The goal is not zero bugs. The goal is not to close on a known major defect that contaminates the next batch.

---

## 15. Change Log

### 2026-08-12 — E1c-B remote-truth handoff sync

**Scope:** documentation-only synchronization of `to_do_update_list.md`; no product/runtime/workflow mutation.  
**Reason:** the previous handoff still described E1c-B as not yet implemented and still listed PR #204 as the current protected-main product source after PR #206 had merged.  
**Remote evidence synchronized:**

- PR #206 final head `7f6eaee6ef0ff1c03501e3e354ae7cd216013e14`;
- Independent Review PASS / NO REVIEW BLOCKER;
- exact-head CI #676 / run `31559136662` SUCCESS;
- merge commit / E1c-B product baseline `fdc1199bea47a2e47f38e2737827f1a2e38451f2`;
- post-main CI #677 / run `31559255388` SUCCESS;
- Pages deployment run `31559254780` SUCCESS;
- Update Portfolio Data #3239/#3240/#3241 SUCCESS;
- E1c-B authenticated browser lifecycle remained explicitly NOT VERIFIED at that point.

**Files changed:** `to_do_update_list.md` only.  
**Runtime impact:** none.  
**Rollback:** revert this documentation change if any synchronized fact is later proven incorrect; do not roll back product code merely for a handoff-document error.

### 2026-08-12 — Handoff SHA semantics correction

**Scope:** documentation-only correction following the remote-truth sync.  
**Root cause:** labeling the PR #206 product merge SHA as the permanently `Current protected-main head` made the document self-stale once the documentation PR itself merged.  
**Correction:** `fdc1199...` is now identified as the immutable E1c-B product implementation baseline; current `main` must be re-fetched from GitHub remote truth.  
**Verification:** PR #208 exact-head CI #680 SUCCESS; merge `9e378c0f0f8a55ac2b37fa4ea8cfb5a1da0d412b`; post-main CI #681 SUCCESS; Pages #1493 / run `31560730310` SUCCESS.  
**Runtime impact:** none.

### 2026-08-12 — #3242 production evidence narrows E1c-B closeout

**Scope:** evidence-only handoff update; no runtime/workflow semantics changed.  
**Evidence:** `Update Portfolio Data #3242` / run `31560257260`, scheduled on E1c-B baseline `fdc1199...`, SUCCESS.  
**Result:** 53 market symbols downloaded; 2 users processed; 2 snapshots uploaded; 0 failures; no new NaN selected-price evidence.  
**Boundary:** scheduled run had no `CALCULATION_JOB_ID`, so running/terminal lifecycle callbacks were skipped and authenticated browser recovery remained unverified at that point.

### 2026-08-12 — #3243/#3244 production evidence + MD-NAN-B1 activation

**User-observed browser evidence:** during live production activity, logout → login still displayed queued/pending state.  
**#3243:** authenticated `workflow_dispatch` on `1b8ed8f...`; running callback SUCCESS; calculation failed `MARKET_DATA_FAILED`; terminal failed callback SUCCESS; 20 exact sanitized provider rows captured.  
**#3244:** authenticated `workflow_dispatch` minutes later on the same pre-fix `main`; market data clean; 144-row transaction integrity PASS; calculation/reconciliation/ledger/snapshot PASS; terminal succeeded callback SUCCESS.  
**Root-cause convergence:** transient upstream daily-row incompleteness/inconsistency; exact Yahoo vs yfinance responsibility not proven.  
**Sanitized evidence:** `docs/governance/evidence/MARKET_DATA_NAN_RUN_31563691963_2026-08-12.json`.  
**Runtime deployment at that point:** not yet merged.

### 2026-08-12 — MD-NAN-B1 pre-merge verification convergence

**PR:** #210.  
**Review blockers remediated:** preserve invalid evidence on retry empty/exception; reject selected-source/action-evidence drift; reject provider daily-row omission.  
**Tests:** `tests/test_market_data_nan_refetch.py` + `tests/test_market_data_nan_refetch_initial_failures.py`.  
**Runtime/test head:** `ecf5873d8c31e93b29c99107649e63b3a16e2eb5`.  
**CI:** #693 / run `31565530250` SUCCESS.  
**Python:** 458 passed; coverage missing lines 549; missing branches 307 ≤ locked maximum 309.  
**Worker/frontend:** SUCCESS.  
**Coverage policy:** PASS with no baseline weakening.

### 2026-08-12 — MD-NAN-B1 merged and post-main verified

**PR final head:** `644a2a7e2ba96dac65ab5c68ba1ceb277ab1501b`.  
**Independent Review:** review `4913241814`, exact final head, **PASS / NO REVIEW BLOCKER**.  
**Exact-head CI:** #696 / run `31565889026` SUCCESS.  
**Merge:** PR #210 → `a8b03877449e885df935389e63fc23e6eb765dd2`.  
**Post-main CI:** #697 / run `31566063069` SUCCESS; Worker/Frontend/Python all SUCCESS.  
**Pages:** #1495 / run `31566062067` build/deploy SUCCESS.  
**Production observation:** PENDING; no post-merge `Update Portfolio Data` run observed at this synchronization point.  
**Runtime implementation status:** MERGED / POST-MAIN VERIFIED.  
**Remaining MD-NAN-B1 action:** observation only; no speculative code changes.

---

## 16. Next Exact Actions

1. Treat E1c-A.1 as closed; do not reopen reconciliation/control-plane work without new material dispatch-binding evidence.
2. Treat PR #210 implementation as merged and post-main verified. Do not modify MD-NAN-B1 code without new material production evidence.
3. Observe the first normal `Update Portfolio Data` run after product baseline `a8b03877449e885df935389e63fc23e6eb765dd2`.
4. If the run is clean and succeeds, record no-regression production evidence. If `NaN selected-price provider row` recurs and bounded re-fetch recovers, record direct mitigation verification. If retry remains invalid/unacceptable, preserve fail-closed behavior and capture new sanitized evidence before any further fix.
5. Do not treat #3244 as fix verification; it predates the fix and only demonstrates transient recovery under unchanged code.
6. After MD-NAN-B1 production observation is acceptable, finish the single remaining E1c-B browser observation: terminal job resolves queued/pending state and frontend returns to normal usable portfolio/snapshot display.
7. If that observation passes with no material blocker, close E1c-B/E1c and immediately perform the focused Product Functionality Review.
8. Select exactly one next user-impact/correctness batch and resume normal functional optimization/development.
