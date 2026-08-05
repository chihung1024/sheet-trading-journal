import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("Worker manifest exporter emits validated deployment expectations", async () => {
  const directory = await mkdtemp(join(tmpdir(), "worker-manifest-export-"));
  const output = join(directory, "github-output.txt");
  try {
    const result = spawnSync(process.execPath, ["tools/export_worker_manifest.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, GITHUB_OUTPUT: output },
    });
    assert.equal(result.status, 0, result.stderr);
    const content = await readFile(output, "utf8");
    assert.match(content, /^release_version=4\.07$/m);
    assert.match(content, /^api_version=2\.60$/m);
    assert.match(content, /^schema_version=2$/m);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Worker manifest exporter fails closed for malformed metadata", async () => {
  const directory = await mkdtemp(join(tmpdir(), "worker-manifest-invalid-"));
  const manifest = join(directory, "manifest.json");
  const output = join(directory, "github-output.txt");
  try {
    await writeFile(manifest, JSON.stringify({ releaseVersion: "latest", apiVersion: "2.59", schemaVersion: 1 }), "utf8");
    const result = spawnSync(process.execPath, ["tools/export_worker_manifest.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_OUTPUT: output,
        WORKER_MANIFEST_PATH: manifest,
      },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /releaseVersion is invalid/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("production deploy workflow derives readiness versions from the manifest", async () => {
  const workflow = await readFile(".github/workflows/deploy-worker.yml", "utf8");
  assert.match(workflow, /id: manifest/);
  assert.match(workflow, /node tools\/export_worker_manifest\.mjs/);
  assert.match(workflow, /EXPECTED_RELEASE_VERSION: \$\{\{ steps\.manifest\.outputs\.release_version \}\}/);
  assert.match(workflow, /EXPECTED_API_VERSION: \$\{\{ steps\.manifest\.outputs\.api_version \}\}/);
  assert.match(workflow, /EXPECTED_SCHEMA_VERSION: \$\{\{ steps\.manifest\.outputs\.schema_version \}\}/);
  assert.doesNotMatch(workflow, /EXPECTED_RELEASE_VERSION: ['\"]4\.05['\"]/);
  assert.doesNotMatch(workflow, /EXPECTED_API_VERSION: ['\"]2\.57['\"]/);
});
