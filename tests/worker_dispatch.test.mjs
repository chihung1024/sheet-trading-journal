import test from "node:test";
import assert from "node:assert/strict";
import { __test } from "../worker.js";

test("dispatch request uses canonical repository metadata without runtime owner variables", () => {
  const request = __test.buildGitHubDispatchRequest({
    token: "secret-token",
    benchmark: "0050.TW",
    userEmail: "user@example.com",
  });
  assert.equal(
    request.url,
    "https://api.github.com/repos/chihung1024/sheet-trading-journal/actions/workflows/update.yml/dispatches",
  );
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers.Authorization, "Bearer secret-token");
  assert.deepEqual(JSON.parse(request.init.body), {
    ref: "main",
    inputs: { custom_benchmark: "0050.TW", target_user_id: "user@example.com" },
  });
});

test("dispatch accepts GitHub 204 and records request id without reading response body", async () => {
  let bodyRead = false;
  const result = await __test.dispatchGitHubWorkflow({
    token: "secret-token",
    benchmark: "SPY",
    userEmail: "user@example.com",
    fetchImpl: async () => ({
      ok: true,
      status: 204,
      headers: new Headers({ "X-GitHub-Request-Id": "ABC1:DEF2" }),
      text: async () => { bodyRead = true; },
    }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.githubRequestId, "ABC1:DEF2");
  assert.equal(bodyRead, false);
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

test("dispatch requires only the token secret", () => {
  assert.throws(
    () => __test.buildGitHubDispatchRequest({ token: "", benchmark: "SPY", userEmail: "u@example.com" }),
    /token is required/,
  );
});
