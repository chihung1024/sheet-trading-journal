import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const adaptiveCss = fs.readFileSync(new URL('../src/styles/adaptive-workspace.css', import.meta.url), 'utf8');
const appSource = fs.readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');

const expectedContainers = [
  'app-workspace',
  'main-workspace',
  'transaction-workspace',
  'analysis-workspace',
  'holdings-workspace',
  'records-workspace',
  'management-workspace',
  'dividends-workspace',
  'cash-workspace',
  'groups-workspace',
];

test('adaptive workspace layer loads after the established product consistency layer', () => {
  const consistencyIndex = mainSource.indexOf("import './styles/product-consistency.css';");
  const adaptiveIndex = mainSource.indexOf("import './styles/adaptive-workspace.css';");
  assert.ok(consistencyIndex >= 0, 'product consistency import should remain present');
  assert.ok(adaptiveIndex > consistencyIndex, 'adaptive workspace layer must load after existing layout contract');
});

test('adaptive workspace centralizes shell, transaction and touch-density tokens', () => {
  for (const token of [
    '--ui-layout-max',
    '--ui-shell-inline-padding',
    '--ui-trade-dock-min',
    '--ui-trade-dock-max',
    '--ui-trade-drawer-max',
    '--ui-trade-sheet-max',
    '--ui-control-height-desktop',
    '--ui-control-height-touch',
    '--ui-touch-target',
    '--ui-safe-top',
    '--ui-safe-right',
    '--ui-safe-bottom',
    '--ui-safe-left',
  ]) {
    assert.match(adaptiveCss, new RegExp(token.replaceAll('-', '\\-')));
  }
  assert.match(adaptiveCss, /@media \(hover:\s*none\), \(pointer:\s*coarse\)[\s\S]*--ui-control-height:\s*var\(--ui-control-height-touch\)/);
});

test('adaptive workspace establishes named inline-size container authorities', () => {
  for (const name of expectedContainers) {
    assert.match(adaptiveCss, new RegExp(`container-name:[^;]*\\b${name}\\b`));
  }
  assert.match(adaptiveCss, /\.main-column\s*\{[\s\S]*container-type:\s*inline-size[\s\S]*container-name:\s*main-workspace/);
  assert.match(adaptiveCss, /\.side-column\s*\{[\s\S]*container-type:\s*inline-size[\s\S]*container-name:\s*transaction-workspace/);
  assert.match(adaptiveCss, /\.section-holdings\s*\{[\s\S]*container-name:\s*holdings-workspace/);
  assert.match(adaptiveCss, /\.section-records\s*\{[\s\S]*container-name:\s*records-workspace/);
});

test('foundation preserves the existing single TradeForm and app-shell width authority', () => {
  assert.equal((appSource.match(/<TradeForm\b/g) || []).length, 1, 'TradeForm must remain the single create/edit authority');
  assert.match(appSource, /isMobileView\.value = window\.innerWidth <= 1024/);
  assert.match(appSource, /@media \(max-width:\s*1024px\)/);
});

test('adaptive presentation layer cannot take typography, financial or mutation authority', () => {
  assert.doesNotMatch(adaptiveCss, /font-size\s*:/i);
  assert.doesNotMatch(adaptiveCss, /!important/i);
  assert.doesNotMatch(adaptiveCss, /(?:NAV|TWR|XIRR|pnl|profit|tax|fx|idempot|worker|d1|record-id|localStorage|fetch\()/i);
});
