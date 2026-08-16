# R2.4A Shadow Cash Ledger Contract — 2026-08-16

Status: **ACTIVE IMPLEMENTATION — SHADOW ONLY**  
Risk class: **R2 — Significant accounting foundation, no production-value cutover**.

## Product goal

Derive a deterministic, currency-aware cash ledger from explicit authoritative facts without changing any current portfolio/NAV/performance surface.

R2.4A is deliberately a pure engine. It accepts inputs supplied by tests/future callers and returns read-only ledger/reconciliation evidence. It does **not** add a Worker route, fetch production cash events, write snapshots, mutate D1, alter Overview, or activate cash-inclusive TWR/XIRR/NAV.

## Authorities

### External cash facts

`cash_events` remains authoritative for exactly:

- `OPENING_BALANCE` — signed baseline state;
- `DEPOSIT` — positive magnitude, positive cash movement;
- `WITHDRAWAL` — positive magnitude, negative cash movement.

A missing opening balance is never interpreted as zero.

### Transaction-derived cash

Only authoritative `records` BUY/SELL/DIV rows may create trade/dividend cash effects.

Native-currency formulas:

```text
BUY  = -(Qty × Price + |Commission| + |Tax|)
SELL = +(Qty × Price - |Commission| - |Tax|)
DIV  = +(Qty × Price) only when Commission = Tax = 0
```

The SELL cash formula intentionally uses the full persisted transaction economics. The holdings calculator's compatibility oversell clamp is a position/PnL behavior and must not rewrite cash from an actual persisted SELL.

Confirmed automatic DIV records currently persist `qty=1`, `price=actual net cash`, `fee=0`, `tax=0`. R2.4A therefore treats `Qty × Price` as authoritative DIV cash only when an explicit transaction cash currency is also present.

## Currency completeness

R2.4A never infers cash currency from symbol.

A transaction is unresolved when:

- `currency` is missing, including pandas/NumPy missing-value markers;
- `currency` is malformed/noncanonical;
- `currency == GBp` because GBp is a quote unit, not an account cash denomination and no reviewed settlement normalization to GBP exists yet;
- DIV carries nonzero Commission/Tax, because the persisted net-cash convention is then ambiguous.

Cash events continue to require exactly three uppercase letters (`USD`, `TWD`, `GBP`, ...); `GBp` remains invalid for cash storage.

No FX conversion or cross-currency total is produced in R2.4A.

## Opening-balance semantics

Opening balance is a baseline state, not an external movement.

For one currency:

1. cash movements strictly before the opening date remain audit evidence but are absorbed by the baseline and are not replayed into the post-opening balance;
2. movements strictly after the opening date are added to the opening balance;
3. any movement on the same calendar date as the opening balance makes the absolute balance **ambiguous**, because cash events have date-only chronology and R2.2 transaction execution chronology is not activated;
4. if no opening exists, the engine may report net movement but must return `balance=None` and incomplete coverage.

This contract does not attempt to reconstruct authoritative cash before the opening baseline.

## Determinism vs chronology

Entries are sorted deterministically for audit/replay using date, currency, baseline marker, source family and stable source id. This ordering is not broker execution chronology.

Same-day non-baseline cash arithmetic is commutative. R2.4A does not inspect or activate `executed_at` / `execution_sequence`.

## Output evidence

The shadow report exposes:

- normalized currency-local ledger entries;
- per-currency opening date/balance;
- all-period net movement;
- post-opening movement;
- provisional authoritative balance only when the currency summary is complete;
- pre-opening movement count;
- opening-date ambiguous movement count;
- unresolved issue codes;
- total/resolved transaction and cash-event row counts;
- overall `complete` only when every input row is resolved and every active currency has an unambiguous explicit opening baseline.

## Explicit non-goals

R2.4A must not:

- fetch user cash events through an ad-hoc credential path;
- add system/API-secret cash write authority;
- read D1 directly from the Python calculator as a bypass;
- modify `PortfolioSnapshot` or calculation manifests;
- change `main.py` production update behavior;
- publish shadow cash to frontend state;
- convert currencies;
- activate account NAV, contributed capital, TWR, XIRR or transaction chronology.

## Next gate

R2.4B may design a reviewed **read-only** production calculation feed for cash events and integration/reconciliation evidence. Any Worker/API change must be separately reviewed, versioned, deployed through the protected production workflow, and still remain shadow-only until a later account-value cutover gate.
