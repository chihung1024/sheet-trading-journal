# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. GitHub / CI / deployment remote truth overrides this snapshot.
>
> Historical chronology is preserved in versioned records rather than duplicated here:
> - Phase 1–6: `docs/archive/to_do_update_list_through_phase6.md`
> - Full pre-R2.4 live-status snapshot: `docs/archive/to_do_update_list_pre_r2_4_closeout_snapshot.md`
> - R2.4 production closeout: `docs/engineering/R2_4_SHADOW_CASH_LEDGER_PRODUCTION_CLOSEOUT_2026-08-17.md`
> - R2.5A currency reconciliation closeout: `docs/engineering/R2_5A_TRANSACTION_CURRENCY_RECONCILIATION_CLOSEOUT_2026-08-17.md`
> - R2.5B post-reconciliation production evidence: `docs/engineering/R2_5B_POST_RECONCILIATION_SHADOW_EVIDENCE_2026-08-17.md`
> - R2.5C opening-balance readiness closeout: `docs/engineering/R2_5C_OPENING_BALANCE_READINESS_CLOSEOUT_2026-08-17.md`
> - R2.5D opening-balance/shadow completion: `docs/engineering/R2_5D_OPENING_BALANCE_SHADOW_COMPLETE_2026-08-17.md`
> - R2.6A account-value preview production closeout: `docs/engineering/R2_6A_ACCOUNT_VALUE_PREVIEW_PRODUCTION_CLOSEOUT_2026-08-17.md`

Last updated: **2026-08-17 Asia/Taipei**  
Current line: **R1 and R2.1–R2.6A are closed at their reviewed boundaries. Production `Update Portfolio Data #3301` / run `32001637621` on `main@550c73f554915d3af6fe2805c788d65c045e0b87` proved cash-shadow completeness and the new engine-owned account-value preview: 192/192 transaction rows resolved, 2/2 cash events resolved, USD observed, `issue_codes=[]`, cash `complete=True`, preview `status=ready`, missing FX `[]`, and snapshot upload succeeded. Existing securities-only Daily P&L/TWR/XIRR/performance semantics remain unchanged. Production Worker remains runtime source `f93dbbed3f67ce4e8c9d808d286f2c0096c1e8ee`, Worker Version ID `ebcbdd35-3f5d-40b9-bb97-aef4a25ef706`, release `4.12` / API `2.65` / schema `3`. The single Primary Active Batch is R3.1A Broker-Neutral Export & Backup Foundation.**

---

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. Keep one Primary Active Batch. Technical work exists only to enable product correctness, maintainability and UX.
3. Debug from evidence and root cause; inspect same-class impact and add regression prevention.
4. Financial/data correctness is fail-closed. Browser presentation must never become a second accounting, FX, tax, recovery or market-data authority.
5. Important work uses recovery points, exact-head CI, frozen review, exact-head merge and post-main verification.
6. Prefer deterministic automation. **AI 管流程，不管帳**.
7. Never infer cash, currency, chronology, lots or other financial facts that authoritative data does not provide.
8. Shadow completeness is a prerequisite for account-value work, not automatic permission to activate NAV/TWR/XIRR.
9. When a batch closes, stop its technical work instead of expanding scope for neatness.
10. Prefer direct user utility over methodology expansion when both are optional and the latter carries higher financial interpretation risk.

---

## 1. Current authoritative state

### Repository / production checkpoint

Before the R2.6A docs-only closeout:

- protected `main`: `550c73f554915d3af6fe2805c788d65c045e0b87`;
- open PRs: none at the production-evidence checkpoint;
- feature PR #335 merged successfully;
- exact-head CI #1147: SUCCESS;
- post-main CI #1148: SUCCESS;
- Pages #1615: SUCCESS;
- production `Update Portfolio Data #3301` / run `32001637621`: SUCCESS on the exact feature merge head;
- production Worker runtime source: `f93dbbed3f67ce4e8c9d808d286f2c0096c1e8ee`;
- Worker Version ID: `ebcbdd35-3f5d-40b9-bb97-aef4a25ef706`;
- runtime contract: release `4.12` / API `2.65` / schema `3`;
- production D1 remains schema v3;
- Worker/D1 required no R2.6A change because portfolio snapshots remain opaque JSON passthrough;
- whole-account TWR/XIRR/performance cutover is not activated.

Always re-read fresh `main`, open PRs, CI, Pages and production runtime before modifying anything.

### R2.5A–R2.5D

Status: **CLOSED / PRODUCTION VERIFIED**.

The reviewed transaction-currency and opening-balance path now gives the observed production ledger durable currency truth and a complete deterministic shadow cash ledger. Do not reopen reconciliation work without new material production evidence.

### R2.6A — Cash-Inclusive Account Value Preview

Status: **CLOSED / PRODUCTION VERIFIED**.

Production #3301 proved:

- cash shadow `complete=True`;
- transaction rows `192`, resolved `192`;
- cash event rows `2`, resolved `2`;
- observed cash currencies `['USD']`;
- cash issue codes `[]`;
- `account_value_preview.status=ready`;
- `cash_ledger_complete=True`;
- preview currencies `['USD']`;
- preview reason `None`;
- preview missing FX `[]`;
- portfolio snapshot upload succeeded;
- normal calculation completed 1 success / 0 failures.

R2.6A is additive only:

- `summary.total_value` remains user-facing `持倉市值`;
- account-level cash is displayed separately as `帳戶價值預覽` on `全部`;
- Daily P&L, TWR, XIRR and performance chart remain at their existing securities-oriented reviewed semantics;
- group/tag views do not duplicate account-level cash;
- frontend does not calculate cash/FX/account value.

The same production run observed the existing CASY dividend-only provider-row condition. The already-reviewed market-data path re-fetched and normalized the persistent dividend-only row as an explicit as-of effective valuation; calculation and snapshot publication succeeded. This does not reopen R2.6A.

---

## 2. Current Primary Active Batch

### Phase

`R3 — Universal Data Gateway`

### Batch

`R3.1A — Broker-Neutral Export & Backup Foundation`

Status: **PLANNING / READY FOR ARCHITECTURE TRACE**

### Primary Goal

> Give the user a deterministic, user-controlled backup/export package containing the authoritative journal data needed to preserve and later reconstruct their portfolio history, without relying on browser-local state or broker-specific assumptions.

### Why this is next

R2 now provides reviewed transaction metadata, explicit cash events, deterministic cash completeness and a production-verified whole-account current-value preview. The highest-value next gap is portability and recoverability of user data.

A whole-account TWR/XIRR/performance cutover remains possible later, but it introduces materially greater methodology risk than the direct user value of backup/export. It is therefore deferred until separately justified by product evidence.

### Narrow execution boundary

1. Export authoritative durable records, not browser-local derived state.
2. Include at minimum transaction records and cash events with the durable metadata required to reconstruct their meaning.
3. Define an explicit versioned export manifest/schema before UI implementation.
4. Preserve transaction currency, cash currency, tags, notes and relevant durable metadata exactly; never infer missing financial facts during export.
5. Separate authoritative source data from derived portfolio snapshot/cache data in the package.
6. Prefer one deterministic download action from the authenticated product UI.
7. Export must be tenant-scoped and authenticated.
8. Do not make localStorage/indexedDB the backup authority.
9. Do not implement broker-specific CSV parsing in R3.1A.
10. Do not implement restore writes until the export contract is reviewed; restore becomes a separate follow-up batch unless a minimal round-trip validator can remain read-only.
11. No TWR/XIRR/performance cutover in this batch.
12. No guessed chronology, currency, cash, tax or lot information.

### Architecture questions to answer before implementation

1. Which existing Worker endpoints already expose tenant-scoped authoritative transaction and cash-event reads, and can they safely support export without a second data path?
2. Which durable fields are required for lossless reconstruction versus optional presentation fields?
3. Should export be a single JSON package, ZIP containing JSON/CSV views, or JSON-first with CSV convenience views?
4. How should schema version, generated-at provenance, tenant identity handling and checksum/integrity metadata be represented without leaking unnecessary account identifiers?
5. Which existing write/import idempotency primitives can later support a safe restore batch?
6. What package-size limits are realistic for the current Worker/Pages architecture?

### Exit criteria

R3.1A may close only when:

1. the export package contract is explicit and versioned;
2. authoritative vs derived data boundaries are documented and tested;
3. transaction and cash-event export is tenant-scoped and authenticated;
4. durable financial fields round-trip through serialization without inference or loss;
5. frontend offers a clear one-action export/backup UX;
6. malformed/incomplete server responses fail closed rather than producing a misleading “complete backup”;
7. full CI + frozen exact-head review pass;
8. production Pages/runtime evidence confirms a valid export flow;
9. no restore mutation or broker-specific parser is silently included.

### NOW / NEXT / BACKLOG / REJECT

- **NOW:** trace authoritative read contracts → define versioned export package → implement deterministic export generation → one-action UX → production verification.
- **NEXT:** R3.1B reviewed restore/import foundation using explicit idempotency and validation, selected only after R3.1A evidence.
- **BACKLOG:** broker-neutral adapters/CSV import, automated reconciliation previews, whole-account TWR/XIRR methodology, historical whole-account chart, multi-currency expansion when actually observed, R4 portfolio intelligence.
- **REJECT:** browser-local backup authority, guessed fields, broker-specific assumptions in core schema, silent restore writes, automatic performance-methodology cutover, unrelated cleanup.

---

## 3. Stable authority boundaries

### Transaction mutation / calculation

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

### Cash authority

```text
user cash CRUD
→ explicit cash_events
→ targeted trusted-system read
→ deterministic shadow cash derivation
→ completeness gate
→ reviewed account-value preview
```

- user CRUD remains the only cash mutation authority;
- no system cash writer;
- transaction cash currency must be explicitly persisted;
- one opening balance per currency;
- absence of opening balance never means zero;
- same-date ambiguity remains fail-closed unless a separately reviewed chronology authority exists.

### Account value / performance

- `summary.total_value` → user-facing `持倉市值`;
- `account_value_preview` → separate current whole-account value preview;
- current-value preview does not automatically alter TWR/XIRR;
- current valuation FX must not be reused as historical performance FX without an explicitly reviewed methodology;
- generic whole-account ROI/TWR/XIRR claims remain invalid until a future reviewed cutover.

### Export / backup authority

R3.1A must preserve this direction:

```text
authenticated tenant-scoped durable reads
→ explicit versioned export contract
→ deterministic package serialization
→ user download
```

Derived UI caches, localStorage and portfolio snapshots may be useful context but are not replacements for authoritative source data.

### Dividend / history

- same-tenant DIV record is the only `已入帳` authority;
- records remain authoritative transaction history;
- Journal `note` is user content, not execution chronology/provenance authority;
- `id` / `created_at` are database facts, not broker execution time.

---

## 4. Roadmap V2 — current dependency order

1. R2.1 canonical event/timeline contract — CLOSED / VERIFIED.
2. R2.2 transaction metadata foundation — CLOSED / PRODUCTION VERIFIED.
3. R2.3 explicit cash storage/API/UI — CLOSED / PRODUCTION VERIFIED.
4. R2.4 deterministic shadow cash ledger + targeted production feed — CLOSED / PRODUCTION VERIFIED.
5. R2.5A transaction currency reconciliation — CLOSED / PRODUCTION VERIFIED.
6. R2.5B post-reconciliation evidence — CLOSED.
7. R2.5C opening-balance readiness UX — CLOSED / PRODUCTION VERIFIED.
8. R2.5D authoritative cash input + shadow verification — CLOSED / PRODUCTION COMPLETE.
9. R2.6A cash-inclusive account-value preview — CLOSED / PRODUCTION VERIFIED.
10. **R3.1A broker-neutral export & backup foundation — CURRENT.**
11. After R3.1A evidence: separately choose restore/import foundation, broker adapters, or whole-account performance methodology according to user value and observed gaps.

Future:

- **R3 Universal Data Gateway:** export/backup, restore/import, broker-neutral adapters and deterministic reconciliation.
- **R4 Portfolio Intelligence:** account-level analytics and AI summarization over deterministic facts. AI never becomes accounting/FX/tax/lot/market-data authority.

---

## 5. Risk / decision register

### Current risks to control

- Do not mistake export convenience formats for authoritative schema.
- Do not omit durable currency/cash metadata that would make later reconstruction ambiguous.
- Do not include secrets, bearer tokens, API keys or unnecessary tenant identifiers in exported files.
- Do not let browser-generated data become the only backup source.
- Do not introduce restore writes before validation/idempotency semantics are reviewed.
- Do not let R3 work reopen closed cash/account-value plumbing without new evidence.
- Existing XIRR warnings about non-conventional cash flows remain a future methodology concern, not an R3.1A blocker.

### Decisions carried forward

- symbol-derived currency is never durable financial authority;
- historical/opening cash is never inferred;
- chronology is never inferred from partial timestamps;
- production evidence selects the next truth gap;
- closed-batch details belong in versioned `docs/engineering/`, not duplicated live-status prose;
- technical cleanup without product justification remains rejected;
- current-value preview is useful product output but not permission for performance-methodology cutover.

---

## 6. Immediate next actions

1. Re-read existing Worker transaction/cash read endpoints and frontend stores/services.
2. Identify the minimum lossless durable field set for transactions + cash events.
3. Trace any existing export/download helpers before adding code.
4. Define versioned package manifest and authoritative/derived separation.
5. Select JSON-first vs ZIP/CSV convenience format from actual product constraints, not preference.
6. Add serialization/contract tests before UI wiring.
7. Implement one-action authenticated export UX.
8. Run full CI, frozen exact-head review and production verification.
9. Keep restore/import writes outside R3.1A unless separately promoted.

---

## 7. Fresh-session startup

1. Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this live handoff.
2. Re-read fresh `main`, open PRs, CI, Pages and production runtime before modification.
3. Treat newer production evidence as higher authority than this snapshot.
4. Keep one Primary Active Batch and preserve its recovery point.
5. Reopen closed work only for new material evidence.
6. Debug same-class impact + regression prevention.
7. Use versioned engineering closeouts for R2 history.
8. Continue **R3.1A Broker-Neutral Export & Backup Foundation** without prematurely activating restore writes, broker-specific assumptions or whole-account performance cutover.
