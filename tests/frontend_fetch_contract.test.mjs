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
  assert.equal(calls, 0, 'task starts on the next microtask');

  await Promise.resolve();
  assert.equal(calls, 1);
  gate.resolve('loaded');
  assert.equal(await first, 'loaded');
  assert.equal(await second, 'loaded');
  assert.equal(calls, 1);
});

test('single-flight propagates the same rejection to all concurrent callers', async () => {
  const gate = deferred();
  const failure = new Error('snapshot unavailable');
  let calls = 0;
  const run = createSingleFlight(async () => {
    calls += 1;
    return gate.promise;
  });

  const first = run();
  const second = run();
  gate.reject(failure);

  await assert.rejects(first, error => error === failure);
  await assert.rejects(second, error => error === failure);
  assert.equal(calls, 1);
});

test('single-flight permits a fresh execution after success or failure settles', async () => {
  let calls = 0;
  const outcomes = ['first', new Error('second failed'), 'third'];
  const run = createSingleFlight(async () => {
    const outcome = outcomes[calls];
    calls += 1;
    if (outcome instanceof Error) throw outcome;
    return outcome;
  });

  assert.equal(await run(), 'first');
  await assert.rejects(run(), /second failed/);
  assert.equal(await run(), 'third');
  assert.equal(calls, 3);
});

test('single-flight requires a callable task', () => {
  assert.throws(() => createSingleFlight(null), /must be a function/);
});

test('portfolio fetch contract is single-flight and propagates real load failures', async () => {
  const store = await read('src/stores/portfolio.js');

  assert.match(store, /createSingleFlight/);
  assert.match(store, /const performFetchAll = async \(\) =>/);
  assert.match(store, /const fetchAll = createSingleFlight\(performFetchAll\)/);
  assert.doesNotMatch(store, /if \(loading\.value\) return;/);
  assert.match(store, /fetchAll error:[\s\S]*connectionStatus\.value = 'error';[\s\S]*throw error;/);
});

test('fetchAll callers distinguish refresh failure from authentication and success states', async () => {
  const app = await read('src/App.vue');
  const login = await read('src/components/LoginOverlay.vue');
  const dividends = await read('src/components/DividendManager.vue');
  const store = await read('src/stores/portfolio.js');

  assert.match(app, /await portfolioStore\.fetchAll\(\);[\s\S]*catch \(error\)/);
  assert.match(app, /已登入，但初始資料載入失敗/);

  assert.match(login, /await authStore\.login\(credential\);[\s\S]*catch \(err\)/);
  assert.match(login, /登入成功，但初始資料載入失敗/);
  assert.doesNotMatch(login, /await authStore\.login\(credential\);[\s\S]*await portfolioStore\.fetchAll\(\);[\s\S]*登入驗證失敗/);

  assert.match(dividends, /await store\.fetchAll\(\);[\s\S]*已刷新配息資訊[\s\S]*catch \(e\)/);

  assert.match(store, /計算已完成，但最新資料載入失敗/);
  assert.match(store, /已偵測到新快照，但載入失敗/);
});
