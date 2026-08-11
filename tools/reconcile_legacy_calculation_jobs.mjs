import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const SHA_RE = /^[0-9a-f]{40}$/;
const SQL_UTC_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPERATION = "e1c_a1_legacy_unbound_queued_reconciliation";
const ERROR_CODE = "LEGACY_DISPATCH_UNBOUND_RECONCILED";

const command = process.argv[2];
if (command === "verify-request") {
  verifyRequest(process.argv[3]);
} else if (command === "execute") {
  executeReconciliation();
} else {
  throw new Error("Usage: reconcile_legacy_calculation_jobs.mjs <verify-request PATH|execute>");
}

function verifyRequest(requestPath) {
  if (!requestPath) throw new Error("request path is required");
  const request = JSON.parse(readFileSync(requestPath, "utf8"));

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

  const outputs = {
    source_sha: request.expected_runtime_source,
    cutoff_utc: request.legacy_created_before_utc,
    max_rows: String(request.max_rows),
    deployment_run_id: String(request.deployment_run_id),
    worker_version_id: request.worker_version_id,
  };
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

  const whereClause =
    `status = 'queued' AND github_run_id IS NULL AND created_at < '${cutoff}'`;
  const before = queryCount(whereClause, wranglerConfig);
  if (before > maxRows) {
    throw new Error(`Refusing reconciliation: target row count ${before} exceeds reviewed max_rows=${maxRows}`);
  }

  if (before > 0) {
    runWrangler(
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
         WHERE ${whereClause};`,
        "--json",
      ],
      true,
    );
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
      reconciled_rows: before - after,
      target_rows_after: after,
      terminal_status: "failed",
      error_code: ERROR_CODE,
      transaction_or_snapshot_rows_mutated: false,
      tenant_identity_recorded: false,
      calculation_job_ids_recorded: false,
    },
  };
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  console.log(
    `Legacy calculation-job reconciliation passed: before=${before} reconciled=${before - after} after=${after}`,
  );
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
  const parsed = JSON.parse(result.stdout);
  const value = Number(parsed?.[0]?.results?.[0]?.total);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("D1 reconciliation count query returned an invalid result");
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
