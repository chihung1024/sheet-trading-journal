import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/styles/product-consistency.css', import.meta.url), 'utf8');
const overviewPage = fs.readFileSync(new URL('../src/components/OverviewPage.vue', import.meta.url), 'utf8');
const overviewHeadline = fs.readFileSync(new URL('../src/components/OverviewHeadline.vue', import.meta.url), 'utf8');
const overviewContext = fs.readFileSync(new URL('../src/components/OverviewContext.vue', import.meta.url), 'utf8');

test('cross-page layout stylesheet is loaded after the base design system', () => {
  const baseIndex = mainSource.indexOf("import './style.css';");
  const consistencyIndex = mainSource.indexOf("import './styles/product-consistency.css';");

  assert.ok(baseIndex >= 0, 'base design system import should remain present');
  assert.ok(consistencyIndex > baseIndex, 'layout consistency layer must load after base design system');
});

test('shared spacing and density tokens remain centralized in the layout contract', () => {
  for (const token of [
    '--ui-page-gap',
    '--ui-card-padding',
    '--ui-control-height',
    '--ui-table-pad-y',
    '--ui-table-pad-x',
  ]) {
    assert.match(css, new RegExp(token.replaceAll('-', '\\-')));
  }
});

test('transaction desktop table uses seven balanced columns after journal summary is merged into symbol context', () => {
  assert.match(css, /\.section-records \.desktop-view table\s*\{[\s\S]*table-layout:\s*fixed/);
  assert.match(css, /\.section-records \.desktop-view th:nth-child\(2\)\s*\{\s*width:\s*28%/);
  assert.match(css, /\.section-records \.desktop-view th:nth-child\(7\)\s*\{\s*width:\s*12%/);
  assert.doesNotMatch(css, /nth-child\(8\)/);
});

test('current overview surfaces consume the shared responsive page rhythm without reviving retired density selectors', () => {
  assert.match(overviewPage, /gap:\s*var\(--ui-page-gap\)/);
  assert.match(overviewHeadline, /padding:\s*20px/);
  assert.match(overviewHeadline, /@media \(max-width:\s*768px\)/);
  assert.match(overviewContext, /@media \(max-width:\s*768px\)/);
  assert.doesNotMatch(css, /\.section-overview \.command-card|\.section-overview \.stat-block|\.daily-command|\.stats-grid/);
});

test('desktop workspace reclaim reduces shell chrome without changing mobile or content authority', () => {
  assert.match(css, /@media \(min-width:\s*1025px\)\s*\{[\s\S]*--header-height:\s*56px/);
  assert.match(css, /@media \(min-width:\s*1025px\)\s*\{[\s\S]*\.content-container\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(330px, 350px\)/);
  assert.match(css, /@media \(min-width:\s*1025px\)\s*\{[\s\S]*\.fixed-panel\s*\{[\s\S]*max-height:\s*calc\(100vh - var\(--header-height\) - 24px\)/);
  assert.match(css, /@media \(min-width:\s*1680px\)\s*\{[\s\S]*\.main-column > \.mobile-tabs\s*\{[\s\S]*position:\s*fixed[\s\S]*left:\s*50%/);
  assert.match(css, /@media \(max-width:\s*768px\)\s*\{[\s\S]*\.mobile-tabs\s*\{[\s\S]*min-height:\s*46px/);
  assert.doesNotMatch(css, /\.main-column > \.mobile-tabs\s*\{[\s\S]*display:\s*none/);
});

test('desktop overview compaction changes spacing only and keeps the financial surfaces present', () => {
  assert.match(css, /\.section-overview \.account-value-preview\s*\{[\s\S]*padding:\s*12px 14px/);
  assert.match(css, /\.section-overview \.overview-headline\s*\{[\s\S]*padding:\s*16px/);
  assert.match(css, /\.section-overview \.overview-headline \.primary-item\s*\{[\s\S]*padding:\s*13px/);
});

test('layout consistency layer does not own typography or brute-force specificity', () => {
  assert.doesNotMatch(css, /font-size\s*:/i);
  assert.doesNotMatch(css, /--ui-font-/i);
  assert.doesNotMatch(css, /!important/i);
});