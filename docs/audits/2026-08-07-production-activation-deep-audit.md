# 2026-08-07 Production Activation Deep Audit — N51–N62

Status: **APPEND-ONLY / IN PROGRESS**  
Baseline: `main@74fe12010ee3138e07a079a3d45271fddb80b536`  
Runtime baseline: Worker `4.07`, API `2.60`, D1 Schema `2`  
Pre-change recovery: `backup-pre-10d3d-74fe120`  
Work branch: `pr-10d3d-production-activation-gate`

This audit supplements, and does not replace, N01–N50. Historical findings, Browser Smoke #17 failure, prior recovery branches, and Release 4.07.3 remain authoritative history. No historical item may be rewritten as though it never occurred.

## Review method

The review was expanded in parallel across:

1. GitHub branch/ruleset/environment control plane;
2. production deployment workflow and exact-SHA propagation gates;
3. Wrangler configuration ownership and Cloudflare variable semantics;
4. D1 identity, migrations, schema readiness, and recovery gating;
5. production runtime version/health/auth/CORS identity;
6. frontend production environment/CSP/OAuth explicitness;
7. required CI coverage and dedicated production audit coverage;
8. release/evidence durability and rollback boundaries;
9. already-open B01/B05/B06/B07/B08/B09/B11/B12/B14/B15 sibling paths.

External verification used current Cloudflare Wrangler/D1 documentation for `keep_vars`, `--strict`, required secrets, and `d1 info --json` behavior. Repository conclusions were then traced back to the exact production workflow/config/runtime code.

## Newly appended findings

### N51 — CRITICAL — production Wrangler config was not a complete source of truth

**Observed root cause**

The production renderer replaced only D1 identity and source SHA. The tracked production `wrangler.toml` did not declare `ALLOWED_ORIGINS`, `GOOGLE_CLIENT_ID`, `DEPLOYMENT_ENVIRONMENT`, or required `API_SECRET` semantics. Wrangler deploy defaults to treating tracked configuration as authoritative and can remove dashboard non-secret vars that are absent from the config. The canonical Worker then falls back when explicit origins/client identity are missing, and its fallback origin set includes localhost development origins.

**Failure mode**

The first canonical production deploy could succeed technically while deleting dashboard vars and silently re-entering a development-compatible fallback policy. A green HTTP/version check would not prove intended production isolation.

**Remediation in PR-10D3D-A**

- make production non-secret bindings explicit in tracked Wrangler config;
- declare `keep_vars = false` intentionally;
- declare `API_SECRET` as required;
- disable Worker preview URLs;
- bind CORS origins and Google client to `config/deployment-environments.json` through the renderer/config checker;
- deploy with Wrangler `--strict`.

**Status:** remediation implemented on work branch; not closed until required CI/review/merge/post-merge proof.

### N52 — HIGH — deployment readiness accepted advanced schema drift

`verify_worker_deployment.mjs` accepted `observed_schema_version >= expected`. During the current Schema-2-only phase, a D1 already at Schema 3 could therefore satisfy readiness even though Schema 3 is explicitly forbidden before Recovery Evidence Gate.

**Remediation:** exact equality is required for the activation gate; a regression test now covers both stale and advanced schema mismatch.

**Status:** implemented, pending PR closeout.

### N53 — HIGH — production contract unit tests were outside required Worker CI

Required CI executed `node --test tests/worker_*.test.mjs`, while the production contract suite was named `tests/test_production_contract_audit.mjs`. Its dedicated workflow also had narrow path filters. Runtime/config changes could therefore miss the production contract unit suite in the protected required check.

**Remediation:** required `test:worker` explicitly includes the production contract suite and the dedicated workflow path coverage is expanded.

**Status:** implemented, pending CI proof.

### N54 — HIGH — production audit expectations could be caller-supplied and system checks could be skipped

The manual production audit accepted expected release/API/schema as workflow inputs instead of deriving them from the checked-out canonical manifest. `API_KEY` was optional, and an audit with missing system credential could still finish with `system_checks=skipped`.

**Remediation:** manual input is reduced to exact source SHA; runtime service/release/API/schema derive from `worker-manifest.json`; formal production audit requires system checks and fails closed if `API_KEY` is absent.

**Status:** implemented, pending live audit.

### N55 — CRITICAL — Recovery Evidence Gate was documentation-only

The zero-downtime policy blocked Schema 3, but `deploy-worker.yml` had no machine gate between a future manifest/migration change and `wrangler d1 migrations apply --remote`.

**Remediation:** `config/recovery-evidence-gate.json` and `tools/verify_recovery_evidence_gate.mjs` make the current maximum schema `2` executable policy. Schema 3+ fails unless status is `passed`, `passed_at` is valid, and all required export/restore/rollback/integrity/recovery evidence references are populated. Required CI and deploy both execute the gate.

**Status:** implemented; gate deliberately remains `blocked`.

### N56 — CRITICAL — wrong production D1 with compatible schema could pass

Version/health checks verified schema shape but not Cloudflare D1 control-plane database UUID/name. A wrong D1 containing the same core tables and schema metadata could pass readiness.

**Remediation:** production deploy now queries `wrangler d1 info --json` and compares both database UUID and name against protected deployment values before any migration/deploy action.

**Status:** implemented, pending first production workflow proof.

### N57 — HIGH — runtime service identity was not part of propagation readiness

`worker-manifest.json` carries `runtimeService`, and `/api/version` reports `service`, but deployment readiness did not compare them.

**Remediation:** manifest exporter emits runtime service; readiness and production audit require exact service identity and health source SHA.

**Status:** implemented, pending CI/live proof.

### N58 — HIGH — production frontend can still pass through implicit legacy fallback

For the Cloudflare Pages main branch, `frontend_environment_policy.mjs` currently permits missing explicit production `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID`, labeling this `legacy-production-fallback`. `src/config.js` contains production fallback values. This prevents a build failure from proving that Cloudflare Pages production variables are actually configured.

**Remediation plan:** PR-10D3D-B must first obtain authoritative Pages production configuration evidence, then make production explicit without breaking the currently serving site. Do not delete the fallback before the external configuration is proven ready.

**Status:** OPEN / deployment blocker for claiming fully explicit frontend environment proof; not a blocker to keeping the current frontend online.

### N59 — MEDIUM — independent PR review is procedural, not enforced by ruleset

`main-protection-v5` requires a PR and strict required checks, but `required_approving_review_count=0` and review-thread resolution is not mandatory. Existing independent review practice is evidence discipline, not a GitHub-enforced invariant.

**Remediation plan:** retain mandatory independent diff/security review in execution policy; when control-plane mutation tooling/approved manual maintenance is available, evaluate requiring one approval without making a single-maintainer recovery path impossible.

**Status:** OPEN / governance hardening.

### N60 — HIGH — production reviewer gate retains admin bypass and self-review capability

The production Environment has a required reviewer but currently reports `can_admins_bypass=true` and `prevent_self_review=false`. Operational policy says never bypass, but GitHub technically permits break-glass bypass/self-review.

**Remediation plan:** continue zero-bypass execution now; separately evaluate disabling admin bypass and enabling self-review prevention only when a second trusted reviewer/recovery mechanism exists, to avoid locking out the only maintainer.

**Status:** OPEN / governance hardening; no bypass is permitted for PR-10D3D.

### N61 — HIGH — production frontend live CSP is not yet part of post-deploy evidence

Repository build contracts prove environment-aware CSP rendering, but the first production Worker activation workflow does not itself prove the currently served production Pages response/header/bundle is the intended exact frontend configuration.

**Remediation plan:** PR-10D3D-B should add a read-only production frontend contract verifier covering served CSP, API origin, staging API exclusion, OAuth client identity, and frontend source/deployment identity where Cloudflare exposes it.

**Status:** OPEN / next batch.

### N62 — HIGH — production OAuth isolation has static proof but no live cross-environment rejection proof

The production Worker will now receive an explicit production Google client ID from tracked config, but the current production acceptance has not yet exercised a real staging-audience token against production and proved rejection without writes.

**Remediation plan:** design a read-only/fail-closed OAuth isolation probe using a short-lived staging token, with no production mutation and no long-lived credential exposure to browser/runtime steps. Execute only after the cross-environment credential boundary can be arranged safely.

**Status:** OPEN / later production verification; never use a real user transaction for this test.

## Existing findings deliberately not duplicated

The following remain governed by their existing IDs/batches rather than receiving new numbers merely because this audit re-observed them:

- B01 / supply-chain integrity, including missing `e2e/package-lock.json`;
- B05 / revocable sessions, logout-all, tenant identity/admission control;
- B06 / record revision, idempotency, pagination snapshot consistency;
- B07 / ledger revision and atomic snapshot publication;
- B08/B09 / market-data, instrument/currency truth, fixed precision;
- B11 / corporate actions and dividend economic correctness;
- B12 / cash ledger and account-level NAV/performance semantics;
- B14 / CSP unsafe-inline/unsafe-eval and PWA/service-worker control plane;
- B15 / DR, export/deletion/retention/legal/security policy;
- N22 / first canonical exact-SHA production deployment not yet executed;
- RISK-032 / release evidence fragmentation and finite artifact retention.

## Revised phased execution order

### Phase D3D-A — production activation control-plane hardening — current

No production deploy, no D1 schema change, no user-data change.

Acceptance requires required CI, independent diff/security review, protected merge, and post-merge CI/Pages proof.

### Phase D3D-B — production frontend explicit environment/CSP proof

Read-only/configuration-first. Prove Pages production variables and served CSP before removing legacy fallback. Keep current frontend available throughout.

### Phase D3D-C — first canonical exact-SHA production Worker deployment

Only after D3D-A/B acceptance. Exact protected-main SHA only. Production reviewer approval is the human gate. Recovery Evidence Gate remains blocked at Schema 2. Verification performs no synthetic production writes.

### Phase D3D-D — post-deploy closeout

Archive exact Worker version/source/service/API/schema/D1/CORS/auth evidence, deployment/run IDs, rollback reference, and Release checkpoint. A failed production audit is preserved as failure evidence and must never be rewritten.

### Phase B01-A — E2E dependency graph reproducibility

Commit `e2e/package-lock.json`, use `npm ci`, verify transitive integrity, and add supply-chain guards. Isolated from runtime/business logic.

### Phase B05 — application session and admission plane

Revocable HttpOnly session, subject-keyed tenant identity, logout-all, account status/quotas. Dual-write/compatibility first; no flag-on cutover in one release.

### Phase B06 → B07 — ledger revision then snapshot publication

Record mutation identity/revision/idempotency/pagination consistency first. Then bind calculations/snapshots to ledger revision and atomically publish only current results.

### Phase B08/B09 → B11/B12 — economic truth plane

Instrument Master, provider provenance, exchange calendar, currency/fixed precision, corporate actions, then cash-ledger/account NAV methodology. Every financial correction requires external truth fixtures and canonical-layer regression tests.

### Phase B14/B15 — browser hardening and recovery/data-rights closeout

CSP nonce/hash migration, service-worker tombstone/control, then full export/restore/retention/deletion/security/legal evidence.

## Debugging invariant retained

Every future defect follows: freeze evidence → reproduce → define invariant → first divergence → failing regression → authoritative-layer fix → sibling-path sweep → external truth for financial defects → shadow/canary → exact post-deploy evidence.

Do not use UI-only financial patches, tolerance relaxation, warning-only publication, fallback-as-verified, browser timestamps as identity, or Time Travel existence as a substitute for a restore drill.
