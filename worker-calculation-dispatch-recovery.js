const STATUS_PATH = '/api/calculation-jobs/status';
const RECOVERABLE_DISPATCH_ERROR_CODES = new Set([
  'GITHUB_DISPATCH_TIMEOUT',
  'GITHUB_DISPATCH_FAILED',
]);

export async function tryRecoverAmbiguousCalculationCallback(
  request,
  env = {},
  { canonicalTest = {} } = {},
) {
  if (!isRunningStatusCallback(request)) return false;
  if (!env?.DB || typeof env.DB.prepare !== 'function') return false;

  const apiKey = request.headers.get('X-API-KEY');
  if (
    typeof env.API_SECRET !== 'string'
    || !env.API_SECRET
    || typeof apiKey !== 'string'
    || typeof canonicalTest.constantTimeEqual !== 'function'
    || !canonicalTest.constantTimeEqual(apiKey, env.API_SECRET)
  ) {
    return false;
  }

  let body;
  try {
    body = await request.clone().json();
  } catch {
    return false;
  }
  if (String(body?.status || '').toLowerCase() !== 'running') return false;

  let jobId;
  let githubRunId;
  let githubRunAttempt;
  try {
    if (typeof canonicalTest.validateCalculationJobId !== 'function') return false;
    if (typeof canonicalTest.validateGitHubRunId !== 'function') return false;
    jobId = canonicalTest.validateCalculationJobId(body.job_id);
    githubRunId = canonicalTest.validateGitHubRunId(body.github_run_id);
    githubRunAttempt = Number(body.github_run_attempt ?? 0);
    if (!Number.isSafeInteger(githubRunAttempt) || githubRunAttempt < 0) return false;
  } catch {
    return false;
  }

  try {
    const statement = env.DB.prepare(`
      UPDATE calculation_jobs
      SET
        status = 'running',
        github_run_id = ?,
        github_run_attempt = CASE WHEN ? > github_run_attempt THEN ? ELSE github_run_attempt END,
        attempt_count = attempt_count + 1,
        error_code = NULL,
        started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
        completed_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE public_id = ?
        AND status = 'failed'
        AND error_code IN ('GITHUB_DISPATCH_TIMEOUT', 'GITHUB_DISPATCH_FAILED')
        AND github_run_id IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM calculation_jobs AS active
          WHERE active.user_id = calculation_jobs.user_id
            AND active.benchmark = calculation_jobs.benchmark
            AND active.public_id <> calculation_jobs.public_id
            AND active.status IN ('queued', 'running')
        )
        AND NOT EXISTS (
          SELECT 1
          FROM calculation_jobs AS newer
          WHERE newer.user_id = calculation_jobs.user_id
            AND newer.benchmark = calculation_jobs.benchmark
            AND newer.id > calculation_jobs.id
        )
    `);
    const result = await statement
      .bind(githubRunId, githubRunAttempt, githubRunAttempt, jobId)
      .run();
    return affectedRows(result) === 1;
  } catch (error) {
    console.error(
      `[calculation_dispatch_recovery] Recovery attempt failed [error=${safeErrorName(error)}]`,
    );
    return false;
  }
}

export function isRecoverableDispatchErrorCode(value) {
  return RECOVERABLE_DISPATCH_ERROR_CODES.has(String(value || '').toUpperCase());
}

function isRunningStatusCallback(request) {
  if (request?.method !== 'POST') return false;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }
  if (url.pathname !== STATUS_PATH) return false;
  const contentType = request.headers.get('Content-Type') || '';
  return contentType.toLowerCase().startsWith('application/json');
}

function affectedRows(result) {
  return Number(result?.meta?.changes ?? result?.changes ?? 0);
}

function safeErrorName(error) {
  return error instanceof Error ? error.name : 'UnknownError';
}

export const __test = Object.freeze({
  RECOVERABLE_DISPATCH_ERROR_CODES,
  isRunningStatusCallback,
});
