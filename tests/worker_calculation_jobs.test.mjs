import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { __test } from "../worker.js";

const JOB_ID = "job_ABCDEFGHIJKLMNOPQRSTUV";

test("idempotency keys are validated, scoped, and window bounded", async () => {
  assert.equal(__test.validateIdempotencyKey("action.0123456789abcdef"), "action.0123456789abcdef");
  assert.throws(() => __test.validateIdempotencyKey("short"), /invalid length/);
  assert.throws(() => __test.validateIdempotencyKey("invalid key with spaces"), /invalid format/);
  const first = await __test.hashCalculationJobIdempotency("user@example.com", "action.0123456789abcdef", 10);
  const duplicate = await __test.hashCalculationJobIdempotency("user@example.com", "action.0123456789abcdef", 10);
  const otherUser = await __test.hashCalculationJobIdempotency("other@example.com", "action.0123456789abcdef", 10);
  const nextWindow = await __test.hashCalculationJobIdempotency("user@example.com", "action.0123456789abcdef", 11);
  assert.equal(first, duplicate);
  assert.notEqual(first, otherUser);
  assert.notEqual(first, nextWindow);
  assert.match(first, /^[0-9a-f]{64}$/);
});

test("opaque job IDs and public responses expose no tenant or idempotency data", () => {
  assert.equal(__test.validateCalculationJobId(JOB_ID), JOB_ID);
  assert.throws(() => __test.validateCalculationJobId("job_invalid"), /invalid length|invalid/);
  const response = __test.publicCalculationJob({
    public_id: JOB_ID,
    user_id: "secret@example.com",
    idempotency_hash: "x".repeat(64),
    status: "queued",
    benchmark: "SPY",
    attempt_count: 0,
    created_at: "2026-08-06 00:00:00",
  }, true);
  assert.equal(response.id, JOB_ID);
  assert.equal(response.deduplicated, true);
  assert.equal("user_id" in response, false);
  assert.equal("idempotency_hash" in response, false);
  assert.equal("github_run_id" in response, false);
});

test("calculation job transitions are fail-closed and terminal states immutable", () => {
  assert.equal(__test.canTransitionCalculationJob("queued", "running"), true);
  assert.equal(__test.canTransitionCalculationJob("queued", "failed"), true);
  assert.equal(__test.canTransitionCalculationJob("running", "succeeded"), true);
  assert.equal(__test.canTransitionCalculationJob("running", "failed"), true);
  assert.equal(__test.canTransitionCalculationJob("succeeded", "failed"), false);
  assert.equal(__test.canTransitionCalculationJob("failed", "running"), false);
  assert.equal(__test.canTransitionCalculationJob("queued", "succeeded"), false);
  assert.equal(__test.canTransitionCalculationJob("running", "running"), true);
});

test("migration and workflow enforce unique idempotency and lifecycle callbacks", async () => {
  const migration = await readFile("migrations/0002_calculation_jobs.sql", "utf8");
  const workflow = await readFile(".github/workflows/update.yml", "utf8");
  assert.match(migration, /UNIQUE \(user_id, idempotency_hash\)/);
  assert.match(migration, /status IN \('queued', 'running', 'succeeded', 'failed'\)/);
  assert.match(migration, /schema_version = 2/);
  assert.match(workflow, /calculation_job_id:/);
  assert.match(workflow, /Mark calculation job running/);
  assert.match(workflow, /Report calculation job result/);
  assert.match(workflow, /steps\.calculation\.outcome == 'success'/);
  assert.match(workflow, /\/api\/calculation-jobs\/status/);
  assert.match(workflow, /always\(\)/);
});
