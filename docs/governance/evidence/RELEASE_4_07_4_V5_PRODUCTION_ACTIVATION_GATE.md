# 4.07.4 — V5 Production Activation Gate Hardening

Release type: **GitHub governance/evidence checkpoint**  
Worker runtime release remains: **4.07**  
API remains: **2.60**  
D1 schema remains: **2**

`4.07.4` must not be interpreted as a Worker 4.07.4 binary/runtime release.

## Checkpoint purpose

This checkpoint archives completion of PR-10D3D-A, the control-plane hardening batch that makes the first future canonical production activation fail closed until authoritative frontend and D1 evidence exists.

D3D-A was merged through PR `#126` at:

`4dda2dacd05779ec5a53a46a17b5ea4d4d2733b6`

The exact final reviewed PR head was:

`0867bca32677b192701f46dda8d56a7fc9df11a5`

## Included hardening

- explicit production Wrangler configuration ownership and strict deploy semantics;
- required-secret declaration and environment-aware production bindings;
- exact runtime source/service/release/API/schema propagation validation;
- exact observed schema readiness rather than permissive advanced-schema acceptance;
- production-contract coverage inside protected CI;
- machine-enforced Recovery Evidence Gate with real structured evidence references for future Schema 3+;
- exact D1 live identity probing before mutation while refusing to invent unverified production D1 authority;
- production activation authority separated from immutable runtime source;
- runtime-source deployability precondition requiring verified production D1 name + UUID fingerprint;
- non-secret preflight before the GitHub production reviewer gate;
- fresh protected-main authority validation after reviewer approval and immediately before production mutation boundaries;
- append-only N51–N68 deep audit supplements.

## Verification

Final PR head:

- required CI `31162653492`: SUCCESS;
- Production Contract Audit unit workflow `31162653392`: SUCCESS;
- independent AI diff/security review `4881296048`: PASS for D3D-A merge scope only;
- open review threads: 0;
- normal protected merge; no bypass.

Post-merge `main@4dda2dacd05779ec5a53a46a17b5ea4d4d2733b6`:

- main CI `31162824361`: SUCCESS;
- Pages `31162820765`: SUCCESS.

## Production remains intentionally blocked

This release checkpoint does **not** represent a production Worker deployment.

At checkpoint closeout:

- production runtime D1 identity remains `unverified`;
- `config/production-activation-authority.json` remains `blocked`;
- the current runtime source fails production runtime preconditions by design;
- no production Environment reviewer approval was requested;
- no production or staging Worker deploy was run;
- no remote D1 migration or production synthetic write occurred.

## Required next work

D3D-B must close the remaining production predeploy evidence gaps:

- N58/N61 — authoritative Cloudflare Pages production explicit environment and served frontend/CSP proof;
- N64 — authoritative read-only Cloudflare production D1 name/UUID proof, followed by reviewed runtime identity pinning;
- N62 — production rejection of a staging-audience Google token without production writes.

Only after a reviewed immutable runtime SHA contains verified production D1 authority and protected main separately authorizes that exact SHA may the production workflow reach its human reviewer gate.

Schema 3 remains forbidden until the separate Recovery Evidence Gate is genuinely passed.

## Recovery references

- pre-D3D-A: `backup-pre-10d3d-74fe120`;
- post-D3D-A merge: `backup-post-10d3d-4dda2da`;
- pre-closeout: `backup-pre-10d3d-closeout-4dda2da`;
- previous GitHub release checkpoint: `4.07.3` at `74fe12010ee3138e07a079a3d45271fddb80b536`.

Machine closeout:

`docs/governance/evidence/PR_10D3D_CLOSEOUT_2026-08-07.json`
