import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/styles/product-consistency.css', import.meta.url), 'utf8');

test('product consistency stylesheet is loaded after the base stylesheet', () => {
  const baseIndex = mainSource.indexOf("import './style.css';");
  const consistencyIndex = mainSource.indexOf("import './styles/product-consistency.css';");

  assert.ok(baseIndex >= 0, 'base stylesheet import should remain present');
  assert.ok(consistencyIndex > baseIndex, 'product consistency layer must load after base styles');
});

test('shared typography, spacing and control tokens are defined', () => {
  for (const token of [
    '--ui-font-caption',
    '--ui-font-body',
    '--ui-font-section',
    '--ui-font-metric',
    '--ui-page-gap',
    '--ui-card-padding',
    '--ui-control-height',
    '--ui-table-pad-y',
  ]) {
    assert.match(css, new RegExp(token.replaceAll('-', '\\-')));
  }
});

test('transaction note presentation is bounded without hiding full-detail authority', () => {
  assert.match(css, /\.section-records \.desktop-view table\s*\{[\s\S]*table-layout:\s*fixed/);
  assert.match(css, /\.section-records \.note-preview,[\s\S]*-webkit-line-clamp:\s*2/);
  assert.doesNotMatch(css, /display:\s*none[^}]*note/i);
});

test('overview cards share a responsive density contract', () => {
  assert.match(css, /\.section-overview \.command-card[\s\S]*min-height:\s*132px/);
  assert.match(css, /\.section-overview \.stat-block[\s\S]*min-height:\s*150px/);
  assert.match(css, /@media \(max-width:\s*768px\)/);
});
