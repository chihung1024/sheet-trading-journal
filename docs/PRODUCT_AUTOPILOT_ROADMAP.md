# Product Autopilot Roadmap

Status: ACTIVE PRODUCT DIRECTION  
Effective: 2026-08-14  
Applies to: product planning, implementation, debugging, review, automation, AI handoff

## 1. Product authority

The project optimizes for two outcomes above all other engineering activity:

1. functional correctness of the real user path;
2. user experience with the least possible manual recovery, repeated action, technical judgment, and maintenance burden.

Debugging, CI, smoke tests, RCA, deployment evidence, governance, and documentation are supporting controls. They are not independent product goals. They may interrupt the product line only when they prevent a demonstrated material user, data-integrity, security, or production failure.

A technical anomaly is not automatically a product defect. When user impact has disappeared, data correctness is protected, and further investigation has low marginal product value, preserve evidence, classify the observation, define a bounded reopen trigger, and converge.

## 2. Product model

The target interaction is:

```text
user expresses or imports a transaction
-> transaction is safely persisted
-> duplicate-create risk is automatically contained
-> records reconcile automatically
-> portfolio calculation is scheduled automatically
-> transient failures recover automatically
-> a trustworthy snapshot is published
-> the UI refreshes automatically
-> the user is interrupted only when human judgment is actually required
```

Normal users should not need to understand Worker, D1, GitHub Actions, idempotency, retries, snapshots, provider failures, job IDs, or deployment acceptance machinery.

## 3. AI-first automation rule

Use AI primarily as a control-plane and operations assistant, not as a source of financial truth.

AI may classify failures, collect and summarize sanitized evidence, decide whether bounded retry or escalation is warranted, maintain handoff state and technical-debt classification, execute low-risk recovery inside existing deterministic contracts, and surface only actionable user-facing status.

AI must not invent a trade, price, FX rate, dividend, split, quantity, or transaction date; bypass ledger/reconciliation validation; silently alter a user's financial record; or replace deterministic FIFO/TWR/XIRR/FX/ledger logic with probabilistic output.

Rule: **AI controls workflow; deterministic code controls the books.**

## 4. Primary phases

### Phase 1 — Invisible Reliable Transaction

Goal: one logical create remains one logical create even across timeout, response loss, reload, token refresh, or browser restart.

Required behavior:

- persist an immutable create intent before network mutation;
- generate and retain a stable idempotency key;
- scope pending intents to the authenticated tenant;
- support multiple intent records rather than one global slot;
- replay only with the same key and exact persisted payload;
- recover pending intents after authenticated reload;
- keep ambiguous intent until confirmed, definitely rejected, explicitly discarded, or conflict-resolved;
- do not silently TTL-expire an unresolved ambiguous intent;
- do not generate a new key after a network/timeout/5xx/malformed-response ambiguity;
- treat `409 IDEMPOTENCY_CONFLICT` as terminal for that intent; never auto-switch to a new key;
- clear pending create storage on explicit logout/tenant change, but retain it across token refresh/page reload;
- fail closed before POST if durable local intent persistence cannot be verified.

UX KPI: normal manual retry decisions = 0; duplicate create caused by response ambiguity is approximately 0; reload recovery requires no user knowledge of idempotency.

### Phase 2 — Automatic Recalculation

Goal: a confirmed record mutation automatically drives the portfolio toward a fresh snapshot.

Direction: mutation marks snapshot stale; debounce closely spaced mutations; automatically trigger the existing calculation-job path; coalesce repeated changes; if the ledger changes while a calculation is running, mark dirty and schedule one follow-up calculation; reuse the existing persistent trigger-update idempotency/job lifecycle instead of building a second scheduler.

UX KPI: ordinary transaction-to-recalculation manual clicks = 0.

### Phase 3 — Self-Healing Snapshot Lifecycle

Expose user-level states instead of backend mechanics: `latest`, `updating`, `recovering`, `action_required`. Backend error codes remain available in technical details, but the normal UI answers first whether the displayed portfolio is current and trustworthy.

### Phase 4 — AI Failure Triage and Recovery

Classify failures as transient, recoverable lifecycle, data-integrity, or persistent defect. Transient failures use bounded retry/backoff without user interruption. Data-integrity failures stay fail-closed and preserve the last trustworthy result. Persistent defects escalate only after a defined repeat/time/impact threshold.

### Phase 5 — AI Operations Autopilot

Reduce manual engineering triage by classifying CI/runtime/provider/snapshot anomalies. Only user-impacting, data-risk, security, or persistent failures become active engineering work. Recovered/transient anomalies are recorded with reopen criteria and closed.

### Phase 6 — AI User Experience

After deterministic reliability is stable, add broker import assistance, transaction parsing with confirmation, anomaly explanation, and portfolio explanation. AI proposals remain behind deterministic validation and user-visible confirmation when financial records would change.

## 5. Debug stop rule

Stop debugging expansion when all applicable conditions are met: material user impact is gone; financial/data correctness remains protected; the safety boundary behaves correctly; root cause is understood enough to prevent a credible regression or the event is evidenced as transient; and further investigation has low marginal product value.

Do not attempt to remove every unknown merely because it exists.

## 6. Scope policy

### NOW

Only work needed to restore/protect a material user path or complete the current product batch safely.

Current NOW: Phase 1 durable record-create intent and invisible recovery.

A market-data failure interrupts NOW only when it is currently recurring or materially blocks portfolio freshness/correctness. One recovered provider anomaly remains passive evidence with a reopen threshold.

### NEXT

Automatic mutation -> recalculation; debounce/dirty-generation coalescing; snapshot lifecycle UX; bounded calculation recovery; stale-update/concurrent-mutation correctness when demonstrated or after Phase 1 closes.

### BACKLOG

Unless promoted by evidence: broad market-provider redesign; generalized idempotency framework; Decimal/fixed-point migration; full cash-ledger redesign; broad auth/session redesign; delete-surviving idempotency tombstone service; complete market master/hours framework; general CI/governance beautification.

### REJECT

Infrastructure solely to make one optional smoke test green; user-auth substitutes using system principals or direct D1 mutation; guessed financial data; new idempotency key after ambiguous create failure; fuzzy payload matching as duplicate authority; silent TTL expiry of unresolved create intent; broad request-layer or market-data refactor without demonstrated product need; exposing backend workflow complexity as normal user recovery instructions.

## 7. Verification policy

Tests and CI are evidence for product claims, not the product itself. Each batch states the user-visible objective, deterministic invariant, smallest implementation scope, applicable tests, exact-head CI when required, rollback/recovery point, independent review when required, and user-path evidence proportional to the changed behavior.

Optional production authenticated smoke remains release evidence, not a development blocker when public/runtime compatibility is established and no evidence shows the frontend path is unsafe to implement. If not executed, release/handoff records must state precisely that authenticated production user-write behavior was not independently exercised.

## 8. Current execution sequence

Single primary implementation batch:

```text
Phase 1A: durable create-intent state foundation
-> Phase 1B: record-create integration and same-key ambiguous recovery
-> Phase 1C: authenticated reload/startup recovery and UX convergence
-> Phase 2: mutation-driven automatic recalculation
```

For Phase 1, do not redesign the Worker contract. Production already supports tenant-scoped stable-key replay/conflict semantics. Reuse that contract and the existing frontend design language used by calculation-job idempotency.

## 9. Future-AI handoff rule

At a new session: read `AI_PROJECT_PLAYBOOK.md`; read this document; read `README.md` and `to_do_update_list.md`; re-check protected `main`, open PRs, exact-head CI, current production/runtime evidence, and current calculation failures; keep one primary implementation batch; promote a discovered issue to NOW only when it materially blocks the active product objective or demonstrates user/data/security impact; converge non-material debug work with evidence and reopen criteria.

This roadmap is the current product-direction authority until explicitly superseded by a later reviewed product decision.