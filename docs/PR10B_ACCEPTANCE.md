# PR-10B Acceptance Contract

## Identity

- Issue: `#68`
- Baseline main SHA: `9eff93e7c997f4343a8360121655d5c686effe8b`
- Working branch: `pr10b-frontend-security-gates`
- Pre-change backup ref: `backup-pre-pr10b-9eff93e`
- Worker release/API/schema remain: `4.07` / `2.60` / `2`

## Objective

Add deterministic non-runtime regression gates that prevent expansion of browser persistence and browser privilege, detect dangerous frontend primitives and secret-like material, and scan repository-hosted public evidence for personal identifiers.

## Allowed changed paths

- `.github/workflows/ci.yml`
- `package.json`
- `docs/PR10B_ACCEPTANCE.md`
- `docs/governance/browser-storage-baseline.json`
- `tests/frontend_security_contracts.test.mjs`
- `tests/test_public_evidence_safety.py`

Any other changed path is a release blocker unless this contract and Issue #68 are amended before review.

## Current known debt represented, not accepted as safe

The browser-storage baseline intentionally records existing keys linked to:

- RISK-009: full transaction cache.
- RISK-012: tenant-unbound confirmed-dividend keys.
- RISK-020 and RISK-038: calculation recovery state.
- RISK-025, RISK-026 and RISK-050: local identity and token storage.
- RISK-041: benchmark cache and published-data mismatch.

The baseline prevents unreviewed growth. It does not close those risks.

## Required validation

1. `npm run test:frontend`
2. `python -m pytest -q tests/test_public_evidence_safety.py tests/test_audit_governance.py`
3. Existing full Python suite.
4. Existing Worker security and deployment suite.
5. Existing Worker config and local D1 migration checks.
6. Existing frontend production build.
7. Exact diff contains only allowed paths.
8. No dependency or package-lock change.
9. No runtime source change.
10. No full email, credential, private key, or private transaction content introduced.

## Contract checks

The frontend contract test must fail closed when:

- an unregistered browser-storage key is introduced;
- system-only `X-API-KEY` or `X-Target-User` is used by browser source;
- the production Worker URL is duplicated outside the reviewed API configuration and CSP allowlist locations (`src/config.js` and `index.html`);
- `v-html`, an `innerHTML` assignment, `eval`, or `new Function` is added;
- a GitHub token, Google API key, private key, or full email is hard-coded in browser source;
- global localStorage clearing expands beyond the inventoried location.

The public-evidence test must scan repository-hosted docs and workflows and fail on the same personal identifier and credential classes.

## Explicit exclusions

- No removal of localStorage keys in this PR.
- No auth/session change.
- No frontend pagination, GroupManager, refresh, date, benchmark, or display correction.
- No Worker or D1 change.
- No release or deployment.

## Merge contract

Merge only when the exact reviewed head SHA has green CI, no out-of-scope file, and an independent comment records scope and test evidence.

## Rollback

Revert the additive tests, inventory, npm script, and CI invocation. Production runtime and data are unchanged.
