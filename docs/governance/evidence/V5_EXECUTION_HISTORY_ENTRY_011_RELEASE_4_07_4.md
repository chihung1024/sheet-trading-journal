# V5 Execution History Entry 011 — Release 4.07.4 Publish Evidence

Status: **CLOSED / PASS**  
Local date: `2026-08-07` (UTC+8)

## Release checkpoint

GitHub governance/evidence checkpoint:

`4.07.4 — V5 Production Activation Gate Hardening`

Authoritative target:

`3024dde0ea148a3997782614da5ca8100462d010`

This checkpoint is **not** a Worker 4.07.4 runtime release. Runtime remains:

- Worker `4.07`;
- API `2.60`;
- D1 Schema `2`.

## Pre-publish proof

The release target was the exact protected-main merge SHA after D3D-A closeout PR #127.

On that exact SHA:

- main CI run `31163230789` / `#303`: **SUCCESS**;
- Pages run `31163228909` / `#1417`: **SUCCESS**;
- recovery ref: `backup-d3d-a-closed-3024dde`.

No production Worker workflow or D1 migration was executed as part of this release checkpoint.

## Isolated release operation

Release operations branch:

`ops/release-4.07.4-20260807`

Base:

`3024dde0ea148a3997782614da5ca8100462d010`

Temporary workflow commit:

`b0ed561e6f7e61637ff6b08dbd75c321dd3e9040`

Workflow:

`Publish 4.07.4 exact-SHA release`

Run:

`31163456562`

Conclusion:

**SUCCESS**

The temporary workflow was configured to fail closed unless protected main still equaled the exact target, neither the tag nor Release already existed, committed release notes preserved Worker 4.07 / Schema 2 semantics, and post-publish Release/tag identity matched the exact target.

The release-ops branch is operational tooling only and must not be merged into main.

## Independent authoritative verification

After the workflow completed, GitHub release/tag APIs were read independently.

Release:

- Release ID: `366623772`;
- tag: `4.07.4`;
- target commitish: `3024dde0ea148a3997782614da5ca8100462d010`;
- `draft=false`;
- `prerelease=false`;
- publisher: `github-actions[bot]`.

Tag:

- ref: `refs/tags/4.07.4`;
- object type: `commit`;
- object SHA: `3024dde0ea148a3997782614da5ca8100462d010`.

Therefore the release checkpoint is not pointing to the release-ops workflow commit and does not depend on a moving branch name.

## Production state remains blocked

Release publication did not alter production activation state:

- production runtime D1 identity remains `unverified`;
- runtime production preconditions remain blocked;
- protected-main production activation authority remains `blocked`;
- Schema 3 remains blocked by Recovery Evidence Gate;
- production reviewer gate is not reachable from the current source;
- no production/staging Worker deploy occurred;
- no production synthetic write occurred.

D3D-B remains the next formal phase.

## Machine evidence

`docs/governance/evidence/RELEASE_4_07_4_PUBLISH_EVIDENCE_2026-08-07.json`

Pre-release-evidence recovery:

`backup-pre-4.07.4-release-evidence-3024dde`
