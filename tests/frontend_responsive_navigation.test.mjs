import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = fs.readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');
const navSource = fs.readFileSync(new URL('../src/components/CompactNavigation.vue', import.meta.url), 'utf8');
const adaptiveCss = fs.readFileSync(new URL('../src/styles/adaptive-workspace.css', import.meta.url), 'utf8');

test('responsive navigation remains a presentation of the single App activeView authority', () => {
  assert.equal((appSource.match(/const activeView = ref\('overview'\)/g) || []).length, 1);
  assert.equal((appSource.match(/const ACTIVE_VIEW_STORAGE_KEY/g) || []).length, 1);
  assert.match(appSource, /<CompactNavigation[\s\S]*:views="views"[\s\S]*:active-view="activeView"[\s\S]*@navigate="activeView = \$event"/);
  assert.match(appSource, /watch\(activeView,[\s\S]*persistView\(v\)[\s\S]*setUrlView\(v\)/);

  // Guard executable persistence/routing authority, not explanatory comments that
  // intentionally name the App-owned URL/localStorage contract.
  assert.doesNotMatch(
    navSource,
    /\b(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem|clear)\s*\(|\bhistory\.(?:pushState|replaceState)\s*\(|\blocation\.(?:assign|replace)\s*\(|\bURLSearchParams\s*\(|\b(?:useRouter|useRoute)\s*\(|\brouter\.(?:push|replace)\s*\(/i,
  );
  assert.match(navSource, /defineEmits\(\['navigate'\]\)/);
  assert.match(navSource, /emit\('navigate', viewKey\)/);
});

test('compact presentation exposes four primary destinations plus More from the existing views catalog', () => {
  assert.match(navSource, /const COMPACT_PRIMARY_ORDER = Object\.freeze\(\[[\s\S]*'overview'[\s\S]*'holdings'[\s\S]*'records'[\s\S]*'dividends'[\s\S]*\]\)/);
  assert.match(navSource, /primaryViews = computed\(\(\) => COMPACT_PRIMARY_ORDER[\s\S]*props\.views\.find/);
  assert.match(navSource, /moreViews = computed\(\(\) => props\.views[\s\S]*!COMPACT_PRIMARY_SET\.has\(view\.key\)/);
  assert.match(navSource, />更多</);
  assert.match(navSource, /aria-haspopup="true"/);
  assert.match(navSource, /:aria-expanded="moreOpen \? 'true' : 'false'"/);
});

test('pending dividend attention remains discoverable in compact primary navigation', () => {
  assert.match(appSource, /:pending-dividends-count="pendingDividendsCount"/);
  assert.match(navSource, /view\.key === 'dividends' && pendingDividendsCount > 0/);
  assert.match(navSource, /class="tab-badge compact-nav-badge"/);
  assert.match(navSource, /待處理配息/);
});

test('compact current-view and More interaction stay keyboard visible and focus-restoring', () => {
  assert.match(navSource, /:aria-current="activeView === view\.key \? 'page' : undefined"/);
  assert.match(navSource, /:class="\{ active: isMoreActive \}"/);
  assert.match(navSource, /event\.key !== 'Escape'/);
  assert.match(navSource, /closeMore\(\{ restoreFocus: true \}\)/);
  assert.match(navSource, /moreButtonRef\.value\?\.focus/);
  assert.match(navSource, /document\.addEventListener\('pointerdown', handlePointerDown\)/);
  assert.match(navSource, /document\.removeEventListener\('pointerdown', handlePointerDown\)/);
});

test('navigation presentation switches from actual main-workspace inline size and uses shared touch density', () => {
  assert.match(adaptiveCss, /\.compact-navigation\s*\{\s*display:\s*none/);
  assert.match(adaptiveCss, /@container main-workspace \(max-width:\s*680px\)[\s\S]*\.main-column > \.mobile-tabs\s*\{[\s\S]*display:\s*none[\s\S]*\.compact-navigation\s*\{[\s\S]*display:\s*grid/);
  assert.match(adaptiveCss, /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(adaptiveCss, /\.compact-nav-item,[\s\S]*\.compact-nav-more-item\s*\{[\s\S]*min-height:\s*var\(--ui-touch-target\)/);
  assert.match(adaptiveCss, /@media \(prefers-reduced-motion:\s*reduce\)/);
});
