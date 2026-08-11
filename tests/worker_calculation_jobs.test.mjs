import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { __test } from "../worker.js";

const JOB_ID = "job_ABCDEFGHIJKLMNOPQRSTUV";
const ALT_JOB_ID = "job_ZYXWVUTSRQPONMLKJIHGFE";
const THIRD_JOB_ID = "job_0123456789abcdefghijkl";
const USER_ID = "user@example.com";

function createCalculationJobsDb() {
  const rowsByHash = new Map();
  const rowsById = new Map();
  const statements = [];

  const activeFor = (userId, benchmark) => [...rowsById.values()]
    .filter(row => (
      row.user_id === userId
      && row.benchmark === benchmark
      && (row.status === "queued" || row.status === "running")
    ))
    .sort((left, right) => (
      left.created_at.localeCompare(right.created_at)
      || left.public_id.localeCompare(right.public_id)
    ))[0] || null;

  const db = {
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      statements.push(normalized);
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
                if (normalized.includes("WHERE NOT EXISTS") && activeFor(userId, benchmark)) {
                  return { meta: { changes: 0 } };
                }
                const row = {
                  public_id: publicId,
                  user_id: userId,
                  idempotency_hash: hash,
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
              if (normalized.startsWith("UPDATE calculation_jobs SET github_run_id = ?")) {
                const [runId, publicId] = args;
                const row = rowsById.get(publicId);
                if (!row || row.github_run_id !== null) return { meta: { changes: 0 } };
                row.github_run_id = runId;
                row.updated_at = "2026-08-11 05:30:01";
                return { meta: { changes: 1 } };
              }
              if (normalized.startsWith("UPDATE calculation_jobs SET status = 'failed'")) {
                const [errorCode, publicId] = args;
                const row = rowsById.get(publicId);
                if (!row || row.status !== "queued") return { meta: { changes: 0 } };
                row.status = "failed";
                row.error_code = errorCode;
                row.completed_at = "2026-08-06 00:01:00";
                row.updated_at = row.completed_at;
                return { meta: { changes: 1 } };
              }
              throw new Error(`Unexpected run SQL: ${normalized}`);
            },
            async first() {
              if (normalized.includes("WHERE user_id = ? AND idempotency_hash = ?")) {
                return rowsByHash.get(`${args[0]}\n${args[1]}`) || null;
              }
              if (
                normalized.includes("WHERE user_id = ?")
                && normalized.includes("benchmark = ?")
                && normalized.includes("status IN ('queued', 'running')")
              ) {
                return activeFor(args[0], args[1]);
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

  return { db, rowsByHash, rowsById, statements };
}

test("idempotency keys are validated and tenant scoped", async () => {
  assert.equal(__test.validateIdempotencyKey("action.0123456789abcdef"), "action.0123456789abcdef");
  assert.throws(() => __test.validateIdempotencyKey("short"), /invalid length/);
  assert.throws(() => __test.validateIdempotencyKey("invalid key with spaces"), /invalid format/);
  const first = await __test.hashCalculationJobIdempotency(USER_ID, "action.0123456789abcdef");
  const duplicate = await __test.hashCalculationJobIdempotency(USER_ID, "action.0123456789abcdef");
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

test("migration and workflow retain durable job callbacks and serialized execution", async () => {
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
  assert.match(workflow, /group:\s*portfolio-update/);
  assert.match(workflow, /cancel-in-progress:\s*false/);
});

test("repository releases idempotency only for old terminal jobs, never active jobs by creation age", async () => {
  const { db, statements } = createCalculationJobsDb();
  const hash = await __test.hashCalculationJobIdempotency(USER_ID, "action.lifecycle.1234567890");

  await __test.calculationJobsRepository.createOrGet(db, {
    publicId: JOB_ID,
    userId: USER_ID,
    idempotencyHash: hash,
    benchmark: "SPY",
  });

  const releaseSql = statements.find(sql => sql.startsWith("UPDATE calculation_jobs SET idempotency_hash = NULL"));
  assert.ok(releaseSql);
  assert.match(releaseSql, /status IN \('succeeded', 'failed'\)/);
  assert.match(releaseSql, /completed_at IS NOT NULL/);
  assert.match(releaseSql, /completed_at <= datetime\('now', \?\)/);
  assert.doesNotMatch(releaseSql, /created_at <=/);
});

test("same idempotency key still resolves to one inserted active job", async () => {
  const { db, rowsByHash } = createCalculationJobsDb();
  const hash = await __test.hashCalculationJobIdempotency(
    USER_ID,
    "action.concurrent.1234567890",
  );
  const first = await __test.calculationJobsRepository.createOrGet(db, {
    publicId: JOB_ID,
    userId: USER_ID,
    idempotencyHash: hash,
    benchmark: "SPY",
  });
  const second = await __test.calculationJobsRepository.createOrGet(db, {
    publicId: ALT_JOB_ID,
    userId: USER_ID,
    idempotencyHash: hash,
    benchmark: "SPY",
  });
  assert.equal(first.inserted, true);
  assert.equal(second.inserted, false);
  assert.equal(first.job.public_id, second.job.public_id);
  assert.equal(rowsByHash.size, 1);
});

test("legacy key rotation cannot create a second active job for the same tenant and benchmark", async () => {
  const { db, rowsById, statements } = createCalculationJobsDb();
  const firstHash = await __test.hashCalculationJobIdempotency(USER_ID, "action.legacy.first.123456");
  const rotatedHash = await __test.hashCalculationJobIdempotency(USER_ID, "action.legacy.second.12345");

  const first = await __test.calculationJobsRepository.createOrGet(db, {
    publicId: JOB_ID,
    userId: USER_ID,
    idempotencyHash: firstHash,
    benchmark: "SPY",
  });
  const rotated = await __test.calculationJobsRepository.createOrGet(db, {
    publicId: ALT_JOB_ID,
    userId: USER_ID,
    idempotencyHash: rotatedHash,
    benchmark: "SPY",
  });

  assert.equal(first.inserted, true);
  assert.equal(rotated.inserted, false);
  assert.equal(rotated.job.public_id, JOB_ID);
  assert.equal(rotated.job.status, "queued");
  assert.equal(rowsById.size, 1);
  const insertSql = statements.find(sql => (
    sql.startsWith("INSERT OR IGNORE INTO calculation_jobs") && sql.includes("WHERE NOT EXISTS")
  ));
  assert.ok(insertSql);
  assert.match(insertSql, /status IN \('queued', 'running'\)/);
});

test("legacy old queued row without dispatch evidence remains active until controlled recovery", async () => {
  const { db, rowsById } = createCalculationJobsDb();
  const firstHash = await __test.hashCalculationJobIdempotency(USER_ID, "action.orphan.first.123456");
  const rotatedHash = await __test.hashCalculationJobIdempotency(USER_ID, "action.orphan.second.12345");

  const first = await __test.calculationJobsRepository.createOrGet(db, {
    publicId: JOB_ID,
    userId: USER_ID,
    idempotencyHash: firstHash,
    benchmark: "SPY",
  });
  rowsById.get(JOB_ID).created_at = "2026-08-01 00:00:00";
  assert.equal(rowsById.get(JOB_ID).github_run_id, null);

  const rotated = await __test.calculationJobsRepository.createOrGet(db, {
    publicId: ALT_JOB_ID,
    userId: USER_ID,
    idempotencyHash: rotatedHash,
    benchmark: "SPY",
  });
  assert.equal(first.inserted, true);
  assert.equal(rotated.inserted, false);
  assert.equal(rotated.job.public_id, JOB_ID);
  assert.equal(rowsById.size, 1);
});

test("dispatch-bound queued row continues to protect legacy cross-key retries", async () => {
  const { db, rowsById } = createCalculationJobsDb();
  const firstHash = await __test.hashCalculationJobIdempotency(USER_ID, "action.bound.first.1234567");
  const rotatedHash = await __test.hashCalculationJobIdempotency(USER_ID, "action.bound.second.123456");
  await __test.calculationJobsRepository.createOrGet(db, { publicId: JOB_ID, userId: USER_ID, idempotencyHash: firstHash, benchmark: "SPY" });
  rowsById.get(JOB_ID).created_at = "2026-08-06 00:00:00";
  const bound = await __test.calculationJobsRepository.bindDispatchRun(db, JOB_ID, "31460959779");
  assert.equal(bound.kind, "bound");
  const rotated = await __test.calculationJobsRepository.createOrGet(db, { publicId: ALT_JOB_ID, userId: USER_ID, idempotencyHash: rotatedHash, benchmark: "SPY" });
  assert.equal(rotated.inserted, false);
  assert.equal(rotated.job.public_id, JOB_ID);
  assert.equal(rowsById.size, 1);
});

test("dispatch run binding is idempotent and refuses conflicting run identity", async () => {
  const { db } = createCalculationJobsDb();
  const hash = await __test.hashCalculationJobIdempotency(USER_ID, "action.bind.run.123456789");
  await __test.calculationJobsRepository.createOrGet(db, { publicId: JOB_ID, userId: USER_ID, idempotencyHash: hash, benchmark: "SPY" });
  const first = await __test.calculationJobsRepository.bindDispatchRun(db, JOB_ID, 31460959779);
  assert.equal(first.kind, "bound");
  assert.equal((await __test.calculationJobsRepository.bindDispatchRun(db, JOB_ID, "31460959779")).kind, "idempotent");
  const conflict = await __test.calculationJobsRepository.bindDispatchRun(db, JOB_ID, "31460959780");
  assert.equal(conflict.kind, "conflict");
  assert.equal(conflict.job.github_run_id, "31460959779");
});

test("different benchmark remains a distinct calculation intent", async () => {
  const { db, rowsById } = createCalculationJobsDb();
  const spyHash = await __test.hashCalculationJobIdempotency(USER_ID, "action.benchmark.spy.123456");
  const qqqHash = await __test.hashCalculationJobIdempotency(USER_ID, "action.benchmark.qqq.123456");

  const spy = await __test.calculationJobsRepository.createOrGet(db, {
    publicId: JOB_ID,
    userId: USER_ID,
    idempotencyHash: spyHash,
    benchmark: "SPY",
  });
  const qqq = await __test.calculationJobsRepository.createOrGet(db, {
    publicId: THIRD_JOB_ID,
    userId: USER_ID,
    idempotencyHash: qqqHash,
    benchmark: "QQQ",
  });

  assert.equal(spy.inserted, true);
  assert.equal(qqq.inserted, true);
  assert.notEqual(spy.job.public_id, qqq.job.public_id);
  assert.equal(rowsById.size, 2);
});

test("ambiguous dispatch recovery fails only a still-queued job", async () => {
  const { db, rowsById } = createCalculationJobsDb();
  const hash = await __test.hashCalculationJobIdempotency(USER_ID, "action.recovery.1234567890");
  await __test.calculationJobsRepository.createOrGet(db, {
    publicId: JOB_ID,
    userId: USER_ID,
    idempotencyHash: hash,
    benchmark: "SPY",
  });

  const failed = await __test.calculationJobsRepository.failQueuedDispatch(
    db,
    JOB_ID,
    "GITHUB_DISPATCH_TIMEOUT",
  );
  assert.equal(failed.kind, "failed-queued");
  assert.equal(failed.job.status, "failed");
  assert.equal(failed.job.error_code, "GITHUB_DISPATCH_TIMEOUT");

  rowsById.get(JOB_ID).status = "running";
  rowsById.get(JOB_ID).error_code = null;
  rowsById.get(JOB_ID).completed_at = null;
  const unchanged = await __test.calculationJobsRepository.failQueuedDispatch(
    db,
    JOB_ID,
    "GITHUB_DISPATCH_TIMEOUT",
  );
  assert.equal(unchanged.kind, "unchanged");
  assert.equal(unchanged.job.status, "running");
  assert.equal(unchanged.job.error_code, null);
});

test("trigger timeout closes a newly queued durable job instead of leaving an orphan", async () => {
  const { db, rowsById } = createCalculationJobsDb();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    const error = new Error("simulated dispatch timeout");
    error.name = "TimeoutError";
    throw error;
  };

  try {
    const request = new Request("https://api.example.test/api/trigger-update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "action.timeout.1234567890",
      },
      body: JSON.stringify({ benchmark: "SPY" }),
    });
    const response = await __test.handleGitHubTrigger(
      request,
      { GITHUB_TOKEN: "test-token", DB: db },
      {},
      { kind: "user", email: USER_ID },
      "request-timeout-test",
    );

    assert.equal(response.status, 502);
    const payload = await response.json();
    assert.equal(payload.error_meta.code, "GITHUB_DISPATCH_TIMEOUT");
    assert.equal(rowsById.size, 1);
    const [row] = rowsById.values();
    assert.equal(row.status, "failed");
    assert.equal(row.error_code, "GITHUB_DISPATCH_TIMEOUT");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("trigger timeout cannot overwrite a job that already crossed to running", async () => {
  const { db, rowsById } = createCalculationJobsDb();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    const [row] = rowsById.values();
    assert.ok(row, "job must be inserted before dispatch");
    row.status = "running";
    row.started_at = "2026-08-06 00:00:30";
    const error = new Error("accepted upstream but response timed out");
    error.name = "TimeoutError";
    throw error;
  };

  try {
    const request = new Request("https://api.example.test/api/trigger-update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "action.timeout.race.123456",
      },
      body: JSON.stringify({ benchmark: "SPY" }),
    });
    const response = await __test.handleGitHubTrigger(
      request,
      { GITHUB_TOKEN: "test-token", DB: db },
      {},
      { kind: "user", email: USER_ID },
      "request-timeout-race-test",
    );

    assert.equal(response.status, 502);
    const [row] = rowsById.values();
    assert.equal(row.status, "running");
    assert.equal(row.error_code, null);
    assert.equal(row.completed_at, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("legacy frontend recovery contract remains unchanged during server-first E1c-A", async () => {
  const storeSource = await readFile("src/stores/portfolio.js", "utf8");
  const stateSource = await readFile("src/services/calculationJobState.js", "utf8");
  assert.match(storeSource, /triggerUpdatePromise/);
  assert.match(storeSource, /if \(triggerUpdatePromise\) return triggerUpdatePromise/);
  assert.match(storeSource, /getOrCreateIdempotencyKey/);
  assert.match(storeSource, /rememberPendingCalculationRequest/);
  assert.match(storeSource, /resumePendingCalculationJob/);
  assert.match(stateSource, /CALCULATION_REQUEST_TTL_MS\s*=\s*15 \* 60 \* 1000/);
});
