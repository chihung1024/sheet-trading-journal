import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exists = relative => fs.existsSync(path.join(ROOT, relative));
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('retired duplicate overview surfaces cannot silently return', () => {
  assert.equal(exists('src/components/DailyCommandCenter.vue'), false);
  assert.equal(exists('src/components/StatsGrid.vue'), false);
  assert.equal(exists('src/services/dailyCommandCenter.js'), false);
  assert.equal(exists('src/components/skeletons/StatsGridSkeleton.vue'), false);

  const overview = read('src/components/OverviewPage.vue');
  assert.doesNotMatch(overview, /DailyCommandCenter|StatsGrid/);
  assert.match(overview, /OverviewHeadline/);
  assert.match(overview, /OverviewContext/);
});
