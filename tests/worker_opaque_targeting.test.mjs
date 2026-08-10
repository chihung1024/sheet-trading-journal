import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { __test } from "../worker.js";

const JOB_ID = "job_ABCDEFGHIJKLMNOPQRSTUV";
const OWNER = "secret@example.com";

function jobRow(overrides = {}) {
  return {
    public_id: JOB_ID,
    user_id: OWNER,
    status: "queued",
    benchmark: "SPY",
    github_run_id: null,
    github_run_attempt: 0,
    attempt_count: 0,
    error_code: null,
    created_at: "2026-08-10 00:00:00",
    started_at: null,
    completed_at: null,
    updated_at: "2026-08-10 00:00:00",
    ...overrides,
  };
}

function jobDb(row) {
  return {
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      return {
        bind(...args) {
          return {
            async first() {
              if (normalized.includes("WHERE public_id = ? AND user_id = ?")) {
                return args[0] === row.public_id && args[1] === row.user_id ? row : null;
              }
              if (normalized.includes("WHERE public_id = ?")) {
                return args[0] === row.public_id ? row : null;
              }
              throw new Error(`Unexpected SQL: ${normalized}`);
            },
          };
        },
      };
    },
  };
}

test("calculation job GET authorizes both tenant user and trusted system", () => {
  assert.equal(__test.authorize({ kind: "user" }, "GET /api/calculation-jobs/:id"), true);
  assert.equal(__test.authorize({ kind: "system" }, "GET /api/calculation-jobs/:id"), true);
});

test("system target projection is explicit while public projection remains owner-free", () => {
  const job = jobRow();

  const publicJob = __test.publicCalculationJob(job, false);
  assert.equal("user_id" in publicJob, false);
  assert.equal("target_user_id" in publicJob, false);

  const target = __test.systemCalculationJobTarget(job);
  assert.deepEqual(target, {
    id: JOB_ID,
    target_user_id: OWNER,
    benchmark: "SPY",
    status: "queued",
  });
});

test("system target projection validates stored owner and benchmark", () => {
  assert.throws(
    () => __test.systemCalculationJobTarget(jobRow({ user_id: "invalid-owner" })),
    /email|invalid/i,
  );
  assert.throws(
    () => __test.systemCalculationJobTarget(jobRow({ benchmark: "bad benchmark" })),
    /symbol|benchmark|invalid/i,
  );
});

test("system repository lookup resolves opaque job without caller-supplied tenant", async () => {
  const row = jobRow({ benchmark: "0050.TW" });
  const db = {
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      assert.match(normalized, /WHERE public_id = \?/);
      assert.doesNotMatch(normalized, /user_id = \?/);
      return {
        bind(publicId) {
          assert.equal(publicId, JOB_ID);
          return { async first() { return row; } };
        },
      };
    },
  };

  const resolved = await __test.calculationJobsRepository.findById(db, JOB_ID);
  assert.equal(resolved.user_id, OWNER);
  assert.equal(resolved.benchmark, "0050.TW");
});

test("system calculation-job handler returns only the narrow owner target projection", async () => {
  const response = await __test.handleGetCalculationJob(
    JOB_ID,
    { DB: jobDb(jobRow()) },
    { kind: "system" },
    "request-system",
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload, {
    success: true,
    job: {
      id: JOB_ID,
      target_user_id: OWNER,
      benchmark: "SPY",
      status: "queued",
    },
  });
});

test("tenant calculation-job handler never exposes owner identity", async () => {
  const response = await __test.handleGetCalculationJob(
    JOB_ID,
    { DB: jobDb(jobRow()) },
    { kind: "user", email: OWNER },
    "request-user",
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.job.id, JOB_ID);
  assert.equal("user_id" in payload.job, false);
  assert.equal("target_user_id" in payload.job, false);
});

test("tenant cannot resolve another user's opaque job", async () => {
  const response = await __test.handleGetCalculationJob(
    JOB_ID,
    { DB: jobDb(jobRow()) },
    { kind: "user", email: "other@example.com" },
    "request-other-user",
  );
  assert.equal(response.status, 404);
  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error_meta.code, "NOT_FOUND");
  assert.equal(JSON.stringify(payload).includes(OWNER), false);
});

test("temporary worker-entry compatibility shim is retired after canonical ownership", async () => {
  const entry = await readFile("worker-entry.js", "utf8");
  assert.doesNotMatch(entry, /handleOpaqueTargetCompatibility/);
  assert.doesNotMatch(entry, /COMPAT_JOB_PATH_RE/);
  assert.match(entry, /return canonicalWorker\.fetch\(request, env, ctx\)/);
});
