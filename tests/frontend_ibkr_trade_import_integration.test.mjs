import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createIbkrRecord, __test as recordCreateTest } from '../src/services/ibkrRecordCreate.js';
import { runIbkrTradeImportBatch } from '../src/services/ibkrTradeImportBatch.js';
import { PENDING_RECORD_CREATE_V1_STORAGE_PREFIX } from '../src/services/projectStorage.js';

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.failRemove = false;
  }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(String(key)) ? this.values.get(String(key)) : null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) {
    if (this.failRemove) throw new Error('remove unavailable');
    this.values.delete(String(key));
  }
}

const ENTRY = Object.freeze({
  idempotencyKey: 'IBKR~ORDER~20260814~U123~487287953~NVDA~BUY',
  record: Object.freeze({
    txn_date: '2026-08-14',
    symbol: 'NVDA',
    txn_type: 'BUY',
    qty: 1,
    price: 100,
    fee: 0.5,
    tax: 0,
    tag: '',
    note: 'source=IBKR',
  }),
});

const successResponse = body => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});

test('confirmed server write with local cleanup degradation is tombstoned and surfaced as a batch warning', async () => {
  const storage = new MemoryStorage();
  const outcome = await createIbkrRecord(ENTRY, {
    storage,
    owner: 'user@example.com',
    getToken: () => 'token',
    refreshToken: async () => false,
    apiBaseUrl: 'https://api.example.test',
    fetchImpl: async () => {
      storage.failRemove = true;
      return successResponse({ success: true, deduplicated: false, record_id: 42 });
    },
  });

  assert.equal(outcome.committed, true);
  assert.equal(outcome.outcomeAmbiguous, false);
  assert.match(outcome.recoveryStateError?.message || '', /remove unavailable/);

  const durableKey = await recordCreateTest.hashImportIdentity(ENTRY.idempotencyKey);
  const stored = JSON.parse(storage.getItem(`${PENDING_RECORD_CREATE_V1_STORAGE_PREFIX}${durableKey}`));
  assert.equal(stored.state, 'terminal');
  assert.equal(stored.terminalReason, 'CONFIRMED_COMMIT_CLEANUP_DEGRADED');
  assert.equal(Object.hasOwn(stored, 'body'), false);

  let refreshCalls = 0;
  let updateCalls = 0;
  const result = await runIbkrTradeImportBatch([ENTRY], {
    createRecord: async () => outcome,
    refreshRecords: async () => { refreshCalls += 1; },
    requestUpdate: async () => { updateCalls += 1; },
  });

  assert.equal(result.status, 'committed_with_sync_warning');
  assert.equal(result.created, 1);
  assert.equal(result.sync.recoveryWarnings.length, 1);
  assert.equal(result.sync.recoveryWarnings[0].index, 0);
  assert.equal(refreshCalls, 1);
  assert.equal(updateCalls, 1);
});

test('IBKR import UI is preview-first and delegates writes without direct record API access or file persistence', async () => {
  const component = await readFile(new URL('../src/components/IbkrTradeImport.vue', import.meta.url), 'utf8');
  const recordList = await readFile(new URL('../src/components/RecordList.vue', import.meta.url), 'utf8');

  assert.match(recordList, /import IbkrTradeImport from ['"]\.\/IbkrTradeImport\.vue['"]/);
  assert.match(recordList, /<IbkrTradeImport\s*\/>/);

  assert.match(component, /deriveIbkrImportProfile\(profileName\.value\)/);
  assert.match(component, /parseIbkrTradeCsv\(fileContents\.value, \{ accountScope: profile\.scopeId \}\)/);
  assert.match(component, /v-if="preview && !result"/);
  assert.match(component, /:disabled="importing \|\| profileDirty \|\| preview\.entries\.length === 0"/);
  assert.match(component, /runIbkrTradeImportBatch\(preview\.value\.entries/);
  assert.match(component, /createIbkrRecord\(entry/);
  assert.match(component, /refreshRecords:\s*\(\) => portfolioStore\.fetchRecords\(\)/);
  assert.match(component, /requestUpdate:\s*\(\) => portfolioStore\.triggerUpdate\(/);
  assert.doesNotMatch(component, /portfolioStore\.fetchAll\(/);
  assert.doesNotMatch(component, /\/api\/records/);
  assert.doesNotMatch(component, /\bfetch\s*\(/);
  assert.doesNotMatch(component, /localStorage\.setItem\s*\(/);
  assert.match(component, /maskAccount/);
  assert.match(component, /aria-modal="true"/);
  assert.match(component, /@media \(max-width: 700px\)/);
  assert.match(component, /已成功項目不會重複新增/);
  assert.match(component, /帳本寫入已確認，不需要重新匯入/);
});