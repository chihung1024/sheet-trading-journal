import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/styles/adaptive-workspace.css', import.meta.url), 'utf8');

const functionBlock = (name) => {
  const match = app.match(new RegExp(`const ${name} = [\\s\\S]*?\\n};`));
  assert.ok(match, `${name} should remain present`);
  return match[0];
};

test('transaction surface keeps exactly one TradeForm authority across dock drawer and sheet', () => {
  assert.equal((app.match(/<TradeForm\b/g) || []).length, 1, 'TradeForm must remain a single authority');
  assert.match(app, /`trade-surface-\$\{tradeSurfaceMode\}`/);
  assert.match(app, /tradeSurfaceMode\.value === 'dock'/);
  assert.match(app, /return 'drawer'/);
  assert.match(app, /if \(isCompactView\.value\) return 'sheet'/);
  assert.doesNotMatch(app, /<TradeForm[\s\S]*<TradeForm/);
});

test('dock eligibility uses actual content-container width and one shared CSS token', () => {
  assert.match(app, /ref="contentContainerRef" class="content-container"/);
  assert.match(app, /new window\.ResizeObserver/);
  assert.match(app, /workspaceInlineSize\.value = width/);
  assert.match(app, /readCssPixelToken\([\s\S]*'--ui-trade-dock-workspace-min'/);
  assert.match(css, /--ui-trade-dock-workspace-min:\s*1500px/);
  assert.match(app, /workspaceInlineSize\.value >= tradeDockWorkspaceMin\.value/);
});

test('app shell keeps <=1024 authority while compact sheet gets an explicit <600 interaction mode', () => {
  assert.match(app, /isMobileView\.value = window\.innerWidth <= 1024/);
  assert.match(app, /isCompactView\.value = window\.innerWidth < 600/);
  assert.match(app, /v-if="isCompactView && activeView !== 'cash'"[\s\S]*class="fab-btn"/);
  assert.match(app, /v-if="!isCompactView && activeView !== 'cash'"[\s\S]*class="trade-rail-toggle"/);
});

test('drawer and sheet are modal presentations while dock remains layout composition', () => {
  assert.match(css, /\.main-wrapper\.trade-mode-drawer \.content-container,[\s\S]*\.main-wrapper\.trade-mode-sheet \.content-container[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /\.side-column\.trade-surface-drawer,[\s\S]*\.side-column\.trade-surface-sheet[\s\S]*position:\s*fixed/);
  assert.match(css, /\.main-wrapper\.trade-mode-dock:not\(\.cash-view\) \.content-container[\s\S]*var\(--ui-trade-dock-min\)[\s\S]*var\(--ui-trade-dock-max\)/);
  assert.match(app, /:inert="!isTradeSurfaceVisible"/);
  assert.match(app, /v-if="isTransientTradeSurfaceOpen"[\s\S]*class="sheet-backdrop"/);
});

test('closing or presentation switching never resets unsaved TradeForm state', () => {
  const closeBlock = functionBlock('closeTransientTradeSurface');
  const toggleBlock = functionBlock('toggleDesktopTradeSurface');
  const modeWatch = app.match(/watch\(tradeSurfaceMode,[\s\S]*?\n}\);/);
  assert.ok(modeWatch, 'tradeSurfaceMode watcher should remain present');
  assert.doesNotMatch(closeBlock, /resetForm/);
  assert.doesNotMatch(toggleBlock, /resetForm/);
  assert.doesNotMatch(modeWatch[0], /resetForm/);

  const resetOccurrences = app.match(/\.resetForm\(/g) || [];
  assert.equal(resetOccurrences.length, 1, 'only explicit new-trade intent may reset the form');
  assert.match(functionBlock('openNewTrade'), /tradeFormRef\.value\?\.resetForm/);
});

test('editing a record opens the current presentation before delegating to TradeForm setupForm', () => {
  const source = functionBlock('handleEditRecord');
  const modeIndex = source.indexOf("tradeSurfaceMode.value === 'dock'");
  const openIndex = source.indexOf('tradeOverlayOpen.value = true');
  const nextTickIndex = source.indexOf('nextTick(() =>');
  const setupIndex = source.indexOf('tradeFormRef.value.setupForm(record)');
  assert.ok(modeIndex >= 0 && openIndex > modeIndex, 'edit should open dock or transient surface by mode');
  assert.ok(nextTickIndex > openIndex, 'edit waits for visible DOM before setup');
  assert.ok(setupIndex > nextTickIndex, 'setupForm runs only after the surface is visible');
});

test('transient transaction surface traps focus supports Escape restores focus and locks page scroll', () => {
  assert.match(app, /const handleTradeSurfaceKeydown = \(event\) => \{[\s\S]*event\.key !== 'Tab'/);
  assert.match(app, /if \(event\.shiftKey && active === first\)[\s\S]*last\.focus\(\)/);
  assert.match(app, /else if \(!event\.shiftKey && active === last\)[\s\S]*first\.focus\(\)/);
  assert.match(app, /event\.key !== 'Escape' \|\| !isTransientTradeSurfaceOpen\.value/);
  assert.match(app, /returnTarget\.isConnected[\s\S]*returnTarget\.focus/);
  assert.match(app, /document\.body\.classList\.toggle\('trade-surface-scroll-lock', open\)/);
  assert.match(css, /body\.trade-surface-scroll-lock\s*\{\s*overflow:\s*hidden/);
  assert.match(app, /window\.removeEventListener\('keydown', handleGlobalKeydown\)/);
});

test('adaptive transaction state stays memory-only and does not create persistence authority', () => {
  assert.doesNotMatch(app, /TRADE_RAIL_STORAGE_KEY|TRADE_SURFACE_STORAGE_KEY|FOCUS_MODE_STORAGE_KEY/);
  assert.doesNotMatch(app, /localStorage\.(?:setItem|getItem)\([^)]*(?:focus|rail|drawer|sheet|surface)/i);
});
