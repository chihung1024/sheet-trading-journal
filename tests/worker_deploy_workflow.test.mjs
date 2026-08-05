import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("production deploy workflow retries operational endpoints across propagation", async () => {
  const workflow = await readFile(".github/workflows/deploy-worker.yml", "utf8");

  assert.match(workflow, /source_sha:/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /git merge-base --is-ancestor/);
  assert.match(workflow, /fetch_until_200\(\)/);
  assert.match(workflow, /for attempt in \$\(seq 1 20\)/);
  assert.match(workflow, /--write-out '%\{http_code\}'/);
  assert.match(workflow, /fetch_until_200 \/api\/version/);
  assert.match(workflow, /fetch_until_200 \/api\/health/);
  assert.match(workflow, /version\.schema_version !== 1/);
  assert.match(workflow, /health\.observed_schema_version !== 1/);
  assert.doesNotMatch(
    workflow,
    /curl --fail --silent --show-error --retry 5/,
    "HTTP 404 propagation responses must be retried explicitly",
  );
});
