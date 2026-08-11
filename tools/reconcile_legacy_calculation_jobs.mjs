import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SHA_RE = /^[0-9a-f]{40}$/;
const SQL_UTC_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REPOSITORY_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const OPERATION = "e1c_a1_legacy_unbound_queued_reconciliation";
const ERROR_CODE = "LEGACY_DISPATCH_UNBOUND_RECONCILED";
export const ACTIVE_WORKFLOW_RUN_STATUSES = Object.freeze([
  "queued",
  "in_progress",
  "waiting",
  "pending",
  "requested",
]);

export function validateRequest(request) {
  if (request?.schema_version !== 1) throw new Error("reconciliation request schema_version must equal 1");
  if (request?.status !== "ready") throw new Error("reconciliation request status must equal ready");
  if (request?.operation !== OPERATION) throw new Error("reconciliation request operation is not authorized");
  if (!SHA_RE.test(request?.expected_runtime_source || "")) {
    throw new Error("expected_runtime_source must be an exact lowercase 40-character SHA");
  }
  if (!SQL_UTC_RE.test(request?.legacy_created_before_utc || "")) {
    throw new Error("legacy_created_before_utc must be UTC in YYYY-MM-DD HH:MM:SS format");
  }
  if (!Number.isInteger(request?.max_rows) || request.max_rows < 1 || request.max_rows > 25) {
    throw new Error("max_rows must be an integer from 1 through 25");
  }
  if (!Number.isInteger(request?.deployment_run_id) || request.deployment_run_id <= 0) {
    throw new Error("deployment_run_id must be a positive integer");
  }
  if (!UUID_RE.test(request?.worker_version_id || "")) {
    throw new Error("worker_version_id must be a UUID");
  }
  if (typeof request?.reason !== "string" || request.reason.trim().length < 20) {
    throw new Error("reconciliation reason is required");
  }
  return {
    source_sha: request.expected_runtime_source,
    cutoff_utc: request.legacy_created_before_utc,
    max_rows: String(request.max_rows),
    deployment_run_id: String(request.deployment_run_id),
    worker_version_id: request.worker_version_id,
  };
}

export async function checkGitHubActiveRuns({
  token,
  repository,
  workflow = "update.yml",
  fetchImpl = fetch,
}) {
  if (!token) throw new Error("GH_TOKEN is required for active-run verification");
  if (!REPOSITORY_RE.test(repository || "")) throw new Error("GITHUB_REPOSITORY is invalid");
  if (!/^[A-Za-z0-9_.-]+\.ya?ml$/.test(workflow)) throw new Error("workflow name is invalid");

  const counts = {};
  for (const status of ACTIVE_WORKFLOW_RUN_STATUSES) {
    const url = new URL(
      `https://api.github.com/repos/${repository}/actions/workflows/${encodeURIComponent(workflow)}/runs`,
    );
    url.searchParams.set("status", status);
    url.searchParams.set("per_page", "1");
    const response = await fetchImpl(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2026-03-10",
      },
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`GitHub active-run check failed for status=${status}: HTTP ${response.status}`);
    }
    const body = await response.json();
    const count = Number(body?.total_count);
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`GitHub active-run check returned invalid total_count for status=${status}`);
    }
    counts[status] = count;
  }

  const activeCount = Object.values(counts).reduce((total, value) => total + value, 0);
  if (activeCount !== 0) {
    const summary = ACTIVE_WORKFLOW_RUN_STATUSES.map((status) => `${status}=${counts[status]}`).join(",");
    throw new Error(`Update Portfolio Data has ${activeCount} nonterminal run(s): ${summary}`);
  }
  console.log(
    `GitHub active-run check passed: ${ACTIVE_WORKFLOW_RUN_STATUSES.map((status) => `${status}=0`).join(",")}`,
  );
  return counts;
}

function verifyRequest(requestPath) {
  if (!requestPath) throw new Error("request path is required");
  const outputs = validateRequest(JSON.parse(readFileSync(requestPath, "utf8")));
  if (process.env.GITHUB_OUTPUT) {
    for (const [key, value] of Object.entries(outputs)) {
      appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`, "utf8");
    }
  }
  console.log(
    `Validated reconciliation request: source=${outputs.source_sha} cutoff=${outputs.cutoff_utc} max_rows=${outputs.max_rows}`,
  );
}

function executeReconciliation() {
  const sourceSha = required("EXPECTED_SHA");
  const cutoff = required("RECONCILIATION_CUTOFF_UTC");
  const maxRows = Number(required("RECONCILIATION_MAX_ROWS"));
  const deploymentRunId = Number(required("DEPLOYMENT_RUN_ID"));
  const workerVersionId = required("WORKER_VERSION_ID");
  const outputPath = process.env.AUDIT_OUTPUT || "production-e1c-a1-legacy-reconciliation.json";
  const wranglerConfig = process.env.WRANGLER_CONFIG || ".wrangler/deploy.toml";

  if (!SHA_RE.test(sourceSha)) throw new Error("EXPECTED_SHA is invalid");
  if (!SQL_UTC_RE.test(cutoff)) throw new Error("RECONCILIATION_CUTOFF_UTC is invalid");
  if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > 25) throw new Error("RECONCILIATION_MAX_ROWS is invalid");
  if (!Number.isInteger(deploymentRunId) || deploymentRunId <= 0) throw new Error("DEPLOYMENT_RUN_ID is invalid");
  if (!UUID_RE.test(workerVersionId)) throw new Error("WORKER_VERSION_ID is invalid");

  const whereClause = `status = 'queued' AND github_run_id IS NULL AND created_at < '${cutoff}'`;
  const before = queryCount(whereClause, wranglerConfig);
  if (before > maxRows) {
    throw new Error(`Refusing reconciliation: target row count ${before} exceeds reviewed max_rows=${maxRows}`);
  }

  let changed = 0;
  if (before > 0) {
    const mutation = runWrangler(
      [
        "d1",
        "execute",
        "DB",
        "--remote",
        "--config",
        wranglerConfig,
        "--command",
        `UPDATE calculation_jobs
         SET status = 'failed',
             error_code = '${ERROR_CODE}',
             completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
             updated_at = CURRENT_TIMESTAMP
         WHERE ${whereClause};
         SELECT changes() AS changed;`,
        "--json",
      ],
      true,
    );
    changed = parseScalar(mutation.stdout, "changed");
    if (changed !== before) {
      throw new Error(`Reconciliation mutation cardinality mismatch: expected=${before} changed=${changed}`);
    }
  }

  const after = queryCount(whereClause, wranglerConfig);
  if (after !== 0) {
    throw new Error(`Reconciliation did not converge: ${after} target row(s) remain`);
  }

  const evidence = {
    schema_version: 1,
    check_name: "e1c_a1_legacy_unbound_queued_reconciliation",
    status: "passed",
    observed_at: new Date().toISOString(),
    source_sha: sourceSha,
    deployment_run_id: deploymentRunId,
    worker_version_id: workerVersionId,
    selection_contract: {
      status: "queued",
      github_run_id: null,
      created_before_utc: cutoff,
      age_is_not_liveness_authority: true,
      live_github_run_check_required_by_workflow: true,
    },
    result: {
      target_rows_before: before,
      mutation_changes: changed,
      target_rows_after: after,
      terminal_status: "failed",
      error_code: ERROR_CODE,
      transaction_or_snapshot_rows_mutated: false,
      tenant_identity_recorded: false,
      calculation_job_ids_recorded: false,
    },
  };
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  console.log(`Legacy calculation-job reconciliation passed: before=${before} changed=${changed} after=${after}`);
}

function queryCount(whereClause, wranglerConfig) {
  const result = runWrangler(
    [
      "d1",
      "execute",
      "DB",
      "--remote",
      "--config",
      wranglerConfig,
      "--command",
      `SELECT COUNT(*) AS total FROM calculation_jobs WHERE ${whereClause};`,
      "--json",
    ],
    true,
  );
  return parseScalar(result.stdout, "total");
}

function parseScalar(stdout, key) {
  const parsed = JSON.parse(stdout);
  const value = Number(parsed?.at(-1)?.results?.[0]?.[key]);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`D1 reconciliation ${key} query returned an invalid result`);
  }
  return value;
}

function runWrangler(args, capture) {
  const commandName = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(commandName, ["wrangler", ...args], {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: { ...process.env, CI: "true" },
  });
  if (result.status !== 0) {
    throw new Error(`Wrangler command failed without exposing D1 row data: ${result.stderr || "unknown error"}`);
  }
  return result;
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const command = process.argv[2];
  if (command === "verify-request") {
    verifyRequest(process.argv[3]);
    return;
  }
  if (command === "check-github-active-runs") {
    await checkGitHubActiveRuns({
      token: required("GH_TOKEN"),
      repository: required("GITHUB_REPOSITORY"),
      workflow: process.env.UPDATE_WORKFLOW || "update.yml",
    });
    return;
  }
  if (command === "execute") {
    executeReconciliation();
    return;
  }
  throw new Error(
    "Usage: reconcile_legacy_calculation_jobs.mjs <verify-request PATH|check-github-active-runs|execute>",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "legacy reconciliation failed");
    process.exitCode = 1;
  });
}
