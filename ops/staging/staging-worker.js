import deploymentWorker from '../../worker-entry.js';

const DEPLOYMENT_ENVIRONMENT = 'staging';
const STAGING_WORKER_SERVICE = 'journal-backend-staging';
const STAGING_FRONTEND_ORIGIN = 'https://staging.sheet-trading-journal.pages.dev';
const PRODUCTION_GOOGLE_CLIENT_ID =
  '951186116587-0ehsmkvlu3uivduc7kjn1jpp9ga7810i.apps.googleusercontent.com';
const GOOGLE_CLIENT_ID_RE = /^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i;

export default {
  async fetch(request, env, ctx) {
    const configurationErrors = validateStagingRuntime(env);
    if (configurationErrors.length > 0) {
      console.error('Staging Worker configuration rejected', configurationErrors.join('; '));
      return stagingJsonResponse(
        {
          success: false,
          error: 'Staging service is not configured',
          error_meta: { code: 'STAGING_CONFIGURATION_ERROR' },
        },
        503,
        request,
      );
    }

    const origin = request.headers.get('Origin');
    if (origin && !isStagingOriginAllowed(origin)) {
      return stagingJsonResponse(
        {
          success: false,
          error: 'Origin not allowed',
          error_meta: { code: 'ORIGIN_FORBIDDEN' },
        },
        403,
        request,
      );
    }

    const response = await deploymentWorker.fetch(request, env, ctx);
    return annotateStagingResponse(response);
  },
};

function validateStagingRuntime(env = {}) {
  const errors = [];
  if (String(env.DEPLOYMENT_ENVIRONMENT || '').trim() !== DEPLOYMENT_ENVIRONMENT) {
    errors.push('DEPLOYMENT_ENVIRONMENT must be staging');
  }

  const configuredOrigins = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    configuredOrigins.length !== 1
    || configuredOrigins[0] !== STAGING_FRONTEND_ORIGIN
  ) {
    errors.push('ALLOWED_ORIGINS must contain only the exact staging frontend origin');
  }

  const googleClientId = String(env.GOOGLE_CLIENT_ID || '').trim();
  if (!GOOGLE_CLIENT_ID_RE.test(googleClientId)) {
    errors.push('GOOGLE_CLIENT_ID must be a valid Google web OAuth client ID');
  } else if (googleClientId === PRODUCTION_GOOGLE_CLIENT_ID) {
    errors.push('GOOGLE_CLIENT_ID must not be the production OAuth client');
  }

  const apiSecret = String(env.API_SECRET || '');
  if (apiSecret.length < 32 || apiSecret.length > 4096) {
    errors.push('API_SECRET must be a dedicated staging secret of 32 to 4096 characters');
  }

  if (String(env.GITHUB_TOKEN || '').trim()) {
    errors.push('GITHUB_TOKEN is forbidden in the staging Worker');
  }
  return errors;
}

function isStagingOriginAllowed(origin) {
  return origin === STAGING_FRONTEND_ORIGIN;
}

function annotateStagingResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('X-Deployment-Environment', DEPLOYMENT_ENVIRONMENT);
  headers.set('X-Worker-Service', STAGING_WORKER_SERVICE);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function stagingJsonResponse(data, status, request) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Deployment-Environment': DEPLOYMENT_ENVIRONMENT,
    'X-Worker-Service': STAGING_WORKER_SERVICE,
  });
  if (isStagingOriginAllowed(request.headers.get('Origin'))) {
    headers.set('Access-Control-Allow-Origin', STAGING_FRONTEND_ORIGIN);
    headers.set('Vary', 'Origin');
  }
  return new Response(JSON.stringify(data), { status, headers });
}

export const __test = {
  DEPLOYMENT_ENVIRONMENT,
  STAGING_WORKER_SERVICE,
  STAGING_FRONTEND_ORIGIN,
  PRODUCTION_GOOGLE_CLIENT_ID,
  validateStagingRuntime,
  isStagingOriginAllowed,
  annotateStagingResponse,
};
