import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildCanvasSemanticFont,
  resolveSemanticFontPx,
} from '../src/services/designTypography.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const createDocument = fontSize => {
  let removed = false;
  const probe = {
    style: {},
    setAttribute() {},
    remove() { removed = true; },
  };
  return {
    documentRef: {
      body: { appendChild() {} },
      createElement() { return probe; },
      defaultView: { getComputedStyle() { return { fontSize }; } },
    },
    wasRemoved: () => removed,
    probe,
  };
};

test('semantic typography bridge resolves CSS-token font size for canvas consumers', () => {
  const mock = createDocument('14px');
  assert.equal(resolveSemanticFontPx('--type-label', { documentRef: mock.documentRef }), 14);
  assert.equal(mock.probe.style.fontSize, 'var(--type-label)');
  assert.equal(mock.wasRemoved(), true);
  assert.equal(
    buildCanvasSemanticFont({ token: '--type-label', documentRef: createDocument('14px').documentRef }),
    "700 14px 'JetBrains Mono', monospace",
  );
});

test('semantic typography bridge fails closed for unknown tokens or unavailable DOM', () => {
  assert.equal(resolveSemanticFontPx('--not-a-token', { documentRef: null }), null);
  assert.equal(resolveSemanticFontPx('--type-label', { documentRef: null }), null);
  assert.equal(buildCanvasSemanticFont({ token: '--not-a-token', documentRef: null }), null);
});

test('PerformanceChart consumes design-system typography instead of hard-coded canvas font pixels', () => {
  const source = read('src/components/PerformanceChart.vue');
  assert.match(source, /resolveSemanticFontPx\('--type-caption'\)/);
  assert.match(source, /resolveSemanticFontPx\('--type-label'\)/);
  assert.match(source, /buildCanvasSemanticFont\(\{ token: '--type-label' \}\)/);
  assert.doesNotMatch(source, /const\s+fontSize\s*=\s*isMobile/);
  assert.doesNotMatch(source, /const\s+labelFontSize\s*=\s*isMobile/);
  assert.doesNotMatch(source, /(?:titleFont|bodyFont):\s*\{\s*size:\s*\d/);
  assert.doesNotMatch(source, /ctx\.font\s*=\s*[^;]*\$\{[^}]+\}px/);
});
