const listeners = new Set();

const normalizeMethod = value => String(value || 'GET').toUpperCase();

const resolveUrl = (input) => {
  const candidate = typeof input === 'string'
    ? input
    : (input && typeof input.url === 'string' ? input.url : '');
  if (!candidate) return null;
  try {
    return new URL(candidate, 'http://request.local');
  } catch {
    return null;
  }
};

export const subscribeRequestFailure = (listener) => {
  if (typeof listener !== 'function') {
    throw new TypeError('request failure listener must be a function');
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const publishRequestFailure = ({
  input,
  init = {},
  error,
  externallyAborted = false,
} = {}) => {
  if (externallyAborted) return false;
  const url = resolveUrl(input);
  if (!url) return false;
  const method = normalizeMethod(init?.method || input?.method);
  const event = Object.freeze({
    pathname: url.pathname,
    method,
    error,
  });

  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch {
      // Observability/recovery subscribers must never change request semantics.
    }
  }
  return listeners.size > 0;
};
