import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('R2.3C exposes cash as a first-class app view without coupling it to portfolio calculation', async () => {
  const app = await readFile('src/App.vue', 'utf8');
  const manager = await readFile('src/components/CashManager.vue', 'utf8');
  assert.match(app, /key: 'cash', label: '現金'/);
  assert.match(app, /<CashManager \/>/);
  assert.match(app, /activeView !== 'cash'.*side-column/s);
  assert.match(app, /main-wrapper\.cash-view \.content-container/);
  assert.match(manager, /目前不影響 NAV \/ TWR \/ XIRR/);
  assert.match(manager, /確認上一筆結果/);
  assert.doesNotMatch(manager, /usePortfolioStore|triggerUpdate|portfolioStore/);
  assert.doesNotMatch(manager, /event_source\s*[:=]/);
  assert.match(manager, /attemptedCreateIntent && error\?\.outcomeAmbiguous !== true/);
  assert.match(manager, /修改結果不確定，已重新載入伺服器目前狀態/);

  const reconcileStart = manager.indexOf('const reconcilePending = async');
  const reconcileEnd = manager.indexOf('const removeEvent = async', reconcileStart);
  const reconcileBlock = manager.slice(reconcileStart, reconcileEnd);
  const replayCatch = reconcileBlock.slice(reconcileBlock.indexOf('} catch (error)'));
  assert.match(reconcileBlock, /completeCashCreateIntent/);
  assert.doesNotMatch(replayCatch, /completeCashCreateIntent/);
  assert.match(replayCatch, /failed replay does not resolve the earlier ambiguous POST/);
});

test('cash UI keeps trade/dividend derived cash out of manual event types', async () => {
  const manager = await readFile('src/components/CashManager.vue', 'utf8');
  assert.match(manager, /OPENING_BALANCE/);
  assert.match(manager, /DEPOSIT/);
  assert.match(manager, /WITHDRAWAL/);
  assert.doesNotMatch(manager, /value="BUY"|value="SELL"|value="DIV"|value="ADJUSTMENT"/);
});
