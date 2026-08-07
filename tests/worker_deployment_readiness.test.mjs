import test from "node:test";
import assert from "node:assert/strict";
import { validateWorkerDeployment } from "../tools/verify_worker_deployment.mjs";

const EXPECTED_SHA = "2521f93917122a116af9e28c76060690de0d7f32";
const PREVIOUS_SHA = "1e0ee016efbb5833ded2cb719df4acf5ccd0b2ca";
const EXPECTED_SERVICE = "trading-journal-api";

function readyVersion(overrides = {}) {
  return {
    service: EXPECTED_SERVICE,
    release_version: "4.07",
    api_version: "2.60",
    schema_version: 2,
    source_commit: EXPECTED_SHA,
    worker_version: {
      id: "1e21ab9a-510e-43fe-8c53-dcee33646300",
      tag: "production",
    },
    ...overrides,
  };
}

function readyHealth(overrides = {}) {
  return {
    status: "ok",
    source_commit: EXPECTED_SHA,
    observed_schema_version: 2,
    ...overrides,
  };
}

function validate(version = readyVersion(), health = readyHealth(), overrides = {}) {
  return validateWorkerDeployment({
    version,
    health,
    expectedSha: EXPECTED_SHA,
    expectedService: EXPECTED_SERVICE,
    expectedReleaseVersion: "4.07",
    expectedApiVersion: "2.60",
    expectedSchemaVersion: "2",
    ...overrides,
  });
}

test("semantic deployment readiness accepts the exact expected production build", () => {
  const result = validate();

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.sourceCommit, EXPECTED_SHA);
  assert.equal(
    result.workerVersionId,
    "1e21ab9a-510e-43fe-8c53-dcee33646300",
  );
});

test("semantic deployment readiness rejects HTTP-200 metadata from the previous Worker", () => {
  const result = validate(readyVersion({ source_commit: PREVIOUS_SHA }));

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /source commit has not propagated/);
  assert.match(result.errors.join("\n"), new RegExp(PREVIOUS_SHA));
  assert.match(result.errors.join("\n"), new RegExp(EXPECTED_SHA));
});

test("semantic deployment readiness rejects service identity drift", () => {
  const result = validate(readyVersion({ service: "other-service" }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /runtime service mismatch/);
});

test("semantic deployment readiness rejects unhealthy, stale, advanced, or missing D1 schema", () => {
  const unhealthy = validate(readyVersion(), readyHealth({ status: "degraded" }));
  assert.equal(unhealthy.ok, false);
  assert.match(unhealthy.errors.join("\n"), /health status is not ready/);

  const staleSchema = validate(
    readyVersion(),
    readyHealth({ observed_schema_version: 1 }),
  );
  assert.equal(staleSchema.ok, false);
  assert.match(staleSchema.errors.join("\n"), /observed D1 schema mismatch/);

  const advancedSchema = validate(
    readyVersion(),
    readyHealth({ observed_schema_version: 3 }),
  );
  assert.equal(advancedSchema.ok, false);
  assert.match(advancedSchema.errors.join("\n"), /observed D1 schema mismatch/);

  const missingSchema = validate(
    readyVersion(),
    { status: "ok", source_commit: EXPECTED_SHA },
  );
  assert.equal(missingSchema.ok, false);
  assert.match(
    missingSchema.errors.join("\n"),
    /observed D1 schema is missing or invalid/,
  );
});

test("semantic deployment readiness rejects version and metadata mismatches", () => {
  const result = validate(
    readyVersion({
      release_version: "4.06",
      api_version: "2.59",
      schema_version: 1,
      worker_version: null,
    }),
  );

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /release version mismatch/);
  assert.match(result.errors.join("\n"), /API version mismatch/);
  assert.match(result.errors.join("\n"), /version endpoint schema mismatch/);
  assert.match(result.errors.join("\n"), /Worker version ID is missing/);
});

test("semantic deployment readiness rejects health source mismatch", () => {
  const result = validate(readyVersion(), readyHealth({ source_commit: PREVIOUS_SHA }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /health source commit mismatch/);
});

test("semantic deployment readiness fails closed for malformed expectations and payloads", () => {
  const result = validateWorkerDeployment({
    version: null,
    health: [],
    expectedSha: "short-sha",
    expectedService: "",
    expectedReleaseVersion: "",
    expectedApiVersion: "",
    expectedSchemaVersion: "not-a-number",
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /expected source SHA/);
  assert.match(result.errors.join("\n"), /expected runtime service is required/);
  assert.match(result.errors.join("\n"), /expected release version is required/);
  assert.match(result.errors.join("\n"), /expected API version is required/);
  assert.match(result.errors.join("\n"), /expected schema version/);
  assert.match(result.errors.join("\n"), /version response must be a JSON object/);
  assert.match(result.errors.join("\n"), /health response must be a JSON object/);
});
