import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("production deploy workflow waits for the expected semantic deployment", async () => {
  const workflow = await readFile(".github/workflows/deploy-worker.yml", "utf8");

  assert.match(workflow, /source_sha:/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /git merge-base --is-ancestor/);
  assert.match(workflow, /wait_for_expected_deployment\(\)/);
  assert.match(workflow, /for attempt in \$\(seq 1 20\)/);
  assert.match(workflow, /--write-out '%\{http_code\}'/);
  assert.match(workflow, /WORKER_BASE_URL\/api\/version/);
  assert.match(workflow, /WORKER_BASE_URL\/api\/health/);
  assert.match(workflow, /node tools\/verify_worker_deployment\.mjs/);
  assert.match(workflow, /EXPECTED_RELEASE_VERSION: '4\.05'/);
  assert.match(workflow, /EXPECTED_API_VERSION: '2\.57'/);
  assert.match(workflow, /EXPECTED_SCHEMA_VERSION: '1'/);
  assert.doesNotMatch(
    workflow,
    /fetch_until_200/,
    "HTTP 200 alone is insufficient while an older Worker version is still propagating",
  );
});
