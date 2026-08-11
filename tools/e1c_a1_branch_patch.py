from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, got {count}")
    return text.replace(old, new, 1)


worker_path = Path("worker.js")
worker = worker_path.read_text()
worker = replace_once(
    worker,
    'const GITHUB_DISPATCH_TIMEOUT_MS = 5_000;\n',
    'const GITHUB_DISPATCH_TIMEOUT_MS = 5_000;\n'
    'const GITHUB_API_VERSION = "2026-03-10";\n'
    'const CALCULATION_JOB_DISPATCH_BINDING_GRACE_SECONDS = 60;\n',
    "dispatch constants",
)
worker = replace_once(
    worker,
    '    const replayModifier = `-${CALCULATION_JOB_TERMINAL_REPLAY_SECONDS} seconds`;\n',
    '    const replayModifier = `-${CALCULATION_JOB_TERMINAL_REPLAY_SECONDS} seconds`;\n'
    '    const dispatchBindingModifier = `-${CALCULATION_JOB_DISPATCH_BINDING_GRACE_SECONDS} seconds`;\n',
    "repository modifiers",
)

old_guard = """        WHERE user_id = ?
          AND benchmark = ?
          AND status IN ('queued', 'running')
      )
    `).bind(
      publicId,
      userId,
      idempotencyHash,
      benchmark,
      userId,
      benchmark,
    ).run();"""
new_guard = """        WHERE user_id = ?
          AND benchmark = ?
          AND status IN ('queued', 'running')
          AND (
            status = 'running'
            OR github_run_id IS NOT NULL
            OR created_at > datetime('now', ?)
          )
      )
    `).bind(
      publicId,
      userId,
      idempotencyHash,
      benchmark,
      userId,
      benchmark,
      dispatchBindingModifier,
    ).run();"""
worker = replace_once(worker, old_guard, new_guard, "atomic cross-key guard")

old_fallback = """      WHERE user_id = ?
        AND benchmark = ?
        AND status IN ('queued', 'running')
      ORDER BY created_at ASC, public_id ASC
      LIMIT 1
    `).bind(userId, benchmark).first();"""
new_fallback = """      WHERE user_id = ?
        AND benchmark = ?
        AND status IN ('queued', 'running')
        AND (
          status = 'running'
          OR github_run_id IS NOT NULL
          OR created_at > datetime('now', ?)
        )
      ORDER BY created_at ASC, public_id ASC
      LIMIT 1
    `).bind(userId, benchmark, dispatchBindingModifier).first();"""
worker = replace_once(worker, old_fallback, new_fallback, "cross-key fallback")

bind_method = """
  async bindDispatchRun(db, publicId, githubRunId) {
    const normalizedPublicId = validateCalculationJobId(publicId);
    const normalizedRunId = validateGitHubRunId(githubRunId);
    const current = await this.findById(db, normalizedPublicId);
    if (!current) return { kind: "not-found", job: null };
    if (current.github_run_id === normalizedRunId) return { kind: "idempotent", job: current };
    if (current.github_run_id !== null) return { kind: "conflict", job: current };

    const result = await db.prepare(`
      UPDATE calculation_jobs
      SET github_run_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE public_id = ? AND github_run_id IS NULL
    `).bind(normalizedRunId, normalizedPublicId).run();
    if (affectedRows(result) !== 1) {
      const observed = await this.findById(db, normalizedPublicId);
      if (observed?.github_run_id === normalizedRunId) return { kind: "idempotent", job: observed };
      return { kind: observed ? "conflict" : "not-found", job: observed || null };
    }
    return { kind: "bound", job: await this.findById(db, normalizedPublicId) };
  },
"""
worker = replace_once(
    worker,
    "\n  async failQueuedDispatch(db, publicId, errorCode) {\n",
    bind_method + "\n  async failQueuedDispatch(db, publicId, errorCode) {\n",
    "dispatch binding repository method",
)

validator = """
function validateGitHubRunId(value) {
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value <= 0)) {
    throw new RequestValidationError("GitHub workflow run ID is invalid");
  }
  const normalized = String(value ?? "").trim();
  if (!/^\\d{1,32}$/.test(normalized) || /^0+$/.test(normalized)) {
    throw new RequestValidationError("GitHub workflow run ID is invalid");
  }
  return normalized;
}

"""
worker = replace_once(
    worker,
    "function buildGitHubDispatchRequest({ token, benchmark, jobId }) {\n",
    validator + "function buildGitHubDispatchRequest({ token, benchmark, jobId }) {\n",
    "run id validator",
)
worker = replace_once(
    worker,
    '        "X-GitHub-Api-Version": "2022-11-28",\n',
    '        "X-GitHub-Api-Version": GITHUB_API_VERSION,\n',
    "GitHub API version",
)

old_dispatch = """async function dispatchGitHubWorkflow({ token, benchmark, jobId, fetchImpl = fetch }) {
  const request = buildGitHubDispatchRequest({ token, benchmark, jobId });
  const response = await fetchImpl(request.url, request.init);
  const githubRequestId = sanitizeHeaderValue(response.headers?.get?.("X-GitHub-Request-Id"));
  if (response.ok) return { ok: true, status: response.status, githubRequestId };
  return classifyGitHubDispatchFailure(response.status, {
    githubRequestId,
    retryAfter: sanitizeHeaderValue(response.headers?.get?.("Retry-After")),
  });
}
"""
new_dispatch = """async function dispatchGitHubWorkflow({ token, benchmark, jobId, fetchImpl = fetch }) {
  const request = buildGitHubDispatchRequest({ token, benchmark, jobId });
  const response = await fetchImpl(request.url, request.init);
  const githubRequestId = sanitizeHeaderValue(response.headers?.get?.("X-GitHub-Request-Id"));
  if (response.ok) {
    if (response.status !== 200 || typeof response.json !== "function") {
      return invalidGitHubDispatchResponse(response.status, githubRequestId);
    }
    try {
      const payload = await response.json();
      return {
        ok: true,
        status: response.status,
        githubRequestId,
        workflowRunId: validateGitHubRunId(payload?.workflow_run_id),
      };
    } catch {
      return invalidGitHubDispatchResponse(response.status, githubRequestId);
    }
  }
  return classifyGitHubDispatchFailure(response.status, {
    githubRequestId,
    retryAfter: sanitizeHeaderValue(response.headers?.get?.("Retry-After")),
  });
}

function invalidGitHubDispatchResponse(status, githubRequestId) {
  return {
    ok: false,
    status,
    code: "GITHUB_DISPATCH_INVALID_RESPONSE",
    message: "Update service returned an invalid dispatch response",
    httpStatus: 502,
    githubRequestId: githubRequestId || "",
    retryAfter: "",
  };
}
"""
worker = replace_once(worker, old_dispatch, new_dispatch, "dispatch response binding")

old_accept = """    console.info(
      `[request_id=${requestId}] GitHub dispatch accepted ` +
      `[job_id=${created.job.public_id}] ` +
      `[github_request_id=${result.githubRequestId || "unavailable"}]`,
    );
    return jsonResponse({
      success: true,
      job: publicCalculationJob(created.job, false),
    }, 202);"""
new_accept = """    const bound = await calculationJobsRepository.bindDispatchRun(
      env.DB,
      created.job.public_id,
      result.workflowRunId,
    );
    if (!bound.job || (bound.kind !== "bound" && bound.kind !== "idempotent")) {
      throw new Error("CalculationJobDispatchBindingFailed");
    }

    console.info(
      `[request_id=${requestId}] GitHub dispatch accepted ` +
      `[job_id=${created.job.public_id}] ` +
      `[github_run_id=${result.workflowRunId}] ` +
      `[github_request_id=${result.githubRequestId || "unavailable"}]`,
    );
    return jsonResponse({
      success: true,
      job: publicCalculationJob(bound.job, false),
    }, 202);"""
worker = replace_once(worker, old_accept, new_accept, "bind accepted dispatch")
worker = replace_once(
    worker,
    "  validateCalculationJobId,\n",
    "  validateCalculationJobId,\n  validateGitHubRunId,\n",
    "test export run id",
)
worker_path.write_text(worker)


dispatch_test = Path("tests/worker_dispatch.test.mjs")
text = dispatch_test.read_text()
text = replace_once(
    text,
    '  assert.equal(request.init.method, "POST");\n  assert.equal(request.init.headers.Authorization, "Bearer secret-token");\n',
    '  assert.equal(request.init.method, "POST");\n  assert.equal(request.init.headers.Authorization, "Bearer secret-token");\n  assert.equal(request.init.headers["X-GitHub-Api-Version"], "2026-03-10");\n',
    "dispatch API version test",
)
old_success = """test("dispatch accepts GitHub 204 without tenant identity", async () => {
  let bodyRead = false;
  let dispatchedBody = null;
  const result = await __test.dispatchGitHubWorkflow({
    token: "secret-token",
    benchmark: "SPY",
    jobId: JOB_ID,
    fetchImpl: async (_url, init) => {
      dispatchedBody = JSON.parse(init.body);
      return {
        ok: true,
        status: 204,
        headers: new Headers({ "X-GitHub-Request-Id": "ABC1:DEF2" }),
        text: async () => { bodyRead = true; },
      };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.githubRequestId, "ABC1:DEF2");
  assert.equal(bodyRead, false);
  assert.deepEqual(dispatchedBody.inputs, {
    custom_benchmark: "SPY",
    calculation_job_id: JOB_ID,
  });
});
"""
new_success = """test("dispatch requires GitHub 200 run binding without tenant identity", async () => {
  let dispatchedBody = null;
  const result = await __test.dispatchGitHubWorkflow({
    token: "secret-token",
    benchmark: "SPY",
    jobId: JOB_ID,
    fetchImpl: async (_url, init) => {
      dispatchedBody = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "X-GitHub-Request-Id": "ABC1:DEF2" }),
        json: async () => ({ workflow_run_id: 31460959779 }),
      };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.githubRequestId, "ABC1:DEF2");
  assert.equal(result.workflowRunId, "31460959779");
  assert.deepEqual(dispatchedBody.inputs, {
    custom_benchmark: "SPY",
    calculation_job_id: JOB_ID,
  });
  assert.equal(JSON.stringify(dispatchedBody).includes("@"), false);
});

test("dispatch fails closed on legacy 204 or invalid 200 response", async () => {
  for (const response of [
    { ok: true, status: 204, headers: new Headers(), json: async () => ({}) },
    { ok: true, status: 200, headers: new Headers(), json: async () => ({}) },
    { ok: true, status: 200, headers: new Headers(), json: async () => ({ workflow_run_id: 0 }) },
  ]) {
    const result = await __test.dispatchGitHubWorkflow({
      token: "secret-token",
      benchmark: "SPY",
      jobId: JOB_ID,
      fetchImpl: async () => response,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "GITHUB_DISPATCH_INVALID_RESPONSE");
  }
});
"""
text = replace_once(text, old_success, new_success, "dispatch success contract test")
dispatch_test.write_text(text)


lifecycle_path = Path("tests/worker_calculation_jobs.test.mjs")
life = lifecycle_path.read_text()
life = replace_once(
    life,
    """  const activeFor = (userId, benchmark) => [...rowsById.values()]
    .filter(row => (
      row.user_id === userId
      && row.benchmark === benchmark
      && (row.status === "queued" || row.status === "running")
    ))
""",
    """  const activeFor = (userId, benchmark) => [...rowsById.values()]
    .filter(row => (
      row.user_id === userId
      && row.benchmark === benchmark
      && (row.status === "queued" || row.status === "running")
      && (
        row.status === "running"
        || row.github_run_id !== null
        || row.created_at >= "2026-08-11 05:29:00"
      )
    ))
""",
    "fake active dispatch evidence",
)
life = replace_once(
    life,
    '                  created_at: "2026-08-06 00:00:00",\n',
    '                  created_at: "2026-08-11 05:30:00",\n',
    "fake new queued timestamp",
)
life = replace_once(
    life,
    """              if (normalized.startsWith("UPDATE calculation_jobs SET status = 'failed'")) {
""",
    """              if (normalized.startsWith("UPDATE calculation_jobs SET github_run_id = ?")) {
                const [runId, publicId] = args;
                const row = rowsById.get(publicId);
                if (!row || row.github_run_id !== null) return { meta: { changes: 0 } };
                row.github_run_id = runId;
                row.updated_at = "2026-08-11 05:30:01";
                return { meta: { changes: 1 } };
              }
              if (normalized.startsWith("UPDATE calculation_jobs SET status = 'failed'")) {
""",
    "fake dispatch binding update",
)
marker = 'test("different benchmark remains a distinct calculation intent", async () => {'
addition = """test("legacy old queued row without dispatch evidence no longer blocks a rotated key", async () => {
  const { db, rowsById } = createCalculationJobsDb();
  const firstHash = await __test.hashCalculationJobIdempotency(USER_ID, "action.orphan.first.123456");
  const rotatedHash = await __test.hashCalculationJobIdempotency(USER_ID, "action.orphan.second.12345");
  const first = await __test.calculationJobsRepository.createOrGet(db, { publicId: JOB_ID, userId: USER_ID, idempotencyHash: firstHash, benchmark: "SPY" });
  rowsById.get(JOB_ID).created_at = "2026-08-06 00:00:00";
  const rotated = await __test.calculationJobsRepository.createOrGet(db, { publicId: ALT_JOB_ID, userId: USER_ID, idempotencyHash: rotatedHash, benchmark: "SPY" });
  assert.equal(first.inserted, true);
  assert.equal(rotated.inserted, true);
  assert.equal(rotated.job.public_id, ALT_JOB_ID);
  assert.equal(rowsById.size, 2);
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

test("cross-key SQL requires positive dispatch evidence or short binding grace", async () => {
  const { db, statements } = createCalculationJobsDb();
  const hash = await __test.hashCalculationJobIdempotency(USER_ID, "action.sql.guard.123456789");
  await __test.calculationJobsRepository.createOrGet(db, { publicId: JOB_ID, userId: USER_ID, idempotencyHash: hash, benchmark: "SPY" });
  const insertSql = statements.find(sql => sql.startsWith("INSERT OR IGNORE INTO calculation_jobs"));
  assert.ok(insertSql);
  assert.match(insertSql, /status = 'running'/);
  assert.match(insertSql, /github_run_id IS NOT NULL/);
  assert.match(insertSql, /created_at > datetime\('now', \?\)/);
});

"""
life = replace_once(life, marker, addition + marker, "lifecycle A1 tests")
lifecycle_path.write_text(life)


Path("docs/engineering/GATE_E_E1C_A1_DISPATCH_BINDING_2026-08-11.md").write_text("""# Gate E / E1c-A.1 — Dispatch Binding and Legacy Orphan Recovery

Status: **IMPLEMENTATION CANDIDATE**  
Date: **2026-08-11**

## Production blocker

After E1c-A Worker runtime `94215c9dfec54a9da80ceac9782a6aca16bee8ad` was deployed and stable, a normal authenticated frontend trigger remained in `計算中...` while repeated remote checks showed no new `Update Portfolio Data` GitHub Actions run. The last existing run (#3235 / `31455526265`) had already completed successfully with a terminal `succeeded` callback before the E1c-A deployment.

E1c-A's server-first cross-key guard correctly prevented duplicate work, but production exposed legacy rollout residue: an old `queued` row with no durable GitHub dispatch identity can be treated as active forever.

## Root cause and locked correction

The Worker used GitHub API `2022-11-28` and only consumed HTTP success plus the request ID; `github_run_id` was populated later by the workflow callback. GitHub API `2026-03-10` returns HTTP 200 with `workflow_run_id`. Schema 2 already contains `github_run_id`, so no migration is needed.

1. Dispatch uses GitHub API `2026-03-10`.
2. Success requires HTTP 200 plus a valid positive workflow run ID; legacy 204/malformed success fails closed.
3. The run ID is durably bound before HTTP 202 returns to the browser. Binding is same-ID idempotent and conflicting-ID fail-closed.
4. Exact-key replay remains authoritative and is never age-expired while active.
5. Cross-key compatibility treats same-tenant/same-benchmark work as active when it is running, has durable GitHub run identity, or is inside a 60-second insert-to-binding grace.
6. Historical old `queued + github_run_id IS NULL` residue cannot permanently block a different key. The grace applies only to cross-key compatibility; it does not expire exact-key lifecycle state.
7. Different benchmark remains distinct.
8. Frontend TTL, workflow concurrency, D1 schema, financial logic, E1d and privacy boundaries are unchanged.

## Risk and recovery

**R3 — production lifecycle / dispatch identity / duplicate-execution correctness.**

Recovery: `backup-pre-e1c-a1-dispatch-binding-6e4e464`. Fresh exact-head CI, R3 Independent Review, expected-head merge, production identity/authority/deploy and a normal frontend terminal smoke remain required.

E1c-B remains deferred until E1c-A.1 is production verified.
""")
