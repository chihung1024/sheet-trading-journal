import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { __test } from "../worker.js";

const JOB_ID = "job_ABCDEFGHIJKLMNOPQRSTUV";

test("idempotency keys are validated, scoped, and window bounded", async () => {
  assert.equal(__test.validateIdempotencyKey("action.0123456789abcdef"), "action.0123456789abcdef");
  assert.throws(() => __test.validateIdempotencyKey("short"), /invalid length/);
  assert.throws(() => __test.validateIdempotencyKey("invalid key with spaces"), /invalid format/);
  const first = await __test.hashCalculationJobIdempotency("user@example.com", "action.0123456789abcdef");
  const duplicate = await __test.hashCalculationJobIdempotency("user@example.com", "action.0123456789abcdef");
  const otherUser = await __test.hashCalculationJobIdempotency("other@example.com", "action.0123456789abcdef");
  assert.equal(first, duplicate);
  assert.notEqual(first, otherUser);
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

test("concurrent duplicate repository requests resolve to one inserted job", async () => {
  const rowsByHash = new Map();
  const rowsById = new Map();
  const db = {
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      return {
        bind(...args) {
          return {
            async run() {
              if (normalized.startsWith("UPDATE calculation_jobs SET idempotency_hash = NULL")) {
                return { meta: { changes: 0 } };
              }
              if (normalized.startsWith("INSERT OR IGNORE INTO calculation_jobs")) {
                const [publicId, userId, hash, benchmark] = args;
                const key = `${userId}\n${hash}`;
                if (rowsByHash.has(key)) return { meta: { changes: 0 } };
                const row = {
                  public_id: publicId,
                  user_id: userId,
                  status: "queued",
                  benchmark,
                  github_run_id: null,
                  github_run_attempt: 0,
                  attempt_count: 0,
                  error_code: null,
                  created_at: "2026-08-06 00:00:00",
                  started_at: null,
                  completed_at: null,
                  updated_at: "2026-08-06 00:00:00",
                };
                rowsByHash.set(key, row);
                rowsById.set(publicId, row);
                return { meta: { changes: 1 } };
              }
              throw new Error(`Unexpected run SQL: ${normalized}`);
            },
            async first() {
              if (normalized.includes("WHERE user_id = ? AND idempotency_hash = ?")) {
                return rowsByHash.get(`${args[0]}\n${args[1]}`) || null;
              }
              if (normalized.includes("WHERE public_id = ?")) {
                return rowsById.get(args[0]) || null;
              }
              throw new Error(`Unexpected first SQL: ${normalized}`);
            },
          };
        },
      };
    },
  };
  const hash = await __test.hashCalculationJobIdempotency(
    "user@example.com",
    "action.concurrent.1234567890",
  );
  const [first, second] = await Promise.all([
    __test.calculationJobsRepository.createOrGet(db, {
      publicId: "job_ABCDEFGHIJKLMNOPQRSTUV",
      userId: "user@example.com",
      idempotencyHash: hash,
      benchmark: "SPY",
    }),
    __test.calculationJobsRepository.createOrGet(db, {
      publicId: "job_ZYXWVUTSRQPONMLKJIHGFE",
      userId: "user@example.com",
      idempotencyHash: hash,
      benchmark: "SPY",
    }),
  ]);
  assert.equal(Number(first.inserted) + Number(second.inserted), 1);
  assert.equal(first.job.public_id, second.job.public_id);
  assert.equal(rowsByHash.size, 1);
});

test("frontend reuses a tenant-bound pending key and collapses concurrent trigger calls", async () => {
  const storeSource = await readFile("src/stores/portfolio.js", "utf8");
  const stateSource = await readFile("src/services/calculationJobState.js", "utf8");
  assert.match(storeSource, /triggerUpdatePromise/);
  assert.match(storeSource, /if \(triggerUpdatePromise\) return triggerUpdatePromise/);
  assert.match(storeSource, /getOrCreateIdempotencyKey/);
  assert.match(storeSource, /rememberPendingCalculationRequest/);
  assert.match(storeSource, /getCalculationOwner/);
  assert.match(storeSource, /resumePendingCalculationJob/);
  assert.match(storeSource, /await startCalculationJobPolling\(responseData\.job\.id\)/);
  assert.match(stateSource, /pending_calculation_request/);
  assert.match(stateSource, /normalizeCalculationOwner/);
  assert.match(stateSource, /CALCULATION_REQUEST_TTL_MS/);
});
