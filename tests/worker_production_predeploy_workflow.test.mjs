import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const WORKFLOW = ".github/workflows/production-predeploy-readonly.yml";

test("production predeploy workflow is one-shot on main and PR-safe", async () => {
  const workflow = await readFile(WORKFLOW, "utf8");
  assert.match(workflow, /name: Production Predeploy Read-Only Evidence/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:[\s\S]*branches:[\s\S]*- main[\s\S]*paths:[\s\S]*production-predeploy-evidence-request\.json/);

  const publicIndex = workflow.indexOf("  public-production-proof:");
  const cloudflareIndex = workflow.indexOf("  cloudflare-control-plane-proof:");
  assert.ok(publicIndex >= 0 && cloudflareIndex > publicIndex);
  const publicJob = workflow.slice(publicIndex, cloudflareIndex);
  const cloudflareJob = workflow.slice(cloudflareIndex);

  assert.doesNotMatch(publicJob, /environment: production/);
  assert.doesNotMatch(publicJob, /secrets\./);
  assert.match(cloudflareJob, /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(cloudflareJob, /needs: public-production-proof/);
  assert.match(cloudflareJob, /environment: production/);
});

test("Cloudflare control-plane workflow contains only read operations", async () => {
  const workflow = await readFile(WORKFLOW, "utf8");
  assert.doesNotMatch(workflow, /\b(?:POST|PUT|PATCH|DELETE)\b/);
  assert.doesNotMatch(workflow, /--request\s+/);
  assert.doesNotMatch(workflow, /wrangler\s+deploy/);
  assert.doesNotMatch(workflow, /d1\s+migrations/);
  assert.doesNotMatch(workflow, /secret\s+(?:put|delete)/);
  assert.doesNotMatch(workflow, /gh\s+api\s+--method/);

  assert.match(workflow, /workers\/scripts\/\$WORKER_SCRIPT_NAME\/versions\/\$WORKER_VERSION_ID/);
  assert.match(workflow, /d1\/database\/\$LIVE_D1_DATABASE_ID/);
  assert.match(workflow, /pages\/projects\/\$PAGES_PROJECT_NAME/);
  assert.match(workflow, /deployments\?env=production&per_page=20/);
});

test("workflow uploads sanitized evidence and destroys raw Cloudflare responses", async () => {
  const workflow = await readFile(WORKFLOW, "utf8");
  assert.match(workflow, /path: production-public-evidence\.json/);
  assert.match(workflow, /path: production-cloudflare-evidence\.json/);
  assert.doesNotMatch(workflow, /path: \.evidence-raw/);
  assert.match(workflow, /Destroy raw control-plane responses/);
  assert.match(workflow, /if: always\(\)/);
  assert.match(workflow, /rm -rf \.evidence-raw/);
});

test("request file forbids writes, deployment, migration, and synthetic production transactions", async () => {
  const request = JSON.parse(await readFile("config/production-predeploy-evidence-request.json", "utf8"));
  assert.equal(request.status, "requested");
  assert.equal(request.writes_allowed, false);
  assert.equal(request.production_deployment_allowed, false);
  assert.equal(request.d1_migration_allowed, false);
  assert.equal(request.synthetic_production_write_allowed, false);
  assert.equal(request.baseline_main_sha, "6bf0f4002ac6ed7fead64d49084ac31c1d33fb39");
});

test("control-plane evidence never depends on protected D1 identity secrets", async () => {
  const workflow = await readFile(WORKFLOW, "utf8");
  const cloudflareIndex = workflow.indexOf("  cloudflare-control-plane-proof:");
  const cloudflareJob = workflow.slice(cloudflareIndex);
  assert.doesNotMatch(cloudflareJob, /CLOUDFLARE_D1_DATABASE_ID:\s*\$\{\{ secrets\./);
  assert.doesNotMatch(cloudflareJob, /CLOUDFLARE_D1_DATABASE_NAME:\s*\$\{\{ secrets\./);
  assert.match(cloudflareJob, /Derive deployed D1 UUID from live Worker binding/);
  assert.match(cloudflareJob, /Cloudflare D1 metadata/);
});
