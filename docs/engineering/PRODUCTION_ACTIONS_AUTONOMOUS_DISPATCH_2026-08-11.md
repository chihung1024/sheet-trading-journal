# Production Actions Autonomous Dispatch

Status: **IMPLEMENTATION CANDIDATE**  
Date: **2026-08-11**

## 1. Requirement change

The operator explicitly authorized ChatGPT to complete GitHub Actions operational work without repeatedly asking the operator to open Actions, choose a workflow, paste an exact SHA, and press **Run workflow**.

The previous process granted decision authority to the AI but retained a manual `workflow_dispatch` transport step. That distinction created repeated human work even when no independent human judgment was required.

This batch changes the transport, not the production safety gates.

## 2. Locked architecture

Normal production deployment initiation becomes:

```text
reviewed protected-main deployment request
-> Production Deployment Dispatch Broker
-> verify event commit is still exact protected-main HEAD
-> validate request schema / exact runtime SHA
-> prove runtime SHA is main-reachable
-> verify existing production activation authority for exact runtime SHA
-> short-lived repository GITHUB_TOKEN dispatches canonical Deploy Worker
-> canonical Deploy Worker performs all existing preflight / production environment / D1 / Worker / stable-contract gates
```

`config/production-deployment-request.json` is the auditable intent record. Updating it is a consequential R3 control-plane change and remains subject to normal branch/PR/CI/review/merge governance.

## 3. Security boundary

The broker deliberately has only:

- `contents: read`
- `actions: write`

It has no production environment, no Cloudflare secrets, no D1 credentials, no repository contents write permission, and no Worker deployment command.

The broker cannot deploy production directly. It can only request execution of the existing `.github/workflows/deploy-worker.yml` workflow after the existing production activation verifier passes.

The canonical Deploy Worker retains `environment: production` and all existing preflight, latest-main authority rechecks, D1 identity verification, migration, Worker deployment, stable post-deploy contract, and artifact gates.

Therefore this batch does **not** bypass GitHub environment protection or weaken production mutation checks.

### 3.1 Supply-chain write-scope exception

The first exact-head CI correctly blocked the new broker because the existing workflow supply-chain policy both required every tracked workflow to be inventoried and prohibited every workflow write scope globally.

That failure is treated as a security-policy finding, not as a test to disable. The correction is an explicit fail-closed allowlist in `docs/governance/github-actions-pins.json`:

```text
production-deployment-dispatch.yml -> actions: write
```

The supply-chain test now requires the observed write scopes to equal the evidence allowlist exactly. It also hard-locks the current exception to the broker workflow and the `actions` scope only. Every other workflow remains zero-write, `write-all` remains prohibited, and `contents: read` remains mandatory.

## 4. Platform capability

GitHub's current REST API version `2026-03-10` returns HTTP 200 with `workflow_run_id` for a successful workflow dispatch. GitHub also documents `workflow_dispatch` and `repository_dispatch` as exceptions that can create workflow runs when initiated with the repository `GITHUB_TOKEN`.

The broker requires HTTP 200 and a positive workflow run ID; malformed or rejected dispatch fails closed.

## 5. Human interaction boundary

After this batch, the operator no longer needs to:

- find the Deploy Worker workflow;
- paste the runtime SHA;
- press Run workflow;
- identify the resulting run.

If the GitHub `production` environment is configured with Required Reviewers, GitHub may still require an independent environment approval before the canonical deploy job receives production secrets. That platform-enforced approval is intentionally not bypassed by this batch.

## 6. Current bootstrap request

The initial request authorizes transport of the already-authorized E1c-A.1 runtime:

`fe5f091fdb2c92970dff74c1a7c99052084adb95`

The protected-main activation authority was established by PR #195 after Production Identity Evidence #15.

## 7. Exact candidate scope

Final candidate scope is six files:

- `.github/workflows/production-deployment-dispatch.yml`
- `config/production-deployment-request.json`
- `tests/worker_production_deployment_dispatch.test.mjs`
- `docs/engineering/PRODUCTION_ACTIONS_AUTONOMOUS_DISPATCH_2026-08-11.md`
- `docs/governance/github-actions-pins.json`
- `tests/test_workflow_supply_chain.py`

The last two files are the explicit supply-chain policy/evidence correction required by the first CI failure. No runtime, frontend, D1 schema, financial calculation, Cloudflare secret, or canonical deployment mutation step is changed.

## 8. Risk and recovery

**Risk: R3 — production deployment dispatch control plane.**

A defect could dispatch the wrong runtime or create an unintended production deployment request. Safeguards are exact-main freshness, exact 40-character SHA validation, main reachability, existing activation-authority equality, least-privilege token permissions, canonical deploy workflow reuse, explicit single-workflow write-scope allowlisting, and reviewer-protected production mutation.

Recovery: `backup-pre-actions-autonomous-dispatch-baa07ba`.

Required before merge:

- exact six-file candidate scope only;
- full exact-head CI;
- broker contract tests;
- supply-chain policy proves only the broker may request `actions: write`;
- no Cloudflare/production secrets in broker;
- no direct deployment commands in broker;
- fresh R3 Same-AI Independent Review;
- expected-head merge only.

## 9. Follow-up

The same principle will be applied to production identity evidence: GitHub Action start/parameter selection should be event-driven rather than delegated to the operator. The exact runtime-change trigger set must be locked separately so authority-only or documentation-only main commits do not generate unnecessary production-review prompts.
