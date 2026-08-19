import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEPLOYMENT_CONTRACT_PATH = path.join(ROOT, 'config', 'deployment-environments.json');
const DEPLOYMENT_CONTRACT = JSON.parse(fs.readFileSync(DEPLOYMENT_CONTRACT_PATH, 'utf8'));
const PRODUCTION_WORKER_URL = DEPLOYMENT_CONTRACT.production.api_origins[0];
const CSP_API_ORIGIN_TOKEN = '__TRADING_JOURNAL_API_ORIGIN__';

// Terminal runtime contract. This inventory intentionally lives with the test instead
// of active-development governance documents. These browser values are non-authoritative;
// server/D1 state remains authoritative for financial data.
const STORAGE_BASELINE = {
  keys: [
    { key: 'automatic_recalculation_clean.v1', owner_paths: ['src/services/automaticRecalculationState.js', 'src/services/projectStorage.js'] },
    { key: 'automatic_recalculation_coverage.v1.', owner_paths: ['src/services/automaticRecalculationState.js', 'src/services/projectStorage.js'] },
    { key: 'automatic_recalculation_dirty.v1', owner_paths: ['src/services/automaticRecalculationState.js', 'src/services/projectStorage.js', 'src/stores/portfolio.js'] },
    { key: 'broker_mapping_presets.v1.', owner_paths: ['src/services/brokerNeutralMappingPresets.js', 'src/services/projectStorage.js'] },
    { key: 'cached_records', owner_paths: ['src/services/projectStorage.js'] },
    { key: 'calculation_failure_recovery.v1', owner_paths: ['src/services/calculationFailureRecovery.js', 'src/services/projectStorage.js'] },
    { key: 'confirmed_dividend_keys', owner_paths: ['src/components/DividendManager.vue', 'src/services/projectStorage.js'] },
    { key: 'email', owner_paths: ['src/stores/auth.js', 'src/services/projectStorage.js'] },
    { key: 'name', owner_paths: ['src/stores/auth.js', 'src/services/projectStorage.js'] },
    { key: 'pending_calculation_request', owner_paths: ['src/services/calculationJobState.js', 'src/services/projectStorage.js', 'src/stores/portfolio.js'] },
    { key: 'pending_calculation_request.v2.', owner_paths: ['src/services/calculationJobState.js', 'src/services/projectStorage.js', 'src/stores/portfolio.js'] },
    { key: 'pending_cash_create.v1.', owner_paths: ['src/services/cashCreateIntent.js', 'src/services/projectStorage.js'] },
    { key: 'pending_journal_restore.v1.', owner_paths: ['src/services/journalRestoreIntent.js', 'src/services/projectStorage.js'] },
    { key: 'pending_record_create.v1.', owner_paths: ['src/services/recordCreateIntent.js', 'src/services/projectStorage.js'] },
    { key: 'record_mutation_barrier.v1', owner_paths: ['src/services/recordCreateIntent.js', 'src/services/projectStorage.js'] },
    { key: 'sheet_trading_journal.activeView', owner_paths: ['src/App.vue'] },
    { key: 'sheet_trading_journal.calculation_poll_claim.', owner_paths: ['src/services/calculationJobPollClaim.js'] },
    { key: 'sheet_trading_journal.market_refresh_leader.', owner_paths: ['src/services/marketRefreshLeadership.js'] },
    { key: 'sheet_trading_journal.market_refresh_pause.', owner_paths: ['src/services/marketRefreshLeadership.js'] },
    { key: 'theme', owner_paths: ['src/composables/useDarkMode.js', 'index.html'] },
    { key: 'token', owner_paths: ['src/stores/auth.js', 'src/services/projectStorage.js'] },
    { key: 'user_benchmark', owner_paths: ['src/stores/portfolio.js', 'src/services/projectStorage.js'] },
  ],
  known_global_clear: { count: 0, owner_path: null },
};

function walkFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath));
    else files.push(fullPath);
  }
  return files;
}

function relative(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

const browserFiles = [
  ...walkFiles(path.join(ROOT, 'src')).filter((filePath) => /\.(?:js|vue|html)$/.test(filePath)),
  path.join(ROOT, 'index.html'),
];

function discoverStorageKeys() {
  const keys = new Set();
  const directCall = /localStorage\.(?:getItem|setItem|removeItem)\(\s*['"`]([^'"`]+)['"`]/g;
  const storageConstant = /(?:export\s+)?const\s+[A-Z0-9_]*STORAGE_(?:KEY|PREFIX)\s*=\s*['"`]([^'"`]+)['"`]/g;

  for (const filePath of browserFiles) {
    const content = read(filePath);
    for (const match of content.matchAll(directCall)) keys.add(match[1]);
    for (const match of content.matchAll(storageConstant)) keys.add(match[1]);
  }
  return [...keys].sort();
}

test('browser persistence matches the terminal inventory exactly', () => {
  const expected = STORAGE_BASELINE.keys.map((entry) => entry.key).sort();
  const discovered = discoverStorageKeys();

  assert.deepEqual(discovered, expected);
  assert.equal(new Set(expected).size, expected.length, 'Storage keys must be unique');

  for (const entry of STORAGE_BASELINE.keys) {
    assert.ok(entry.key);
    assert.ok(Array.isArray(entry.owner_paths) && entry.owner_paths.length > 0);
    const ownerText = entry.owner_paths
      .map((ownerPath) => read(path.join(ROOT, ownerPath)))
      .join('\n');
    assert.ok(ownerText.includes(entry.key), `${entry.key} is not present in its declared owner paths`);
  }
});

test('global localStorage clearing remains absent', () => {
  const owners = [];

  for (const filePath of browserFiles) {
    const content = read(filePath);
    const count = (content.match(/localStorage\.clear\s*\(/g) || []).length;
    for (let index = 0; index < count; index += 1) owners.push(relative(filePath));
  }

  assert.equal(owners.length, STORAGE_BASELINE.known_global_clear.count);
  assert.deepEqual(owners, []);
  assert.equal(STORAGE_BASELINE.known_global_clear.owner_path, null);
});

test('full transaction records are not written to browser storage', () => {
  const portfolioStore = read(path.join(ROOT, 'src', 'stores', 'portfolio.js'));
  assert.doesNotMatch(
    portfolioStore,
    /localStorage\.setItem\(\s*['"`]cached_records['"`]/,
  );
});

test('browser code cannot use system-only authorization headers', () => {
  const violations = [];
  for (const filePath of browserFiles) {
    const content = read(filePath);
    for (const header of ['X-API-KEY', 'X-Target-User']) {
      if (content.includes(header)) violations.push(`${relative(filePath)}:${header}`);
    }
  }
  assert.deepEqual(violations, []);
});

test('production Worker authority is limited to API configuration and the deployment contract', () => {
  const owners = browserFiles
    .filter((filePath) => read(filePath).includes(PRODUCTION_WORKER_URL))
    .map(relative)
    .sort();
  assert.deepEqual(owners, ['src/config.js']);
  assert.ok(DEPLOYMENT_CONTRACT.production.api_origins.includes(PRODUCTION_WORKER_URL));

  const indexHtml = read(path.join(ROOT, 'index.html'));
  const pageHeaders = read(path.join(ROOT, 'public', '_headers'));
  const cspRenderer = read(path.join(ROOT, 'tools', 'frontend_csp.mjs'));

  assert.equal(indexHtml.split(CSP_API_ORIGIN_TOKEN).length - 1, 1);
  assert.equal(pageHeaders.split(CSP_API_ORIGIN_TOKEN).length - 1, 1);
  assert.ok(!indexHtml.includes(PRODUCTION_WORKER_URL));
  assert.ok(!pageHeaders.includes(PRODUCTION_WORKER_URL));
  assert.match(cspRenderer, /DEPLOYMENT_CONTRACT/);
});

test('browser code contains no reviewed dangerous rendering or execution primitives', () => {
  const patterns = [
    ['v-html', /\bv-html\s*=/],
    ['innerHTML assignment', /\.innerHTML\s*=/],
    ['eval', /\beval\s*\(/],
    ['Function constructor', /\bnew\s+Function\s*\(/],
  ];
  const violations = [];

  for (const filePath of browserFiles) {
    const content = read(filePath);
    for (const [label, pattern] of patterns) {
      if (pattern.test(content)) violations.push(`${relative(filePath)}:${label}`);
    }
  }
  assert.deepEqual(violations, []);
});

test('browser source contains no hard-coded credential material or full email address', () => {
  const patterns = [
    ['GitHub classic token', /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/],
    ['GitHub fine-grained token', /\bgithub_pat_[A-Za-z0-9_]{20,}\b/],
    ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
    ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ['full email', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
  ];
  const violations = [];

  for (const filePath of browserFiles) {
    const content = read(filePath);
    for (const [label, pattern] of patterns) {
      if (pattern.test(content)) violations.push(`${relative(filePath)}:${label}`);
    }
  }
  assert.deepEqual(violations, []);
});
