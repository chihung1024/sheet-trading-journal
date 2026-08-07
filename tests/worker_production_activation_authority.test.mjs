import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  validateProductionActivationAuthority,
  validateProductionActivationEvidence,
} from "../tools/verify_production_activation_authority.mjs";

const SHA = "1234567890abcdef1234567890abcdef12345678";
const checks = {
  production_frontend_explicit_environment: "pending",
  production_frontend_live_contract: "pending",
  production_d1_identity: "pending",
};

const blocked = {
  schema_version: 1,
  authority_id: "PRODUCTION-ACTIVATION-AUTHORITY",
  status: "blocked",
  authorized_source_sha: null,
  approved_at: null,
  required_checks: checks,
  evidence: {},
};

test("current blocked authority is structurally valid but cannot authorize production", () => {
  const structure = validateProductionActivationAuthority({ authority: blocked, requestedSha: SHA, requireReady: false });
  assert.equal(structure.ok, true);

  const deploy = validateProductionActivationAuthority({ authority: blocked, requestedSha: SHA, requireReady: true });
  assert.equal(deploy.ok, false);
  assert.match(deploy.errors.join("\n"), /production activation is blocked/);
});

test("ready authority must authorize the exact requested source and every required check", () => {
  const authority = {
    ...blocked,
    status: "ready",
    authorized_source_sha: SHA,
    approved_at: "2026-08-07T09:00:00.000Z",
    required_checks: Object.fromEntries(Object.keys(checks).map((key) => [key, "passed"])),
    evidence: Object.fromEntries(
      Object.keys(checks).map((key) => [key, `docs/governance/evidence/production-activation/${key}.json`]),
    ),
  };
  assert.equal(validateProductionActivationAuthority({ authority, requestedSha: SHA }).ok, true);
  const wrongSha = validateProductionActivationAuthority({
    authority,
    requestedSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  });
  assert.equal(wrongSha.ok, false);
  assert.match(wrongSha.errors.join("\n"), /not the authorized production source/);
});

test("activation evidence is bound to check name, source SHA, time, and proof", () => {
  const authority = {
    ...blocked,
    status: "ready",
    authorized_source_sha: SHA,
    approved_at: "2026-08-07T09:00:00.000Z",
  };
  const valid = {
    schema_version: 1,
    check_name: "production_d1_identity",
    status: "passed",
    observed_at: "2026-08-07T08:55:00.000Z",
    source_sha: SHA,
    proof: {
      result: "pass",
      summary: "Read-only Cloudflare D1 identity matched the reviewed authority.",
      artifact_reference: "run:123",
    },
  };
  assert.equal(
    validateProductionActivationEvidence({ document: valid, checkName: "production_d1_identity", authority }).ok,
    true,
  );
  const invalid = validateProductionActivationEvidence({
    document: { ...valid, source_sha: "a".repeat(40), proof: { result: "fail" } },
    checkName: "production_d1_identity",
    authority,
  });
  assert.equal(invalid.ok, false);
});

test("production deployment workflow performs control-plane preflight before reviewer job", async () => {
  const workflow = await readFile(".github/workflows/deploy-worker.yml", "utf8");
  const preflightIndex = workflow.indexOf("  preflight:");
  const deployIndex = workflow.indexOf("  deploy:");
  assert.ok(preflightIndex >= 0 && deployIndex > preflightIndex);
  const preflight = workflow.slice(preflightIndex, deployIndex);
  const deploy = workflow.slice(deployIndex);

  assert.doesNotMatch(preflight, /environment: production/);
  assert.match(preflight, /git worktree add --detach .* refs\/remotes\/origin\/main/);
  assert.match(preflight, /production-control-plane-preflight/);
  assert.match(preflight, /verify_production_activation_authority\.mjs/);

  assert.match(deploy, /needs: preflight/);
  assert.match(deploy, /environment: production/);
  assert.match(deploy, /production-control-plane-after-approval/);
  assert.match(deploy, /git worktree add --detach .* refs\/remotes\/origin\/main/);
  assert.match(deploy, /Re-verify production activation authority from latest protected main/);
});

test("runtime source and production authority remain separate control planes", async () => {
  const workflow = await readFile(".github/workflows/deploy-worker.yml", "utf8");
  assert.match(workflow, /Checkout exact requested runtime source/);
  assert.match(workflow, /refs\/remotes\/origin\/main/);
  assert.match(workflow, /EXPECTED_SHA="\$REQUESTED_SHA" node tools\/verify_production_activation_authority\.mjs/);
});
