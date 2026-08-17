# Desktop Visibility D4–D5 Closeout — 2026-08-17

Status: **CLOSED / PAGES VERIFIED**

This document closes the final two batches of the 2026-08-17 desktop workspace optimization pass. The governing product rule remains: reclaim workspace by layout/composition first; do not shrink typography, hide business facts, or create a second data/financial authority merely to make the screen look denser.

## D4 — Reversible Desktop Focus Mode

PR: #352

Reviewed behavior:

- desktop users can toggle `專注檢視` / `顯示交易區` to reclaim the persistent transaction-rail width;
- the existing single `TradeForm` remains the only create/edit authority and stays mounted;
- focus state is memory-only and is not persisted to localStorage;
- editing a record from transaction history reopens the desktop rail before `TradeForm.setupForm(record)` executes;
- the runtime mobile boundary is `<= 1024px`, matching the existing `@media (max-width: 1024px)` CSS authority;
- mobile sheet behavior and the cash single-column layout are unchanged;
- no accounting, FX, persistence, API, Worker, restore, or calculation semantics changed.

Evidence:

- exact reviewed head: `481d72ed5235552afdde6d13384967c76aaed4b2`;
- exact-head CI #1189: SUCCESS;
- frozen independent review: PASS / BLOCKER 0 / FOLLOW-UP 0;
- merged main: `d3278c67b6cfeda468f3503729db82b5f8bfef96`;
- post-main CI #1190: SUCCESS;
- Pages #1632: SUCCESS on the same main commit.

Root-cause correction made during review:

The pre-existing runtime mobile check used `< 1024` while the CSS authority used `max-width: 1024px`. D4 exposed that 1024px boundary mismatch. The runtime was corrected to `<= 1024`, and the regression contract was updated to verify the actual CSS authority rather than duplicating the rule in the wrong stylesheet.

## D5 — Management Workspace Composition

PR: #353

Reviewed behavior:

- dividends: desktop header/help/queue chrome padding is reduced without removing guidance, queue state, or confirmation actions;
- cash: because the cash view has no transaction rail, `>=1280px` composes the existing cash editor beside the authoritative cash ledger while keeping header/boundary/pending state full width;
- the cash editor uses two form columns only inside that wide layout; fields and mutation paths are unchanged;
- groups: because this page normally still shares the viewport with the transaction rail, the rename + assignment two-column workspace waits until `>=1600px` so the seven-column assignment table keeps usable width;
- the group transaction viewport grows to `clamp(520px, 62vh, 760px)`;
- `>=1680px` uses three columns for the existing strategy overview cards;
- no business content is hidden and the final layout layer adds no `font-size`, `!important`, or `display:none` rules.

Evidence:

- exact reviewed head: `250fec5248b067df51feded27354455a5b7732aa`;
- exact-head CI #1193: SUCCESS;
- frozen independent review: PASS / BLOCKER 0 / FOLLOW-UP 0;
- merged main: `c2928b6c59291f82c4eda901f78f39eaecc124e4`;
- post-main CI #1194: SUCCESS;
- Pages #1633: SUCCESS on the same main commit.

Width-gate correction made during review:

The initial D5 draft used the same `1280px` threshold for cash and groups. Source-level layout calculation showed this was unsafe for groups because the persistent 330–350px transaction rail still exists there; a 1280px browser could leave the main group area too narrow for the seven-column assignment table. The group composition gate was raised to `1600px` instead of compensating by shrinking text or squeezing data columns.

## Final Desktop Visibility boundary

D1–D5 are now closed. The pass delivered:

1. reclaimed header / outer vertical space;
2. improved Overview information hierarchy and viewport-aware chart sizing;
3. denser transaction and holdings work surfaces;
4. reversible desktop transaction-rail focus mode;
5. horizontal composition for management pages only when the available width safely supports it.

No further layout compression should be added merely for cosmetic density. Reopen this area only when production evidence identifies a concrete usability gap (overflow, hidden/obscured action, excessive first-screen displacement, or inefficient workspace use). Product feature work should again take priority over speculative visual cleanup.
