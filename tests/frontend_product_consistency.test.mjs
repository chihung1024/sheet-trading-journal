import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/styles/product-consistency.css', import.meta.url), 'utf8');

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

test('overview command and stats surfaces share one compact responsive density contract', () => {
  assert.match(css, /\.section-overview \.command-card[\s\S]*min-height:\s*112px/);
  assert.match(css, /\.section-overview \.stat-block[\s\S]*min-height:\s*140px/);
  assert.match(css, /@media \(max-width:\s*768px\)/);
});

test('layout consistency layer does not own typography or brute-force specificity', () => {
  assert.doesNotMatch(css, /font-size\s*:/i);
  assert.doesNotMatch(css, /--ui-font-/i);
  assert.doesNotMatch(css, /!important/i);
});
