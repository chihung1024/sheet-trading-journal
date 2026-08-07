# PR-10D3C1 — Staging Browser Workflow Compile Fix Acceptance

Status: IMPLEMENTED / FINAL REVIEW PENDING  
Baseline: `a1bfc40a1e22ee2624e9cff7d6324f13215ea35c`  
Recovery branch: `backup-post-10d3c-merge-a1bfc40`  
Work branch: `pr-10d3c1-workflow-compile-fix`  
PR: `#124`

## Trigger

PR-10D3C infrastructure merged as PR `#123`. Repository CI had been green on its reviewed head, but GitHub's own workflow compiler produced a separate failure immediately after merge for `.github/workflows/staging-browser-smoke.yml`:

- main failure run: `31151484724`;
- event: `push`;
- conclusion: `failure`;
- jobs: `0`;
- workflow display name degraded to the file path rather than `Staging Browser Smoke`.

A valid `workflow_dispatch`-only workflow must not create a push execution. A zero-job push failure is treated as a workflow-definition compile failure, not as a staging runtime failure.

## Root cause

The workflow placed:

`STAGING_E2E_ID_TOKEN_FILE: ${{ runner.temp }}/staging-e2e-google-id-token`

inside the job-level `env` block.

`runner.*` is execution-time runner context. Resolving it in job-level environment configuration occurs before a runner/step context exists, so GitHub cannot compile the job.

The original D3C static contracts covered secret scope, exact SHA, OAuth identity, Worker identity and cleanup, but did not cover GitHub expression-context availability.

## Test-first expected-red proof

Before changing the workflow, the repair branch added a regression assertion that extracts the job-level `env` block and rejects any `${{ runner.* }}` expression.

Expected-red head:

`a4435a9024dddd7fffd7ecf28d3d5118ad0490c9`

Evidence:

- repository CI `31151800338`:
  - Frontend contracts: FAIL at the new compile-context guard;
  - Python: PASS;
  - Worker/security/local-D1: PASS;
- GitHub compiler independently repeated the real failure as run `31151714637`:
  - event `push`;
  - conclusion `failure`;
  - zero jobs;
  - workflow name/path `.github/workflows/staging-browser-smoke.yml`.

This aligned the static regression test with the actual GitHub compiler failure class.

## Authoritative fix

The job-level environment now retains only `SOURCE_SHA`.

The runner temporary token path is resolved only at step runtime and is bound exactly three times:

1. Google ID-token mint step;
2. authenticated browser-smoke step;
3. unconditional cleanup step.

Each uses:

`STAGING_E2E_ID_TOKEN_FILE: ${{ runner.temp }}/staging-e2e-google-id-token`

The static contract now enforces both properties:

- job-level env contains no `${{ runner.* }}` expression;
- the token-file runtime binding appears exactly three times.

Long-lived OAuth credentials remain scoped only to the token-mint step. No token path was moved into the repository workspace.

## Green proof

Root-fix/evidence head before this acceptance update:

`0315c39ba8f03fd20f753f7908c188507382e80a`

Repository CI `31151933217`:

- Frontend contracts + production build: PASS;
- Python functional/coverage + workflow supply-chain policy: PASS;
- Worker/security/local-D1: PASS.

GitHub Actions metadata for the same head reported exactly one workflow run: the normal PR `CI` run. It reported **no** `.github/workflows/staging-browser-smoke.yml` push failure. This is the required external compiler green signal for the defect class.

## Final acceptance before merge

Because editing this evidence document creates a new branch head, the final reviewed head must again satisfy both layers:

1. all three protected-main repository checks PASS;
2. GitHub Actions metadata for the exact final head contains no zero-job `push` failure for `staging-browser-smoke.yml`;
3. final diff contains only:
   - `.github/workflows/staging-browser-smoke.yml`;
   - `tests/frontend_staging_browser_smoke_contract.test.mjs`;
   - this acceptance document;
4. no frontend app runtime, Worker source, D1, financial, OAuth-semantic, staging-deployment or production-environment change;
5. no blocking review thread;
6. normal protected `merge`, no bypass.

After merge, `main` must also show normal CI/Pages success and **no new zero-job compile-failure run** for the staging browser workflow before staging may move.

## Scope / rollback

This repair changes GitHub Actions test infrastructure only. Production and staging runtimes are unchanged.

Rollback reference: `backup-post-10d3c-merge-a1bfc40`. Before merge, abandon the repair branch; after merge, revert the repair PR.
