# Phase 5 — Record Create UI Completion

Date: 2026-08-14 Asia/Taipei  
Risk: **R2 Significant**

## Product objective

Close the remaining same-page UX gap after an outcome-ambiguous record CREATE is later authoritatively confirmed with its original Idempotency-Key.

PR #239 already prevents a second same-payload logical create while automatic reconciliation is active and safely replays the exact original key/body through the durable record-create intent. Before this slice, however, the successful replay remained invisible to the caller UI:

- TradeForm could still display the original unresolved form after the server had confirmed the create;
- DividendManager could still show an old pending-dividend row until a later snapshot/read refresh;
- once the #239 reconciliation lock disappeared after success, the stale UI could invite a second intentional submission even though the first create had already been confirmed.

The missing capability was therefore **UI completion after authoritative recovery success**, not another retry/idempotency mechanism.

## Prerequisites

This slice builds on already production-verified behavior:

- PR #239 — same-page record-create ambiguity reconciliation;
- merge `b45505dc9d532ea076d9fcebabd65ef65e39c312`;
- post-main CI #842 SUCCESS;
- Pages #1522 SUCCESS.

Recovery-copy convergence also closed in PR #241:

- merge `d80f10394d5fe7d325d96b1c9802139c22711498`;
- post-main CI #848 SUCCESS;
- Pages #1524 SUCCESS.

## Design

### 1. Memory-only authoritative completion signal

New service:

`src/services/recordCreateRecoverySignal.js`

It provides a small in-memory publish/subscribe channel for one fact only:

> the existing same-key record-create recovery path has received a successful server response.

The event contains:

- normalized owner email;
- the exact serialized durable intent body;
- an in-memory recovery timestamp.

The event is frozen. Listener failures are isolated and cannot alter recovery semantics.

There is deliberately:

- no localStorage key;
- no D1/schema change;
- no Worker change;
- no new request or retry path;
- no permanent payload fingerprint/dedupe.

### 2. Store is the only publisher

`src/stores/portfolio.js` publishes only inside `recoverPendingRecordCreateIntent()` after the original idempotent replay has returned `json.success`.

The ordering is:

```text
same-key replay succeeds
→ clear/complete durable create intent where possible
→ mark snapshot stale
→ mark Phase 2 dirty generation when required
→ publish UI completion event
→ existing success toast / first-record auto-update handling
```

No event is published for:

- initial normal CREATE success;
- timeout/network ambiguity;
- explicit 4xx/terminal rejection;
- superseded intent;
- UPDATE/DELETE;
- guessed record state.

The UI therefore never fabricates accounting truth from intent disappearance, localStorage state, or a payload match alone.

## TradeForm behavior

`src/components/TradeForm.vue` now remembers the exact normalized serialized body of the currently unresolved CREATE.

The original payload normalization was extracted into `buildRecordPayload()` so the submit path and recovery comparison use the same rules for:

- numeric coercion;
- price/total derivation;
- current tag/type/date/symbol fields.

A recovery event can complete the form only when all of these are true:

1. the form is not in edit mode;
2. an unresolved CREATE body is still present;
3. event owner equals the currently signed owner;
4. event body exactly equals that unresolved body;
5. the form's **current** normalized body still equals the recovered body.

If the user changed any form field after the ambiguous submit, the recovered transaction is acknowledged but the new input is preserved.

If the form still represents the recovered transaction, it is reset and the existing `submitted` UI event is emitted. In `App.vue`, that event only closes the mobile trade sheet; it does not issue another fetch or mutation.

Manual reset and entry into edit mode clear the unresolved-create marker, so a later old recovery event cannot erase unrelated work.

## Why exact body correlation is safe here

This is not permanent payload dedupe.

During the short same-page ambiguity window, PR #239 already prevents a second **same-payload** logical CREATE from receiving a new key. A different payload is allowed to supersede the old intent, and TradeForm also replaces its unresolved-body marker with the newer submission.

Therefore owner + exact serialized body is used only as a UI-correlation key for the already bounded same-page recovery episode. After that episode, intentionally identical future trades remain legal and receive their normal independent logical keys.

The raw Idempotency-Key itself is not exposed to the UI components.

## DividendManager behavior

`src/components/DividendManager.vue` subscribes to the same success signal, but its authority is narrower.

It acts only when:

- event owner matches the current signed owner;
- event body parses as a record CREATE;
- `txn_type === 'DIV'`;
- `tag === 'Auto-Dividend'`;
- symbol/date match a dividend row currently visible in `localDividends`.

It then marks that current row confirmed using the existing local confirmed-key presentation state.

The listener does **not** call:

- `addRecord()`;
- `triggerUpdate()`;
- `fetchAll()`;
- any backend API.

It therefore cannot create a second transaction or calculation job. A later authoritative snapshot/read remains responsible for normal long-lived data state.

## Scope

Production code:

- `src/services/recordCreateRecoverySignal.js`
- `src/stores/portfolio.js`
- `src/components/TradeForm.vue`
- `src/components/DividendManager.vue`

Tests:

- `tests/frontend_record_create_recovery_signal.test.mjs`
- `tests/frontend_trade_form.test.mjs`

No Worker, D1/schema, Python engine, financial formula, market-data, auth protocol or deployment workflow changes.

## Verification chronology

### CI #851

Code-bearing head `dfa039a9d2b01a0b2f673e4ae3d3b05672f03922` initially failed the Frontend contract job while Worker and Python were healthy.

RCA: `tests/frontend_trade_form.test.mjs` still encoded the old invariant that `emit('submitted')` could exist only once and that `setupForm` was immediately adjacent to `defineExpose`. The new feature intentionally introduces a second **authoritative recovery-success** completion point.

The runtime implementation was not relaxed. The old test was replaced with a stronger contract requiring exactly two allowed completion paths:

1. immediate committed mutation;
2. recovered CREATE only after owner/body/current-form equality guards.

### CI #852 — code-bearing candidate

Exact head:

`d2924a2e6eeb79b26cb41f54591c84b2fcf6f966`

Run: `31784727933`

Result: **SUCCESS**

- Frontend contracts/build: SUCCESS
- Worker security/deployment/local D1: SUCCESS
- Python tests/coverage: SUCCESS

This is the code-bearing evidence only. Permanent documentation advances the branch head, so #852 is not the final merge gate.

## Independent R2 review

Result: **PASS / 0 BLOCKER**.

Reviewed invariants:

- success event comes only from server-confirmed same-key replay;
- ambiguity/rejection/supersede cannot publish success;
- listener failures cannot affect accounting/recovery;
- current owner isolation is required in both UIs;
- TradeForm user edits are preserved;
- edit/reset state invalidates old completion markers;
- a newer different CREATE supersedes the old UI marker;
- DividendManager authority is limited to visible `Auto-Dividend` rows;
- no UI listener performs another mutation or calculation trigger;
- parent `submitted` handling has no network side effect;
- no permanent payload dedupe or backend authority is introduced;
- cross-tab completion signaling is intentionally out of scope; other tabs continue to converge through authoritative read/snapshot lifecycles.

## Rollback

Frontend-only rollback:

- revert this PR / redeploy previous Pages artifact.

No Worker rollback, D1 migration, schema rollback or ledger repair is required.

## Remaining gates

After this permanent document and the current to-do handoff are committed:

1. fetch latest PR #242 head;
2. require fresh full CI on that exact docs-bearing head;
3. compare against protected `main`, require `behind_by=0`;
4. require final scope exactly eight files: the six code/test files above, this handoff, and `to_do_update_list.md`;
5. final R2 scope review;
6. update PR #242 final evidence;
7. mark Ready;
8. ordinary merge with expected head SHA;
9. require post-main CI SUCCESS;
10. require production Pages build/report/deploy SUCCESS;
11. no Worker deploy and no real-user ledger smoke mutation.

Only then mark this slice CLOSED.
