import { readFileSync } from 'node:fs';

const CONTRACT_URL = new URL('../config/deployment-environments.json', import.meta.url);
const GOOGLE_CLIENT_ID_RE = /^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export const DEPLOYMENT_CONTRACT = Object.freeze(
  JSON.parse(readFileSync(CONTRACT_URL, 'utf8')),
);

validateContract(DEPLOYMENT_CONTRACT);

export class FrontendEnvironmentPolicyError extends Error {
  constructor(errors) {
    super(`Frontend environment isolation policy failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
    this.name = 'FrontendEnvironmentPolicyError';
    this.errors = Object.freeze([...errors]);
  }
}

export function validateFrontendEnvironment(source = process.env) {
  const env = readEnvironment(source);
  const errors = [];
  const mainBranch = DEPLOYMENT_CONTRACT.main_branch;
  const allowedEnvironments = new Set(DEPLOYMENT_CONTRACT.allowed_deploy_environments);

  if (env.deployEnvironment && !allowedEnvironments.has(env.deployEnvironment)) {
    errors.push('VITE_DEPLOY_ENV is not one of the terminal deployment environments');
  }

  if (env.isCloudflarePages && !env.pagesBranch) {
    errors.push('CF_PAGES_BRANCH is required when CF_PAGES identifies a Pages build');
  }

  let context = 'local-or-ci';
  if (env.isCloudflarePages && env.pagesBranch === mainBranch) {
    context = 'pages-production';
    validateProductionEnvironment(env, errors, { requireExplicitValues: false });
  } else if (env.isCloudflarePages && env.pagesBranch) {
    context = 'pages-non-main-disabled';
    errors.push('Cloudflare Pages non-main builds are disabled in the frozen terminal source');
  } else if (env.deployEnvironment === 'production') {
    context = 'explicit-production';
    validateProductionEnvironment(env, errors, { requireExplicitValues: true });
  }

  if (errors.length > 0) {
    throw new FrontendEnvironmentPolicyError(errors);
  }

  return Object.freeze({
    context,
    deployEnvironment: env.deployEnvironment || null,
    pagesBranch: env.pagesBranch || null,
    isCloudflarePages: env.isCloudflarePages,
    configurationMode:
      context === 'pages-production' && !env.apiUrl && !env.googleClientId
        ? 'legacy-production-fallback'
        : 'explicit',
  });
}

function readEnvironment(source) {
  const value = (name) => String(source?.[name] || '').trim();
  const pagesFlag = value('CF_PAGES').toLowerCase();
  const pagesBranch = value('CF_PAGES_BRANCH');

  return {
    deployEnvironment: value('VITE_DEPLOY_ENV').toLowerCase(),
    apiUrl: value('VITE_API_URL'),
    googleClientId: value('VITE_GOOGLE_CLIENT_ID'),
    pagesBranch,
    isCloudflarePages:
      pagesBranch.length > 0 || ['1', 'true', 'yes'].includes(pagesFlag),
  };
}

function validateProductionEnvironment(env, errors, { requireExplicitValues }) {
  if (env.deployEnvironment && env.deployEnvironment !== 'production') {
    errors.push('The main Cloudflare Pages branch cannot declare a non-production VITE_DEPLOY_ENV');
  }

  const apiOrigin = parseOrigin(env.apiUrl, 'VITE_API_URL', errors, {
    required: requireExplicitValues,
    requireHttps: true,
    forbidLocalhost: true,
  });
  if (apiOrigin && !DEPLOYMENT_CONTRACT.production.api_origins.includes(apiOrigin)) {
    errors.push('Production builds must use a reviewed production API origin');
  }

  const clientId = validateGoogleClientId(env.googleClientId, errors, {
    required: requireExplicitValues,
  });
  if (
    clientId
    && !DEPLOYMENT_CONTRACT.production.google_client_ids.includes(clientId)
  ) {
    errors.push('Production builds must use a reviewed production Google OAuth client');
  }
}

function parseOrigin(rawValue, label, errors, { required, requireHttps, forbidLocalhost }) {
  if (!rawValue) {
    if (required) errors.push(`${label} is required for this deployment environment`);
    return null;
  }

  let parsed;
  try {
    parsed = new URL(rawValue);
  } catch {
    errors.push(`${label} must be a valid absolute URL origin`);
    return null;
  }

  if (parsed.origin !== rawValue) {
    errors.push(`${label} must be an origin only, without path, query, fragment, or trailing slash`);
  }
  if (parsed.username || parsed.password) {
    errors.push(`${label} must not contain URL credentials`);
  }
  if (requireHttps && parsed.protocol !== 'https:') {
    errors.push(`${label} must use HTTPS`);
  }
  if (forbidLocalhost && LOCAL_HOSTS.has(parsed.hostname.toLowerCase())) {
    errors.push(`${label} cannot use localhost in a deployed environment`);
  }

  return parsed.origin;
}

function validateGoogleClientId(rawValue, errors, { required }) {
  if (!rawValue) {
    if (required) errors.push('VITE_GOOGLE_CLIENT_ID is required for this deployment environment');
    return null;
  }
  if (!GOOGLE_CLIENT_ID_RE.test(rawValue)) {
    errors.push('VITE_GOOGLE_CLIENT_ID is not a valid Google web OAuth client ID');
    return null;
  }
  return rawValue;
}

function validateContract(contract) {
  const errors = [];
  if (contract.schema_version !== 1) errors.push('unsupported schema_version');
  if (!contract.main_branch) errors.push('main_branch is required');
  if (
    !Array.isArray(contract.allowed_deploy_environments)
    || contract.allowed_deploy_environments.length !== 1
    || contract.allowed_deploy_environments[0] !== 'production'
  ) {
    errors.push('allowed_deploy_environments must contain only production');
  }
  for (const key of ['api_origins', 'google_client_ids', 'frontend_origins']) {
    if (!Array.isArray(contract.production?.[key]) || contract.production[key].length === 0) {
      errors.push(`production.${key} must be a non-empty array`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid deployment environment contract: ${errors.join(', ')}`);
  }
}
