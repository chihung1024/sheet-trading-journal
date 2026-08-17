import canonicalWorker, { __test as canonicalTest } from './worker.js';
import { tryHandleDividendEventCreate } from './worker-dividend-event.js';
import { tryHandleJournalRestore } from './worker-journal-restore.js';

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);
const IDEMPOTENT_RECORD_CREATE_PATH = '/api/records/idempotent';
const CANONICAL_RECORDS_PATH = '/api/records';

export default {
  async fetch(request, env = {}, ctx) {
    const policy = getExplicitOriginPolicy(env);
    if (policy.explicit) {
      const origin = request.headers.get('Origin');
      if (origin && !policy.allowedOrigins.has(origin)) {
        return originForbiddenResponse();
      }
    }

    const entryDependencies = {
      canonicalWorker,
      canonicalTest,
      isOriginAllowed(origin, runtimeEnv) {
        const runtimePolicy = getExplicitOriginPolicy(runtimeEnv);
        return runtimePolicy.explicit
          ? runtimePolicy.allowedOrigins.has(origin)
          : canonicalTest.isOriginAllowed(origin, runtimeEnv);
      },
    };

    const restoreResponse = await tryHandleJournalRestore(request, env, ctx, entryDependencies);
    if (restoreResponse) return restoreResponse;

    const dividendResponse = await tryHandleDividendEventCreate(
      request,
      env,
      ctx,
      entryDependencies,
    );
    if (dividendResponse) return dividendResponse;

    return canonicalWorker.fetch(routeRecordCreateRequest(request), env, ctx);
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
  routeRecordCreateRequest,
});

function routeRecordCreateRequest(request) {
  if (request?.method !== 'POST') return request;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return request;
  }
  if (url.pathname !== IDEMPOTENT_RECORD_CREATE_PATH) return request;

  url.pathname = CANONICAL_RECORDS_PATH;
  return new Request(url.toString(), request);
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
