import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildDataSyncPresentation } from '../src/services/dataSyncPresentation.js';

test('data sync presentation never treats loaded-but-unverified data as synchronized', () => {
  assert.deepEqual(
    buildDataSyncPresentation({
      connectionStatus: 'connected',
      snapshotFreshness: 'loaded',
      verified: false,
    }),
    {
      className: 'loading',
      label: '驗證資料中',
      title: '資料已載入，正在確認與目前交易紀錄一致',
    },
  );

  assert.equal(
    buildDataSyncPresentation({
      connectionStatus: 'connected',
      snapshotFreshness: 'loaded',
      verified: true,
    }).label,
    '資料已同步',
  );
});

test('active update, connection error and stale evidence take precedence over a prior verification proof', () => {
  assert.equal(buildDataSyncPresentation({ isPolling: true, verified: true }).label, '資料更新中');
  assert.equal(buildDataSyncPresentation({ connectionStatus: 'error', verified: true }).label, '連線異常');
  assert.equal(buildDataSyncPresentation({
    connectionStatus: 'connected',
    snapshotFreshness: 'stale',
    verified: true,
  }).label, '資料待更新');
});

test('loading and initial connected states stay non-authoritative', () => {
  assert.equal(buildDataSyncPresentation({ loading: true }).label, '載入資料中');
  assert.equal(buildDataSyncPresentation({ connectionStatus: 'connected' }).label, '準備資料中');
  assert.equal(buildDataSyncPresentation().label, '連線中');
});

test('App uses the existing snapshot verification proof and product-level sync language', async () => {
  const source = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8');

  assert.match(source, /buildDataSyncPresentation/);
  assert.match(source, /isSnapshotVerificationCurrent/);
  assert.match(source, /isSnapshotVerificationCurrent\(portfolioStore\.rawData, portfolioStore\.records\)/);
  assert.match(source, />立即更新</);
  assert.match(source, /aria-label="立即更新資料"/);
  assert.match(source, /下次自動更新/);
  assert.match(source, /暫停盤中自動更新/);

  assert.doesNotMatch(source, /正在觸發 GitHub Actions/);
  assert.doesNotMatch(source, /系統將自動輪詢狀態/);
  assert.doesNotMatch(source, /手動觸發計算/);
  assert.doesNotMatch(source, /確定要觸發後端計算/);
  assert.doesNotMatch(source, /快照待重算/);
  assert.doesNotMatch(source, /已連線・快照已載入/);
});

test('persistent stale-data guidance remains actionable without exposing snapshot/backend internals', async () => {
  const source = await readFile(new URL('../src/services/dataReliability.js', import.meta.url), 'utf8');

  assert.match(source, /持倉與績效資料待更新/);
  assert.match(source, /可使用「立即更新」/);
  assert.doesNotMatch(source, /持倉與績效快照待重新計算/);
  assert.doesNotMatch(source, /後端尚未確認發布新的計算快照/);
  assert.doesNotMatch(source, /手動觸發重算/);
});