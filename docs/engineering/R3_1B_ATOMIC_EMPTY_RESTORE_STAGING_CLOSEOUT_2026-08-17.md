# R3.1B — Atomic Empty Restore Staging Closeout

Date: 2026-08-17 (Asia/Taipei)

## Status

**CLOSED at the backend + isolated staging evidence boundary.**

R3.1B now has live evidence that the reviewed backup-v1 restore contract can be applied atomically to an empty tenant, read back authoritatively, replayed idempotently, rejected on changed intent or non-empty destination, and cleaned up without touching production journal data.

This closeout does **not** mean that production users can execute restore from the frontend yet. The existing frontend remains preview-only. User-facing execution, capability gating, confirmation UX, and production activation belong to R3.1C.

## Reviewed implementation boundary

The delivered restore path is:

```text
user-selected backup v1
→ strict local preview validation
→ empty-destination check
→ authenticated tenant-scoped POST /api/journal-restore
→ one atomic D1 batch guarded by journal_restore_sessions
→ authoritative server readback
→ same-key replay deduplication
→ changed-intent / non-empty fail-closed rejection
```

Safety properties retained:

- restore never merges into a non-empty journal;
- existing transaction/cash rows are never silently replaced or deleted;
- source database IDs and internal server hashes are not imported as authority;
- missing financial facts are never guessed;
- duplicate multiplicity that is legitimate in the backup contract is preserved;
- a failed atomic batch rolls back both restore guard and live rows;
- completed same-intent replay is a no-op;
- a reused key with a different payload fails closed;
- derived portfolio/performance outputs are not imported from backup and remain subject to normal recalculation authority.

## Exact staging evidence

Workflow: **Deploy Staging Worker #6**

- workflow run ID: `32022424046`
- source: `main@c1c7c2895c297372981dac2898131c7727d44e9a`
- staging Worker Version ID: `3198a37d-9882-4e68-b40d-edb7e01ed6c9`
- canonical runtime contract: release `4.12` / API `2.65` / schema `3`
- Worker regression suite: `261 / 261` passed
- Recovery Evidence Gate: passed
- staging D1 migrations: already current; `0006_journal_restore_sessions.sql` present/applied
- final workflow conclusion: **SUCCESS**

### Stable deployment / route readiness

The live run materially validated the deployment-propagation hardening introduced by PR #344.

A single successful probe was **not** sufficient. During propagation, requests alternated between the previous and new Worker source across `/api/version`, `/api/health`, and `/api/journal-restore`. The gate reset its consecutive-pass counter whenever any endpoint was served by the wrong source or contract.

The deployment reached the required **3 consecutive full-contract passes only after 11 attempts**.

This is direct production-like staging evidence that the earlier 404 was a Cloudflare serving-edge propagation race rather than a defect in the restore transaction semantics. The stable-readiness gate prevented credentials and mutations from running until route identity was stable.

### Authenticated restore smoke

After stable readiness, the workflow minted a fresh short-lived Google ID token for the isolated staging restore identity and verified all of the following against the live staging Worker/D1:

1. atomic restore into an empty tenant;
2. authoritative transaction and cash-event readback;
3. restored row counts and reviewed durable fields matched the synthetic backup;
4. same-intent / same-key replay was deduplicated without adding rows;
5. same-key / changed-payload retry failed closed with idempotency conflict;
6. a second restore intent against a non-empty destination failed closed;
7. unconditional owned-data cleanup returned the isolated tenant to empty;
8. replay after cleanup remained a no-op because the completed restore session stayed authoritative;
9. the temporary credential file was removed;
10. live staging browser-origin isolation passed.

The workflow reported:

`Staging journal restore verified at c1c7c2895c297372981dac2898131c7727d44e9a: atomic create, authoritative readback, replay deduplication, conflict/non-empty blocking, and cleanup all passed`

No production tenant journal was used for this write smoke.

## PR / CI chain

The final propagation/root-cause hardening was PR #344: `fix: require stable staging restore route readiness`.

- frozen exact head: `1f5a5c67265464949c2358961f9cf385a673948a`
- exact-head CI #1170: **SUCCESS**
- frozen independent review: **PASS / BLOCKER 0 / FOLLOW-UP 0**
- merged main: `c1c7c2895c297372981dac2898131c7727d44e9a`
- post-main CI #1171: **SUCCESS**
- Pages #1624: **SUCCESS**

## Product boundary after closeout

Backend/staging recoverability is now proven, but the current `JournalRestoreButton.vue` intentionally remains preview-only and tells the user that execution will be opened in the next safe slice.

Therefore the next Primary Active Batch is:

**R3.1C — Restore Execution UX + Production Capability Activation**

R3.1C must not simply enable the existing disabled button. Before user-facing mutation is activated it must establish live production Worker route capability, preserve one idempotency generation across ambiguous retries, require explicit final confirmation, perform authoritative post-restore refetch, and trigger normal recalculation rather than import derived analytics.

## Non-blocking follow-up

The staging Wrangler/template path still contains older displayed release/API/schema constants in some configuration text while the canonical manifest and live readiness contract are `4.12 / 2.65 / 3`. The successful exact-source runtime proof shows this was not the restore failure root cause. Treat it as bounded metadata-drift debt and do not let it displace R3.1C product work unless it creates a user-visible or deployment-correctness failure.
