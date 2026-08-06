import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  shouldCompeteForMarketRefreshLeadership,
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
    hasLeadership: true,
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

test('leadership competition requires every session and visibility prerequisite', () => {
  assert.equal(shouldCompeteForMarketRefreshLeadership(eligibleContext()), true);

  for (const blocked of [
    { enabled: false },
    { paused: true },
    { visible: false },
    { marketHours: false },
    { hasToken: false },
    { tokenExpired: true },
  ]) {
    assert.equal(
      shouldCompeteForMarketRefreshLeadership(eligibleContext(blocked)),
      false,
      `Expected competition rejection for ${JSON.stringify(blocked)}`,
    );
  }

  assert.equal(
    shouldCompeteForMarketRefreshLeadership(eligibleContext({ hasLeadership: false })),
    true,
    'Followers must remain eligible to compete after lease expiry',
  );
});

test('market refresh scheduling requires leadership and every non-busy prerequisite', () => {
  assert.equal(shouldScheduleMarketRefresh(eligibleContext()), true);

  for (const blocked of [
    { enabled: false },
    { paused: true },
    { visible: false },
    { marketHours: false },
    { hasToken: false },
    { tokenExpired: true },
    { hasLeadership: false },
    { hasLeadership: undefined },
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
    { hasLeadership: false },
  ]) {
    assert.equal(shouldTriggerMarketRefresh(eligibleContext(blocked)), false);
  }
});

test('refresh composable uses centralized policy and leadership at schedule and trigger boundaries', () => {
  const source = readComposable();
  assert.match(source, /shouldCompeteForMarketRefreshLeadership/);
  assert.match(source, /shouldScheduleMarketRefresh/);
  assert.match(source, /shouldTriggerMarketRefresh/);
  assert.match(source, /hasLeadership: isLeader\.value && leadership\?\.isLeader\(\) === true/);
  assert.match(source, /busy: portfolioStore\.isPolling \|\| portfolioStore\.loading/);
  assert.match(source, /running: isRunning\.value/);
  assert.doesNotMatch(source, /無視頁面可見性/);
});

test('pause is shared across tabs while hidden-page transitions release only local leadership', () => {
  const source = readComposable();

  const pauseBlock = sourceBlock(source, 'const togglePause', 'const stopMarketRefresh');
  assert.match(pauseBlock, /const requestedPause = !isPaused\.value/);
  assert.match(pauseBlock, /coordinator\.setPaused\(requestedPause\)/);
  assert.match(pauseBlock, /isPaused\.value = coordinator\.isPaused\(\)/);
  assert.match(pauseBlock, /stopActiveSchedule\(\);/);
  assert.doesNotMatch(pauseBlock, /leadership\?\.stop\(\)/);

  const visibilityBlock = sourceBlock(source, 'const handleVisibilityChange', 'const manualTrigger');
  assert.match(visibilityBlock, /if \(!isPageVisible\(\)\) \{/);
  assert.match(visibilityBlock, /stopLeadership\(\);/);
  assert.match(visibilityBlock, /syncLeadership\(\)/);

  const pauseCallbackBlock = sourceBlock(source, 'const handleSharedPauseChange', 'const ensureLeadership');
  assert.match(pauseCallbackBlock, /isPaused\.value = nextPaused === true/);
  assert.match(pauseCallbackBlock, /stopActiveSchedule\(\);/);
  assert.match(pauseCallbackBlock, /syncLeadership\(\)/);

  assert.match(source, /onPauseChange: handleSharedPauseChange/);
  assert.match(source, /const observationContext = \{ \.\.\.baseContext, paused: false \}/);

  const stopBlock = sourceBlock(source, 'const stopActiveSchedule', 'const triggerRefresh');
  assert.match(stopBlock, /stopRefreshTimer\(\);/);
  assert.match(stopBlock, /stopCountdown\(\);/);
  assert.match(stopBlock, /timeRemaining\.value = 0;/);
});

test('visibility and storage listeners are lifecycle-bound and timer creation is idempotent', () => {
  const source = readComposable();
  assert.match(source, /document\.addEventListener\('visibilitychange', handleVisibilityChange\);/);
  assert.match(source, /document\.removeEventListener\('visibilitychange', handleVisibilityChange\);/);
  assert.match(source, /createMarketRefreshLeadership/);
  assert.match(source, /leadership\?\.stop\(\)/);

  const startBlock = sourceBlock(source, 'const startMarketRefresh', 'const formattedTimeRemaining');
  assert.match(startBlock, /if \(!checkTimer\) \{/);
  assert.equal((startBlock.match(/checkTimer = setInterval/g) || []).length, 1);

  const evaluateBlock = sourceBlock(source, 'const evaluateMarketRefresh', 'const handleLeadershipChange');
  assert.match(evaluateBlock, /if \(refreshTimer\) return true;/);
  assert.equal((evaluateBlock.match(/refreshTimer = setInterval/g) || []).length, 1);
});

test('followers cannot create automatic timers or reach triggerUpdate without a shared action claim', () => {
  const source = readComposable();
  const triggerBlock = sourceBlock(source, 'const triggerRefresh', 'const evaluateMarketRefresh');
  assert.match(triggerBlock, /if \(!shouldTriggerMarketRefresh\(/);
  assert.match(triggerBlock, /claimAutomaticAction\(INTERVAL_MS\)/);
  assert.match(triggerBlock, /isPaused\.value = leadership\?\.isPaused\(\) === true/);
  assert.match(triggerBlock, /const updatePromise = portfolioStore\.triggerUpdate\(\);/);
  assert.ok(
    triggerBlock.indexOf('shouldTriggerMarketRefresh') < triggerBlock.indexOf('claimAutomaticAction'),
    'Eligibility must be checked before the distributed action claim',
  );
  assert.ok(
    triggerBlock.indexOf('claimAutomaticAction') < triggerBlock.indexOf('portfolioStore.triggerUpdate'),
    'Distributed action claim must be confirmed before triggerUpdate',
  );

  const evaluateBlock = sourceBlock(source, 'const evaluateMarketRefresh', 'const handleLeadershipChange');
  assert.match(evaluateBlock, /shouldScheduleMarketRefresh\(context\)/);
  assert.ok(
    evaluateBlock.indexOf('shouldScheduleMarketRefresh') < evaluateBlock.indexOf('refreshTimer = setInterval'),
    'Leadership-aware schedule policy must run before timer creation',
  );
});

test('stale leadership sync results are invalidated across token and lifecycle changes', () => {
  const source = readComposable();
  assert.match(source, /let leadershipSyncEpoch = 0/);
  assert.match(source, /const requestEpoch = \+\+leadershipSyncEpoch/);
  assert.match(source, /requestEpoch !== leadershipSyncEpoch/);
  assert.match(source, /requestedToken !== authStore\.token/);
  assert.match(source, /if \(newToken !== previousToken\) \{/);
  assert.match(source, /stopLeadership\(\);\n\s+isPaused\.value = false;/);
});

test('follower tabs show distributed ownership instead of a false zero countdown', () => {
  const source = readComposable();
  const formattedBlock = sourceBlock(source, 'const formattedTimeRemaining', 'const togglePause');
  assert.match(formattedBlock, /if \(!isPaused\.value && !isLeader\.value\) return '其他分頁處理中';/);
  assert.ok(
    formattedBlock.indexOf("return '其他分頁處理中'") < formattedBlock.indexOf('Math.floor'),
    'Follower status must be decided before countdown formatting',
  );
});
