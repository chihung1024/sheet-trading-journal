import test from "node:test";
import assert from "node:assert/strict";
import { __test } from "../worker.js";

const JOB_ID = "job_ABCDEFGHIJKLMNOPQRSTUV";

test("calculation job GET authorizes both tenant user and trusted system", () => {
  assert.equal(__test.authorize({ kind: "user" }, "GET /api/calculation-jobs/:id"), true);
  assert.equal(__test.authorize({ kind: "system" }, "GET /api/calculation-jobs/:id"), true);
});

test("system target projection is explicit while public projection remains owner-free", () => {
  const job = {
    public_id: JOB_ID,
    user_id: "secret@example.com",
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
  };

  const publicJob = __test.publicCalculationJob(job, false);
  assert.equal("user_id" in publicJob, false);
  assert.equal("target_user_id" in publicJob, false);

  const target = __test.systemCalculationJobTarget(job);
  assert.deepEqual(target, {
    id: JOB_ID,
    target_user_id: "secret@example.com",
    benchmark: "SPY",
    status: "queued",
  });
});

test("system repository lookup resolves opaque job without caller-supplied tenant", async () => {
  const row = {
    public_id: JOB_ID,
    user_id: "secret@example.com",
    status: "queued",
    benchmark: "0050.TW",
    github_run_id: null,
    github_run_attempt: 0,
    attempt_count: 0,
    error_code: null,
    created_at: "2026-08-10 00:00:00",
    started_at: null,
    completed_at: null,
    updated_at: "2026-08-10 00:00:00",
  };
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
  assert.equal(resolved.user_id, "secret@example.com");
  assert.equal(resolved.benchmark, "0050.TW");
});
