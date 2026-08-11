import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_SHA = "fe5f091fdb2c92970dff74c1a7c99052084adb95";

test("production deployment request is exact, auditable, and schema-1", async () => {
  const request = JSON.parse(await readFile("config/production-deployment-request.json", "utf8"));
  assert.equal(request.schema_version, 1);
  assert.match(request.request_id, /^[A-Za-z0-9._-]{8,128}$/);
  assert.equal(request.source_sha, SOURCE_SHA);
  assert.match(request.source_sha, /^[0-9a-f]{40}$/);
  assert.equal(Number.isFinite(Date.parse(request.requested_at)), true);
  assert.equal(typeof request.reason, "string");
  assert.ok(request.reason.trim().length > 0);
});

test("dispatch broker is main-only, least-privilege, authority-gated, and cannot deploy directly", async () => {
  const workflow = await readFile(".github/workflows/production-deployment-dispatch.yml", "utf8");

  assert.match(workflow, /push:/);
  assert.match(workflow, /branches:\s*\n\s*- main/);
  assert.match(workflow, /config\/production-deployment-request\.json/);
  assert.match(workflow, /contents:\s*read/);
  assert.match(workflow, /actions:\s*write/);
  assert.doesNotMatch(workflow, /contents:\s*write/);
  assert.doesNotMatch(workflow, /environment:\s*production/);
  assert.doesNotMatch(workflow, /secrets\./);

  assert.match(workflow, /event SHA is no longer protected-main HEAD/);
  assert.match(workflow, /git merge-base --is-ancestor/);
  assert.match(workflow, /verify_production_activation_authority\.mjs/);
  assert.match(workflow, /EXPECTED_SHA="\$source_sha"/);

  assert.match(workflow, /actions\/workflows\/deploy-worker\.yml\/dispatches/);
  assert.match(workflow, /X-GitHub-Api-Version: 2026-03-10/);
  assert.match(workflow, /workflow_run_id/);
  assert.match(workflow, /status" != "200"/);
  assert.match(workflow, /github\.token/);

  assert.doesNotMatch(workflow, /wrangler\s+d1\s+migrations\s+apply/);
  assert.doesNotMatch(workflow, /worker:deploy/);
  assert.doesNotMatch(workflow, /CLOUDFLARE_API_TOKEN/);
});

test("canonical deploy workflow retains reviewer-protected production mutation gates", async () => {
  const deploy = await readFile(".github/workflows/deploy-worker.yml", "utf8");
  assert.match(deploy, /workflow_dispatch:/);
  assert.match(deploy, /environment:\s*production/);
  assert.match(deploy, /Verify production activation authority from protected main control plane/);
  assert.match(deploy, /Final activation authority check before remote D1 mutation/);
  assert.match(deploy, /Final activation authority check before Worker deploy/);
  assert.match(deploy, /Apply additive D1 migrations/);
  assert.match(deploy, /Deploy canonical Worker source/);
  assert.match(deploy, /Wait for stable post-deploy production contract/);
});
