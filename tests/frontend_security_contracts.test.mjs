import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';


const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STORAGE_BASELINE_PATH = path.join(ROOT, 'docs', 'governance', 'browser-storage-baseline.json');
const RISK_REGISTER_PATH = path.join(ROOT, 'docs', 'governance', 'risk-register.json');
const PRODUCTION_WORKER_URL = 'https://journal-backend.chired.workers.dev';

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
  const storageConstant = /(?:export\s+)?const\s+[A-Z0-9_]*STORAGE_KEY\s*=\s*['"`]([^'"`]+)['"`]/g;

  for (const filePath of browserFiles) {
    const content = read(filePath);
    for (const match of content.matchAll(directCall)) keys.add(match[1]);
    for (const match of content.matchAll(storageConstant)) keys.add(match[1]);
  }
  return [...keys].sort();
}

test('browser persistence matches the reviewed inventory exactly', () => {
  const baseline = JSON.parse(read(STORAGE_BASELINE_PATH));
  const expected = baseline.keys.map((entry) => entry.key).sort();
  const discovered = discoverStorageKeys();

  assert.deepEqual(discovered, expected);
  assert.equal(new Set(expected).size, expected.length, 'Storage keys must be unique');
  assert.ok(baseline.keys.every((entry) => entry.authoritative === false));

  const riskIds = new Set(JSON.parse(read(RISK_REGISTER_PATH)).risks.map((risk) => risk.id));
  for (const entry of baseline.keys) {
    assert.ok(entry.key && entry.classification && entry.target_batch && entry.planned_action);
    assert.ok(Array.isArray(entry.owner_paths) && entry.owner_paths.length > 0);
    assert.ok(Array.isArray(entry.risk_ids));
    for (const riskId of entry.risk_ids) assert.ok(riskIds.has(riskId), `Unknown risk ${riskId}`);

    const ownerText = entry.owner_paths
      .map((ownerPath) => read(path.join(ROOT, ownerPath)))
      .join('\n');
    assert.ok(ownerText.includes(entry.key), `${entry.key} is not present in its declared owner paths`);
  }
});

test('global localStorage clearing remains a known isolated debt', () => {
  const baseline = JSON.parse(read(STORAGE_BASELINE_PATH));
  const owners = [];

  for (const filePath of browserFiles) {
    const content = read(filePath);
    const count = (content.match(/localStorage\.clear\s*\(/g) || []).length;
    for (let index = 0; index < count; index += 1) owners.push(relative(filePath));
  }

  assert.equal(owners.length, baseline.known_global_clear.count);
  assert.deepEqual([...new Set(owners)], [baseline.known_global_clear.owner_path]);
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

test('production Worker URL is limited to API configuration and the CSP allowlist', () => {
  const owners = browserFiles
    .filter((filePath) => read(filePath).includes(PRODUCTION_WORKER_URL))
    .map(relative)
    .sort();
  assert.deepEqual(owners, ['index.html', 'src/config.js']);
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
