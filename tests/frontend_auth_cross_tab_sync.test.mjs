import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  AUTH_STORAGE_EVENT_KIND,
  classifyCrossTabAuthEvent,
} from '../src/services/authCrossTabSync.js';
import { TOKEN_STORAGE_KEY } from '../src/services/projectStorage.js';

const encodeBase64Url = (value) => Buffer.from(value)
  .toString('base64')
  .replace(/=/g, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_');

const makeJwt = (claims) => (
  `${encodeBase64Url('{"alg":"none"}')}.${encodeBase64Url(JSON.stringify(claims))}.signature`
);

const NOW_MS = 1_800_000_000_000;
const validToken = (email, extra = {}) => makeJwt({
  exp: Math.floor(NOW_MS / 1000) + 3600,
  email,
  ...extra,
});

const eventFor = (newValue, storageArea = null) => ({
  key: TOKEN_STORAGE_KEY,
  newValue,
  storageArea,
});

test('unrelated storage keys and another Storage area are ignored', () => {
  const localStorage = {};
  const sessionStorage = {};

  assert.deepEqual(
    classifyCrossTabAuthEvent({ key: 'email', newValue: 'x' }, { expectedStorage: localStorage }),
    { kind: AUTH_STORAGE_EVENT_KIND.IGNORE },
  );
  assert.deepEqual(
    classifyCrossTabAuthEvent(eventFor(validToken('user@example.com'), sessionStorage), {
      expectedStorage: localStorage,
      nowMs: NOW_MS,
    }),
    { kind: AUTH_STORAGE_EVENT_KIND.IGNORE },
  );
});

test('token deletion is a cross-tab sign-out', () => {
  assert.deepEqual(
    classifyCrossTabAuthEvent(eventFor(null), { nowMs: NOW_MS }),
    { kind: AUTH_STORAGE_EVENT_KIND.SIGNED_OUT },
  );
});

test('same signed tenant token replacement is adopted as a refresh without reload semantics', () => {
  const nextToken = validToken(' USER@example.com ', {
    name: 'Signed Name',
    picture: 'https://images.example.test/user.png',
  });
  const result = classifyCrossTabAuthEvent(eventFor(nextToken), {
    currentToken: validToken('user@example.com'),
    currentEmail: 'user@example.com',
    nowMs: NOW_MS,
  });

  assert.equal(result.kind, AUTH_STORAGE_EVENT_KIND.TOKEN_REFRESHED);
  assert.equal(result.token, nextToken);
  assert.equal(result.email, 'user@example.com');
  assert.equal(result.claims.name, 'Signed Name');
  assert.equal(Object.isFrozen(result), true);
});

test('different signed tenant or previously signed-out tab requires a full session reconstruction', () => {
  const otherToken = validToken('other@example.com');
  const switched = classifyCrossTabAuthEvent(eventFor(otherToken), {
    currentToken: validToken('user@example.com'),
    currentEmail: 'user@example.com',
    nowMs: NOW_MS,
  });
  assert.equal(switched.kind, AUTH_STORAGE_EVENT_KIND.SESSION_CHANGED);
  assert.equal(switched.email, 'other@example.com');

  const newlySignedIn = classifyCrossTabAuthEvent(eventFor(otherToken), {
    currentToken: '',
    currentEmail: '',
    nowMs: NOW_MS,
  });
  assert.equal(newlySignedIn.kind, AUTH_STORAGE_EVENT_KIND.SESSION_CHANGED);
});

test('invalid, expired, or unsigned-tenant replacement fails closed', () => {
  const invalid = [
    'not-a-jwt',
    makeJwt({ exp: Math.floor(NOW_MS / 1000) - 1, email: 'user@example.com' }),
    makeJwt({ exp: Math.floor(NOW_MS / 1000) + 3600 }),
  ];

  for (const nextToken of invalid) {
    assert.deepEqual(
      classifyCrossTabAuthEvent(eventFor(nextToken), {
        currentEmail: 'user@example.com',
        nowMs: NOW_MS,
      }),
      { kind: AUTH_STORAGE_EVENT_KIND.INVALID },
    );
  }
});

test('a storage event carrying the already-published token is ignored', () => {
  const token = validToken('user@example.com');
  assert.deepEqual(
    classifyCrossTabAuthEvent(eventFor(token), {
      currentToken: token,
      currentEmail: 'user@example.com',
      nowMs: NOW_MS,
    }),
    { kind: AUTH_STORAGE_EVENT_KIND.IGNORE },
  );
});

test('auth store integrates every cross-tab auth generation without trusting localStorage profile fields', async () => {
  const source = await readFile(new URL('../src/stores/auth.js', import.meta.url), 'utf8');
  const handlerStart = source.indexOf('const handleStorageEvent = (event) => {');
  const handlerEnd = source.indexOf('\n  const startStorageSync', handlerStart);
  assert.notEqual(handlerStart, -1);
  assert.notEqual(handlerEnd, -1);
  const handler = source.slice(handlerStart, handlerEnd);

  assert.match(handler, /classifyCrossTabAuthEvent\(event/);
  assert.match(handler, /expectedStorage: globalThis\.localStorage/);
  assert.match(handler, /currentToken: token\.value/);
  assert.match(handler, /currentEmail: user\.value\.email/);

  assert.match(handler, /AUTH_STORAGE_EVENT_KIND\.SIGNED_OUT/);
  assert.match(handler, /AUTH_STORAGE_EVENT_KIND\.INVALID/);
  assert.match(handler, /AUTH_STORAGE_EVENT_KIND\.TOKEN_REFRESHED/);
  assert.match(handler, /AUTH_STORAGE_EVENT_KIND\.SESSION_CHANGED/);

  const refreshBranch = handler.slice(
    handler.indexOf('AUTH_STORAGE_EVENT_KIND.TOKEN_REFRESHED'),
    handler.indexOf('AUTH_STORAGE_EVENT_KIND.SESSION_CHANGED'),
  );
  assert.match(refreshBranch, /cancelTokenRefresh\(\)/);
  assert.match(refreshBranch, /token\.value = change\.token/);
  assert.match(refreshBranch, /email: change\.email/);
  assert.doesNotMatch(refreshBranch, /localStorage\.getItem|readAuthenticationStorage/);
  assert.doesNotMatch(refreshBranch, /reload/);

  const sessionBranch = handler.slice(handler.indexOf('AUTH_STORAGE_EVENT_KIND.SESSION_CHANGED'));
  const clearIndex = sessionBranch.indexOf('clearInMemoryAuthState()');
  const reloadIndex = sessionBranch.indexOf('globalThis.location?.reload?.()');
  assert.notEqual(clearIndex, -1);
  assert.notEqual(reloadIndex, -1);
  assert.equal(clearIndex < reloadIndex, true);

  const invalidBranch = handler.slice(
    handler.indexOf('AUTH_STORAGE_EVENT_KIND.INVALID'),
    handler.indexOf('AUTH_STORAGE_EVENT_KIND.TOKEN_REFRESHED'),
  );
  assert.match(invalidBranch, /clearInMemoryAuthState\(\)/);
  assert.doesNotMatch(invalidBranch, /clearSensitiveProjectStorage|removeItem|reload/);

  assert.doesNotMatch(handler, /event\.newValue === null\) \{\s*clearInMemoryAuthState\(\);\s*console\.log\([^]*?\}\s*$/);
});
