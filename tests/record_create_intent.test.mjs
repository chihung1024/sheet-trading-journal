import assert from 'node:assert/strict';
import test from 'node:test';

import {
  beginRecordCreateIntent,
  completeRecordCreateIntent,
  markRecordCreateIntentTerminal,
  readEligibleRecordCreateIntents,
  RECORD_CREATE_INTENT_TTL_MS,
  rotateRecordMutationBarrier,
} from '../src/services/recordCreateIntent.js';
import {
  clearSensitiveProjectStorage,
  PENDING_RECORD_CREATE_V1_STORAGE_PREFIX,
  RECORD_MUTATION_BARRIER_STORAGE_KEY,
} from '../src/services/projectStorage.js';

class MemoryStorage {
  constructor(entries = []) {
    this.values = new Map(entries);
    this.failSet = false;
  }

  get length() {
    return this.values.size;
  }

  key(index) {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    if (this.failSet) throw new Error('storage unavailable');
    this.values.set(String(key), String(value));
  }

  removeItem(key) {
    this.values.delete(String(key));
  }
}

const ids = (...values) => {
  let index = 0;
  return () => values[index++];
};

const OWNER = 'user@example.com';
const NOW = Date.UTC(2026, 7, 14, 2, 0, 0);
const PAYLOAD = Object.freeze({ Date: '2026-08-14', Symbol: 'AAPL', Type: 'BUY', Qty: 1, Price: 100 });

test('create intent persists barrier and immutable serialized body before network use', () => {
  const storage = new MemoryStorage();
  const intent = beginRecordCreateIntent(storage, `  ${OWNER.toUpperCase()}  `, PAYLOAD, {
    now: NOW,
    createOpaqueId: ids('barrier-000000000001', 'intent-0000000000001'),
  });

  assert.equal(intent.owner, OWNER);
  assert.equal(intent.body, JSON.stringify(PAYLOAD));
  assert.equal(intent.idempotencyKey, 'intent-0000000000001');
  assert.equal(intent.barrierToken, 'barrier-000000000001');
  assert.equal(Object.isFrozen(intent), true);
  assert.equal(storage.getItem(RECORD_MUTATION_BARRIER_STORAGE_KEY)?.includes(OWNER), true);
  assert.equal(
    storage.getItem(`${PENDING_RECORD_CREATE_V1_STORAGE_PREFIX}${intent.idempotencyKey}`)?.includes(intent.body),
    true,
  );
});

test('identical legitimate creates receive distinct keys and only the newest barrier remains replay eligible', () => {
  const storage = new MemoryStorage();
  const first = beginRecordCreateIntent(storage, OWNER, PAYLOAD, {
    now: NOW,
    createOpaqueId: ids('barrier-000000000001', 'intent-0000000000001'),
  });
  const second = beginRecordCreateIntent(storage, OWNER, PAYLOAD, {
    now: NOW + 1,
    createOpaqueId: ids('barrier-000000000002', 'intent-0000000000002'),
  });

  assert.notEqual(first.idempotencyKey, second.idempotencyKey);
  assert.equal(first.body, second.body);
  const eligible = readEligibleRecordCreateIntents(storage, OWNER, { now: NOW + 2 });
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].idempotencyKey, second.idempotencyKey);
});

test('later explicit mutation barrier supersedes older pending create replay', () => {
  const storage = new MemoryStorage();
  beginRecordCreateIntent(storage, OWNER, PAYLOAD, {
    now: NOW,
    createOpaqueId: ids('barrier-000000000001', 'intent-0000000000001'),
  });
  rotateRecordMutationBarrier(storage, OWNER, {
    now: NOW + 1,
    createOpaqueId: ids('barrier-000000000002'),
  });

  assert.deepEqual(readEligibleRecordCreateIntents(storage, OWNER, { now: NOW + 2 }), []);
});

test('terminal, stale, malformed, future and cross-owner intents fail closed', () => {
  const storage = new MemoryStorage();
  const intent = beginRecordCreateIntent(storage, OWNER, PAYLOAD, {
    now: NOW,
    createOpaqueId: ids('barrier-000000000001', 'intent-0000000000001'),
  });

  assert.equal(markRecordCreateIntentTerminal(storage, OWNER, intent.idempotencyKey, {
    now: NOW + 1,
    reason: 'conflict',
  }), true);
  assert.deepEqual(readEligibleRecordCreateIntents(storage, OWNER, { now: NOW + 2 }), []);

  const fresh = beginRecordCreateIntent(storage, OWNER, PAYLOAD, {
    now: NOW + 10,
    createOpaqueId: ids('barrier-000000000002', 'intent-0000000000002'),
  });
  assert.deepEqual(
    readEligibleRecordCreateIntents(storage, OWNER, { now: NOW + 10 + RECORD_CREATE_INTENT_TTL_MS + 1 }),
    [],
  );
  assert.deepEqual(readEligibleRecordCreateIntents(storage, 'other@example.com', { now: NOW + 11 }), []);

  storage.setItem(`${PENDING_RECORD_CREATE_V1_STORAGE_PREFIX}malformed-00000001`, '{bad json');
  assert.deepEqual(readEligibleRecordCreateIntents(storage, OWNER, { now: NOW - 10 * 60 * 1000 }), []);
  assert.equal(fresh.owner, OWNER);
});

test('completion removes only the exact same-owner create intent', () => {
  const storage = new MemoryStorage();
  const intent = beginRecordCreateIntent(storage, OWNER, PAYLOAD, {
    now: NOW,
    createOpaqueId: ids('barrier-000000000001', 'intent-0000000000001'),
  });

  assert.equal(completeRecordCreateIntent(storage, 'other@example.com', intent.idempotencyKey), false);
  assert.notEqual(storage.getItem(`${PENDING_RECORD_CREATE_V1_STORAGE_PREFIX}${intent.idempotencyKey}`), null);
  assert.equal(completeRecordCreateIntent(storage, OWNER, intent.idempotencyKey), true);
  assert.equal(storage.getItem(`${PENDING_RECORD_CREATE_V1_STORAGE_PREFIX}${intent.idempotencyKey}`), null);
});

test('storage failure aborts intent creation before any caller can send a POST', () => {
  const storage = new MemoryStorage();
  storage.failSet = true;
  assert.throws(
    () => beginRecordCreateIntent(storage, OWNER, PAYLOAD, {
      now: NOW,
      createOpaqueId: ids('barrier-000000000001', 'intent-0000000000001'),
    }),
    /storage unavailable/,
  );
});

test('logout cleanup removes barrier and all record-create intent keys without embedding owner in key names', () => {
  const storage = new MemoryStorage();
  const intent = beginRecordCreateIntent(storage, OWNER, PAYLOAD, {
    now: NOW,
    createOpaqueId: ids('barrier-000000000001', 'intent-0000000000001'),
  });
  const intentKey = `${PENDING_RECORD_CREATE_V1_STORAGE_PREFIX}${intent.idempotencyKey}`;
  assert.equal(intentKey.includes(OWNER), false);

  clearSensitiveProjectStorage(storage);
  assert.equal(storage.getItem(RECORD_MUTATION_BARRIER_STORAGE_KEY), null);
  assert.equal(storage.getItem(intentKey), null);
});
