# R2.4 Shadow Cash Ledger — Production Closeout

Date: 2026-08-17 Asia/Taipei

## Closed boundary

R2.4 is CLOSED / PRODUCTION VERIFIED at the shadow-only boundary. The capability derives and observes explicit cash completeness, but it is not an account-value authority and does not modify securities snapshots, Overview totals, NAV, TWR, XIRR, FX valuation, or transaction chronology.

## Repository delivery

- R2.4A deterministic shadow cash ledger: PR #326, exact reviewed head `0035de2c009611621ec6e8dc227aad9004c09eec`, merge `717866ee489aee938fbb8954d071b582e9b6752c`.
- R2.4B targeted read-only cash shadow feed: PR #327, exact reviewed head `da9b26f2d7ba28fda1d5eeb160060ff704288a47`, runtime merge/source `f93dbbed3f67ce4e8c9d808d286f2c0096c1e8ee`.
- R2.4B frozen review: PASS / BLOCKER 0 / FOLLOW-UP 0; exact-head CI #1124 passed.
- User cash-event CRUD remains the only cash mutation authority. The API-secret system principal may only read `GET /api/cash-events` for one explicit `X-Target-User`; no all-user cash feed and no system cash writer exists.

## Production activation

- Production Identity Evidence #26 / run `31984262043`: SUCCESS for exact source `f93dbbed3f67ce4e8c9d808d286f2c0096c1e8ee`.
- Identity artifact `9273271736`, digest `sha256:4cdcb90702026a1cb3a45ed8b5dc76026bad3abd5c54ad2ce90c2f7480466704`.
- Activation PR #328 exact head `a1598105aa31aa09c755646daff78e08a5c7b137`; exact-head CI #1126 / run `31984636350`: SUCCESS; frozen review PASS / BLOCKER 0 / FOLLOW-UP 0.
- Activation/control-plane merge `9bd3d1fe3f92376f7e922df7a37eb738963de136`; post-main CI #1127 / run `31984732786`: SUCCESS; Pages #1608 / run `31984731948`: SUCCESS.
- Production Deployment Dispatch Broker #10 / run `31984732759`: SUCCESS.
- Canonical Deploy Worker #13 / run `31984738416`: SUCCESS after reviewer-protected `production` approval. All source/main-reachability, recovery, activation-authority, protected-config, production D1 identity, migration, deploy, stability, and evidence-upload gates passed.
- Live Worker source: `f93dbbed3f67ce4e8c9d808d286f2c0096c1e8ee`.
- Worker Version ID: `ebcbdd35-3f5d-40b9-bb97-aef4a25ef706`.
- Runtime contract: release `4.12` / API `2.65` / schema `3`.
- Post-deploy artifact `9273434812`, digest `sha256:3620b1740b2d2f95681432f42d0aa86e3b45c8d3eb0ebdfad7ab9a9e4c7c3e1b`; `/version` and `/health` returned 200, anonymous records remained 401, production CORS origins were accepted and staging/local origins rejected.

## Real hosted calculation proof

Normal production `Update Portfolio Data` #3291 / run `31985211893` executed from protected `main@9bd3d1fe3f92376f7e922df7a37eb738963de136` and completed SUCCESS.

The hosted calculation path used the production API secret and, for every processed tenant, successfully executed the targeted cash shadow feed and produced a shadow completeness report. No feed-stage or derivation-stage shadow failure occurred. The existing securities-only calculation and snapshot upload path also completed successfully for every processed tenant, proving that R2.4 observation remains non-blocking and does not take over current accounting authority.

The shadow log contract remained privacy-safe: completeness state, row counts, currency codes, issue codes, and exception class names only. It does not log cash amounts, balances, notes, raw cash payloads, or tenant identity as part of the shadow evidence.

## Production evidence and next blocker

The first blocking reconciliation gap exposed by real production data is:

`TRANSACTION_CURRENCY_MISSING`

Observed legacy transaction rows do not yet carry authoritative persisted cash currency, so shadow completeness correctly remains false. Symbol-based currency inference is intentionally forbidden. The system must not treat missing currency as USD/TWD/GBP by guess, and it must not infer missing opening cash as zero.

This is a product-data readiness result, not a deployment failure.

## Decision

R2.4 closes here. Do not extend this batch into a cash-inclusive accounting cutover or additional engine refactoring.

Next Primary Active Batch: **R2.5A — Transaction Currency Reconciliation UX** under the broader R2.5 Reconciliation & Migration UX capability.

R2.5A should make missing authoritative transaction currency understandable and repairable through a reviewed user workflow, reusing the existing fill-only metadata authority. Any automatic candidate may assist the user, but it cannot become durable financial truth without deterministic validation and explicit reviewed authority. Once transaction currency coverage is materially repaired, the shadow ledger may surface the next truthful readiness gap such as missing explicit opening balances.

## Explicit non-goals carried forward

- no symbol-based automatic currency inference as accounting authority;
- no fabricated opening cash or historical zero balance;
- no cash-inclusive snapshot / Overview / NAV / TWR / XIRR cutover;
- no FX conversion layer in this closeout;
- no transaction chronology activation from partial metadata;
- no system/API-secret cash writer;
- no unrelated technical cleanup.
