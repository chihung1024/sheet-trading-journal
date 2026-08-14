import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = relativePath => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('portfolio recovery copy reflects automatic read recovery without removing truthful manual fallbacks', async () => {
  const source = await readSource('../src/stores/portfolio.js');

  assert.match(source, /計算已完成；最新資料暫時載入失敗，系統將自動重試/);
  assert.match(source, /\$\{action\}已完成；最新交易紀錄暫時載入失敗，系統將自動重試/);
  assert.match(source, /已偵測到新快照；載入暫時失敗，系統將自動重試/);

  assert.doesNotMatch(source, /計算已完成，但最新資料載入失敗，請手動刷新/);
  assert.doesNotMatch(source, /畫面重新載入失敗；請重新整理確認最新紀錄/);
  assert.doesNotMatch(source, /已偵測到新快照，但載入失敗，請手動刷新/);

  assert.match(source, /自動重新計算狀態無法保存；必要時可手動更新/);
  assert.match(source, /計算工作仍在排隊或執行中，稍後重新整理可繼續追蹤/);
});

test('dividend recovery copy describes same-key reconciliation rather than payload dedupe or manual retry', async () => {
  const source = await readSource('../src/components/DividendManager.vue');

  assert.match(source, /透過共用 addRecord durable idempotency lifecycle 新增配息記錄/);
  assert.doesNotMatch(source, /資料庫會自動處理重複/);

  assert.match(source, /配息入帳回應不確定；系統正在使用原交易識別碼自動確認，請勿重複提交。/);
  assert.doesNotMatch(source, /請先刷新交易紀錄確認，勿直接再次提交/);

  assert.match(source, /配息已入帳；重新計算狀態將由系統持續追蹤與恢復，無需重複操作。/);
  assert.doesNotMatch(source, /配息已入帳，但自動更新失敗，請手動點擊「更新數據」/);
});

test('restored-session initial read copy reflects the existing automatic full-read recovery', async () => {
  const source = await readSource('../src/App.vue');

  assert.match(source, /已登入，但初始資料暫時載入失敗，系統將自動重試/);
  assert.doesNotMatch(source, /已登入，但初始資料載入失敗，請稍後手動刷新/);
});
