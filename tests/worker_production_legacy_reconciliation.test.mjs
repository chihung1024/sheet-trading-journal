import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/production-legacy-job-reconciliation.yml", "utf8");
const request = JSON.parse(
  readFileSync("config/production-legacy-job-reconciliation-request.json", "utf8"),
);
const tool = readFileSync("tools/reconcile_legacy_calculation_jobs.mjs", "utf8");

test("reconciliation starts from reviewed protected-main request and retains production reviewer gate", () => {
  assert.match(workflow, /paths:\s*\n\s+- config\/production-legacy-job-reconciliation-request\.json/);
  assert.match(workflow, /permissions:\s*\n\s+contents: read\s*\n\s+actions: read/);
  assert.doesNotMatch(workflow, /:\s*write\s*$/m);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /event SHA is no longer protected-main HEAD/);
  assert.match(workflow, /verify_production_activation_authority\.mjs/);
});

test("workflow proves absence of live update runs repeatedly and again immediately before mutation", () => {
  assert.match(workflow, /actions\/workflows\/update\.yml\/runs\?per_page=100/g);
  assert.match(workflow, /for attempt in \$\(seq 1 3\)/);
  assert.match(workflow, /run\.status !== 'completed'/);
  const finalCheck = workflow.indexOf("Final authority and active-run check before production D1 mutation");
  const mutation = workflow.indexOf("Reconcile only legacy queued jobs without durable dispatch identity");
  assert.ok(finalCheck >= 0 && mutation > finalCheck);
  assert.match(workflow, /X-GitHub-Api-Version: 2026-03-10/);
});

test("request is exact-source, bounded, and tied to the verified deployment", () => {
  assert.equal(request.schema_version, 1);
  assert.equal(request.status, "ready");
  assert.equal(request.operation, "e1c_a1_legacy_unbound_queued_reconciliation");
  assert.equal(request.expected_runtime_source, "fe5f091fdb2c92970dff74c1a7c99052084adb95");
  assert.equal(request.deployment_run_id, 31475347673);
  assert.equal(request.worker_version_id, "68f32cee-c609-4624-aaff-eaa55ef0c77d");
  assert.match(request.legacy_created_before_utc, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.ok(request.max_rows >= 1 && request.max_rows <= 25);
});

test("D1 mutation is narrow, terminal, idempotent, and records no tenant/job identity", () => {
  assert.match(tool, /status = 'queued' AND github_run_id IS NULL AND created_at < '\$\{cutoff\}'/);
  assert.match(tool, /SET status = 'failed'/);
  assert.match(tool, /LEGACY_DISPATCH_UNBOUND_RECONCILED/);
  assert.match(tool, /target row count \$\{before\} exceeds reviewed max_rows/);
  assert.match(tool, /target_rows_after/);
  assert.match(tool, /tenant_identity_recorded: false/);
  assert.match(tool, /calculation_job_ids_recorded: false/);
  assert.doesNotMatch(tool, /\bDELETE\s+FROM\s+calculation_jobs\b/i);
  assert.doesNotMatch(tool, /\bUPDATE\s+(records|portfolio_snapshots|user_settings)\b/i);
});

test("same production approval also performs system contract audit and uploads sanitized evidence", () => {
  assert.match(workflow, /REQUIRE_SYSTEM_CHECKS: '1'/);
  assert.match(workflow, /production-contract-audit\.json/);
  assert.match(workflow, /production-e1c-a1-legacy-reconciliation\.json/);
  assert.match(workflow, /actions\/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f # v6/);
});
