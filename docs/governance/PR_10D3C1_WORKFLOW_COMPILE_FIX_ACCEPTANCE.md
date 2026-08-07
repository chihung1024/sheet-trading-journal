# PR-10D3C1 — Staging Browser Workflow Compile Fix Acceptance

Status: TEST-FIRST / EXPECTED RED  
Baseline: `a1bfc40a1e22ee2624e9cff7d6324f13215ea35c`  
Recovery branch: `backup-post-10d3c-merge-a1bfc40`  
Work branch: `pr-10d3c1-workflow-compile-fix`

## Trigger

PR-10D3C infrastructure merged as PR `#123`. The required repository CI had been green on the reviewed PR head, but GitHub's own workflow compiler produced a separate failure immediately after merge for `.github/workflows/staging-browser-smoke.yml`:

- run: `31151484724`;
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

The repository's static D3C contract had guards for secret scope, exact SHA, OAuth identity, source identity and cleanup, but it did not yet guard expression-context availability.

## Test-first guard

Before changing the workflow, add a regression assertion that extracts the job-level `env` block and rejects any `${{ runner.* }}` expression there.

The baseline must fail this new contract test. Existing Python and Worker/D1 tests are expected to remain green.

## Authoritative fix

Do not remove the temporary-token cleanup contract and do not replace the path with a repository-local token file.

Resolve the runner temporary directory only at step runtime, where runner context is valid, and ensure the same path is supplied to:

- Google ID-token mint step;
- authenticated browser-smoke step;
- unconditional cleanup step.

Long-lived OAuth credentials must remain scoped only to token mint.

## External compiler acceptance

Repository CI alone is insufficient for this defect class. Before merge, the fixed branch/head must also be checked through GitHub Actions metadata:

- the new commit must **not** create a zero-job `push` failure for `.github/workflows/staging-browser-smoke.yml`;
- the workflow should retain its declared name `Staging Browser Smoke` once GitHub accepts the definition;
- after merge, no new compile-failure run may appear on `main`.

## Scope

This repair may change only:

- `.github/workflows/staging-browser-smoke.yml`;
- the static staging-browser workflow contract test;
- this acceptance/evidence document.

No frontend app runtime, Worker source, D1 data/schema, financial logic, OAuth semantics, staging deployment or production environment change is permitted.

## Rollback

Before merge, abandon this repair branch. After merge, revert the repair PR. The current production and staging runtimes are not changed by this compile repair.
