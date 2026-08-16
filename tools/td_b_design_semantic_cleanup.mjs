import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const write = (relative, content) => fs.writeFileSync(path.join(ROOT, relative), content);

function replaceExact(relative, before, after, expected = 1) {
  const source = read(relative);
  const count = source.split(before).length - 1;
  if (count !== expected) throw new Error(`${relative}: expected ${expected} occurrences, found ${count}: ${before}`);
  write(relative, source.split(before).join(after));
}

function createNew(relative, content) {
  const full = path.join(ROOT, relative);
  if (fs.existsSync(full)) throw new Error(`${relative}: already exists`);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  write(relative, content);
}

createNew('src/services/designTypography.js', `const ALLOWED_TYPOGRAPHY_TOKENS = Object.freeze(new Set([
  '--type-caption',
  '--type-label',
  '--type-body',
  '--type-control',
  '--type-emphasis',
  '--type-section',
  '--type-page',
  '--type-metric-sm',
  '--type-metric',
]));

export const resolveSemanticFontPx = (token, { documentRef = globalThis.document } = {}) => {
  if (!ALLOWED_TYPOGRAPHY_TOKENS.has(token)) return null;
  if (!documentRef?.createElement || !documentRef?.defaultView?.getComputedStyle) return null;

  const host = documentRef.body || documentRef.documentElement;
  if (!host?.appendChild) return null;

  const probe = documentRef.createElement('span');
  probe.setAttribute?.('aria-hidden', 'true');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  probe.style.fontSize = \`var(\${token})\`;
  host.appendChild(probe);

  try {
    const computed = documentRef.defaultView.getComputedStyle(probe).fontSize;
    const value = Number.parseFloat(computed);
    return Number.isFinite(value) && value > 0 ? value : null;
  } finally {
    probe.remove?.();
  }
};

export const buildCanvasSemanticFont = ({
  token = '--type-label',
  weight = 700,
  family = "'JetBrains Mono', monospace",
  documentRef = globalThis.document,
} = {}) => {
  const sizePx = resolveSemanticFontPx(token, { documentRef });
  return sizePx === null ? null : \`\${weight} \${sizePx}px \${family}\`;
};

export const __test = Object.freeze({ ALLOWED_TYPOGRAPHY_TOKENS });
`);

replaceExact(
  'src/components/PerformanceChart.vue',
`import {
  buildComparableTwrComparison,
  firstTwrInvalidDate,
  lastFiniteSeriesIndex,
} from '../services/twrState.js';`,
`import {
  buildComparableTwrComparison,
  firstTwrInvalidDate,
  lastFiniteSeriesIndex,
} from '../services/twrState.js';
import {
  buildCanvasSemanticFont,
  resolveSemanticFontPx,
} from '../services/designTypography.js';`,
);

replaceExact(
  'src/components/PerformanceChart.vue',
`    const isMobile = window.innerWidth < 768;
    const fontSize = isMobile ? 10 : 12;
    const labelFontSize = isMobile ? 11 : 14;`,
`    const isMobile = window.innerWidth < 768;
    const captionFontSize = resolveSemanticFontPx('--type-caption');
    const labelFontSize = resolveSemanticFontPx('--type-label');
    const canvasValueFont = buildCanvasSemanticFont({ token: '--type-label' });`,
);

replaceExact(
  'src/components/PerformanceChart.vue',
`labels: { boxWidth: 10, padding: 10, font: { size: fontSize } }`,
`labels: { boxWidth: 10, padding: 10, font: captionFontSize ? { size: captionFontSize } : undefined }`,
);

replaceExact(
  'src/components/PerformanceChart.vue',
`titleFont: { size: 13 }, bodyFont: { size: 13 }, padding: 10,`,
`titleFont: labelFontSize ? { size: labelFontSize } : undefined,
                    bodyFont: labelFontSize ? { size: labelFontSize } : undefined,
                    padding: 10,`,
);

replaceExact(
  'src/components/PerformanceChart.vue',
`ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: isMobile ? 5 : 10, font: { size: fontSize } }`,
`ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: isMobile ? 5 : 10, font: captionFontSize ? { size: captionFontSize } : undefined }`,
);

replaceExact(
  'src/components/PerformanceChart.vue',
`                        ctx.font = \`bold \${labelFontSize}px JetBrains Mono\`;`,
`                        if (canvasValueFont) ctx.font = canvasValueFont;`,
);

replaceExact('src/components/StatsGrid.vue', '總資產淨值', '持倉市值', 1);
replaceExact('src/components/StatsGrid.vue', '投入成本', '持倉成本', 1);
replaceExact('src/components/StatsGrid.vue', 'ROI: {{ roi }}%', '未實現報酬率: {{ roi }}%', 1);
replaceExact('src/components/StrategyGroupOverview.vue', '總資產淨值', '持倉市值', 1);
replaceExact('src/components/StrategyGroupOverview.vue', '投入資本', '持倉成本', 1);
replaceExact('src/components/PerformanceChart.vue', '>總資產</button>', '>持倉市值</button>', 1);
replaceExact('src/components/PerformanceChart.vue', `label: '總資產',`, `label: '持倉市值',`, 1);
replaceExact('src/components/skeletons/StatsGridSkeleton.vue', '/* 總資產數字較大 */', '/* 持倉市值數字較大 */', 1);
replaceExact('src/components/skeletons/StatsGridSkeleton.vue', '/* 關鍵：總資產卡片橫跨兩欄，防止 CLS */', '/* 關鍵：持倉市值卡片橫跨兩欄，防止 CLS */', 1);

replaceExact(
  'README.md',
`  - 總資產（Market Value / NAV-like）`,
`  - 持倉市值（Securities Market Value；目前不含未建模的現金部位）`,
);
replaceExact(
  'README.md',
`  - ROI（投資報酬率）`,
`  - 未實現報酬率（Unrealized Return；未實現損益 ÷ 目前持倉成本）`,
);

replaceExact(
  'journal_engine/models.py',
`class PortfolioSummary(BaseModel):
    total_value: float
    invested_capital: float`,
`class PortfolioSummary(BaseModel):
    # Legacy API field name retained for compatibility. This is the current
    # securities-holdings market value in TWD; an explicit cash asset is not yet modeled.
    total_value: float
    # Legacy API field name retained for compatibility. This is the cost basis of
    # the current positive holdings, not lifetime account deposits/contributed capital.
    invested_capital: float`,
);

createNew('tests/frontend_design_typography_bridge.test.mjs', `import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildCanvasSemanticFont,
  resolveSemanticFontPx,
} from '../src/services/designTypography.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const createDocument = fontSize => {
  let removed = false;
  const probe = {
    style: {},
    setAttribute() {},
    remove() { removed = true; },
  };
  return {
    documentRef: {
      body: { appendChild() {} },
      createElement() { return probe; },
      defaultView: { getComputedStyle() { return { fontSize }; } },
    },
    wasRemoved: () => removed,
    probe,
  };
};

test('semantic typography bridge resolves CSS-token font size for canvas consumers', () => {
  const mock = createDocument('14px');
  assert.equal(resolveSemanticFontPx('--type-label', { documentRef: mock.documentRef }), 14);
  assert.equal(mock.probe.style.fontSize, 'var(--type-label)');
  assert.equal(mock.wasRemoved(), true);
  assert.equal(
    buildCanvasSemanticFont({ token: '--type-label', documentRef: createDocument('14px').documentRef }),
    "700 14px 'JetBrains Mono', monospace",
  );
});

test('semantic typography bridge fails closed for unknown tokens or unavailable DOM', () => {
  assert.equal(resolveSemanticFontPx('--not-a-token', { documentRef: null }), null);
  assert.equal(resolveSemanticFontPx('--type-label', { documentRef: null }), null);
  assert.equal(buildCanvasSemanticFont({ token: '--not-a-token', documentRef: null }), null);
});

test('PerformanceChart consumes design-system typography instead of hard-coded canvas font pixels', () => {
  const source = read('src/components/PerformanceChart.vue');
  assert.match(source, /resolveSemanticFontPx\('--type-caption'\)/);
  assert.match(source, /resolveSemanticFontPx\('--type-label'\)/);
  assert.match(source, /buildCanvasSemanticFont\(\{ token: '--type-label' \}\)/);
  assert.doesNotMatch(source, /const\s+fontSize\s*=\s*isMobile/);
  assert.doesNotMatch(source, /const\s+labelFontSize\s*=\s*isMobile/);
  assert.doesNotMatch(source, /(?:titleFont|bodyFont):\s*\{\s*size:\s*\d/);
  assert.doesNotMatch(source, /ctx\.font\s*=\s*`[^`]*\$\{[^}]+\}px/);
});
`);

createNew('tests/frontend_portfolio_terminology.test.mjs', `import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const CURRENT_UI = [
  'src/components/StatsGrid.vue',
  'src/components/StrategyGroupOverview.vue',
  'src/components/PerformanceChart.vue',
];

test('current portfolio UI names securities values according to the actual calculator semantics', () => {
  const stats = read('src/components/StatsGrid.vue');
  const strategy = read('src/components/StrategyGroupOverview.vue');
  const chart = read('src/components/PerformanceChart.vue');

  assert.match(stats, /持倉市值/);
  assert.match(stats, /持倉成本/);
  assert.match(stats, /未實現報酬率:/);
  assert.match(strategy, /持倉市值/);
  assert.match(strategy, /持倉成本/);
  assert.match(chart, />持倉市值<\/button>/);
  assert.match(chart, /label:\s*'持倉市值'/);
});

test('misleading cash-inclusive or generic ROI labels cannot re-enter current portfolio surfaces', () => {
  const combined = CURRENT_UI.map(read).join('\n');
  assert.doesNotMatch(combined, /總資產淨值/);
  assert.doesNotMatch(combined, />總資產<\/button>/);
  assert.doesNotMatch(combined, /label:\s*'總資產'/);
  assert.doesNotMatch(combined, /ROI:\s*\{\{/);
});

test('documentation states that current total_value is holdings market value rather than cash-inclusive NAV', () => {
  const readme = read('README.md');
  const models = read('journal_engine/models.py');
  assert.match(readme, /持倉市值（Securities Market Value；目前不含未建模的現金部位）/);
  assert.match(readme, /未實現報酬率（Unrealized Return；未實現損益 ÷ 目前持倉成本）/);
  assert.match(models, /securities-holdings market value in TWD/);
  assert.match(models, /current positive holdings, not lifetime account deposits/);
});
`);

console.log('TD-B design/semantic authority cleanup applied');
