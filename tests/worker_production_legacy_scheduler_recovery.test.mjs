import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  executeRecovery,
  inspectTarget,
  validateRequest,
} from "../tools/recover_stuck_reconciliation_run.mjs";

const request = {
  schema_version: 1,
  status: "ready",
  operation: "e1c_a1_cancel_stuck_scheduler_run",
  target_run_id: 31479868929,
  target_production_job_id: 93742148875,
  expected_head_sha: "8f9f942cc22b70e5bbec0f05438b0a74fefb8057",
  expected_workflow_path: ".github/workflows/production-legacy-job-reconciliation.yml",
  reason: "Cancel only the reviewed scheduler-stuck run without weakening any production mutation boundary.",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeFetch({ runnerAssigned = false, productionSteps = [], terminalAfterCancel = false } = {}) {
  let cancelled = false;
  return async (url, options = {}) => {
    const parsed = new URL(url);
    if (options.method === "POST" && parsed.pathname.endsWith(`/actions/runs/${request.target_run_id}/cancel`)) {
      cancelled = true;
      return new Response("", { status: 202 });
    }
    if (parsed.pathname.endsWith(`/actions/runs/${request.target_run_id}`)) {
      if (cancelled && terminalAfterCancel) {
        return jsonResponse({
          status: "completed",
          conclusion: "cancelled",
          head_sha: request.expected_head_sha,
          path: request.expected_workflow_path,
          run_attempt: 1,
        });
      }
      return jsonResponse({
        status: "queued",
        conclusion: null,
        head_sha: request.expected_head_sha,
        path: request.expected_workflow_path,
        run_attempt: 1,
      });
    }
    if (parsed.pathname.endsWith(`/actions/runs/${request.target_run_id}/pending_deployments`)) {
      return jsonResponse([]);
    }
    if (parsed.pathname.endsWith(`/actions/runs/${request.target_run_id}/jobs`)) {
      return jsonResponse({
        jobs: [
          {
            id: 93742107150,
            name: "Verify reconciliation request before reviewer gate",
            status: "completed",
            conclusion: "success",
          },
          {
            id: request.target_production_job_id,
            name: "Reconcile legacy unbound queued jobs and audit production",
            status: "queued",
            conclusion: null,
            runner_id: runnerAssigned ? 42 : null,
            runner_name: runnerAssigned ? "runner" : null,
            steps: productionSteps,
          },
        ],
      });
    }
    if (parsed.pathname.endsWith("/actions/concurrency_groups/production-legacy-job-reconciliation")) {
      return jsonResponse({
        group_name: "production-legacy-job-reconciliation",
        total_count: 1,
        group_members: [{ run_id: request.target_run_id, status: "in_progress" }],
      });
    }
    throw new Error(`Unexpected mock GitHub request: ${options.method || "GET"} ${url}`);
  };
}

test("scheduler recovery request is exact and bounded", () => {
  assert.deepEqual(validateRequest(request), {
    target_run_id: request.target_run_id,
    target_production_job_id: request.target_production_job_id,
    expected_head_sha: request.expected_head_sha,
    expected_workflow_path: request.expected_workflow_path,
  });
  assert.throws(() => validateRequest({ ...request, target_run_id: -1 }), /target_run_id/);
  assert.throws(() => validateRequest({ ...request, expected_workflow_path: ".github/workflows/other.yml" }), /not authorized/);
});

test("inspection accepts only an approved run that never acquired a runner", async () => {
  const result = await inspectTarget({
    token: "test-token",
    repository: "chihung1024/sheet-trading-journal",
    request,
    fetchImpl: makeFetch(),
  });
  assert.equal(result.runner_assigned, false);
  assert.equal(result.execution_steps_started, false);
  assert.equal(result.pending_deployments, 0);
  assert.equal(result.concurrency_group_member_count, 1);
});

test("inspection refuses cancellation after runner assignment or step start", async () => {
  await assert.rejects(
    inspectTarget({
      token: "test-token",
      repository: "chihung1024/sheet-trading-journal",
      request,
      fetchImpl: makeFetch({ runnerAssigned: true }),
    }),
    /already has a runner/,
  );
  await assert.rejects(
    inspectTarget({
      token: "test-token",
      repository: "chihung1024/sheet-trading-journal",
      request,
      fetchImpl: makeFetch({ productionSteps: [{ name: "Set up job", status: "in_progress" }] }),
    }),
    /execution steps/,
  );
});

test("execute performs two observations before cancel and requires cancelled terminal state", async () => {
  const result = await executeRecovery({
    token: "test-token",
    repository: "chihung1024/sheet-trading-journal",
    request,
    fetchImpl: makeFetch({ terminalAfterCancel: true }),
    sleepImpl: async () => {},
  });
  assert.equal(result.cancel_http_status, 202);
  assert.equal(result.terminal_status, "completed");
  assert.equal(result.terminal_conclusion, "cancelled");
});

test("scheduler recovery workflow has no production execution secrets or environment", () => {
  const workflow = readFileSync(
    ".github/workflows/production-legacy-reconciliation-scheduler-recovery.yml",
    "utf8",
  );
  assert.match(workflow, /actions: write/);
  assert.match(workflow, /contents: read/);
  assert.doesNotMatch(workflow, /environment:\s*production/);
  assert.doesNotMatch(workflow, /CLOUDFLARE_|API_KEY|secrets\./);
  assert.match(workflow, /recover_stuck_reconciliation_run\.mjs execute/);
});
