# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote main/open PR/CI/Pages and machine-readable contracts override prose.
>
> Detailed Phase 1–6 chronology remains archived at `docs/archive/to_do_update_list_through_phase6.md`. Do not restart closed work from archive plans.

Last updated: **2026-08-16 Asia/Taipei**  
Current line: **R1 Decision Cockpit is CLOSED / PRODUCTION VERIFIED. R2.1 is CLOSED / VERIFIED. R2.2A and R2.2B are CLOSED / PRODUCTION VERIFIED. R2.2C-A read-only detail UX, R2.2C-B Python shadow metadata transport, and R2.2C-C idempotent metadata-only enrichment API are CLOSED / VERIFIED; C-C is PRODUCTION VERIFIED. Production serves exact runtime source `fe81a06586b566444dd53e416c96255059bb3fdb` at release `4.10` / API `2.63` / schema `3`, Worker Version ID `297251da-a5ec-48a1-ab24-c1d8742809c8`. Python calculation-order activation remains explicitly disabled. The current product batch is R2.2C-D IBKR Source Metadata Capture + Safe Enrichment Caller.**

---

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. Keep one Primary Active Batch. Technical work exists to enable product correctness, maintainability and UX; do not create perpetual cleanup phases.
3. Debug by evidence and root cause. Inspect same-class impact and add regression/prevention rather than symptom-only patches.
4. Financial/data correctness is fail-closed. Browser presentation must never become a second accounting, FX, tax, recovery or market-data authority.
5. Important work uses recovery points, exact-head CI, frozen review, exact-head merge and post-main verification.
6. Prefer deterministic automation. **AI 管流程，不管帳**.
7. Do not delete old code/files merely because they look old; first prove they are neither compatibility surfaces nor forensic/governance evidence.
8. Phase numbering is not priority. Rank work by cross-user applicability, frequency, product/UX value and dependency order.
9. Do not infer cash, historical lots, industry classifications, risk scores or financial facts that authoritative data does not provide.
10. When a product batch closes, stop its technical work instead of expanding scope for neatness.

---

## 1. Current authoritative state

### Recovery checkpoint before Roadmap V2

GitHub Release:

`backup-2026-08-16-tech-debt-closeout`

Target:

`13b6558e48fc703afc8b9d1572ec696d104eccb2`

This is a recovery/governance checkpoint, not a Worker/API/schema version.

### Current production product runtime

R1 Decision Cockpit merge:

`eda462b0741a36ece3f4064eb302ea1b3a5b58b7`

Verification:

- PR #301 final exact head `6735454a02abd4ecfdb2ab80facac4d4a12f471d`
- exact-head CI #1062 / run `31928863491`: **SUCCESS**
- frozen review `4945470029`: **PASS / BLOCKER 0 / FOLLOW-UP 0**
- merge `eda462b0741a36ece3f4064eb302ea1b3a5b58b7`
- post-main CI #1063 / run `31928936171`: **SUCCESS**
- Pages #1583 / run `31928935341`: **SUCCESS**
- no Worker/D1/Python accounting deployment or schema change

Current production Worker runtime source:

`fe81a06586b566444dd53e416c96255059bb3fdb`

Current Worker Version ID:

`297251da-a5ec-48a1-ab24-c1d8742809c8`

Runtime contract: release `4.10`, API `2.63`, schema `3`. R2.2C-C metadata-only enrichment is live in production on top of the R2.2B metadata read/write semantics. Physical schema authority remains 3 because migration `0004_record_timeline_metadata_expand.sql` was already applied by R2.2A; Deploy Worker #10 again reported `No migrations to apply!`. Python calculation ordering remains on the existing deterministic contract and must not use partial metadata coverage.

Current production activation/deployment control-plane merge:

`6b53e1ea915b48ef2dd9c1fc97e078e4e8849f84`

R2.1 authoritative repository checkpoint:

- merged PR #305 — `docs: establish R2 ledger event contract baseline`;
- exact reviewed head `1e45afe24c792d3f23f52770b4fee9cde90f8512`;
- merge/main checkpoint `6ff2a0852f716970c485fd20f78139d246c07309`;
- exact-head CI #1069 / run `31932043354`: **SUCCESS**;
- frozen review `4945608716`: **PASS / BLOCKER 0 / FOLLOW-UP 0**;
- post-main CI #1070: **SUCCESS**;
- Pages #1585: **SUCCESS**;
- no runtime/schema activation in R2.1.

R2.2A repository closeout / production expansion gate:

- recovery base: exact `main@6ff2a0852f716970c485fd20f78139d246c07309`;
- PR #306 — `db: expand nullable transaction timeline metadata`;
- substantive frozen head: `11fce6e3bff4520a48998f039ac3c6e20c8843eb`;
- substantive CI #1071 / run `31932538495`: **SUCCESS**;
- substantive review `4945633945`: **PASS / BLOCKER 0 / FOLLOW-UP 1**;
- final exact head: `3d4a9a738fcc53b9b2b4f35f2060584d663bbb70`;
- final exact-head CI #1072 / run `31932628031`: **SUCCESS**;
- final frozen review `4945637870`: **PASS / BLOCKER 0 / FOLLOW-UP 1**;
- merge/main checkpoint: `a7fc221b3a41e129766e852fae7140430b8ec36f`;
- post-main CI #1073 / run `31932726361`: **SUCCESS**;
- Pages #1586 / run `31932725963`: **SUCCESS**;
- no Worker/API/frontend/Python calculation behavior change in the R2.2A schema expansion itself;
- handoff truth repair PR #307 merge/runtime source: `9aed8760dfd49d9568b86555a87c61de086df3d0`;
- Production Identity Evidence #19 / run `31933155712`: **SUCCESS** for exact source `9aed8760dfd49d9568b86555a87c61de086df3d0`;
- identity artifact `9259872791`, digest `sha256:f54729eee0a8db1f589c70db32ed17f6ce0313ae5f4dd2e1c825392b3e2cee94`: sanitized PASS / `errors=[]`;
- activation/request PR #308 final exact head `26b4ab6021e97961f65db82f8ccb489b523bed2c`;
- PR #308 exact-head CI #1078 / run `31933347864`: **SUCCESS**;
- PR #308 frozen review `4945661457`: **PASS / BLOCKER 0 / FOLLOW-UP 0**;
- PR #308 merge/control plane `ce5ce80d449d76cb7a581aac4bf6f34df0c9f5b3`;
- post-main CI #1079 / run `31933394774`: **SUCCESS**;
- Pages #1588 / run `31933394407`: **SUCCESS**;
- Production Deployment Dispatch Broker #5 / run `31933394781`: **SUCCESS**;
- canonical Deploy Worker #8 / run `31933401342`: **SUCCESS** after reviewer-protected `production` Environment approval;
- remote production D1 applied exactly `0004_record_timeline_metadata_expand.sql`: **SUCCESS**;
- Worker redeployed from exact runtime source `9aed8760dfd49d9568b86555a87c61de086df3d0`, Worker Version ID `1cf64e71-f4d4-4a30-89eb-2c0fd14d3472`;
- at the R2.2A closeout checkpoint, live runtime was release `4.08`, API `2.61`, schema `3`; `/version` and `/health` returned HTTP 200, anonymous records remained 401, production origins 204, staging/localhost origins 403;
- stable post-deploy production contract: **3/3 consecutive PASS**;
- post-deploy artifact `9260057775`, digest `sha256:f66126a2ce5b63c3f05297bee09e5b0da9fd270377ded339fe172b9f2fe700e2`;
- therefore R2.2A physical storage expansion was **PRODUCTION VERIFIED** with metadata API/accounting semantics intentionally inactive at that checkpoint; R2.2B has since activated the reviewed API/write semantics.

A later docs-only merge may advance repository `main` without changing product runtime. Always re-read fresh remote truth.

### Product state

- Phase 1 Multi-Market Transaction Experience — CLOSED / PRODUCTION VERIFIED
- Phase 2 Trading Journal Note UX — CLOSED / PRODUCTION VERIFIED
- Phase 3 Explainability — OPTIMIZED FOR CURRENT REQUIREMENTS
- Phase 4 Strategy Analytics — OPTIMIZED FOR CURRENT REQUIREMENTS
- Phase 5 Historical Lot / Trade Analytics — BACKLOG until an authoritative historical lot producer exists
- Phase 6 UX Convergence — OPTIMIZED FOR CURRENT REQUIREMENTS
- Phase 7.1 IBKR Stock Trade File Import — PRODUCTION CODE/PAGES VERIFIED
- Phase 8.1 Responsive Daily P&L Density — CLOSED / PRODUCTION PAGES VERIFIED
- Phase 9.1 Dividend Confirmation Source of Truth — CLOSED / PRODUCTION PAGES VERIFIED
- Phase 9.2 Deterministic Dividend Event Identity — CLOSED / PRODUCTION VERIFIED
- Phase 10 roadmap — COMPLETE / OPTIMIZED FOR CURRENT REQUIREMENTS
- Phase 11 Daily Portfolio Command Center — **SUBSUMED by R1 Decision Cockpit**
- Former Phase 12 IBKR Sync Automation — OPTIONAL BROKER-SPECIFIC BACKLOG
- Phase 13 Cross-Page UX Consistency & Holdings Visualization — OPTIMIZED FOR CURRENT REQUIREMENTS
- Independent technical-debt root-cause cleanup TD-A / TD-B — CLOSED / PRODUCTION VERIFIED
- **R1 Decision Cockpit — CLOSED / PRODUCTION VERIFIED**
- **R2 Ledger Truth v2 — ACTIVE**
- **R2.1 Event / Timeline Contract Audit — CLOSED / VERIFIED**
- **R2.2A Nullable Timeline Metadata Storage Expansion — CLOSED / PRODUCTION VERIFIED**
- **R2.2B Metadata API Activation + Writer Semantics — CLOSED / PRODUCTION VERIFIED**
- **R2.2C Transaction Timeline Detail + Source Metadata Capture — ACTIVE; C-A/B/C closed, C-D current**

---

## 2. Roadmap V2

The previous independent audits were consolidated into four dependency-ordered product capabilities to minimize rework.

### R1 — Decision Cockpit — DONE

Purpose: make the Overview answer the most frequent user questions without repeating the same facts in multiple dashboard blocks.

Final information hierarchy:

```text
現在 / Overview headline
→ 今日脈絡 / reasons
→ 待處理 / exception-driven actions
→ 趨勢 / PerformanceChart
```

#### Final information ownership

- `持倉市值` — one primary headline owner;
- `今日損益` — one primary headline owner;
- `累計損益` — one primary headline owner;
- `持倉成本 / 未實現 / 已實現` — breakdown beneath the headline;
- `TWR / XIRR` — secondary long-term performance context, preserving reliability caveats;
- Daily P&L contributor/detractor — context only, never another primary total;
- concentration — context only;
- pending dividends — rendered only when an action is actually required;
- PerformanceChart — trend/time-series role only.

#### Architecture

```text
Pinia authoritative data
→ OverviewPage (only page-level store/orchestration owner)
→ reviewed domain services
   - dailyPnlExplainability
   - portfolioConcentration
   - dividendAttention
   - twrState
→ overviewProjection (pure UI read-model projection)
→ props-only OverviewHeadline / OverviewContext
→ optional DailyPnlExplanation detail
→ PerformanceChart
```

`overviewProjection.js` must not become a second store/accounting engine. It may compose and format already-reviewed facts and preserve existing presentation compatibility, but must not fetch, mutate, calculate portfolio accounting, invent FX, or establish another financial authority.

#### Retired by R1

Removed rather than hidden:

- `DailyCommandCenter.vue`
- `StatsGrid.vue`
- `StatsGridSkeleton.vue`
- `dailyCommandCenter.js`
- obsolete Daily Command contract
- stale `.daily-command / .command-card / .stats-grid / .stat-block` layout selectors

Do not recreate these as a parallel Overview summary system.

#### R1 regression lessons

Two root-cause issues were caught before merge and now have prevention:

1. Phase-13 product-consistency regression still required retired command/stats selectors. The old test contract was corrected to protect the current IA rather than force dead architecture to remain.
2. JavaScript `Number(null) === 0` could make missing Overview values appear as false zeroes. New Overview numeric formatters accept only actual finite numbers; missing values display fail-closed as `—`.

Legacy daily-return presentation fallback is preserved: published `daily_pnl_roi_percent` wins; older snapshots may fall back to reviewed daily P&L ÷ published `daily_pnl_base_value` exactly as the former StatsGrid did.

---

### R2 — Ledger Truth v2 — ACTIVE

Purpose: establish a truthful account/event foundation before building account-level analytics, universal restore/import, or AI portfolio interpretation.

R2 combines two previously separate proposals because they are the same domain problem:

- **Transaction Timeline Integrity**
- **Account / Cash Ledger Foundation**

#### R2 target event contract

Design one backward-compatible canonical event model able to represent:

- trade date;
- optional authoritative execution timestamp and/or stable sequence;
- symbol/instrument identity;
- transaction type;
- quantity / price / fee / tax / currency;
- source/import provenance;
- explicit cash events;
- deterministic event identity/idempotency;
- compatibility with existing BUY / SELL / DIV records.

Do not make exact time mandatory for old/manual records. Existing records must remain valid.

#### R2.1 — Event / Timeline Contract Audit — CLOSED / VERIFIED

Detailed contract: `docs/engineering/R2_LEDGER_TRUTH_V2_EVENT_CONTRACT_AUDIT_2026-08-16.md`.

Primary evidence:

- durable `records` schema remains date-level plus create-idempotency hashes;
- Worker create/update validation still accepts only the legacy transaction payload;
- `main.prepare_transactions()` supplies `Date -> id` deterministic ingest order but no first-class execution metadata;
- Gate C already proved that `Date -> id` is a deterministic ledger order, not broker chronology, and explicitly rejected reconstructing execution order from free-form `note`;
- IBKR parsing already sees `Currency`, `DateTime`, `OrderID` and `TradeID`, but current persistence sanitization removes the legacy machine-note envelope before the user Journal Note is stored.

Root cause:

> the project lacks one canonical optional transaction-event metadata envelope between import adapters, Worker/D1, Python and presentation.

R2.1 accepted contract:

- existing BUY / SELL / DIV records remain valid without new metadata;
- future transaction metadata is additive and nullable;
- first implementation candidates are `currency`, `executed_at`, `execution_sequence`, `event_source`;
- no fabricated timestamp/default timezone for legacy/manual records;
- aggregated multi-fill imports do not invent one exact timestamp unless the adapter has a reviewed unambiguous policy;
- individual timestamps may be captured/displayed, but **partial timestamp coverage must not activate authoritative calculation chronology**;
- capture/persistence and calculation-order activation are separate gates;
- future create payload hashing must include metadata that changes durable event meaning;
- legacy-compatible updates must not silently erase metadata, and amended records must not leave stale ordering evidence trusted by calculation;
- cash event storage remains a later R2.3 decision instead of widening the current `records.txn_type` constraint in this batch.

R2.1 scope classification:

- NOW: contract, backward compatibility, coverage-aware ordering, mutation/idempotency gates;
- NEXT: additive capture/persistence + timeline/detail presentation + shadow Python transport;
- BACKLOG: broker background sync and richer provenance references until R3 reconciliation needs them;
- REJECT: parsing `note`, fake timestamps, partial-coverage chronology, early NAV cutover, unrelated cleanup.

R2.1 closeout:

- PR #305 merged to `main@6ff2a0852f716970c485fd20f78139d246c07309`;
- exact-head CI #1069: **SUCCESS**;
- frozen review: **PASS / BLOCKER 0**;
- post-main CI #1070 and Pages #1585: **SUCCESS**;
- no Worker/D1/Python/UI runtime behavior changed.

#### R2.2A — Nullable Timeline Metadata Storage Expansion — CLOSED / PRODUCTION VERIFIED

Primary Goal:

> establish additive physical storage for R2.1 transaction metadata without activating a new Worker/API/schema contract or changing any existing user/calculation behavior.

Scope lock:

- **In Scope:** D1 nullable columns, local migration tests, legacy-row compatibility, configuration gate for expand-only semantics.
- **Out of Scope:** Worker CRUD metadata, idempotency hash v2, manual/IBKR writers, UI display, Python ordering, cash/NAV, unrelated refactoring.
- **Risk:** R2 financial data contract, but runtime behavior radius intentionally minimized.

Files:

- `migrations/0004_record_timeline_metadata_expand.sql`
- `tools/test_d1_schema.mjs`
- `tools/check_worker_config.mjs`
- this handoff closeout

Implementation:

- adds nullable `currency TEXT`;
- adds nullable `executed_at TEXT`;
- adds nullable `execution_sequence TEXT`;
- adds nullable `event_source TEXT`;
- no defaults and no `NOT NULL` — unknown remains unknown;
- `0004` deliberately does **not** update `schema_metadata`, so the active schema-v3 Worker remains compatible and authoritative;
- `execution_sequence` is frozen as TEXT for the persistence layer to avoid lossy JavaScript/SQLite numeric coercion and preserve source/reviewed-adapter ordering tokens; R2.2A does not authorize lexical/numeric sorting on this field;
- no index added because no production query consumes these fields yet.

Root cause / decision:

The current D1 test/config control plane ties active schema metadata to the Worker manifest. Physically adding nullable columns and simultaneously advancing the Worker schema contract would collapse the R2.1-required two-stage rollout. The selected expand→activate pattern instead lets production D1 gain backward-compatible columns first while the old Worker continues to operate unchanged. R2.2B can then activate metadata API semantics only after storage exists and is verified.

Verification:

- branch recovery base: `main@6ff2a0852f716970c485fd20f78139d246c07309`;
- substantive exact head: `11fce6e3bff4520a48998f039ac3c6e20c8843eb`;
- PR #306 CI #1071 / run `31932538495`: **SUCCESS**;
- Frontend contracts/build: **SUCCESS**;
- Python compile/tests/coverage gate: **SUCCESS**;
- Worker test suites/config/recovery gate: **SUCCESS**;
- local D1 applies all migrations: **SUCCESS**;
- local D1 verifies all four new columns are TEXT, nullable, no-default: **SUCCESS**;
- old-shape BUY record INSERT without metadata: **SUCCESS**, all new fields read back NULL;
- substantive frozen review `4945633945`: **PASS / BLOCKER 0 / FOLLOW-UP 1**;
- final exact head `3d4a9a738fcc53b9b2b4f35f2060584d663bbb70`: CI #1072 / run `31932628031` **SUCCESS**;
- final frozen-head review `4945637870`: **PASS / BLOCKER 0 / FOLLOW-UP 1**;
- merge `a7fc221b3a41e129766e852fae7140430b8ec36f`;
- post-main CI #1073 / run `31932726361`: **SUCCESS**;
- Pages #1586 / run `31932725963`: **SUCCESS**;
- production D1 expansion: **VERIFIED** by canonical Deploy Worker #8 / run `31933401342`; remote `0004_record_timeline_metadata_expand.sql` applied successfully, compatible schema-v3 Worker redeployed, and stable production contract passed 3/3 consecutive probes.

Regression / prevention:

- config test rejects any `UPDATE schema_metadata` in the expand-only migration;
- config test rejects accidental `DEFAULT` or `NOT NULL` constraints in the new columns;
- D1 test proves old writers remain valid;
- current Worker record projections ignore the new columns, so existing reads/writes/calculation remain unchanged.

Rollback:

- production migration is now applied. Do **not** destructively drop the four nullable columns as an emergency rollback; the compatible schema-v3 Worker safely ignores them;
- if runtime rollback is required, use the protected deployment path to redeploy a reviewed schema-v3-compatible source while leaving additive columns inert;
- any future removal of the columns requires a separately reviewed cleanup with data-usage evidence after R2.2B/R2.2C evolution.

R2.2A production activation closeout:

1. handoff truth repair PR #307 merged at exact runtime source `9aed8760dfd49d9568b86555a87c61de086df3d0`;
2. reviewer-protected **Production Identity Evidence #19** / run `31933155712` returned sanitized PASS for that exact source;
3. activation evidence + exact-source authority/request were reviewed in PR #308 and merged at control-plane `ce5ce80d449d76cb7a581aac4bf6f34df0c9f5b3`;
4. **Production Deployment Dispatch Broker #5** / run `31933394781` validated protected-main control plane and dispatched canonical deployment;
5. reviewer-protected **Deploy Worker #8** / run `31933401342` verified D1 identity, applied remote `0004`, redeployed the unchanged schema-v3 Worker, and reached 3/3 stable production-contract passes;
6. post-deploy artifact `9260057775` proves runtime source/version/health/CORS remained within the reviewed compatibility contract;
7. R2.2A closed with the four nullable columns present but non-authoritative to API/accounting at that checkpoint; the separately reviewed R2.2B activation has since made the API/write semantics production-authoritative.

Historical R2.2A review FOLLOW-UP → **SATISFIED BY R2.2B**:

- preserve pre-upgrade create-idempotency compatibility: if all metadata is absent/null, canonical payload hashing must remain byte-for-byte/effectively identical to the legacy hash input; if any authoritative metadata is present, use a versioned extended fingerprint so same idempotency key + different metadata conflicts;
- same-event amendments should preserve omitted metadata, while changes that alter event identity/order must clear or revalidate stale chronology/provenance rather than silently trust old browser state.

#### R2.2B — Metadata API Activation + Writer Semantics — CLOSED / PRODUCTION VERIFIED

Primary Goal:

> activate backward-compatible Worker/API read/write semantics for the four optional transaction metadata fields while keeping calculation chronology disabled until a separate evidence gate.

Production contract now live:

- release `4.09`, API `2.62`, physical schema authority remains `3`;
- optional `currency`, `executed_at`, `execution_sequence`, `event_source` are validated and persisted on POST/PUT;
- legacy create payload hashing remains byte-compatible whenever all metadata is absent/null;
- any authoritative metadata uses the versioned `record-create-metadata-v1` fingerprint so same key + changed metadata conflicts;
- same-event PUT preserves omitted metadata; explicit null clears; changing `txn_date`, `symbol` or `txn_type` clears omitted stale metadata;
- preservation/clearing is one tenant-scoped atomic SQL `UPDATE ... CASE`, not a SELECT→UPDATE read/modify/write window;
- `GBp` remains a valid quote unit, `executed_at` requires a real offset-aware timestamp, `execution_sequence` remains opaque TEXT, and `event_source` is limited to reviewed privacy-safe classes;
- migration history remains immutable: runtime release and historical schema-activation release are separate authorities.

Repository verification:

- PR #310 final exact head `5d479de77edc31f096cdf57cf2d60ffc8b998b0a`;
- exact-head CI #1084 / run `31937509649`: **SUCCESS** — Frontend, Worker/D1 and Python all green;
- frozen review `4945819640`: **PASS / BLOCKER 0 / FOLLOW-UP 0**;
- merge/main checkpoint `263fbbd665f519dc69d6828c351c66e399e5f266`;
- post-main CI #1085 / run `31937610097`: **SUCCESS**;
- Pages #1590 / run `31937609532`: **SUCCESS**;
- exact-head Worker CI includes real local D1 proof that SQLite CASE expressions use pre-update identity values and preserve cross-tenant isolation;
- the first CI failure was traced to a pre-existing brittle Journal Note test that matched an exact historical SQL column sequence. It was replaced with invariant-level checks; no frontend runtime behavior was changed.

Production activation closeout:

1. reviewer-protected **Production Identity Evidence #21** / run `31938174096` audited exact source `cc889dc4e497351528fb9efdfbd1ae2db5b6d3a3`: **SUCCESS**;
2. identity artifact `9261266695`, digest `sha256:dbecc165bb4f6e5e816027784304a2aa4e404cf8bf148046ea5d14a0127c1025`: sanitized PASS / `errors=[]`;
3. activation PR #312 exact head `f03ec686d9a368d720bacc44cdbf22232cc74467`, CI #1088 / run `31938390555`: **SUCCESS**, frozen review `4945850245`: **PASS / BLOCKER 0 / FOLLOW-UP 0**;
4. PR #312 normal merge/control plane `c30e2671eb6aaddecbfa473ed813abbba2eef7a7`; post-main CI #1089 / run `31938455177`: **SUCCESS**; Pages #1592 / run `31938454889`: **SUCCESS**;
5. **Production Deployment Dispatch Broker #6** / run `31938455181`: **SUCCESS** and dispatched the canonical deploy for exact runtime source `cc889dc4e497351528fb9efdfbd1ae2db5b6d3a3`;
6. reviewer-protected **Deploy Worker #9** / run `31938461098`: **SUCCESS** after production approval; all preflight, D1 identity and repeated authority checks passed;
7. remote D1 migration step reported **No migrations to apply**, proving R2.2B activation did not change physical schema or replay migration `0004`;
8. canonical Worker `journal-backend` deployed release `4.09` / API `2.62` / schema `3`, Worker Version ID `11593548-e848-4e22-8504-989234c6ca47`;
9. propagation probe #1 correctly rejected the still-visible old source; probes #2–#4 then passed three consecutive full contracts for exact source `cc889dc4e497351528fb9efdfbd1ae2db5b6d3a3`, so the stable gate did not accept a single-edge hit;
10. post-deploy artifact `9261380121`, digest `sha256:d0a387feac906b59d35971a60531d26294583b316fb0053142e7fe162ba00ae7`: `/version=200`, `/health=200`, anonymous records `401`, approved production origins `204`, staging/localhost origins `403`.

Production boundary:

- R2.2B metadata API/write semantics are now **PRODUCTION VERIFIED**;
- storing, reading or writing metadata still does **not** authorize Python calculation ordering;
- partial timestamp coverage remains non-authoritative for chronology;
- `execution_sequence` remains opaque until a reviewed source-specific comparator contract exists;
- the next product work may present/transport metadata, but calculation ordering requires a separate evidence gate.

#### R2.2C — Transaction Timeline Detail + Source Metadata Capture — ACTIVE

Closed sub-batches:

- **R2.2C-A Read-only metadata detail UX** — PR #314 head `ddd4da9a72348c095b51ae08d401fdb843f9f40c`, merge `be4eb3279af084f2acbfa232283db181029dee87`; exact-head CI #1093 and post-main CI #1094 / Pages #1594 passed. Stored metadata is shown only in the shared transaction detail surface; list ordering and valuation authority were not changed.
- **R2.2C-B Python shadow metadata transport** — PR #315 head `1c0a746a509974f9b854cbc20a8e14274b4b4500`, merge `65645024d7d94fb1b890feb9e45a28fbbf1d5e7d`; CI #1095, post-main CI #1096 and Pages #1595 passed. Lower-case metadata columns are transported but are deliberately not aliased to calculator `Timestamp` / `Sequence`; chronology remains disabled.
- **R2.2C-C Idempotent metadata-only enrichment API** — PR #316 head `6848500b640cba8667b2dcf42de2abfbb02bfc94`, runtime source/merge `fe81a06586b566444dd53e416c96255059bb3fdb`; exact-head CI #1097 / run `31940363921`, frozen review `4945918738`, post-main CI #1098 / Pages #1596 passed. The user-only `PUT /api/records/metadata` performs tenant-scoped atomic fill-only enrichment guarded by expected economic fields and never overwrites authoritative metadata or transaction economics.

R2.2C-C production activation closeout:

1. Production Identity Evidence #23 / run `31941927006`: **SUCCESS** for exact runtime source `fe81a06586b566444dd53e416c96255059bb3fdb`;
2. identity artifact `9262258229`, digest `sha256:1f605b54f4335aafc232f3e6c2850e08fe92eb799b2f756a6e67ca274dda0e8b`: sanitized PASS / all production identity, Pages and CSP checks true / `errors=[]`;
3. activation PR #317 exact head `155b34826b776623e072fbe120a72ec45e286dad`; CI #1099 / run `31942066904`: **SUCCESS**; frozen review `4945976036`: **PASS**; normal merge/control plane `6b53e1ea915b48ef2dd9c1fc97e078e4e8849f84`;
4. Production Deployment Dispatch Broker #7 / run `31942122506`: **SUCCESS**;
5. reviewer-protected Deploy Worker #10 / run `31942127294`: **SUCCESS**; remote D1 reported `No migrations to apply!` and canonical Worker deployed release `4.10` / API `2.63` / schema `3`;
6. Worker Version ID `297251da-a5ec-48a1-ab24-c1d8742809c8`;
7. propagation attempt #2 correctly observed an old edge and reset the stability counter; attempts #3–#5 then passed three consecutive full contracts, preserving the fail-safe rollout rule;
8. post-deploy artifact `9262381868`, digest `sha256:b25346e1a0cd4d5df0e8d120591f06aafed714155d501535790954b555039158`: `/version=200`, `/health=200`, anonymous records `401`, production origins `204`, staging/localhost/127.0.0.1 origins `403`.

Current primary batch — **R2.2C-D IBKR Source Metadata Capture + Safe Enrichment Caller**:

- keep the existing IBKR legacy POST payload and durable idempotency key unchanged;
- after confirmed create/replay, enrich the returned record id through the production-verified metadata-only endpoint;
- capture source currency and privacy-safe IBKR provenance; never persist Account ID as metadata;
- only persist `executed_at` when the source timestamp is genuinely offset-aware; timezone-less `YYYYMMDD;HHMMSS` remains unknown;
- multi-fill orders do not invent one execution timestamp when authoritative fill times differ;
- metadata-only success refreshes record detail state but does not request Python recalculation;
- metadata enrichment failure is a source-information warning, never a false transaction-write failure;
- Python chronology remains disabled until a separate coverage/comparator evidence gate.

#### R2 cash/account truth

Explicit cash must be event-driven and multi-currency. Candidate event classes require design/review before schema activation, including:

- opening cash balance;
- deposit;
- withdrawal;
- trade-related cash movement derived from authoritative transaction semantics;
- dividend cash movement derived from confirmed DIV records;
- narrowly defined adjustment only if an auditable use case is proven.

Do not infer historical cash as zero. Do not backfill a fake account NAV from securities-only history.

Expected eventual semantics after reconciliation:

```text
Account NAV = securities market value + explicit cash
Contributed capital = explicit external cash flows
Securities market value = current holdings market value
Cash = currency-aware ledger balance
```

Current UI continues to say `持倉市值 / 持倉成本` until account coverage is sufficiently authoritative for a reviewed NAV cutover.

#### R2 rollout principle

Prefer additive/shadow computation and reconciliation first. Do not immediately replace the current production summary with account-level numbers.

A safe R2 sequence is:

1. canonical event/timeline contract + backward compatibility — **R2.1 CLOSED / VERIFIED**;
2. physical nullable transaction metadata expansion — **R2.2A CLOSED / PRODUCTION VERIFIED**;
3. metadata API activation + writer/idempotency/amendment semantics — **R2.2B CLOSED / PRODUCTION VERIFIED**;
4. timeline/detail presentation + shadow Python metadata transport + safe source enrichment — **R2.2C CURRENT; C-A/B/C CLOSED, C-D CURRENT**, still without calculation-order activation;
5. explicit cash event storage/model;
6. shadow cash ledger calculation;
7. reconciliation and migration UX;
8. only then review account NAV / account-level performance cutover.

R2.2 must itself keep execution-order activation behind a later evidence gate; storing a timestamp/sequence does not automatically authorize the accounting engine to use it.

---

### R3 — Universal Data Gateway — AFTER R2 FOUNDATION

Consolidates:

- broker-neutral import;
- user export / backup / restore;
- existing IBKR file importer as Adapter #1;
- future broker APIs/Flex sync as adapters rather than direct ledger bypasses.

Target flow:

```text
external file/API/export
→ parse
→ normalize to canonical events
→ column/source mapping
→ local preview
→ deterministic validation
→ duplicate/conflict reconciliation
→ authenticated idempotent create
```

AI may suggest mappings; deterministic validation decides whether data can enter the ledger.

Backup/restore should use a versioned canonical export schema and the same preview/reconciliation engine rather than direct database replacement.

---

### R4 — Portfolio Intelligence — AFTER R2/R3 TRUST FOUNDATION

Consolidates:

- account-level advanced analytics;
- authoritative historical lot/trade lifecycle analytics;
- AI Journal Intelligence.

Order:

1. reviewed account-value/performance methodology;
2. historical lot producer from authoritative transaction events;
3. Sharpe / Sortino / MDD / rolling/benchmark analytics with explicit methodology;
4. AI summarization and behavioral insight over deterministic facts.

AI must never become a second accounting, FX, tax, lot-matching or market-data engine.

---

## 3. Stable authority boundaries

### Mutation / calculation

```text
record durable intent
→ tenant-scoped idempotent Worker write
→ committed mutation/readback
→ durable dirty generation
→ calculation lifecycle
→ Python snapshot publication
→ browser verification/presentation
```

No browser-local accounting or recovery authority.

### R2 transaction event metadata

```text
source/manual facts
→ adapter/form validation
→ optional durable event metadata
→ read/presentation
→ shadow calculation transport
→ separate ordering-activation review
```

`note` is user Journal content, not execution chronology/provenance storage. `id`/`created_at` remain deterministic database facts but must not be presented as broker execution time.

R2.2A physical storage and R2.2B API/write semantics are now live in production from exact runtime source `cc889dc4e497351528fb9efdfbd1ae2db5b6d3a3`, release `4.09` / API `2.62` / schema `3`. This makes metadata available for truthful capture, read and presentation only. Python calculation ordering remains disabled until a separate source/coverage/comparator evidence gate is reviewed and activated.

### Overview presentation

```text
OverviewPage
→ existing reviewed domain services
→ overviewProjection
→ props-only Headline / Context
```

One fact has one primary owner on Overview. A second appearance is allowed only if it adds decomposition, trend, comparison, causal explanation or action context.

### Design system / typography

```text
src/style.css
→ font source + semantic --type-* / --icon-* roles
→ Vue consumers
→ designTypography.js bridge for canvas/Chart.js only
```

`src/styles/product-consistency.css` remains layout/density only.

### Financial terminology

Until R2 provides explicit cash/account truth:

- `summary.total_value` → user-facing `持倉市值`;
- `summary.invested_capital` → user-facing `持倉成本`;
- generic cash-inclusive `總資產淨值 / NAV` is invalid;
- generic whole-account ROI language is invalid for the current unrealized-only ratio.

### Dividend

- actual same-tenant DIV record is the only `已入帳` authority;
- pending attention reconciles snapshot candidates against records-authoritative DIV confirmation;
- no browser-local confirmation authority;
- no inferred pay date or unreviewed tax policy.

### Journal / history

- Journal summary placement is presentation only;
- full Journal Note remains in `RecordDetailPanel`;
- no historical lot inference from current-day `day_ledger`;
- records remain authoritative transaction history.

### Portfolio concentration

- weights consume reconciled holdings market values + summary total;
- cash is not inferred;
- sector/industry remains deferred until authoritative classification metadata exists.

---

## 4. Intentional legacy / forensic material

Do not blanket-delete:

- `cloudflare worker/` forensic Worker archive;
- deployment tombstones/historical pointers;
- serialized compatibility field names such as `total_value` / `invested_capital`;
- migration readers / recovery state without production evidence that removal is safe;
- compatibility readers required for existing snapshots/records.

Do not use `npm audit fix --force` or blanket dependency upgrades as generic cleanup.

---

## 5. REJECT / DO NOT DO WITHOUT NEW EVIDENCE

- no second Overview read-model owner for the same reviewed facts;
- no second browser valuation/accounting/FX engine;
- no cash-inclusive `NAV/總資產淨值` claim before R2 establishes explicit cash truth;
- no guessed historical cash;
- no mandatory fabricated execution timestamps for legacy records;
- no reconstruction of financial chronology from free-form `note`;
- no use of `created_at` or record `id` as fake execution timestamp;
- no calculation-order activation from partial timestamp coverage;
- no generic lexical/numeric ordering of `execution_sequence` before a reviewed source/comparator contract;
- no assumption that live R2.2B metadata authorizes calculation chronology; Python ordering remains behind a separate full-coverage/source-comparator evidence gate;
- no historical lot attribution from current-day `day_ledger`;
- no sector/industry classification guessed from symbol names, frontend maps or strategy Tags;
- no invented risk score, forecast or investment recommendation without reviewed methodology;
- no new arbitrary numeric Vue/CSS or Chart.js typography scale;
- no blanket deletion of forensic archives, tombstones or compatibility fields;
- no IBKR-specific automation path that bypasses the future Universal Data Gateway.

---

## 6. Current Phase / Batch / Next Actions

### Primary Goal

**R2 Ledger Truth v2: make account/event data truthful enough that future timeline, cash, import/restore and intelligence features do not depend on inferred chronology or fake NAV.**

### Current Phase

`R2 — Ledger Truth v2`

### Current Batch

`R2.2C — Transaction Timeline Detail UX + Shadow Metadata Transport`

Primary objective:

> make the newly-live optional event metadata understandable and useful in transaction history/detail while carrying it through Python as shadow, non-ordering data; do not change accounting chronology.

Product-first scope:

1. re-audit the current transaction history/detail data path and keep one presentation owner for event metadata;
2. present authoritative `currency`, `executed_at`, `execution_sequence`, and `event_source` when present, with graceful absence for legacy/manual records;
3. use explicit labels that distinguish execution time/source from database `created_at` and record `id`; never fabricate a timestamp or provenance value;
4. carry the optional metadata through Python transaction models/normalization in shadow form only so later reconciliation can measure coverage without changing sort/order behavior;
5. add focused regression tests for legacy records, partial metadata coverage, privacy-safe provenance and presentation semantics;
6. inspect manual/import capture boundaries only where necessary to support truthful UX; do not broaden into broker-specific background sync.

Non-goals:

- no Python calculation-order activation;
- no ordering from partial timestamp coverage;
- no generic lexical/numeric interpretation of `execution_sequence`;
- no cash/NAV or account-level performance cutover;
- no IBKR background sync;
- no unrelated refactor or cleanup.

Entry truth:

- production Worker source `cc889dc4e497351528fb9efdfbd1ae2db5b6d3a3` is stable at release `4.09` / API `2.62` / schema `3`;
- production D1 already contains the four nullable metadata columns;
- R2.2B write/idempotency/amendment semantics are production verified;
- legacy records without metadata remain fully valid;
- current deterministic calculation chronology remains unchanged and is an explicit safety boundary.


---

## 7. Fresh-session startup

1. Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this handoff.
2. Re-read fresh `main`, open PRs, CI and Pages before modification.
3. Treat new user screenshots/logs/production symptoms as newer than prose.
4. Keep one Primary Active Batch and preserve its recovery point.
5. Reopen closed work only for fresh material evidence.
6. Debug same-class impact + regression prevention.
7. Overview changes must preserve `OverviewPage` as the page-level orchestration boundary and reuse reviewed domain services.
8. Typography changes must extend semantic roles at the design-system authority; canvas uses the approved bridge.
9. R2 is active. R2.1, R2.2A and R2.2B are closed / verified, and production now serves R2.2B exact source `cc889dc4e497351528fb9efdfbd1ae2db5b6d3a3` at release `4.09` / API `2.62` / schema `3`. Continue with **R2.2C Transaction Timeline Detail UX + Shadow Metadata Transport** only; do not activate cash/NAV or calculation chronology from partial metadata coverage.