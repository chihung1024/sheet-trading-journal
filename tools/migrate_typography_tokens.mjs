import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');

const collectVueFiles = dir => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectVueFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.vue')) out.push(full);
  }
  return out;
};

const normalizeRem = (raw, unit) => {
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return unit === 'px' ? value / 16 : value;
};

const iconSelector = selector => /(?:logo-icon|icon-box|title-icon|empty-icon|label-icon|refresh-icon|filter-icon|toast-icon|fab-btn|btn-close-sheet|theme-toggle|market-badge|spinner(?:-sm)?|\.dot\b|btn-icon\b|empty-icon)/i.test(selector);
const metricSelector = selector => /(?:stat-value|summary-value|published-total|contributor-total|net-display|command-summary-value|m-amount|m-price\b|m-footer-val|daily-pnl-block\s+\.stat-value)/i.test(selector);
const titleSelector = selector => /(?:\bh[1-4]\b|panel-title|chart-title|gm-title|gm-section-title|strategy-name|history-title|empty-text|allocation-heading\s+strong|concentration-header\s+h4)/i.test(selector);
const controlSelector = selector => /(?:button|input|select|textarea|\bbtn[-_]|switch-btn|toggle-pills|time-pills|quick-tag|filter-select|search-input|form-input|input-field|show-more-btn|detail-link|command-toggle|select-group-btn)/i.test(selector);
const captionSelector = selector => /(?:eyebrow|caption|hint|help|note|status|badge|tag|meta|count|currency|subtitle|date|label|footer|period|scope|rate|small|info|authority|warning|context|description|detail-authority|record-twd|empty-hint|syncing|confirmed-label)/i.test(selector);

const iconToken = rem => {
  if (rem <= 0.9) return '--icon-xs';
  if (rem <= 1.05) return '--icon-sm';
  if (rem <= 1.15) return '--icon-md';
  if (rem <= 1.3) return '--icon-lg';
  if (rem <= 1.6) return '--icon-xl';
  return '--icon-empty';
};

const textToken = (selector, rem) => {
  if (metricSelector(selector)) return rem >= 1.35 ? '--type-metric' : '--type-metric-sm';
  if (titleSelector(selector)) return rem >= 1.2 ? '--type-page' : '--type-section';
  if (controlSelector(selector)) return '--type-control';
  if (captionSelector(selector)) return rem <= 0.77 ? '--type-caption' : '--type-label';
  if (rem <= 0.77) return '--type-caption';
  if (rem <= 0.84) return '--type-label';
  if (rem <= 0.94) return '--type-body';
  if (rem <= 1.05) return '--type-emphasis';
  if (rem <= 1.2) return '--type-section';
  if (rem <= 1.4) return '--type-metric-sm';
  return '--type-metric';
};

const selectorForOffset = (css, offset) => {
  const open = css.lastIndexOf('{', offset);
  if (open < 0) return '';
  const previousClose = css.lastIndexOf('}', open - 1);
  const previousOpen = css.lastIndexOf('{', open - 1);
  const start = Math.max(previousClose, previousOpen) + 1;
  return css.slice(start, open).trim();
};

const migrateCss = css => css.replace(
  /font-size\s*:\s*([0-9]*\.?[0-9]+)(rem|px)\s*;/g,
  (match, raw, unit, offset) => {
    const rem = normalizeRem(raw, unit);
    if (rem == null) return match;
    const selector = selectorForOffset(css, offset);
    const token = iconSelector(selector) ? iconToken(rem) : textToken(selector, rem);
    return `font-size: var(${token});`;
  },
);

const migrateStyleBlocks = source => source.replace(
  /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/g,
  (match, open, css, close) => `${open}${migrateCss(css)}${close}`,
);

const files = [...collectVueFiles(SRC), path.join(ROOT, 'index.html')];
let changed = 0;
for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');
  const after = migrateStyleBlocks(before);
  if (after === before) continue;
  fs.writeFileSync(file, after);
  changed += 1;
  console.log(`migrated ${path.relative(ROOT, file)}`);
}

console.log(`typography migration changed ${changed} file(s)`);
