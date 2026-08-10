import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { validateProductionRuntimePreconditions } from "../tools/verify_production_runtime_preconditions.mjs";

const verified = {
  production: {
    d1_identity_status: "verified",
    d1_database_name: "production-db",
    d1_database_id_sha256: "a".repeat(64),
  },
  staging: {
    d1_database_name: "trading-journal-staging",
  },
};

test("tracked production runtime preconditions follow the declared D1 authority state", async () => {
  const contract = JSON.parse(await readFile("config/deployment-environments.json", "utf8"));
  const result = validateProductionRuntimePreconditions(contract);

  if (contract.production.d1_identity_status === "unverified") {
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /D1 identity is not verified/);
    return;
  }

  assert.equal(contract.production.d1_identity_status, "verified");
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("runtime source becomes deployable only with reviewed D1 name and UUID fingerprint", () => {
  assert.equal(validateProductionRuntimePreconditions(verified).ok, true);

  const missingFingerprint = validateProductionRuntimePreconditions({
    ...verified,
    production: { ...verified.production, d1_database_id_sha256: null },
  });
  assert.equal(missingFingerprint.ok, false);
  assert.match(missingFingerprint.errors.join("\n"), /UUID SHA-256 fingerprint/);

  const stagingCollision = validateProductionRuntimePreconditions({
    ...verified,
    production: { ...verified.production, d1_database_name: "trading-journal-staging" },
  });
  assert.equal(stagingCollision.ok, false);
  assert.match(stagingCollision.errors.join("\n"), /must differ/);
});

test("production workflow enforces runtime preconditions before reviewer and after approval", async () => {
  const workflow = await readFile(".github/workflows/deploy-worker.yml", "utf8");
  const preflightIndex = workflow.indexOf("  preflight:");
  const deployIndex = workflow.indexOf("  deploy:");
  const preflight = workflow.slice(preflightIndex, deployIndex);
  const deploy = workflow.slice(deployIndex);

  assert.match(preflight, /Verify deployable production runtime preconditions/);
  assert.match(preflight, /node tools\/verify_production_runtime_preconditions\.mjs/);
  assert.match(deploy, /Re-verify deployable production runtime preconditions/);
  assert.match(deploy, /node tools\/verify_production_runtime_preconditions\.mjs/);

  const preflightRuntime = preflight.indexOf("Verify deployable production runtime preconditions");
  const preflightAuthority = preflight.indexOf("Verify production activation authority from protected main control plane");
  assert.ok(preflightRuntime >= 0 && preflightRuntime < preflightAuthority);

  const deployRuntime = deploy.indexOf("Re-verify deployable production runtime preconditions");
  const protectedConfig = deploy.indexOf("Verify protected deployment configuration");
  assert.ok(deployRuntime >= 0 && deployRuntime < protectedConfig);
});
