import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("production deploy workflow requires consecutive full-contract passes before declaring stability", async () => {
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
  assert.match(workflow, /Wait for stable post-deploy production contract/);
  assert.match(workflow, /required_consecutive_passes=3/);
  assert.match(workflow, /max_attempts=20/);
  assert.match(workflow, /for attempt in \$\(seq 1 "\$max_attempts"\)/);
  assert.match(workflow, /if node tools\/verify_production_contract\.mjs; then/);
  assert.match(workflow, /consecutive_passes=\$\(\(consecutive_passes \+ 1\)\)/);
  assert.match(workflow, /Production contract not stable on attempt \$attempt; resetting consecutive-pass counter/);
  assert.match(workflow, /consecutive_passes=0/);
  assert.match(workflow, /rm -f "\$AUDIT_OUTPUT"/);
  assert.match(workflow, /sleep 3/);
  assert.match(workflow, /Stable production contract verified after \$attempt attempts/);
  assert.match(workflow, /EXPECTED_RUNTIME_SERVICE: \$\{\{ steps\.manifest\.outputs\.runtime_service \}\}/);
  assert.match(workflow, /EXPECTED_RELEASE_VERSION: \$\{\{ steps\.manifest\.outputs\.release_version \}\}/);
  assert.match(workflow, /EXPECTED_API_VERSION: \$\{\{ steps\.manifest\.outputs\.api_version \}\}/);
  assert.match(workflow, /EXPECTED_SCHEMA_VERSION: \$\{\{ steps\.manifest\.outputs\.schema_version \}\}/);
  assert.match(workflow, /name: production-post-deploy-\$\{\{ steps\.source\.outputs\.sha \}\}/);
  assert.doesNotMatch(workflow, /wait_for_expected_deployment\(\)/);
  assert.doesNotMatch(workflow, /Verify post-deploy public auth and CORS contract/);
  assert.doesNotMatch(workflow, /EXPECTED_RELEASE_VERSION: ['"]\d/);
  assert.doesNotMatch(workflow, /EXPECTED_API_VERSION: ['"]\d/);
  assert.doesNotMatch(
    workflow,
    /fetch_until_200/,
    "HTTP 200 alone is insufficient while an older Worker version is still propagating",
  );
});

test("stability gate resets after a failed full-contract probe instead of accepting one new-edge hit", async () => {
  const workflow = await readFile(".github/workflows/deploy-worker.yml", "utf8");
  const start = workflow.indexOf("      - name: Wait for stable post-deploy production contract");
  const end = workflow.indexOf("      - name: Upload sanitized post-deploy evidence");
  assert.ok(start >= 0 && end > start, "stability step must precede evidence upload");

  const stability = workflow.slice(start, end);
  const probe = stability.indexOf("if node tools/verify_production_contract.mjs; then");
  const increment = stability.indexOf("consecutive_passes=$((consecutive_passes + 1))");
  const successGate = stability.indexOf("consecutive_passes >= required_consecutive_passes");
  const failure = stability.indexOf("else", increment);
  const reset = stability.indexOf("consecutive_passes=0", failure);

  assert.ok(probe >= 0 && increment > probe && successGate > increment);
  assert.ok(failure > successGate && reset > failure, "any stale-edge/full-contract failure must reset stability progress");
  assert.match(stability, /required_consecutive_passes=3/);
  assert.match(stability, /max_attempts=20/);
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
