import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { presentToastMessage } from '../src/services/toastPresentation.js';

const technicalTerms = /快照|後端計算工作|計算工作|原計算工作|原交易識別碼|原識別碼|相同識別碼|觸發重算|數據重算|背景計算/;

const cases = [
  ['新增成功；持倉快照待重新計算', '新增成功；持倉與績效將自動更新'],
  ['更新成功；持倉快照待重新計算', '更新成功；持倉與績效將自動更新'],
  ['刪除成功；持倉快照待重新計算', '刪除成功；持倉與績效將自動更新'],
  ['🚀 這是您的第一筆交易，系統正自動啟動背景計算...', '🚀 這是您的第一筆交易，正在準備持倉與績效資料...'],
  ['⚠️ 已偵測到新快照；載入暫時失敗，系統將自動重試', '⚠️ 最新資料已完成更新；載入暫時失敗，系統將自動重試'],
  ['計算工作仍在排隊或執行中，稍後重新整理可繼續追蹤', '資料更新仍在處理中，稍後重新整理可繼續追蹤'],
  ['相同的計算要求已在排隊，繼續追蹤原工作', '相同的更新要求已在處理中，繼續等待完成'],
  ['🔄 已建立後端計算工作，正在同步中...', '🔄 資料更新已開始，正在同步中...'],
  ['🔄 已手動觸發數據重算，正在同步中...', '🔄 資料更新已開始，正在同步中...'],
  ['後端計算失敗 (FAILED)', '資料更新失敗 (FAILED)'],
  ['更新要求的回應不確定；系統將用相同識別碼安全確認原計算工作，請勿重複觸發', '更新要求的回應不確定；系統將安全確認原本的更新要求，請勿重複操作'],
  ['新增交易回應不確定，系統正在用原識別碼自動確認，請勿重複送出相同交易', '新增交易回應不確定，系統正在安全確認原本的交易要求，請勿重複送出相同交易'],
  ['配息入帳回應不確定；系統正在使用原交易識別碼自動確認，請勿重複提交。', '配息入帳回應不確定；系統正在安全確認原本的交易要求，請勿重複提交。'],
  ['暫時性計算服務異常已達自動重試上限，已保留既有快照', '暫時性資料更新服務異常已達自動重試上限，已保留上一次可用資料'],
  ['自動重試仍未成功；已停止重試並保留待重算狀態', '自動重試仍未成功；已停止重試並保留待更新狀態'],
];

test('known operation and recovery toasts converge on product language at the single presentation boundary', () => {
  for (const [input, expected] of cases) {
    const output = presentToastMessage(input);
    assert.equal(output, expected, input);
    assert.doesNotMatch(output, technicalTerms, input);
  }
});

test('ordinary user-facing messages are unchanged', () => {
  for (const message of [
    '✅ 數據已更新完畢！',
    '交易資料未通過檢查；請檢查交易紀錄',
    '最新資料讀取失敗',
    '請勿重複送出相同交易',
  ]) {
    assert.equal(presentToastMessage(message), message);
  }
});

test('non-string toast payloads remain safe and deterministic', () => {
  assert.equal(presentToastMessage(null), '');
  assert.equal(presentToastMessage(undefined), '');
  assert.equal(presentToastMessage(42), '42');
});

test('all global controllers still share useToast while product copy is applied only at presentation', async () => {
  const toastSource = await readFile(new URL('../src/composables/useToast.js', import.meta.url), 'utf8');
  const mainSource = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');

  assert.match(toastSource, /import \{ presentToastMessage \} from '\.\.\/services\/toastPresentation\.js'/);
  assert.match(toastSource, /message: presentToastMessage\(message\)/);
  assert.match(mainSource, /const \{ addToast \} = useToast\(\)/);
  assert.match(mainSource, /notify: addToast/);
  assert.doesNotMatch(toastSource, /portfolio|calculationJob|retry|idempotency|fetch\(/);
});