import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const PORTFOLIO_PATH = 'src/stores/portfolio.js';
const AUTH_PATH = 'src/stores/auth.js';
const APP_PATH = 'src/App.vue';
const GROUP_MUTATION_PATH = 'src/services/groupRecordMutation.js';
const TRADE_FORM_PATH = 'src/components/TradeForm.vue';
const INDEX_PATH = 'index.html';

test('portfolio polling is single-flight and invalidates stale loop completions', () => {
  const source = read(PORTFOLIO_PATH);

  assert.doesNotMatch(
    source,
    /setInterval\s*\(/,
    'async interval polling can overlap requests whose deadline exceeds the interval',
  );
  assert.match(source, /setTimeout\s*\(/);
  assert.match(source, /calculationJobPollEpoch/);
  assert.match(source, /snapshotPollEpoch/);
  assert.match(source, /epoch\s*!==\s*calculationJobPollEpoch/);
  assert.match(source, /epoch\s*!==\s*snapshotPollEpoch/);
});

test('group record mutations use the shared bounded request/parser services', () => {
  const source = read(GROUP_MUTATION_PATH);

  assert.match(source, /from '\.\/fetchDeadline\.js'/);
  assert.match(source, /from '\.\/apiResponse\.js'/);
  assert.match(source, /fetchWithDeadline\s*\(/);
  assert.match(source, /DEFAULT_REQUEST_TIMEOUT_MS/);
  assert.match(source, /readApiJson\s*\(/);
  assert.doesNotMatch(source, /response\.json\(\)\.catch/);
});

test('connection and snapshot freshness are separate fail-closed UI states', () => {
  const portfolio = read(PORTFOLIO_PATH);
  const app = read(APP_PATH);

  assert.match(portfolio, /connectionStatus\s*=\s*ref\('unknown'\)/);
  assert.match(portfolio, /snapshotFreshness\s*=\s*ref\('unknown'\)/);
  assert.match(portfolio, /markSnapshotStale/);
  assert.match(portfolio, /snapshotFreshness\.value\s*=\s*'stale'/);

  for (const mutationName of ['addRecord', 'updateRecord', 'deleteRecord']) {
    const start = portfolio.indexOf(`const ${mutationName}`);
    assert.notEqual(start, -1);
    const next = portfolio.indexOf('\n    const ', start + 10);
    const block = portfolio.slice(start, next === -1 ? undefined : next);
    assert.match(block, /markSnapshotStale\(\)/, `${mutationName} must mark the snapshot stale`);
  }

  assert.match(app, /const statusPresentation\s*=\s*computed/);
  assert.match(app, /portfolioStore\.connectionStatus/);
  assert.match(app, /portfolioStore\.snapshotFreshness/);
  assert.doesNotMatch(
    app,
    /<div v-else class="status-indicator ready" title="連線正常">/,
    'idle UI must not claim connectivity without verified state',
  );
});

test('auth store reacts to cross-tab token removal without requiring server-session redesign', () => {
  const source = read(AUTH_PATH);
  assert.match(source, /TOKEN_STORAGE_KEY/);
  assert.match(source, /addEventListener\(['"]storage['"]/);
  assert.match(source, /removeEventListener\(['"]storage['"]/);
  assert.match(source, /event\.key\s*===\s*TOKEN_STORAGE_KEY/);
  assert.match(source, /event\.newValue\s*===\s*null/);
  assert.match(source, /startStorageSync/);
  assert.match(source, /stopStorageSync/);
});

test('viewport zoom remains available and formerly clickable header/tag spans are semantic buttons', () => {
  const index = read(INDEX_PATH);
  const app = read(APP_PATH);
  const tradeForm = read(TRADE_FORM_PATH);

  const viewport = index.match(/<meta name="viewport"[^>]*>/)?.[0] || '';
  assert.doesNotMatch(viewport, /maximum-scale\s*=\s*1/i);
  assert.doesNotMatch(viewport, /user-scalable\s*=\s*no/i);

  assert.doesNotMatch(app, /<span class="refresh-icon"[^>]*@click/);
  assert.doesNotMatch(app, /<div class="user-profile"[^>]*@click/);
  assert.match(app, /<button[^>]*class="refresh-icon"/);
  assert.match(app, /<button[^>]*class="user-profile"/);

  assert.doesNotMatch(tradeForm, /<span v-for="t in commonTags"[^>]*@click/);
  assert.match(tradeForm, /<button[^>]*v-for="t in commonTags"/);
});

test('TradeForm currency labels are derived instead of hardcoded to USD', () => {
  const source = read(TRADE_FORM_PATH);
  assert.doesNotMatch(source, /成交單價 \(USD\)/);
  assert.doesNotMatch(source, /交易總金額 \(USD\)/);
  assert.match(source, /transactionCurrency/);
  assert.match(source, /transactionCurrencySymbol/);
  assert.match(source, /\.TW/);
  assert.match(source, /TWD/);
  assert.match(source, /USD/);
});
