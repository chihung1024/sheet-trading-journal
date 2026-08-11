# Production Actions Autonomous Dispatch

Status: **DEPLOYED / VERIFIED**  
Document revision: **2**  
Date: **2026-08-11**

## 1. Requirement

GitHub Actions operational transport should not be delegated back to the operator when no independent human judgment is required. Normal flow must not require the operator to find a workflow, paste an exact SHA, press **Run workflow**, or identify the created run.

Independent production mutation approval is a separate safety control and is not bypassed.

## 2. Deployed architecture

Normal Worker deployment initiation is now:

```text
reviewed protected-main deployment request
-> Production Deployment Dispatch Broker
-> exact protected-main freshness
-> request schema + exact runtime SHA
-> main reachability
-> existing production activation authority equality
-> short-lived repository GITHUB_TOKEN dispatches canonical Deploy Worker
-> canonical Deploy Worker retains reviewer-protected production mutation gates
```

Auditable request:

`config/production-deployment-request.json`

Broker:

`.github/workflows/production-deployment-dispatch.yml`

The broker has only:

- `contents: read`
- `actions: write`

It has no production environment, Cloudflare/D1 credentials, repository contents write permission, or direct deployment command.

The supply-chain policy explicitly allows only this workflow to request `actions: write`; every other tracked workflow remains zero-write.

## 3. Production proof

PR #196 merged the broker on protected main:

`67b873529ab4cd063ec9d0b7d5c1d30bbb4b8ffc`

Broker #1 automatically created Deploy Worker #4 / run `31475347673` for exact runtime:

`fe5f091fdb2c92970dff74c1a7c99052084adb95`

This proves that normal production deployment no longer requires manual workflow selection or SHA entry.

Deploy #4 subsequently completed successfully after the independent `production` Environment approval.

## 4. Remaining human boundary

The repository `production` Environment has a Required Reviewer. The current connector does not expose pending-deployment approval mutation.

Therefore the only retained manual step is the independent GitHub production-environment approval that releases production secrets to the canonical deploy/maintenance job.

This boundary must not be confused with workflow transport. It is intentionally not removed, self-approved by a bot, or bypassed through admin override.

## 5. Pages #1482 disposition

The PR #196 merge triggered GitHub Pages #1482, which GitHub marked failed even though its `build` job never received a runner and executed zero Checkout/Jekyll steps; `report-build-status` succeeded and deploy was skipped. The Pages build API remained at `building` with no application error.

This is retained as **FOLLOW-UP / GitHub Pages execution-plane anomaly**, not reclassified as a repository build regression. Repo CI #635 passed and the immediately prior Pages #1481 completed the full build/deploy pipeline successfully.

Do not create empty commits or mutate runtime identity merely to retrigger the generated Pages workflow.

## 6. Next automation quality work

The same event-driven principle should be applied to read-only Production Identity Evidence so normal runtime changes do not require manual Action start/parameter entry.

That follow-up must remain separate from E1c lifecycle correctness and must avoid producing production-review prompts for authority-only or documentation-only commits.
