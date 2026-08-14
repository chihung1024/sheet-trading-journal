import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createSingleFlight } from '../src/services/singleFlight.js';

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

test('single-flight callers share one execution and one settled result', async () => {
  const gate = deferred();
  let calls = 0;
  const run = createSingleFlight(async () => {
    calls += 1;
    return gate.promise;
  });

  const first = run();
  const second = run();
  assert.strictEqual(first, second);
  await Promise.resolve();
  assert.equal(calls, 1);

  gate.resolve('loaded');
  assert.equal(await first, 'loaded');
  assert.equal(await second, 'loaded');
  assert.equal(calls, 1);
});

test('single-flight propagates the same rejection and permits a fresh later generation', async () => {
  let calls = 0;
  const failure = new Error('snapshot unavailable');
  const run = createSingleFlight(async () => {
    calls += 1;
    if (calls === 1) throw failure;
    return 'recovered';
  });

  const first = run();
  const second = run();
  assert.strictEqual(first, second);
  await assert.rejects(first, error => error === failure);
  await assert.rejects(second, error => error === failure);
  assert.equal(await run(), 'recovered');
  assert.equal(calls, 2);
});

test('afterCurrent waits for an older load and starts a new generation after it settles', async () => {
  const firstGate = deferred();
  const secondGate = deferred();
  let calls = 0;
  const run = createSingleFlight(async () => {
    calls += 1;
    return calls === 1 ? firstGate.promise : secondGate.promise;
  });

  const current = run();
  await Promise.resolve();
  assert.equal(calls, 1);

  const fresh = run.afterCurrent();
  await Promise.resolve();
  assert.equal(calls, 1, 'fresh generation must wait for current load to settle');

  firstGate.resolve('old');
  assert.equal(await current, 'old');
  await Promise.resolve();
  assert.equal(calls, 2, 'fresh generation must begin after current settles');

  secondGate.resolve('fresh');
  assert.equal(await fresh, 'fresh');
});

test('afterCurrent still starts a fresh generation when the older load fails', async () => {
  const firstGate = deferred();
  let calls = 0;
  const run = createSingleFlight(async () => {
    calls += 1;
    if (calls === 1) return firstGate.promise;
    return 'fresh-after-failure';
  });

  const current = run();
  await Promise.resolve();
  const fresh = run.afterCurrent();
  firstGate.reject(new Error('old load failed'));
  await assert.rejects(current, /old load failed/);
  assert.equal(await fresh, 'fresh-after-failure');
  assert.equal(calls, 2);
});

test('single-flight requires a callable task', () => {
  assert.throws(() => createSingleFlight(null), /must be a function/);
});

test('portfolio fetch contract propagates failures and distinguishes fresh post-event loads', async () => {
  const store = await read('src/stores/portfolio.js');

  assert.match(store, /createSingleFlight/);
  assert.match(store, /const performFetchAll = async \(\) =>/);
  assert.match(store, /const fetchAll = createSingleFlight\(performFetchAll\)/);
  assert.match(store, /const fetchAllFresh = \(\) => fetchAll\.afterCurrent\(\)/);
  assert.doesNotMatch(store, /if \(loading\.value\) return;/);
  assert.match(store, /fetchAll error:[\s\S]*connectionStatus\.value = 'error';[\s\S]*throw error;/);
  assert.match(store, /job\.status === 'succeeded'[\s\S]*await fetchAllFresh\(\)/);
  assert.match(store, /isNewData \|\| isResetConfirmed[\s\S]*await fetchAllFresh\(\)/);
  assert.match(store, /計算已完成；最新資料暫時載入失敗，系統將自動重試/);
  assert.match(store, /已偵測到新快照；載入暫時失敗，系統將自動重試/);
});

test('UI callers distinguish authentication, data-load failure, and real refresh success', async () => {
  const app = await read('src/App.vue');
  const login = await read('src/components/LoginOverlay.vue');
  const dividends = await read('src/components/DividendManager.vue');

  assert.match(app, /await portfolioStore\.fetchAll\(\);[\s\S]*catch \(error\)/);
  assert.match(app, /已登入，但初始資料載入失敗/);

  const loginStart = login.indexOf('await authStore.login(credential);');
  const portfolioFetch = login.indexOf('await portfolioStore.fetchAll();', loginStart);
  const abortAfterAcceptedLogin = login.indexOf('if (!isActive) return', loginStart);
  assert.ok(loginStart >= 0 && portfolioFetch > loginStart);
  assert.ok(abortAfterAcceptedLogin === -1 || abortAfterAcceptedLogin > portfolioFetch);
  assert.match(login, /登入成功，但初始資料載入失敗/);

  assert.match(dividends, /await store\.fetchAll\(\);[\s\S]*已刷新配息資訊[\s\S]*catch \(e\)/);
});
