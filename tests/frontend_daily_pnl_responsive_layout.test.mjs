import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const componentUrl = new URL('../src/components/DailyPnlExplanation.vue', import.meta.url);

const readSource = () => readFile(componentUrl, 'utf8');

test('daily PnL contributor list uses responsive multi-column cards on wide screens', async () => {
  const source = await readSource();

  assert.match(source, /\.contributor-list\s*\{[\s\S]*?grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(420px,\s*1fr\)\)/);
  assert.match(source, /\.contributor-row\s*\{[\s\S]*?min-width:\s*0/);
  assert.match(source, /\.contributor-components\s*\{[\s\S]*?grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(150px,\s*1fr\)\)/);
});

test('daily PnL layout fails gracefully to one contributor column on narrow screens', async () => {
  const source = await readSource();

  assert.match(source, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.contributor-list\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
  assert.match(source, /\.contributor-total\s*\{[\s\S]*?white-space:\s*nowrap/);
  assert.match(source, /\.component-detail\s*\{[\s\S]*?justify-content:\s*space-between/);
});

test('layout optimization remains presentation-only and preserves existing explainability controls', async () => {
  const source = await readSource();

  assert.match(source, /v-for="row in visibleRows"/);
  assert.match(source, /showAll\.value[\s\S]*?props\.explanation\.rows/);
  assert.match(source, /顯示全部 \$\{explanation\.rows\.length\} 項/);
  assert.doesNotMatch(source, /fetch\(|\/api\//);
});
