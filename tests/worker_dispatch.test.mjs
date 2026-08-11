import test from "node:test";
import assert from "node:assert/strict";
import { __test } from "../worker.js";

const JOB_ID = "job_ABCDEFGHIJKLMNOPQRSTUV";

test("dispatch request exposes only opaque calculation targeting", () => {
  const request = __test.buildGitHubDispatchRequest({
    token: "secret-token",
    benchmark: "0050.TW",
    jobId: JOB_ID,
  });
  assert.equal(
    request.url,
    "https://api.github.com/repos/chihung1024/sheet-trading-journal/actions/workflows/update.yml/dispatches",
  );
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers.Authorization, "Bearer secret-token");
  assert.equal(request.init.headers["X-GitHub-Api-Version"], "2026-03-10");
  const body = JSON.parse(request.init.body);
  assert.deepEqual(body, {
    ref: "main",
    inputs: { custom_benchmark: "0050.TW", calculation_job_id: JOB_ID },
  });
  assert.equal("target_user_id" in body.inputs, false);
  assert.equal(request.init.body.includes("@"), false);
});

test("dispatch requires GitHub 200 run binding without tenant identity", async () => {
  let dispatchedBody = null;
  const result = await __test.dispatchGitHubWorkflow({
    token: "secret-token",
    benchmark: "SPY",
    jobId: JOB_ID,
    fetchImpl: async (_url, init) => {
      dispatchedBody = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "X-GitHub-Request-Id": "ABC1:DEF2" }),
        json: async () => ({ workflow_run_id: 31460959779 }),
      };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.githubRequestId, "ABC1:DEF2");
  assert.equal(result.workflowRunId, "31460959779");
  assert.deepEqual(dispatchedBody.inputs, {
    custom_benchmark: "SPY",
    calculation_job_id: JOB_ID,
  });
  assert.equal(JSON.stringify(dispatchedBody).includes("@"), false);
});

test("dispatch fails closed on legacy 204 or invalid 200 response", async () => {
  for (const response of [
    { ok: true, status: 204, headers: new Headers(), json: async () => ({}) },
    { ok: true, status: 200, headers: new Headers(), json: async () => ({}) },
    { ok: true, status: 200, headers: new Headers(), json: async () => ({ workflow_run_id: 0 }) },
  ]) {
    const result = await __test.dispatchGitHubWorkflow({
      token: "secret-token",
      benchmark: "SPY",
      jobId: JOB_ID,
      fetchImpl: async () => response,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "GITHUB_DISPATCH_INVALID_RESPONSE");
  }
});

test("dispatch rejects missing opaque job target", () => {
  assert.throws(
    () => __test.buildGitHubDispatchRequest({ token: "secret-token", benchmark: "SPY" }),
    /calculation job ID|invalid/i,
  );
});

test("dispatch classifies GitHub failures", () => {
  const cases = new Map([
    [401, "GITHUB_AUTH_FAILED"], [403, "GITHUB_PERMISSION_DENIED"],
    [404, "GITHUB_WORKFLOW_NOT_FOUND"], [422, "GITHUB_DISPATCH_REJECTED"],
    [429, "GITHUB_RATE_LIMITED"], [500, "GITHUB_UNAVAILABLE"],
  ]);
  for (const [status, code] of cases) {
    assert.equal(__test.classifyGitHubDispatchFailure(status).code, code);
  }
});

test("dispatch requires the GitHub token secret", () => {
  assert.throws(
    () => __test.buildGitHubDispatchRequest({ token: "", benchmark: "SPY", jobId: JOB_ID }),
    /token is required/,
  );
});
