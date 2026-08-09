# TO-DO / UPDATE LIST — Product Integrity Execution Handoff

> **FIRST-READ FILE.** Future AI/maintainers must read this file before changing the repository. It exists so execution can continue even when the previous chat/session is unavailable.
>
> **Mandatory update rule:** after every material implementation, test/CI result, PR review, merge, production smoke/audit, recovery ref, blocker, or scope decision, update this file in the same working branch/PR whenever practical.

Last updated: **2026-08-09**

---

## 0. Operating rules

1. Read this file first.
2. Read `docs/engineering/PRODUCT_INTEGRITY_EXECUTION.md`.
3. While Gate C is active, also read `docs/engineering/GATE_C_TRANSACTION_INTEGRITY_AUDIT.md`.
4. Re-fetch current `main`, active PR head, CI, review threads, and recovery refs; never trust an old chat as current authority.
5. Continue only the current active Gate unless the user changes priority.
6. Standard sequence: **pre-change recovery → scoped branch/PR → tests/CI → independent diff review → review/thread check → main-drift check → exact-head merge → post-main CI → post-change recovery**.
7. Never lower validation/coverage/financial-integrity gates just to pass CI.
8. Gates A–D do **not** authorize Schema 3.
9. Repository merge does **not** authorize production Worker deployment.
10. Do not reopen historical D3D governance during ordinary product work unless production activation is explicitly requested.
11. Keep this file synchronized after every material result.

---

# 1. Current authoritative state

- Repository: `chihung1024/sheet-trading-journal`
- Protected `main`: `03242d00082067333cf77ffa424094b8936b406c`
- D1: **Schema 2**
- Worker source contract: release `4.07` / API `2.60` / required schema `2`
- Active Gate: **Gate C — Schema-2 transaction integrity preflight**
- Active PR: **#150 — Draft**
- PR title: `Gate C: add read-only transaction integrity audit infrastructure`
- Work branch: `pr-gate-c-transaction-integrity-preflight`
- Gate C base: `03242d00082067333cf77ffa424094b8936b406c`
- Pre-Gate-C recovery: `backup-pre-gate-c-03242d0`
- Post-Gate-B recovery: `backup-post-gate-b-03242d0`
- Current sub-phase: **C5 production read-only qualification infrastructure**
- Latest tested code/privacy head before this handoff commit: `2cbf2804bc34267468fbcde8d9422fa26ede04fb`
- CI #452 / run `31297308611`: **SUCCESS**
- **Hold point:** merge only the read-only audit infrastructure; do not merge blocking calculator preflight or strict `CLAMP -> ERROR` before real production audit evidence.

---

# 2. Completed program phases

| Phase | Status | Evidence |
|---|---|---|
| P1 source-record / required market-data integrity | ✅ | PR #133 |
| P2 dividend semantic unification | ✅ | PR #134 |
| P3 currency-aware valuation / FX integrity | ✅ | PR #135 |
| P4A XIRR validity / precision / valuation-date semantics | ✅ | PR #136 |
| P4B Modified Dietz / linked-TWR reliability | ✅ with residual | PR #137 |
| P5A fetchAll single-flight / truthful load contract | ✅ | PR #138 |
| P5B stale/read reliability UX | ✅ | PR #139 |
| P5C1 committed/rejected/ambiguous mutation outcomes | ✅ | PR #140 |
| P5C2 GroupManager partial mutation truth | ✅ | PR #141 |
| P5C3A HTTP 5xx ambiguity truth | ✅ | PR #142 |
| Calculation failure observability | ✅ | PR #143 |
| P6A cross-tab auth generation sync | ✅ | PR #144 |
| P6B non-destructive pending calculation reads | ✅ | PR #145 |
| P6D tenant/job-scoped cross-tab poll claims | ✅ | PR #146 |
| Launch-day market bootstrap | ✅ | PR #147 |
| Gate A / P6C generation-safe pending recovery | ✅ | PR #148 / merge `f3c55f4...` |
| Gate B / P5C3B atomic DELETE | ✅ | PR #149 / merge `03242d0...` |

## Gate A closeout

- PR #148 final head `80d417c125797020fab1b6be401084049f2e25e3`
- merge `f3c55f4cd322c35ca163e1330f7b1e7bc14580bf`
- final PR CI #429: SUCCESS
- post-main CI #430: SUCCESS
- production `Update Portfolio Data` #3213 / run `31295494999`: SUCCESS; 2 users succeeded / 0 failed
- recovery `backup-post-product-integrity-p6c-f3c55f4`

## Gate B closeout

- PR #149 final head `439e9ed39647ccd5885a2cc02a6850712c30708a`
- final exact-head CI #433 / `31296056184`: SUCCESS
- merge `03242d00082067333cf77ffa424094b8936b406c`
- post-main CI #434 / `31296121054`: SUCCESS
- recovery `backup-post-gate-b-03242d0`
- result: record delete + last-record snapshot cleanup share one D1 `batch()`; malformed result/cardinality fails closed
- production Worker deployment not performed

---

# 3. Gate C — ACTIVE

## Goal

Establish deterministic Schema-2 source-ledger integrity before calculator CLAMP behavior or same-day type-priority sorting can hide impossible position prefixes.

Distinguish strictly:

- **Schema-2 deterministic ledger-validity order:** `Date -> record id`
- **true broker execution chronology:** not guaranteed by current schema

## Prohibited in current Gate C line

- Schema 3
- new first-class execution columns
- broker execution table
- futures support
- broad broker-import redesign
- broad market-provider abstraction
- unrelated UX refactor
- production Worker deployment

---

## C1 — Runtime audit ✅ completed

Evidence: `docs/engineering/GATE_C_TRANSACTION_INTEGRITY_AUDIT.md`  
Audit commit: `2e535982e460045fb8235d99307c9ba1e31ffa2e`

Key findings:

1. `prepare_transactions()` source order is deterministic `Date -> id`; it does not create `Timestamp`/`Sequence` or parse `note`.
2. Production calculator effective same-day order is `BUY -> DIV -> SELL`; default oversell is `CLAMP`.
3. Canonical Daily-P&L uses compatible type-priority and clamp semantics, so internal reconciliation does not certify source-prefix validity.
4. Holdings validator checks only final aggregate quantity, not intermediate prefixes.
5. Prefix audit must use the independent split-adjusted ledger.
6. `id` is a valid Schema-2 deterministic tie-breaker, not broker-time proof.
7. Existing `_sequence` test does not exercise calculator sequence support.
8. `TransactionAnalyzer` zero-on-exception behavior is unsafe if authoritative, but no live authoritative consumer was found.

---

## C2 — Prefix-integrity core ✅ implemented and test-qualified

Module: `journal_engine/core/ledger_integrity.py`

Contract:

- valid positive unique record `id`
- stable replay `Date -> id`
- BUY adds; SELL subtracts; DIV has no position effect
- `all` + every active comma/semicolon tag scope
- provisional tolerance `max(1e-9, cumulative_abs_buy_qty * 1e-12)`
- deterministic fail-closed diagnostics/input validation

Tests: `tests/test_ledger_integrity.py`

Coverage includes exact closeout, fractional round trips, first-row SELL, partial oversell, tolerance edges, split-adjusted quantities, multi-tag scopes, same-day Date/id order, deterministic ids, DIV, missing Tag, timezone-aware dates, malformed/duplicate ids, invalid dates/symbols/quantities and non-finite values.

Coverage governance:

- module registered in `docs/governance/python-coverage-baseline.json`
- no coverage gate lowered
- CI #435: functional tests passed; source-inventory gate found missing registration
- CI #436: source inventory fixed; missing-branch gate found insufficient branch coverage
- fail-closed tests expanded; unreachable branch removed
- CI #438 / `31296710938`: SUCCESS

### Temporary blocking runner candidate — tested then deliberately removed

The candidate proved:

- split-adjusted validation ledger built once
- prefix check before calculator
- violation blocks calculator and upload
- same validation ledger reused for parity/upload validation

Evidence:

- integration commit `72f96e06d4b2cf449427652e5aac55a80a0f625f`
- regression head `ec65aef87153c4ffc2b8e173448face00be69af6`
- CI #441 / `31296798001`: SUCCESS

Decision: **do not merge blocking enforcement before production read-only qualification.**

The candidate was removed from PR #150:

- `main.py` restored to protected-main content in `71c086a2f54eb106f2017eae5304271d700aa51f`
- `tests/test_runner_ledger_integrity.py` removed in `b666e36c7b1fba19e4e9f85e0e4d5d0371eebcb9`

PR #150 therefore does not change normal portfolio calculation behavior.

---

## C3 — Same-day ordering regression

Completed:

- [x] verify production lacks first-class `Timestamp` / `Sequence`
- [x] verify calculator/reconciler BUY/DIV/SELL priority
- [x] define `Date -> id` as deterministic Schema-2 validity order
- [x] prefix tests use source Date/id order rather than type priority
- [x] same-day BUY → SELL → BUY → SELL round trip covered

Remaining before Gate C closeout:

- [ ] correct/supplement historical `_sequence` test to exercise actual `Sequence` contract or explicitly test priority behavior
- [ ] keep `note` outside financial ordering

---

## C4 — External provenance audit

Implemented audit semantics:

- [x] repository runtime search confirms `import_key` is not DB/runtime-enforced identity
- [x] parser recognizes only explicit structured tokens (`import_key`, `order_id`, `trade_id`, execution-time fields)
- [x] free-form note text is never emitted
- [x] duplicate identity is evaluated **within each user**, preventing cross-tenant false positives
- [x] duplicate `import_key` / `trade_id` groups block qualification
- [x] repeated `order_id` groups are evidence only, not automatic defects
- [x] public machine-readable audit output exposes **counts only**
- [x] no user id, ticker, tag name, record id, quantity, price, raw broker id, or hashed broker id is emitted in the result JSON

Production evidence still required:

- [ ] count structured note conventions in current production records
- [ ] count duplicate import-key / trade-id groups
- [ ] count repeated order-id groups
- [ ] classify partial-fill/cross-date risk if evidence appears
- [ ] keep futures excluded

---

## C5 — Production-data qualification 🟠 ACTIVE

### Read-only audit infrastructure in PR #150

New tool: `tools/audit_transaction_integrity.py`

Properties:

- existing records read path + market data only
- never calculates a portfolio snapshot
- never uploads a snapshot
- never mutates records/settings/D1
- validates split-factor coverage before multiplier use; missing market data cannot silently become factor `1.0`
- builds independent split-adjusted ledger per user
- audits `all` + active tags in `Date -> id` order
- emits one machine-readable line `GATE_C_TRANSACTION_INTEGRITY_AUDIT=<json>`
- public result is counts-only and non-sensitive
- structured provenance duplicate grouping is user-scoped

Workflow: `.github/workflows/update.yml`

New manual boolean input:

`transaction_integrity_audit_only` (default `false`)

Audit mode:

- rejects non-empty `calculation_job_id`
- uses existing `API_KEY` for read access
- runs `python tools/audit_transaction_integrity.py`
- skips calculation/upload
- skips calculation-job callbacks
- shares existing `portfolio-update` concurrency group

Normal scheduled/manual calculation path is unchanged when audit mode is false.

Tests:

- `tests/test_transaction_integrity_audit.py`
- `tests/test_workflow_yaml.py`

### Audit infrastructure / privacy CI history

- audit runner `e986e17b2180658bddd1bd0ebfb11dca9853c29f`
- audit-only workflow `d93a058ca015a53c535d9ccdfc8532ae4c260431`
- initial audit tests `0d34e7dae3332d1c50dddcc849336fb45059d919`
- workflow contract head `f83e5721ad5ccd32db6ef5ed3712544413ac37fa`
- CI #449 / `31297087680`: SUCCESS
- handoff head `c795fd351b2dc5b55b101b298c61791fd6339fa4`
- CI #450 / `31297190520`: SUCCESS
- independent diff/privacy review found public-log details and cross-user duplicate grouping as merge blockers
- privacy/user-scoping fix `9a598b7f4a018edd8247238592fafded964c0c22`
- privacy regression head `2cbf2804bc34267468fbcde8d9422fa26ede04fb`
- CI #452 / `31297308611`: **SUCCESS**

### C5 merge plan

PR #150 is **audit infrastructure only**, not blocking enforcement.

Before merge:

- [x] PR title/body reflect read-only audit infrastructure
- [x] blocking `main.py` integration removed
- [x] runner blocking regression removed
- [x] privacy review completed and blockers fixed
- [x] CI #452 green on privacy-fixed code
- [ ] run exact-head CI after this final handoff commit
- [ ] independent final changed-file/diff review
- [ ] confirm final diff excludes `main.py` and `tests/test_runner_ledger_integrity.py`
- [ ] confirm reviews/threads clear
- [ ] confirm protected `main` has not drifted
- [ ] exact-head merge PR #150
- [ ] post-main CI
- [ ] create post-audit-infrastructure recovery ref

After merge, run **one production read-only audit** from merged `main`:

- `Update Portfolio Data` → `Run workflow`
- `transaction_integrity_audit_only = true`
- `target_user_id =` blank (all users)
- `calculation_job_id =` blank
- benchmark is irrelevant in audit mode

ChatGPT currently has no workflow-dispatch connector action, so this one run must be manually triggered in GitHub UI unless a new connected dispatch capability appears.

Production audit acceptance:

- [ ] all users audited
- [ ] all active tag scopes audited
- [ ] split coverage valid
- [ ] prefix violation counts recorded
- [ ] duplicate structured `import_key` / `trade_id` group counts recorded
- [ ] repeated order-id group counts recorded as evidence
- [ ] counts-only production result persisted in this file + Gate C audit evidence
- [ ] no enforcement decision until unexplained violations are resolved

---

## C6 — Enforcement decision — blocked on C5 result

Only after production audit:

- [ ] decide whether to merge blocking pre-calculator prefix gate
- [ ] decide separately whether calculator `CLAMP` stays as defense-in-depth or switches to `ERROR`
- [ ] add strict-policy regressions before any CLAMP→ERROR change
- [ ] ensure no authoritative secondary analyzer converts integrity failure to valid-looking zero output
- [ ] scoped enforcement PR
- [ ] exact-head CI / independent diff review / reviews/threads / main-drift check
- [ ] merge / post-main CI / recovery
- [ ] update this file and activate Gate D

---

# 4. Gate D — QUEUED

Goal: make successful calculations explainable/replayable before provider or ledger architecture redesign.

Planned:

- [ ] engine commit SHA
- [ ] record count / max record id / canonical input hash
- [ ] benchmark/config hash
- [ ] market-data as-of provenance
- [ ] FX as-of provenance
- [ ] synthetic valuation count/source
- [ ] calculation timestamp
- [ ] frozen golden replay covering transactions, prices, FX, splits, dividends, holdings, realized P&L, Daily P&L, TWR, XIRR
- [ ] distinguish record/vendor/FX/engine/synthetic-valuation changes
- [ ] CI / review / exact-head merge / post-main CI / recovery

---

# 5. Post-Gate-D architecture review — DEFERRED

Candidates only after fresh review:

- Schema-3 execution identity (`source`, `external_id`, `order_id`, `executed_at_utc`, `currency`, `asset_class`, `contract_multiplier`)
- immutable `broker_executions` table
- canonical lot-ledger consolidation
- broad market-data provider abstraction
- broad cleanup / typing / dead-code refactor

---

# 6. D3D production governance — DEFERRED

Do not resume automatically. Deferred items include production identity evidence, N58/N61/N64/N62/N69, N59/N60, RISK-032, and any Schema-3 Recovery Evidence Gate work.

Historical navigation: `docs/governance/V5_CURRENT_HANDOFF.md`.

---

# 7. Known residuals

- P4B: net daily cash flow cannot reconstruct gross intraday Modified-Dietz timing on zero-start days.
- Schema 2: no first-class immutable external execution id/time/sequence.
- Same-day broker chronology: note timestamps are not calculation ordering fields.
- Commission rebates: Commission/Tax `abs()` normalization cannot represent net-negative commission faithfully.
- Futures/derivatives: no first-class asset class / multiplier; remain excluded.

---

# 8. Production / deployment boundaries

- merge ≠ production Worker deploy
- no D1 migration unless explicitly authorized + recovery-gated
- Cloudflare production activation remains separately governed
- Gate C audit must not mutate production D1
- do not pretend unavailable direct Cloudflare access exists
- production audit evidence must remain read-only and counts-only

---

# 9. External broker constraints for later work

- recent IBKR reconstruction should use `DAYS_7`, not `TODAY` alone
- reconcile trades with positions before declaring import complete
- one `order_id` can contain multiple fills
- order-level note `import_key` is not DB-enforced idempotency
- partially filled orders can be skipped by order-id-only guards
- immutable `trade_id` is stronger, but true chronology still needs first-class execution time/sequence
- futures remain excluded

---

# 10. Execution log

### 2026-08-09 — Gate A closeout

- merge `f3c55f4...`
- production calculation smoke #3213 / `31295494999`: SUCCESS
- 2 users succeeded / 0 failed

### 2026-08-09 — Gate B closeout

- PR #149
- final CI #433 / `31296056184`: SUCCESS
- merge `03242d00082067333cf77ffa424094b8936b406c`
- post-main CI #434 / `31296121054`: SUCCESS
- recovery `backup-post-gate-b-03242d0`

### 2026-08-09 — Gate C C1

- audit evidence `2e535982e460045fb8235d99307c9ba1e31ffa2e`
- result: clamp/type-priority consistency cannot certify source-prefix validity

### 2026-08-09 — Gate C C2 module / coverage qualification

- CI #435: tests pass; source inventory blocked unregistered source
- inventory updated without lowering gates
- CI #436: tests pass; missing-branch gate blocked
- fail-closed tests expanded
- CI #438 / `31296710938`: SUCCESS

### 2026-08-09 — Gate C temporary blocking runner candidate

- integration `72f96e06d4b2cf449427652e5aac55a80a0f625f`
- regression head `ec65aef87153c4ffc2b8e173448face00be69af6`
- CI #441 / `31296798001`: SUCCESS
- decision: technically valid, but removed pending production audit
- removal/restoration `71c086a...` + `b666e36...`

### 2026-08-09 — Gate C C5 read-only audit infrastructure

- audit tool `e986e17b2180658bddd1bd0ebfb11dca9853c29f`
- audit-only workflow `d93a058ca015a53c535d9ccdfc8532ae4c260431`
- audit tests `0d34e7dae3332d1c50dddcc849336fb45059d919`
- workflow test head `f83e5721ad5ccd32db6ef5ed3712544413ac37fa`
- CI #449 / `31297087680`: SUCCESS
- handoff CI #450 / `31297190520`: SUCCESS
- independent privacy review found public-log detail leakage + cross-user duplicate false-positive risk
- privacy fix `9a598b7f4a018edd8247238592fafded964c0c22`
- privacy regression head `2cbf2804bc34267468fbcde8d9422fa26ede04fb`
- CI #452 / `31297308611`: SUCCESS
- decision: final audit output is counts-only; duplicate identity is user-scoped
- **exact next action:** require new exact-head CI for this handoff commit, finish final diff/review/main-drift qualification, merge PR #150, verify post-main CI/recovery, then request one manual audit-only workflow dispatch.

---

# 11. Immediate next action for future AI

**Do not start Gate D or enforcement.**

1. Fetch PR #150 exact head after this handoff commit.
2. Require exact-head CI SUCCESS.
3. Confirm changed files are audit infrastructure/docs/tests only and exclude `main.py` plus `tests/test_runner_ledger_integrity.py`.
4. Re-review `.github/workflows/update.yml` and `tools/audit_transaction_integrity.py` for no write path / no sensitive public output.
5. Check review submissions, unresolved threads, and protected-main drift.
6. Exact-head merge PR #150 if clean.
7. Confirm post-main CI and create post-audit-infrastructure recovery ref.
8. Have the user manually trigger **Update Portfolio Data** once with `transaction_integrity_audit_only=true`, blank target user, blank calculation job id.
9. Fetch that run/log and parse `GATE_C_TRANSACTION_INTEGRITY_AUDIT=...`.
10. Persist counts-only production evidence here and in Gate C audit docs before making any enforcement decision.
