import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const WORKFLOW_PATH = ".github/workflows/production-legacy-job-reconciliation.yml";
const CONCURRENCY_GROUP = "production-legacy-job-reconciliation";
const OPERATION = "e1c_a1_cancel_stuck_scheduler_run";
const API_VERSION = "2026-03-10";
const TARGET_RUN_ID = 31479868929;
const TARGET_PRODUCTION_JOB_ID = 93742148875;
const EXPECTED_HEAD_SHA = "8f9f942cc22b70e5bbec0f05438b0a74fefb8057";
const SUCCESSOR_RUN_ID = 31516843313;
const SUCCESSOR_HEAD_SHA = "66a9c8cccfc3e912d5d65a25c0ad4bdab8796890";

export function validateRequest(request) {
  if (request?.schema_version !== 1) throw new Error("scheduler recovery schema_version must equal 1");
  if (request?.status !== "ready") throw new Error("scheduler recovery status must equal ready");
  if (request?.operation !== OPERATION) throw new Error("scheduler recovery operation is not authorized");
  if (request?.target_run_id !== TARGET_RUN_ID) {
    throw new Error("target_run_id is not the exact reviewed one-shot recovery target");
  }
  if (request?.target_production_job_id !== TARGET_PRODUCTION_JOB_ID) {
    throw new Error("target_production_job_id is not the exact reviewed one-shot recovery target");
  }
  if (request?.expected_head_sha !== EXPECTED_HEAD_SHA) {
    throw new Error("expected_head_sha is not the exact reviewed one-shot recovery source");
  }
  if (request?.expected_workflow_path !== WORKFLOW_PATH) {
    throw new Error("expected_workflow_path is not authorized");
  }
  if (request?.successor_run_id !== SUCCESSOR_RUN_ID) {
    throw new Error("successor_run_id is not the exact reviewed pending successor");
  }
  if (request?.successor_head_sha !== SUCCESSOR_HEAD_SHA) {
    throw new Error("successor_head_sha is not the exact reviewed pending successor source");
  }
  if (typeof request?.reason !== "string" || request.reason.trim().length < 30) {
    throw new Error("scheduler recovery reason is required");
  }
  return {
    target_run_id: TARGET_RUN_ID,
    target_production_job_id: TARGET_PRODUCTION_JOB_ID,
    expected_head_sha: EXPECTED_HEAD_SHA,
    expected_workflow_path: WORKFLOW_PATH,
    successor_run_id: SUCCESSOR_RUN_ID,
    successor_head_sha: SUCCESSOR_HEAD_SHA,
  };
}

async function githubJson({ token, repository, path, method = "GET", fetchImpl = fetch }) {
  if (!token) throw new Error("GH_TOKEN is required");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository || "")) {
    throw new Error("GITHUB_REPOSITORY is invalid");
  }
  const response = await fetchImpl(`https://api.github.com/repos/${repository}${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": API_VERSION,
    },
    redirect: "error",
    cache: "no-store",
  });
  let body = null;
  if (response.status !== 204) {
    const text = await response.text();
    body = text ? JSON.parse(text) : null;
  }
  return { response, body };
}

export async function inspectTarget({ token, repository, request, fetchImpl = fetch }) {
  const validated = validateRequest(request);
  const runResult = await githubJson({
    token,
    repository,
    path: `/actions/runs/${validated.target_run_id}`,
    fetchImpl,
  });
  if (!runResult.response.ok) throw new Error(`target run lookup failed: HTTP ${runResult.response.status}`);
  const run = runResult.body;
  if (run?.status !== "queued" || run?.conclusion !== null) {
    throw new Error(`target run is no longer scheduler-stuck queued: status=${run?.status} conclusion=${run?.conclusion}`);
  }
  if (run?.head_sha !== validated.expected_head_sha) throw new Error("target run head SHA changed");
  if (run?.path !== validated.expected_workflow_path) throw new Error("target run workflow path changed");
  if (run?.run_attempt !== 1) throw new Error("target run attempt is not the reviewed first attempt");

  const pendingResult = await githubJson({
    token,
    repository,
    path: `/actions/runs/${validated.target_run_id}/pending_deployments`,
    fetchImpl,
  });
  if (!pendingResult.response.ok) {
    throw new Error(`pending deployment lookup failed: HTTP ${pendingResult.response.status}`);
  }
  if (!Array.isArray(pendingResult.body) || pendingResult.body.length !== 0) {
    throw new Error("target run still has a pending production approval boundary");
  }

  const jobsResult = await githubJson({
    token,
    repository,
    path: `/actions/runs/${validated.target_run_id}/jobs?filter=latest&per_page=100`,
    fetchImpl,
  });
  if (!jobsResult.response.ok) throw new Error(`target job lookup failed: HTTP ${jobsResult.response.status}`);
  const jobs = Array.isArray(jobsResult.body?.jobs) ? jobsResult.body.jobs : [];
  const preflight = jobs.find((job) => job?.name === "Verify reconciliation request before reviewer gate");
  const production = jobs.find((job) => job?.id === validated.target_production_job_id);
  if (preflight?.status !== "completed" || preflight?.conclusion !== "success") {
    throw new Error("reviewed reconciliation preflight is not completed success");
  }
  if (!production) throw new Error("reviewed production job was not found");
  if (production.status !== "queued" || production.conclusion !== null) {
    throw new Error("production job is no longer queued without a conclusion");
  }
  if (production.runner_id !== null || production.runner_name !== null) {
    throw new Error("production job already has a runner; refusing scheduler cancellation");
  }
  if (!Array.isArray(production.steps) || production.steps.length !== 0) {
    throw new Error("production job execution-step state is not exactly empty");
  }

  const groupResult = await githubJson({
    token,
    repository,
    path: `/actions/concurrency_groups/${encodeURIComponent(CONCURRENCY_GROUP)}`,
    fetchImpl,
  });
  if (!groupResult.response.ok) {
    throw new Error(`concurrency group lookup failed: HTTP ${groupResult.response.status}`);
  }
  const members = Array.isArray(groupResult.body?.group_members) ? groupResult.body.group_members : [];
  if (groupResult.body?.total_count !== 2 || members.length !== 2) {
    throw new Error("scheduler recovery requires exactly the target and reviewed pending successor");
  }
  const targetMember = members.find((member) => member?.run_id === validated.target_run_id);
  const successorMember = members.find((member) => member?.run_id === validated.successor_run_id);
  if (!targetMember || targetMember.status !== "in_progress") {
    throw new Error("target is not the active owner of the reconciliation concurrency group");
  }
  if (!successorMember || successorMember.status !== "pending") {
    throw new Error("reviewed successor is not the sole pending reconciliation group member");
  }

  const successorResult = await githubJson({
    token,
    repository,
    path: `/actions/runs/${validated.successor_run_id}`,
    fetchImpl,
  });
  if (!successorResult.response.ok) {
    throw new Error(`successor run lookup failed: HTTP ${successorResult.response.status}`);
  }
  const successor = successorResult.body;
  if (successor?.status !== "pending" || successor?.conclusion !== null) {
    throw new Error("reviewed successor is no longer pending without a conclusion");
  }
  if (successor?.head_sha !== validated.successor_head_sha) throw new Error("successor head SHA changed");
  if (successor?.path !== validated.expected_workflow_path) throw new Error("successor workflow path changed");
  if (successor?.run_attempt !== 1) throw new Error("successor run attempt is not the reviewed first attempt");
  if (successor?.event !== "push") throw new Error("successor event is not the reviewed push event");

  const successorJobsResult = await githubJson({
    token,
    repository,
    path: `/actions/runs/${validated.successor_run_id}/jobs?filter=latest&per_page=100`,
    fetchImpl,
  });
  if (!successorJobsResult.response.ok) {
    throw new Error(`successor job lookup failed: HTTP ${successorJobsResult.response.status}`);
  }
  const successorJobs = successorJobsResult.body?.jobs;
  if (!Array.isArray(successorJobs) || successorJobs.length !== 0) {
    throw new Error("reviewed successor has already materialized execution jobs");
  }

  return {
    target_run_id: validated.target_run_id,
    target_production_job_id: validated.target_production_job_id,
    head_sha: run.head_sha,
    workflow_path: run.path,
    run_status: run.status,
    production_job_status: production.status,
    runner_assigned: false,
    execution_steps_started: false,
    pending_deployments: 0,
    concurrency_group_member_count: 2,
    successor_run_id: validated.successor_run_id,
    successor_head_sha: validated.successor_head_sha,
    successor_status: successor.status,
    successor_jobs_started: false,
  };
}

export async function executeRecovery({ token, repository, request, fetchImpl = fetch, sleepImpl = sleep }) {
  const first = await inspectTarget({ token, repository, request, fetchImpl });
  await sleepImpl(1000);
  const final = await inspectTarget({ token, repository, request, fetchImpl });
  if (JSON.stringify(first) !== JSON.stringify(final)) {
    throw new Error("scheduler target or successor changed between recovery observations");
  }

  const cancelResult = await githubJson({
    token,
    repository,
    path: `/actions/runs/${first.target_run_id}/cancel`,
    method: "POST",
    fetchImpl,
  });
  if (cancelResult.response.status !== 202) {
    throw new Error(`GitHub scheduler cancellation failed: HTTP ${cancelResult.response.status}`);
  }

  let terminal = null;
  for (let attempt = 1; attempt <= 24; attempt += 1) {
    const runResult = await githubJson({
      token,
      repository,
      path: `/actions/runs/${first.target_run_id}`,
      fetchImpl,
    });
    if (!runResult.response.ok) throw new Error(`post-cancel run lookup failed: HTTP ${runResult.response.status}`);
    if (runResult.body?.status === "completed") {
      terminal = {
        status: runResult.body.status,
        conclusion: runResult.body.conclusion,
      };
      break;
    }
    await sleepImpl(2500);
  }
  if (!terminal) throw new Error("target run did not reach a terminal state after cancellation request");
  if (terminal.conclusion !== "cancelled") {
    throw new Error(`target run reached unexpected terminal conclusion=${terminal.conclusion}`);
  }

  return {
    ...first,
    cancel_http_status: 202,
    terminal_status: terminal.status,
    terminal_conclusion: terminal.conclusion,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadRequest(path) {
  if (!path) throw new Error("scheduler recovery request path is required");
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeOutputs(result) {
  if (!process.env.GITHUB_OUTPUT) return;
  for (const [key, value] of Object.entries(result)) {
    if (["string", "number", "boolean"].includes(typeof value)) {
      appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`, "utf8");
    }
  }
}

async function main() {
  const command = process.argv[2];
  const request = loadRequest(process.argv[3]);
  if (command === "verify-request") {
    const result = validateRequest(request);
    writeOutputs(result);
    console.log(`Validated scheduler recovery request for run=${result.target_run_id} successor=${result.successor_run_id}`);
    return;
  }
  if (command === "execute") {
    const result = await executeRecovery({
      token: process.env.GH_TOKEN,
      repository: process.env.GITHUB_REPOSITORY,
      request,
    });
    const evidence = {
      schema_version: 1,
      check_name: "e1c_a1_scheduler_recovery",
      status: "passed",
      observed_at: new Date().toISOString(),
      result,
      production_data_mutated: false,
      production_secrets_required: false,
    };
    const output = process.env.AUDIT_OUTPUT || "production-e1c-a1-scheduler-recovery.json";
    writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
    console.log(`Scheduler recovery passed: cancelled run=${result.target_run_id}; preserved successor=${result.successor_run_id}`);
    return;
  }
  throw new Error("Usage: recover_stuck_reconciliation_run.mjs <verify-request PATH|execute PATH>");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "scheduler recovery failed");
    process.exitCode = 1;
  });
}
