import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  shouldScheduleMarketRefresh,
  shouldTriggerMarketRefresh,
} from '../src/services/refreshPolicy.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMPOSABLE_PATH = path.join(ROOT, 'src', 'composables', 'useMarketHoursRefresh.js');

function eligibleContext(overrides = {}) {
  return {
    enabled: true,
    paused: false,
    visible: true,
    marketHours: true,
    hasToken: true,
    tokenExpired: false,
    busy: false,
    running: false,
    ...overrides,
  };
}

function readComposable() {
  return fs.readFileSync(COMPOSABLE_PATH, 'utf8').replace(/\r\n/g, '\n');
}

function sourceBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test('market refresh scheduling requires every non-busy prerequisite', () => {
  assert.equal(shouldScheduleMarketRefresh(eligibleContext()), true);

  for (const blocked of [
    { enabled: false },
    { paused: true },
    { visible: false },
    { marketHours: false },
    { hasToken: false },
    { tokenExpired: true },
  ]) {
    assert.equal(
      shouldScheduleMarketRefresh(eligibleContext(blocked)),
      false,
      `Expected schedule rejection for ${JSON.stringify(blocked)}`,
    );
  }
});

test('market refresh trigger additionally rejects busy and already-running states', () => {
  assert.equal(shouldTriggerMarketRefresh(eligibleContext()), true);
  assert.equal(shouldTriggerMarketRefresh(eligibleContext({ busy: true })), false);
  assert.equal(shouldTriggerMarketRefresh(eligibleContext({ running: true })), false);

  for (const blocked of [
    { enabled: false },
    { paused: true },
    { visible: false },
    { marketHours: false },
    { hasToken: false },
    { tokenExpired: true },
  ]) {
    assert.equal(shouldTriggerMarketRefresh(eligibleContext(blocked)), false);
  }
});

test('refresh composable uses the centralized policy at schedule and trigger boundaries', () => {
  const source = readComposable();
  assert.match(source, /shouldScheduleMarketRefresh/);
  assert.match(source, /shouldTriggerMarketRefresh/);
  assert.match(source, /const context = getRefreshContext\(\);/);
  assert.match(source, /busy: portfolioStore\.isPolling \|\| portfolioStore\.loading/);
  assert.match(source, /running: isRunning\.value/);
  assert.doesNotMatch(source, /無視頁面可見性/);
});

test('pause and hidden-page transitions stop active refresh and countdown timers', () => {
  const source = readComposable();

  const pauseBlock = sourceBlock(source, 'const togglePause', 'const stopMarketRefresh');
  assert.match(pauseBlock, /if \(isPaused\.value\) \{/);
  assert.match(pauseBlock, /stopActiveSchedule\(\);/);
  assert.match(pauseBlock, /evaluateMarketRefresh\(\{ triggerImmediately: true \}\);/);

  const visibilityBlock = sourceBlock(source, 'const handleVisibilityChange', 'const manualTrigger');
  assert.match(visibilityBlock, /if \(!isPageVisible\(\)\) \{/);
  assert.match(visibilityBlock, /stopActiveSchedule\(\);/);
  assert.match(visibilityBlock, /evaluateMarketRefresh\(\{ triggerImmediately: true \}\);/);

  const stopBlock = sourceBlock(source, 'const stopActiveSchedule', 'const triggerRefresh');
  assert.match(stopBlock, /stopRefreshTimer\(\);/);
  assert.match(stopBlock, /stopCountdown\(\);/);
  assert.match(stopBlock, /timeRemaining\.value = 0;/);
});

test('visibility listener is lifecycle-bound and timer creation is idempotent', () => {
  const source = readComposable();
  assert.match(source, /document\.addEventListener\('visibilitychange', handleVisibilityChange\);/);
  assert.match(source, /document\.removeEventListener\('visibilitychange', handleVisibilityChange\);/);

  const startBlock = sourceBlock(source, 'const startMarketRefresh', 'const formattedTimeRemaining');
  assert.match(startBlock, /if \(!checkTimer\) \{/);
  assert.equal((startBlock.match(/checkTimer = setInterval/g) || []).length, 1);

  const evaluateBlock = sourceBlock(source, 'const evaluateMarketRefresh', 'const startMarketRefresh');
  assert.match(evaluateBlock, /if \(refreshTimer\) return true;/);
  assert.equal((evaluateBlock.match(/refreshTimer = setInterval/g) || []).length, 1);
});

test('hidden, paused, or invalid authentication cannot reach automatic triggerUpdate', () => {
  const source = readComposable();
  const triggerBlock = sourceBlock(source, 'const triggerRefresh', 'const evaluateMarketRefresh');
  assert.match(triggerBlock, /if \(!shouldTriggerMarketRefresh\(/);
  assert.match(triggerBlock, /const updatePromise = portfolioStore\.triggerUpdate\(\);/);
  assert.ok(
    triggerBlock.indexOf('shouldTriggerMarketRefresh') < triggerBlock.indexOf('portfolioStore.triggerUpdate'),
    'Eligibility must be checked before triggerUpdate',
  );
});
