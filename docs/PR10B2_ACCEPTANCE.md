# PR-10B2 Acceptance — Workflow Supply-Chain Pinning

## Purpose

This batch advances B01 without changing application runtime or financial behavior. It converts every external GitHub Action reference from a mutable semantic tag to an exact immutable commit SHA and adds a deterministic fail-closed policy test.

Tracking issue: #80

## Exact baseline and recovery

- Repository: `chihung1024/sheet-trading-journal`
- Main SHA before change: `7c4545f4e822af37452cc62e0b594e9d21a0c653`
- Main tree before change: `86d754f20641a01bc51855b4f08ab8477b8129eb`
- Worker release/API/schema: `4.07` / `2.60` / `2`
- Pre-change backup: `backup-pre-pr10b2-7c4545f`
- Work branch: `pr10b2-workflow-supply-chain`
- Runtime effect: none
- Cost policy: free-only; no paid scanner, hosted observability service, Cloudflare resource, Google Cloud resource, or IBKR request is introduced.

## Upstream pin evidence

The tag references were resolved through the public GitHub REST Git-reference endpoints on 2026-08-06 UTC and captured in `docs/governance/github-actions-pins.json`.

| Action | Reviewed tag | Immutable commit |
|---|---:|---|
| `actions/checkout` | `v7` | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-python` | `v7` | `5fda3b95a4ea91299a34e894583c3862153e4b97` |
| `actions/setup-node` | `v7` | `820762786026740c76f36085b0efc47a31fe5020` |
| `actions/upload-artifact` | `v6` | `b7c566a772e6b6bfb58ed0dc250532a479d7789f` |

The semantic major is retained only as an inline maintenance comment. Execution uses the 40-character commit SHA.

## Changed behavior

- All tracked workflow `uses:` entries are exact-SHA pinned.
- Every checkout step explicitly sets `persist-credentials: false`.
- The CI Python job runs the dependency-free workflow policy test before installing project dependencies.
- The policy test rejects:
  - mutable tags, branches, or shortened SHAs;
  - actions outside the reviewed allowlist;
  - a SHA or semantic-major mismatch against the evidence file;
  - checkout steps that persist credentials;
  - workflow `write` permissions or `write-all`;
  - an unrecorded workflow file.

## Explicit exclusions

No change to:

- frontend or Worker runtime;
- authentication, Google OAuth, or browser token storage;
- D1 schema, migrations, records, snapshots, or jobs;
- calculation formulas, market data, dividends, benchmarks, or accounting;
- Cloudflare Worker or Pages deployment;
- IBKR connectivity or transaction reads;
- package dependencies, release metadata, API version, or schema version.

## Acceptance gates

1. `python tests/test_workflow_supply_chain.py` passes without third-party packages.
2. The complete existing Python test suite passes.
3. Worker security/deployment/config/schema tests pass.
4. Frontend security contracts and production build pass.
5. Exact PR diff contains only the four workflow files, the policy test, the pin evidence, and this acceptance record.
6. Independent exact-head review confirms no workflow trigger, secret name, command, environment, deployment target, or calculation behavior changed.
7. Merge uses expected-head locking.
8. A post-merge backup branch is created from the exact merge commit.
9. Main exact-SHA CI passes.

## Rollback

Revert the merge commit or restore the four workflow files from `backup-pre-pr10b2-7c4545f`.

No runtime deployment or data rollback is required. Existing Actions runs already started from older commits are unaffected.
