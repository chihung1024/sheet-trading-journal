import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const replaceAllRequired = (relative, replacements) => {
  const file = path.join(ROOT, relative);
  let source = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (const [from, to, label] of replacements) {
    if (!source.includes(from)) {
      throw new Error(`${relative}: missing expected semantic target: ${label}`);
    }
    source = source.replaceAll(from, to);
    changed = true;
    console.log(`${relative}: ${label}`);
  }
  if (changed) fs.writeFileSync(file, source);
};

replaceAllRequired('src/style.css', [
  ['--type-control: 0.875rem;', '--type-control: 1rem;', 'controls use 16px for readable touch/input behavior'],
]);

const stylePath = path.join(ROOT, 'src/style.css');
const appPath = path.join(ROOT, 'src/App.vue');
const fontImport = "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');";
let style = fs.readFileSync(stylePath, 'utf8');
let app = fs.readFileSync(appPath, 'utf8');
if (!app.includes(fontImport)) throw new Error('App.vue no longer contains expected font import migration source');
app = app.replace(`${fontImport}\n\n`, '');
if (!style.startsWith(fontImport)) style = `${fontImport}\n\n${style}`;
fs.writeFileSync(appPath, app);
fs.writeFileSync(stylePath, style);
console.log('moved font import into design-system authority');

replaceAllRequired('src/components/DailyCommandCenter.vue', [
  ['font-size: var(--type-metric-sm); font-weight: 700; overflow: hidden;', 'font-size: var(--type-emphasis); font-weight: 700; overflow: hidden;', 'compact command summary uses emphasis, not KPI scale'],
]);

replaceAllRequired('src/components/DailyPnlExplanation.vue', [
  ['font-size: var(--type-metric-sm);\n  font-weight: 700;\n  white-space: nowrap;', 'font-size: var(--type-emphasis);\n  font-weight: 700;\n  white-space: nowrap;', 'published and contributor totals use emphasis scale'],
  ['font-size: var(--type-metric-sm);\n  }', 'font-size: var(--type-emphasis);\n  }', 'mobile published/contributor totals keep emphasis scale'],
]);

replaceAllRequired('src/components/DataReliabilityBanner.vue', [
  ['.reliability-issue strong {\n  font-size: var(--type-body);\n}', '.reliability-issue strong {\n  font-size: var(--type-emphasis);\n}', 'reliability title is one level above message'],
]);

replaceAllRequired('src/components/HoldingsTable.vue', [
  [".m-price { display: block; font-weight: 700; font-family: 'JetBrains Mono', monospace; font-size: var(--type-metric-sm); }", ".m-price { display: block; font-weight: 700; font-family: 'JetBrains Mono', monospace; font-size: var(--type-emphasis); }", 'mobile price is emphasis, not KPI'],
  [".m-footer-val { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: var(--type-metric-sm); }", ".m-footer-val { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: var(--type-emphasis); }", 'mobile footer values are emphasis, not KPI'],
]);

replaceAllRequired('src/components/RecordList.vue', [
  [".m-amount { font-size: var(--type-metric-sm); font-weight: 700; font-family: 'JetBrains Mono', monospace; }", ".m-amount { font-size: var(--type-emphasis); font-weight: 700; font-family: 'JetBrains Mono', monospace; }", 'mobile transaction amount uses emphasis scale'],
]);

replaceAllRequired('src/components/TradeForm.vue', [
  ['font-size: var(--type-label); line-height: 1; padding: 0 4px;', 'font-size: var(--icon-sm); line-height: 1; padding: 0 4px;', 'tag removal glyph uses icon scale'],
  ['.currency-symbol { font-size: var(--type-label);', '.currency-symbol { font-size: var(--type-metric-sm);', 'currency prefix stays visually paired with amount'],
]);

replaceAllRequired('src/components/DividendManager.vue', [
  ['font-size: var(--type-control); transition: all 0.2s; }', 'font-size: var(--icon-md); transition: all 0.2s; }', 'icon-only dividend actions use icon scale'],
  ['font-size: var(--type-metric-sm); font-weight: 700; font-family:', 'font-size: var(--type-emphasis); font-weight: 700; font-family:', 'desktop dividend net amount uses emphasis scale'],
]);

replaceAllRequired('src/components/IbkrTradeImport.vue', [
  ['font-size: var(--type-control);\n}', 'font-size: var(--icon-md);\n}', 'dialog close glyph uses icon scale'],
]);

replaceAllRequired('src/components/LoginOverlay.vue', [
  ['.logo {\n  font-size: var(--type-metric);', '.logo {\n  font-size: var(--icon-empty);', 'login logo uses icon scale'],
  ['.error-icon {\n  font-size: var(--type-section);', '.error-icon {\n  font-size: var(--icon-lg);', 'login error glyph uses icon scale'],
  ['.lock-icon {\n  font-size: var(--type-body);', '.lock-icon {\n  font-size: var(--icon-sm);', 'login lock glyph uses icon scale'],
]);

replaceAllRequired('src/components/PortfolioAllocationDonut.vue', [
  ['.allocation-heading strong { color: var(--text-main); font-size: var(--type-section); }', '.allocation-heading strong { color: var(--text-main); font-size: var(--type-emphasis); }', 'donut subheading uses emphasis instead of section scale'],
]);

console.log('semantic typography cleanup complete');
