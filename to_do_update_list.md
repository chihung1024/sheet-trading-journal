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
11. `to_do_update_list.md` must remain synchronized with execution reality.

---

# 1. Current authoritative state

- Repository: `chihung1024/sheet-trading-journal`
- Protected `main`: `03242d00082067333cf77ffa424094b8936b406c`
- D1: **Schema 2**
- Worker source contract: release `4.07` / API `2.60` / required schema `2`
- Active Gate: **Gate C — Schema-2 transaction integrity preflight**
- Active PR: **#150** — Draft
- Work branch: `pr-gate-c-transaction-integrity-preflight`
- Gate C base: `03242d00082067333cf77ffa424094b8936b406c`
- Pre-Gate-C recovery: `backup-pre-gate-c-03242d0`
- Post-Gate-B recovery: `backup-post-gate-b-03242d0`
- Current PR head at this update: `ec65aef87153c4ffc2b8e173448face00be69af6`
- Current sub-phase: **C5 production read-only qualification preparation**
- **Hold point:** do not merge blocking prefix enforcement into `main` before production read-only audit evidence exists.

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

- PR #148 final head: `80d417c125797020fab1b6be401084049f2e25e3`
- merge: `f3c55f4cd322c35ca163e1330f7b1e7bc14580bf`
- final PR CI #429: SUCCESS
- post-main CI #430: SUCCESS
- production `Update Portfolio Data` #3213 / run `31295494999`: SUCCESS, 2 users succeeded / 0 failed
- recovery: `backup-post-product-integrity-p6c-f3c55f4`

## Gate B closeout

- PR #149 final head: `439e9ed39647ccd5885a2cc02a6850712c30708a`
- final exact-head CI #433 / `31296056184`: SUCCESS
- merge: `03242d00082067333cf77ffa424094b8936b406c`
- post-main CI #434 / `31296121054`: SUCCESS
- recovery: `backup-post-gate-b-03242d0`
- result: record delete + last-record snapshot cleanup now share one D1 `batch()` transaction; malformed result/cardinality fails closed
- production Worker deployment: not performed

---

# 3. Gate C — ACTIVE

## Goal

Establish deterministic Schema-2 source-ledger integrity before allowing calculator CLAMP behavior or same-day type-priority sorting to hide impossible position prefixes.

Gate C distinguishes:

- **Schema-2 deterministic ledger order:** `Date -> record id`
- **true broker execution chronology:** not guaranteed under current schema

Do not claim the first is the second.

## Gate C prohibited scope

Do not add in the initial Gate C line:

- Schema 3
- first-class new execution columns
- broker execution table
- futures support
- broad broker-import redesign
- broad provider abstraction
- unrelated UX refactor
- production Worker deployment

---

## C1 — Runtime audit ✅ completed

Evidence file: `docs/engineering/GATE_C_TRANSACTION_INTEGRITY_AUDIT.md`

Audit commit: `2e535982e460045fb8235d99307c9ba1e31ffa2e`

### C1 conclusions

1. `prepare_transactions()` gives deterministic source order `Date -> id`; it does not create `Timestamp`/`Sequence` and does not parse `note`.
2. `PortfolioCalculator` production behavior is effectively same-day `BUY -> DIV -> SELL`, stable within each type; default oversell policy is `CLAMP`.
3. Canonical Daily-P&L independently uses compatible type-priority + clamp semantics, so calculator/reconciler agreement does **not** certify source-ledger validity.
4. `PortfolioValidator.validate_holdings_consistency()` checks final aggregate quantity only; it does not detect a negative intermediate prefix.
5. Prefix integrity must be tested on the independent **split-adjusted** ledger so pre/post-split share units are comparable.
6. Record `id` is adequate as deterministic Schema-2 ledger tie-breaker, but not proof of broker execution time.
7. Existing `_sequence` test is misleading: calculator reads `Timestamp` / `Sequence`, not `_sequence`.
8. `TransactionAnalyzer` has broad zero-on-exception behavior but no live authoritative constructor/call was found; do not broaden into a rewrite without new evidence.

---

## C2 — Prefix-integrity module and runner candidate ✅ code/CI qualified, not merged

### Contract

New module: `journal_engine/core/ledger_integrity.py`

- input: independent split-adjusted transaction DataFrame
- required identity/order: valid positive unique `id`, valid `Date`
- stable replay: `Date -> id`
- BUY adds quantity
- SELL subtracts quantity
- DIV does not change quantity
- audit scopes: `all` + every active comma/semicolon tag
- provisional tolerance: `max(1e-9, cumulative_abs_buy_qty * 1e-12)`
- first negative prefix produces deterministic non-secret diagnostic
- strict wrapper raises `LedgerIntegrityError`

### Tests

`tests/test_ledger_integrity.py` covers:

- exact zero closeout
- fractional round trip
- first-row SELL
- partial oversell
- tolerance edge + relative tolerance
- split-adjusted common units
- multi-tag scopes
- same-day `Date -> id` order
- deterministic id sorting
- DIV semantics
- missing Tag default
- timezone-aware dates
- non-DataFrame input
- invalid/bool/non-integral/non-finite ids
- invalid/empty dates
- empty symbol
- invalid/non-finite quantity
- non-finite tolerance input

Runner integration candidate:

- `main.py` now builds split-adjusted validation ledger once
- prefix preflight runs **before `PortfolioCalculator` construction**
- same validation ledger is reused for existing post-calculation split-ledger parity and upload validation
- calculator default `CLAMP` remains unchanged

Runner regression: `tests/test_runner_ledger_integrity.py`

- proves validation ledger → prefix preflight → calculator ordering
- proves prefix violation blocks calculator construction and upload
- proves same validation ledger is reused

### CI history

- PR #150 opened Draft.
- CI #435 / `31296549869`: functional Python tests passed; failed because new source file was not registered in coverage source inventory.
- Coverage source inventory updated to include `journal_engine/core/ledger_integrity.py`; **coverage thresholds were not lowered**.
- CI #436 / `31296606316`: tests passed; failed only on maximum missing-branch gate.
- Additional fail-closed input tests added; unreachable empty-tag branch removed.
- CI #438 / `31296710938`: **SUCCESS** across Python coverage, Frontend, Worker/D1.
- Runner integration commit: `72f96e06d4b2cf449427652e5aac55a80a0f625f`.
- Runner integration regression commit/current head: `ec65aef87153c4ffc2b8e173448face00be69af6`.
- CI #441 / `31296798001`: **SUCCESS** across Python coverage, Frontend, Worker/D1.

### C2 checklist

- [x] Standalone ledger-integrity module
- [x] Deterministic `Date -> id` prefix replay
- [x] `all` + active tag scopes
- [x] Split-adjusted quantity semantics
- [x] Structured diagnostics
- [x] Fail-closed input validation
- [x] Coverage inventory updated without lowering gates
- [x] Full CI green after branch-coverage additions
- [x] Runner integration candidate runs preflight before calculator
- [x] Runner regression proves violation blocks calculator/upload
- [x] Full CI green after runner integration
- [ ] Production read-only audit
- [ ] Decide disposition of PR #150 before merge based on audit result

---

## C3 — Same-day ordering regression

Completed evidence:

- [x] verified absence of production `Timestamp` / `Sequence`
- [x] verified calculator/reconciler BUY/DIV/SELL type priority
- [x] verified `Date -> id` is deterministic Schema-2 ledger-validity order
- [x] prefix unit test explicitly uses source Date/id rather than type priority
- [x] same-day BUY → SELL → BUY → SELL valid round trip covered by prefix module

Still required before Gate C closeout:

- [ ] correct/supplement misleading historical `_sequence` test to test actual `Sequence` behavior or explicitly document priority behavior
- [ ] do not parse free-form `note` into financial ordering

---

## C4 — External provenance audit

Current evidence:

- [x] repository runtime search: `import_key` is not a database/runtime-enforced identity field

Still required:

- [ ] inspect current production `note` conventions (`import_key`, IBKR order/trade ids, timestamps)
- [ ] conservatively detect duplicate structured provenance without making `note` a financial calculation dependency
- [ ] distinguish order-level vs fill-level identity risk
- [ ] document partial-fill and cross-date fill risk
- [ ] keep futures excluded

---

## C5 — Production-data qualification 🟠 NEXT

**This must happen before blocking enforcement is merged.**

Required:

- [ ] obtain current production records via an already-authorized read path
- [ ] build split-adjusted validation ledger for every user
- [ ] audit `all` and every active tag scope in `Date -> id` order
- [ ] count rows / symbols / scopes / violations
- [ ] separate tiny accepted tolerance residue from true negative prefix
- [ ] classify violations: data/import ordering, split-unit issue, unsupported short/oversell, unknown
- [ ] inspect structured production `note` provenance in the same read-only pass
- [ ] persist only anonymized diagnostics/evidence; never expose secrets or full notes
- [ ] do **not** enable strict enforcement while unexplained violations remain

### C5 execution-boundary decision

PR #150 currently contains a blocking runner preflight candidate. **Do not merge it yet.** A safe read-only production audit path must be established first. Do not expose production secrets to untrusted PR code or weaken existing deployment governance merely to perform the audit.

---

## C6 — Enforcement decision

Only after C5 evidence:

- [ ] if production prefixes are clean, decide whether to keep preflight + calculator `CLAMP` as defense-in-depth or additionally switch calculator to `ERROR`
- [ ] add strict-policy regressions before any `CLAMP -> ERROR` change
- [ ] ensure no authoritative secondary analyzer converts integrity failures to valid-looking zero output
- [ ] independently review PR diff
- [ ] check reviews/threads
- [ ] check main drift
- [ ] exact-head merge
- [ ] post-main CI
- [ ] post-Gate-C recovery
- [ ] update this file and activate Gate D

---

# 4. Gate D — QUEUED

Goal: make successful calculations explainable/replayable before provider or ledger architecture redesign.

Planned manifest/golden work:

- [ ] engine commit SHA
- [ ] record count / max record id / canonical input hash
- [ ] benchmark/config hash
- [ ] market-data as-of provenance
- [ ] FX as-of provenance
- [ ] synthetic valuation count/source
- [ ] calculation timestamp
- [ ] frozen golden replay covering transactions, prices, FX, splits, dividends, holdings, realized P&L, Daily P&L, TWR, XIRR
- [ ] prove replay distinguishes record/vendor/FX/engine/synthetic-valuation changes
- [ ] CI / independent review / exact-head merge / post-main CI / recovery

---

# 5. Post-Gate-D architecture review — DEFERRED

No implementation before a fresh review after Gate D.

Candidates only:

- Schema-3 execution identity (`source`, `external_id`, `order_id`, `executed_at_utc`, `currency`, `asset_class`, `contract_multiplier`, unique external id index)
- stronger immutable `broker_executions` table
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
- Commission rebates: Commission/Tax normalization with `abs()` cannot faithfully represent a net-negative commission.
- Futures/derivatives: no first-class asset class / multiplier; remain excluded.

---

# 8. Production / deployment boundaries

- merge ≠ production Worker deploy
- no D1 migration unless explicitly authorized + recovery-gated
- Cloudflare production activation remains separately governed
- Gate C must not mutate production D1 during audit
- do not pretend unavailable direct Cloudflare access exists
- production audit evidence must be read-only and anonymized

---

# 9. External broker constraints for later work

- IBKR recent reconstruction should use `DAYS_7`, not `TODAY` alone
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

- branch `pr-gate-c-transaction-integrity-preflight`
- audit evidence `docs/engineering/GATE_C_TRANSACTION_INTEGRITY_AUDIT.md`
- commit `2e535982e460045fb8235d99307c9ba1e31ffa2e`
- result: current clamp/type-priority consistency cannot certify source-prefix validity

### 2026-08-09 — Gate C C2 module / coverage qualification

- standalone module + tests added
- CI #435: functional tests passed; coverage source inventory blocked new file
- coverage inventory updated without lowering gates
- CI #436: tests passed; missing-branch gate still blocked
- additional fail-closed tests added; unreachable branch removed
- CI #438 / `31296710938`: SUCCESS
- decision: module/coverage contract qualified

### 2026-08-09 — Gate C C2 runner integration candidate

- main integration commit `72f96e06d4b2cf449427652e5aac55a80a0f625f`
- runner regression head `ec65aef87153c4ffc2b8e173448face00be69af6`
- CI #441 / `31296798001`: SUCCESS
- result: preflight is proven to run before calculator and block calculator/upload on violation
- decision: **do not merge blocking enforcement before C5 production read-only audit**
- **exact next action:** establish the safest read-only production audit path without weakening secret/deployment governance; run C5; write anonymized results here before any merge/enforcement decision.

---

# 11. Immediate next action for future AI

**Gate C / C5 is the next task. Do not merge PR #150 yet. Do not start Gate D or Schema 3.**

1. Re-read PR #150 current head and CI #441.
2. Establish a production **read-only** audit execution path using existing authorized credentials/governance; do not expose secrets to unsafe PR execution and do not upload snapshots during audit.
3. Audit every production user using split-adjusted `Date -> id` prefix semantics for `all` + all active tags.
4. Audit structured note provenance conservatively in the same read-only pass.
5. Persist anonymized counts/classification and exact execution evidence.
6. Only then decide whether PR #150 should be split, revised, or qualified for merge and whether any strict `CLAMP -> ERROR` proposal is safe.
