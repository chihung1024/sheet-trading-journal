import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("production deploy workflow waits for the exact manifest-declared deployment", async () => {
  const workflow = await readFile(".github/workflows/deploy-worker.yml", "utf8");

  assert.match(workflow, /source_sha:/);
  assert.match(workflow, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /git merge-base --is-ancestor/);
  assert.match(workflow, /id: manifest/);
  assert.match(workflow, /node tools\/export_worker_manifest\.mjs/);
  assert.match(workflow, /npm run worker:recovery-gate:check/);
  assert.match(workflow, /node tools\/verify_d1_identity\.mjs/);
  assert.match(workflow, /wrangler d1 info/);
  assert.match(workflow, /wait_for_expected_deployment\(\)/);
  assert.match(workflow, /for attempt in \$\(seq 1 20\)/);
  assert.match(workflow, /--write-out '%\{http_code\}'/);
  assert.match(workflow, /WORKER_BASE_URL\/api\/version/);
  assert.match(workflow, /WORKER_BASE_URL\/api\/health/);
  assert.match(workflow, /node tools\/verify_worker_deployment\.mjs/);
  assert.match(workflow, /EXPECTED_RUNTIME_SERVICE: \$\{\{ steps\.manifest\.outputs\.runtime_service \}\}/);
  assert.match(workflow, /EXPECTED_RELEASE_VERSION: \$\{\{ steps\.manifest\.outputs\.release_version \}\}/);
  assert.match(workflow, /EXPECTED_API_VERSION: \$\{\{ steps\.manifest\.outputs\.api_version \}\}/);
  assert.match(workflow, /EXPECTED_SCHEMA_VERSION: \$\{\{ steps\.manifest\.outputs\.schema_version \}\}/);
  assert.match(workflow, /Verify post-deploy public auth and CORS contract/);
  assert.match(workflow, /node tools\/verify_production_contract\.mjs/);
  assert.doesNotMatch(workflow, /EXPECTED_RELEASE_VERSION: ['"]\d/);
  assert.doesNotMatch(workflow, /EXPECTED_API_VERSION: ['"]\d/);
  assert.doesNotMatch(
    workflow,
    /fetch_until_200/,
    "HTTP 200 alone is insufficient while an older Worker version is still propagating",
  );
});

test("canonical production Worker config is source-of-truth and deploy is strict", async () => {
  const [config, packageJsonRaw] = await Promise.all([
    readFile("wrangler.toml", "utf8"),
    readFile("package.json", "utf8"),
  ]);
  const packageJson = JSON.parse(packageJsonRaw);

  assert.match(config, /^preview_urls = false$/m);
  assert.match(config, /^keep_vars = false$/m);
  assert.match(config, /^required = \["API_SECRET"\]$/m);
  assert.match(config, /^DEPLOYMENT_ENVIRONMENT = "production"$/m);
  assert.match(config, /^ALLOWED_ORIGINS = "https:\/\/sheet-trading-journal\.pages\.dev,https:\/\/chihung1024\.github\.io"$/m);
  assert.match(config, /^GOOGLE_CLIENT_ID = "951186116587-0ehsmkvlu3uivduc7kjn1jpp9ga7810i\.apps\.googleusercontent\.com"$/m);
  assert.match(packageJson.scripts["worker:deploy"], /wrangler deploy --strict/);
});
