import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ACTIVE_WORKFLOW_RUN_STATUSES,
  checkGitHubActiveRuns,
  validateRequest,
} from "../tools/reconcile_legacy_calculation_jobs.mjs";

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

test("production mutation executes the immutable reviewed operation code, not the older runtime checkout", () => {
  assert.match(workflow, /Materialize immutable reviewed reconciliation control plane/);
  assert.match(workflow, /REVIEWED_CONTROL_PLANE_SHA: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /reviewed_tool_sha/);
  assert.match(workflow, /latest_tool_sha/);
  assert.match(workflow, /reviewed_workflow_sha/);
  assert.match(workflow, /latest_workflow_sha/);
  assert.match(
    workflow,
    /run: node "\$RUNNER_TEMP\/e1c-a1-reviewed-control-plane\/tools\/reconcile_legacy_calculation_jobs\.mjs" execute/,
  );
  assert.doesNotMatch(workflow, /run: node tools\/reconcile_legacy_calculation_jobs\.mjs execute/);
});

test("active-run proof queries every supported nonterminal workflow status without first-page inference", async () => {
  assert.deepEqual(ACTIVE_WORKFLOW_RUN_STATUSES, [
    "queued",
    "in_progress",
    "waiting",
    "pending",
    "requested",
  ]);
  const observed = [];
  const fetchImpl = async (url) => {
    observed.push({ status: url.searchParams.get("status"), perPage: url.searchParams.get("per_page") });
    return { ok: true, status: 200, json: async () => ({ total_count: 0, workflow_runs: [] }) };
  };
  const counts = await checkGitHubActiveRuns({
    token: "test-token",
    repository: "owner/repo",
    fetchImpl,
  });
  assert.deepEqual(observed, ACTIVE_WORKFLOW_RUN_STATUSES.map((status) => ({ status, perPage: "1" })));
  assert.deepEqual(Object.keys(counts), ACTIVE_WORKFLOW_RUN_STATUSES);
  assert.doesNotMatch(workflow, /runs\?per_page=100/);
  assert.match(workflow, /check-github-active-runs/g);
});

test("active-run proof fails closed on a nonterminal run or GitHub API failure", async () => {
  const oneWaiting = async (url) => ({
    ok: true,
    status: 200,
    json: async () => ({ total_count: url.searchParams.get("status") === "waiting" ? 1 : 0 }),
  });
  await assert.rejects(
    checkGitHubActiveRuns({ token: "test-token", repository: "owner/repo", fetchImpl: oneWaiting }),
    /waiting=1/,
  );

  const unavailable = async () => ({ ok: false, status: 503, json: async () => ({}) });
  await assert.rejects(
    checkGitHubActiveRuns({ token: "test-token", repository: "owner/repo", fetchImpl: unavailable }),
    /HTTP 503/,
  );
});

test("request is exact-source, bounded, and tied to the verified deployment", () => {
  const outputs = validateRequest(request);
  assert.equal(request.schema_version, 1);
  assert.equal(request.status, "ready");
  assert.equal(request.operation, "e1c_a1_legacy_unbound_queued_reconciliation");
  assert.equal(outputs.source_sha, "fe5f091fdb2c92970dff74c1a7c99052084adb95");
  assert.equal(outputs.deployment_run_id, "31475347673");
  assert.equal(outputs.worker_version_id, "68f32cee-c609-4624-aaff-eaa55ef0c77d");
  assert.match(outputs.cutoff_utc, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.ok(Number(outputs.max_rows) >= 1 && Number(outputs.max_rows) <= 25);
});

test("latest request and operation code are rechecked again immediately before mutation", () => {
  const finalGate = workflow.indexOf("Final request, operation-code, authority, and active-run check before production D1 mutation");
  const mutation = workflow.indexOf("Reconcile only legacy queued jobs without durable dispatch identity");
  assert.ok(finalGate >= 0 && mutation > finalGate);
  const finalBlock = workflow.slice(finalGate, mutation);
  assert.match(finalBlock, /production-legacy-job-reconciliation-request\.json/);
  assert.match(finalBlock, /reviewed_tool_sha/);
  assert.match(finalBlock, /reviewed_workflow_sha/);
  assert.match(finalBlock, /verify_production_activation_authority\.mjs/);
  assert.match(finalBlock, /check-github-active-runs/);
});

test("D1 mutation is narrow, cardinality-verified, terminal, idempotent, and records no tenant/job identity", () => {
  assert.match(tool, /status = 'queued' AND github_run_id IS NULL AND created_at < '\$\{cutoff\}'/);
  assert.match(tool, /SET status = 'failed'/);
  assert.match(tool, /LEGACY_DISPATCH_UNBOUND_RECONCILED/);
  assert.match(tool, /target row count \$\{before\} exceeds reviewed max_rows/);
  assert.match(tool, /SELECT changes\(\) AS changed/);
  assert.match(tool, /changed !== before/);
  assert.match(tool, /mutation_changes: changed/);
  assert.match(tool, /target_rows_after: after/);
  assert.match(tool, /tenant_identity_recorded: false/);
  assert.match(tool, /calculation_job_ids_recorded: false/);
  assert.doesNotMatch(tool, /\bDELETE\s+FROM\s+calculation_jobs\b/i);
  assert.doesNotMatch(tool, /\bUPDATE\s+(records|portfolio_snapshots|user_settings)\b/i);
});

test("same production approval verifies live worker identity, runs system audit, and uploads sanitized evidence", () => {
  assert.match(workflow, /Verify live Worker version matches reviewed deployment evidence/);
  assert.match(workflow, /EXPECTED_WORKER_VERSION_ID/);
  assert.match(workflow, /REQUIRE_SYSTEM_CHECKS: '1'/);
  assert.match(workflow, /production-pre-reconciliation-contract\.json/);
  assert.match(workflow, /production-contract-audit\.json/);
  assert.match(workflow, /production-e1c-a1-legacy-reconciliation\.json/);
  assert.match(workflow, /actions\/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f # v6/);
});
