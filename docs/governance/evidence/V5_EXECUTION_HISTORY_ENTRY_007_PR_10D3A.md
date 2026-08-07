# V5 Execution History — Entry 007 — PR-10D3A Environment-Aware CSP Closed

This entry is an append-only companion to `docs/governance/V5_EXECUTION_HISTORY.md` and preserves the full PR-10D3A chronology without rewriting Entries 000–006.

- Baseline: `d78bb3c7aadf1c3e3d9078be304d410d70a96103`
- Pre-change backup: `backup-pre-10d3a-csp-d78bb3c`
- Work branch: `pr-10d3a-environment-aware-csp`
- PR: `#120`
- Finding closed at build-contract layer: `N24`

## Expected-red proof

- Head: `519d40a6569dadb091f2d194119a33c8a0daf928`
- CI: `31145425753`
- Python: PASS
- Worker/security/D1: PASS
- Frontend: `134/137` PASS; exactly three new CSP guards failed
- Direct reproduction: fixed staging Vite build emitted a meta CSP that did not authorize `https://journal-backend-staging.chired.workers.dev`

## Root fix proof

- Head: `917ca6a7515cdb6670963e31438eb649bdd23095`
- CI: `31145761413`
- Frontend contracts: `137/137` PASS
- Production Vite build: PASS
- Python: PASS
- Worker/security/D1: PASS

Fix uses `__TRADING_JOURNAL_API_ORIGIN__` in both CSP source surfaces and resolves it through a Vite plugin that imports the existing deployment contract/environment validator. Arbitrary preview remains fail-closed. No wildcard origins were introduced. `unsafe-inline` and `unsafe-eval` were intentionally not removed in this batch.

## Final review / merge

- Final reviewed head: `c0bfc64cd0083452272bdc8ea21364b277579b5f`
- Final CI: `31145840067`, all protected-main required checks PASS
- Independent AI review id: `4879839767`
- Changed files: exactly 7
- Review threads: 0
- Blocking findings: 0
- Merge method: `merge`
- Bypass used: no
- Merge SHA: `61839eff4eae7102b4b4be32eb606008fdd246c8`

## Post-merge proof

- Main CI: `31146068529`, PASS for Frontend/Python/Worker-D1
- Production Pages build/deployment: `31146067097`, PASS
- Post-change backup: `backup-post-10d3a-61839ef`
- No staging branch update occurred before production-main verification
- No staging/production Worker deployment occurred in PR-10D3A
- No D1/schema/financial-engine change occurred

## Carried-forward gates

- Full CSP hardening (`unsafe-inline` / `unsafe-eval` removal): B14
- Fixed staging activation + exact-SHA staging Worker deployment: next operational step
- Staging browser OAuth/CRUD smoke: PR-10D3C
- Production explicit environment/CORS/CSP cutover + first exact-SHA production Worker deployment: PR-10D4
- Schema 3 remains blocked until B03 closeout and recovery evidence gate

Machine-readable companion: `docs/governance/evidence/PR_10D3A_CLOSEOUT_2026-08-07.json`.
