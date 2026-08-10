import canonicalWorker, { __test as canonicalTest } from './worker.js';

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);
const COMPAT_JOB_PATH_RE = /^\/api\/calculation-jobs\/(job_[A-Za-z0-9_-]{22})$/;
const COMPAT_JOB_STATUSES = new Set(['queued', 'running', 'succeeded', 'failed']);
const COMPAT_SYMBOL_RE = /^[A-Z0-9.^=\-]{1,24}$/;
const COMPAT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {
  async fetch(request, env = {}, ctx) {
    const policy = getExplicitOriginPolicy(env);
    if (policy.explicit) {
      const origin = request.headers.get('Origin');
      if (origin && !policy.allowedOrigins.has(origin)) {
        return originForbiddenResponse();
      }
    }

    const compatibilityResponse = await handleOpaqueTargetCompatibility(request, env);
    if (compatibilityResponse) return compatibilityResponse;

    return canonicalWorker.fetch(request, env, ctx);
  },
};

export const __test = Object.freeze({
  getAllowedOrigins(env = {}) {
    const policy = getExplicitOriginPolicy(env);
    return policy.explicit
      ? new Set(policy.allowedOrigins)
      : canonicalTest.getAllowedOrigins(env);
  },
  isOriginAllowed(origin, env = {}) {
    const policy = getExplicitOriginPolicy(env);
    return policy.explicit
      ? policy.allowedOrigins.has(origin)
      : canonicalTest.isOriginAllowed(origin, env);
  },
  getExplicitOriginPolicy,
  parseConfiguredOrigin,
  handleOpaqueTargetCompatibility,
});

async function handleOpaqueTargetCompatibility(request, env) {
  if (request.method !== 'GET') return null;

  const match = new URL(request.url).pathname.match(COMPAT_JOB_PATH_RE);
  if (!match) return null;

  const suppliedKey = request.headers.get('X-API-KEY');
  if (
    suppliedKey === null
    || typeof env.API_SECRET !== 'string'
    || !env.API_SECRET
    || !canonicalTest.constantTimeEqual(suppliedKey, env.API_SECRET)
  ) {
    return null;
  }

  try {
    if (!env.DB || typeof env.DB.prepare !== 'function') {
      throw new Error('D1BindingUnavailable');
    }

    const publicId = canonicalTest.validateCalculationJobId(match[1]);
    const row = await env.DB.prepare(`
      SELECT public_id, user_id, status, benchmark
      FROM calculation_jobs
      WHERE public_id = ?
      LIMIT 1
    `).bind(publicId).first();

    if (!row) {
      return compatibilityJsonResponse({
        success: false,
        error: 'Calculation job not found',
        error_meta: { code: 'NOT_FOUND' },
      }, 404);
    }

    const owner = String(row.user_id || '').trim().toLowerCase();
    const status = String(row.status || '').trim();
    const benchmark = String(row.benchmark || '').trim().toUpperCase();
    if (
      row.public_id !== publicId
      || !COMPAT_EMAIL_RE.test(owner)
      || !COMPAT_JOB_STATUSES.has(status)
      || !COMPAT_SYMBOL_RE.test(benchmark)
    ) {
      throw new Error('InvalidCalculationJobRow');
    }

    return compatibilityJsonResponse({
      success: true,
      job: {
        id: publicId,
        target_user_id: owner,
        benchmark,
        status,
      },
    });
  } catch (error) {
    console.error('Opaque calculation target compatibility lookup failed', safeCompatibilityErrorName(error));
    return compatibilityJsonResponse({
      success: false,
      error: 'Calculation job is unavailable',
      error_meta: { code: 'DATABASE_ERROR' },
    }, 500);
  }
}

function compatibilityJsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

function safeCompatibilityErrorName(error) {
  return error instanceof Error ? error.name : 'UnknownError';
}

function getExplicitOriginPolicy(env) {
  if (!hasExplicitAllowedOrigins(env)) {
    return Object.freeze({ explicit: false, allowedOrigins: new Set() });
  }

  const allowedOrigins = new Set();
  for (const candidate of String(env.ALLOWED_ORIGINS ?? '').split(',')) {
    const normalized = parseConfiguredOrigin(candidate);
    if (normalized) allowedOrigins.add(normalized);
  }

  return Object.freeze({ explicit: true, allowedOrigins });
}

function hasExplicitAllowedOrigins(env) {
  return env !== null
    && (typeof env === 'object' || typeof env === 'function')
    && Reflect.has(env, 'ALLOWED_ORIGINS');
}

function parseConfiguredOrigin(candidate) {
  const value = String(candidate ?? '').trim();
  if (!value || value === '*') return null;

  try {
    const parsed = new URL(value);
    if (!HTTP_PROTOCOLS.has(parsed.protocol)) return null;
    if (parsed.username || parsed.password) return null;
    if (parsed.origin !== value) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function originForbiddenResponse() {
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Origin not allowed',
      error_meta: {
        code: 'ORIGIN_FORBIDDEN',
        request_id: crypto.randomUUID(),
      },
    }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Vary': 'Origin',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
    },
  );
}
