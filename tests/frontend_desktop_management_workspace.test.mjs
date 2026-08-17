import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/styles/product-consistency.css', import.meta.url), 'utf8');
const cash = fs.readFileSync(new URL('../src/components/CashManager.vue', import.meta.url), 'utf8');
const groups = fs.readFileSync(new URL('../src/components/GroupManager.vue', import.meta.url), 'utf8');
const dividends = fs.readFileSync(new URL('../src/components/DividendManager.vue', import.meta.url), 'utf8');

test('D5 keeps the existing management component authorities mounted by App', () => {
  assert.match(app, /class="section-dividends"[\s\S]*<DividendManager/);
  assert.match(app, /class="section-cash"[\s\S]*<CashManager/);
  assert.match(app, /class="section-groups"[\s\S]*<GroupManager/);
});

test('wide cash workspace composes the existing editor and ledger side by side', () => {
  assert.match(cash, /class="card cash-editor"/);
  assert.match(cash, /class="card cash-list-card"/);
  assert.match(app, /<aside[\s\S]*v-if="activeView !== 'cash'"/);
  assert.match(css, /@media \(min-width:\s*1280px\)[\s\S]*\.section-cash \.cash-page\s*\{[\s\S]*grid-template-columns:\s*minmax\(340px, 0\.72fr\) minmax\(0, 1\.28fr\)/);
  assert.match(css, /\.section-cash \.cash-editor\s*\{\s*grid-column:\s*1/);
  assert.match(css, /\.section-cash \.cash-list-card\s*\{\s*grid-column:\s*2/);
  assert.match(css, /\.section-cash \.cash-form\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
});

test('group workspace waits for enough viewport width beside the transaction rail', () => {
  assert.equal((groups.match(/class="card gm-card"/g) || []).length, 1);
  assert.equal((groups.match(/class="gm-section gm-section-selection"/g) || []).length, 1);
  assert.match(css, /@media \(min-width:\s*1600px\)[\s\S]*\.section-groups \.gm-card\s*\{[\s\S]*grid-template-columns:\s*minmax\(300px, 0\.38fr\) minmax\(0, 1fr\)/);
  assert.match(css, /\.section-groups \.gm-section-selection\s*\{[\s\S]*grid-column:\s*2/);
  assert.match(css, /\.section-groups \.gm-card \.gm-records\s*\{[\s\S]*max-height:\s*clamp\(520px, 62vh, 760px\)/);
});

test('ultrawide strategy overview uses three columns while retaining the same strategy cards', () => {
  assert.match(css, /@media \(min-width:\s*1680px\)[\s\S]*\.section-groups \.strategy-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
});

test('desktop dividend density keeps all queue guidance and actions present', () => {
  assert.match(dividends, /class="dividend-entry-help"/);
  assert.match(dividends, /class="queue-section-label"/);
  assert.match(dividends, /class="btn-action btn-confirm"/);
  assert.match(css, /@media \(min-width:\s*1025px\)[\s\S]*\.section-dividends \.dm-header\s*\{\s*padding:\s*14px 16px/);
});

test('D5 layout authority does not shrink typography or hide business content', () => {
  assert.doesNotMatch(css, /font-size\s*:/i);
  assert.doesNotMatch(css, /!important/i);
  assert.doesNotMatch(css, /display\s*:\s*none/i);
});
