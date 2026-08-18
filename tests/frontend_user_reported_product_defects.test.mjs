import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { nextTick, reactive } from 'vue';

import {
  installSnapshotSelfHealing,
} from '../src/services/snapshotSelfHealing.js';
import {
  readAutomaticRecalculationStatus,
} from '../src/services/automaticRecalculationState.js';
import { buildSourceRecordsIdentity } from '../src/services/snapshotIntegrity.js';

class MemoryStorage {
  constructor(entries = []) {
    this.values = new Map(entries);
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
    this.values.set(String(key), String(value));
  }

  removeItem(key) {
    this.values.delete(String(key));
  }
}

const OWNER = 'user@example.com';
const RECORDS = Object.freeze([
  Object.freeze({
    id: 1,
    user_id: OWNER,
    txn_date: '2026-08-14',
    symbol: 'AAPL',
    txn_type: 'BUY',
    qty: 1,
    price: 100,
    fee: 0,
    tax: 0,
    tag: 'Stock',
    note: '',
  }),
]);

const makeSnapshotForPrice = async (price) => {
  const source = await buildSourceRecordsIdentity(
    RECORDS.map(record => ({ ...record, price })),
  );
  return {
    updated_at: '2026-08-14T10:32:53Z',
    calculation_manifest: {
      deterministic_identity: {
        identity_version: 1,
        source_records: source,
        runtime_config: { benchmark_symbol: 'SPY' },
      },
    },
  };
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test('a stale snapshot discovered after a succeeded calculation re-enters the Phase 2 full-read handoff once for real Worker API records', async () => {
  const storage = new MemoryStorage();
  const calls = { fetchAll: 0, stale: 0 };
  const portfolio = reactive({
    portfolioReadStatus: 'loading',
    snapshotFreshness: 'stale',
    loading: false,
    calculationJob: { id: 'job_terminal_success', status: 'succeeded' },
    records: RECORDS.map(record => ({ ...record })),
    rawData: await makeSnapshotForPrice(99),
    selectedBenchmark: 'SPY',
    markSnapshotStale() {
      calls.stale += 1;
      portfolio.snapshotFreshness = 'stale';
    },
    async fetchAll() {
      calls.fetchAll += 1;
      portfolio.loading = true;
      portfolio.portfolioReadStatus = 'loading';
      await nextTick();
      portfolio.loading = false;
      portfolio.portfolioReadStatus = 'loaded';
      return true;
    },
  });
  const auth = reactive({ user: { email: OWNER } });

  const stop = installSnapshotSelfHealing({ portfolio, auth, storage });
  portfolio.portfolioReadStatus = 'loaded';
  await nextTick();
  await delay(80);

  const status = readAutomaticRecalculationStatus(storage, OWNER);
  assert.equal(status.dirty, true);
  assert.equal(calls.stale >= 1, true);
  assert.equal(calls.fetchAll, 2, 'one repair read plus one terminal-lane handoff read');

  portfolio.snapshotFreshness = 'loaded';
  await nextTick();
  portfolio.snapshotFreshness = 'stale';
  await nextTick();
  await delay(40);
  assert.equal(calls.fetchAll, 2, 'the same durable dirty generation is handed off at most once');

  stop();
});

test('trade entry stays one canonical surface: dock in flow, drawer/sheet as intentional overlays', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8');
  const adaptiveSource = await readFile(new URL('../src/styles/adaptive-workspace.css', import.meta.url), 'utf8');
  const desktopPanel = appSource.match(/\.fixed-panel\s*\{([\s\S]*?)\n\}/)?.[1] || '';

  assert.equal((appSource.match(/<TradeForm\b/g) || []).length, 1, 'TradeForm remains the single create/edit authority');
  assert.match(desktopPanel, /position:\s*sticky;/);
  assert.doesNotMatch(desktopPanel, /position:\s*fixed;/);
  assert.match(desktopPanel, /width:\s*100%;/);
  assert.match(appSource, /`trade-surface-\$\{tradeSurfaceMode\}`/);
  assert.match(appSource, /if \(isCompactView\.value\) return 'sheet';/);
  assert.match(appSource, /@click="closeTransientTradeSurface\(\)"/);
  assert.match(appSource, /v-if="isTransientTradeSurfaceOpen"[\s\S]*class="sheet-backdrop"/);
  assert.match(adaptiveSource, /\.side-column\.trade-surface-drawer,[\s\S]*\.side-column\.trade-surface-sheet[\s\S]*position:\s*fixed;/);
  assert.match(adaptiveSource, /\.trade-surface-drawer \.fixed-panel,[\s\S]*\.trade-surface-sheet \.fixed-panel[\s\S]*position:\s*static;/);
  assert.match(adaptiveSource, /\.sheet-backdrop\s*\{[\s\S]*position:\s*fixed;[\s\S]*inset:\s*0;/);
});
