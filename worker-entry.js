import canonicalWorker, { __test as canonicalTest } from './worker.js';

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

export default {
  async fetch(request, env = {}, ctx) {
    const policy = getExplicitOriginPolicy(env);
    if (!policy.explicit) {
      return canonicalWorker.fetch(request, env, ctx);
    }

    const origin = request.headers.get('Origin');
    if (origin && !policy.allowedOrigins.has(origin)) {
      return originForbiddenResponse();
    }

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
});

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
