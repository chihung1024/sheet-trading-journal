import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

const collectVueFiles = dir => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectVueFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.vue')) out.push(full);
  }
  return out;
};

const styleBlocks = source => (
  Array.from(source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g), match => match[1])
);

const TYPE_TOKENS = [
  '--type-caption',
  '--type-label',
  '--type-body',
  '--type-control',
  '--type-emphasis',
  '--type-section',
  '--type-page',
  '--type-metric-sm',
  '--type-metric',
];

const ICON_TOKENS = [
  '--icon-xs',
  '--icon-sm',
  '--icon-md',
  '--icon-lg',
  '--icon-xl',
  '--icon-empty',
];

const ALLOWED_FONT_TOKENS = new Set([...TYPE_TOKENS, ...ICON_TOKENS]);

test('src/style.css is the only typography and icon-size token definition authority', () => {
  const designSystem = fs.readFileSync(path.join(SRC, 'style.css'), 'utf8');
  for (const token of ALLOWED_FONT_TOKENS) {
    assert.match(designSystem, new RegExp(`${token.replaceAll('-', '\\-')}\\s*:`));
  }

  const otherSources = [
    ...collectVueFiles(SRC),
    path.join(SRC, 'styles', 'product-consistency.css'),
  ];

  for (const file of otherSources) {
    const source = fs.readFileSync(file, 'utf8');
    for (const token of ALLOWED_FONT_TOKENS) {
      assert.doesNotMatch(
        source,
        new RegExp(`${token.replaceAll('-', '\\-')}\\s*:`),
        `${path.relative(ROOT, file)} must consume ${token}, not redefine it`,
      );
    }
  }
});

test('Vue component styles cannot invent numeric font-size values', () => {
  const numericFontSize = /font-size\s*:\s*[0-9]*\.?[0-9]+(?:rem|px|em|%)/i;

  for (const file of collectVueFiles(SRC)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const css of styleBlocks(source)) {
      assert.doesNotMatch(
        css,
        numericFontSize,
        `${path.relative(ROOT, file)} contains a numeric font-size outside the design system`,
      );
    }
  }
});

test('component font-size declarations only consume approved semantic text or icon tokens', () => {
  const declaration = /font-size\s*:\s*var\((--[a-z0-9-]+)\)/gi;

  for (const file of collectVueFiles(SRC)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const css of styleBlocks(source)) {
      for (const match of css.matchAll(declaration)) {
        assert.ok(
          ALLOWED_FONT_TOKENS.has(match[1]),
          `${path.relative(ROOT, file)} uses unapproved font-size token ${match[1]}`,
        );
      }
    }
  }
});

test('cross-page consistency stylesheet is layout-only and cannot become a typography override layer again', () => {
  const css = fs.readFileSync(path.join(SRC, 'styles', 'product-consistency.css'), 'utf8');
  assert.doesNotMatch(css, /font-size\s*:/i);
  assert.doesNotMatch(css, /--ui-font-/i);
  assert.doesNotMatch(css, /!important/i);
});
