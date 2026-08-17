import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/styles/product-consistency.css', import.meta.url), 'utf8');

test('desktop focus mode is a reversible control over the existing single trade rail', () => {
  assert.match(app, /v-if="!isMobileView && activeView !== 'cash'"[\s\S]*class="trade-rail-toggle"/);
  assert.match(app, /@click="desktopTradeRailCollapsed = !desktopTradeRailCollapsed"/);
  assert.match(app, /aria-controls="desktop-trade-rail"/);
  assert.match(app, /'trade-rail-collapsed': isDesktopTradeRailCollapsed/);
  assert.equal((app.match(/<TradeForm\b/g) || []).length, 1, 'TradeForm must remain a single authority');
});

test('focus mode keeps the TradeForm mounted and only changes desktop visibility/layout', () => {
  assert.match(app, /v-show="isMobileView \|\| !desktopTradeRailCollapsed"[\s\S]*id="desktop-trade-rail"/);
  assert.match(app, /const desktopTradeRailCollapsed = ref\(false\)/);
  assert.match(app, /const isDesktopTradeRailCollapsed = computed\(\(\) => \([\s\S]*!isMobileView\.value[\s\S]*activeView\.value !== 'cash'[\s\S]*desktopTradeRailCollapsed\.value/);
  assert.match(css, /@media \(min-width:\s*1025px\)[\s\S]*\.main-wrapper\.trade-rail-collapsed \.content-container\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
});

test('editing a record reopens the desktop rail before delegating to TradeForm setupForm', () => {
  const editHandler = app.match(/const handleEditRecord = \(record\) => \{[\s\S]*?\n\};/);
  assert.ok(editHandler, 'handleEditRecord should remain present');
  const source = editHandler[0];
  const reopenIndex = source.indexOf('desktopTradeRailCollapsed.value = false');
  const nextTickIndex = source.indexOf('nextTick(() =>');
  const setupIndex = source.indexOf('tradeFormRef.value.setupForm(record)');
  assert.ok(reopenIndex >= 0, 'desktop edit must reopen the rail');
  assert.ok(nextTickIndex > reopenIndex, 'rail must reopen before waiting for DOM update');
  assert.ok(setupIndex > nextTickIndex, 'setupForm must execute only after the rail is visible again');
});

test('mobile sheet behavior remains authoritative and clears desktop-only focus state on resize', () => {
  assert.match(app, /isMobileView\.value = window\.innerWidth < 1024/);
  assert.match(app, /if \(isMobileView\.value\) \{[\s\S]*showMobileTrade\.value = false;[\s\S]*desktopTradeRailCollapsed\.value = false/);
  assert.match(app, /class="side-column"[\s\S]*'mobile-sheet': isMobileView[\s\S]*'sheet-open': showMobileTrade/);
  assert.match(app, /v-if="isMobileView && activeView !== 'cash'"[\s\S]*class="fab-btn"/);
});

test('desktop focus state is memory-only and does not create browser persistence authority', () => {
  assert.doesNotMatch(app, /TRADE_RAIL_STORAGE_KEY|FOCUS_MODE_STORAGE_KEY|desktopTradeRailCollapsed[^\n]*localStorage/i);
  assert.doesNotMatch(app, /localStorage\.(?:setItem|getItem)\([^)]*(?:focus|rail)/i);
});

test('focus-mode CSS remains layout-only', () => {
  assert.match(css, /\.trade-rail-toggle/);
  assert.doesNotMatch(css, /font-size\s*:/i);
  assert.doesNotMatch(css, /!important/i);
});
