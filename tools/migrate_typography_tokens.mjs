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

const iconSelector = selector => /(?:logo-icon|icon-box|title-icon|empty-icon|label-icon|refresh-icon|filter-icon|toast-icon|fab-btn|btn-close-sheet|theme-toggle|market-badge|spinner(?:-sm)?|\.dot\b|btn-icon\b)/i.test(selector);
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

const replaceOnce = (source, from, to, label) => {
  if (!source.includes(from)) return source;
  console.log(`semantic correction: ${label}`);
  return source.replace(from, to);
};

const applySemanticCorrections = (file, source) => {
  const relative = path.relative(ROOT, file).replaceAll('\\', '/');
  let out = source;

  if (relative === 'src/App.vue') {
    const appStyleAuthority = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');\n\n:root {\n  --layout-max: 1920px;\n  --header-height: 64px;\n  --space-desktop: 20px;\n}\n\n/* Header Optimization */`;
    out = out.replace(
      /@import url\('https:\/\/fonts\.googleapis\.com\/css2\?family=Inter:wght@400;500;600;700&family=JetBrains\+Mono:wght@400;500;700&display=swap'\);\n\n:root \{[\s\S]*?\/\* Header Optimization \*\//,
      appStyleAuthority,
    );
    out = out.replace(
      /(\.action-trigger-btn span:first-child \{[^{}]*?font-size:)\s*var\(--type-section\);/,
      '$1 var(--icon-md);',
    );
  }

  if (relative === 'src/components/RecordList.vue') {
    const noteLine = '                                <span v-if="r.note" class="record-note-inline">{{ r.note }}</span>\n';
    while (out.includes(noteLine + noteLine)) {
      out = out.replaceAll(noteLine + noteLine, noteLine);
    }

    out = replaceOnce(
      out,
      '代碼 / 策略 <span class="sort-icon">{{ getSortIcon(\'symbol\') }}</span>',
      '代碼 / 策略 / 備註 <span class="sort-icon">{{ getSortIcon(\'symbol\') }}</span>',
      'RecordList header owns journal summary with symbol/strategy',
    );
    out = replaceOnce(out, '                    <th>備註</th>\n', '', 'remove empty desktop note column');
    out = out.replaceAll('colspan="8"', 'colspan="7"');

    if (!out.includes(noteLine)) {
      out = replaceOnce(
        out,
        '                                <div v-if="getRecordTags(r).length > 0" class="record-tags" aria-label="策略標籤">\n                                    <span v-for="tag in getRecordTags(r)" :key="tag" class="tag-chip">{{ tag }}</span>\n                                </div>\n',
        '                                <div v-if="getRecordTags(r).length > 0" class="record-tags" aria-label="策略標籤">\n                                    <span v-for="tag in getRecordTags(r)" :key="tag" class="tag-chip">{{ tag }}</span>\n                                </div>\n' + noteLine,
        'inline journal summary below symbol and strategy tags',
      );
    }

    out = replaceOnce(
      out,
      '                        <td class="note-cell">\n                            <span v-if="r.note" class="note-preview">{{ r.note }}</span>\n                            <span v-else class="note-empty">—</span>\n                        </td>\n',
      '',
      'remove standalone journal table cell',
    );
    out = replaceOnce(out, '.symbol-cell { min-width: 135px; }\n', '.symbol-cell { min-width: 0; }\n', 'allow combined journal column to flex');
    out = replaceOnce(
      out,
      '.note-cell { min-width: 180px; max-width: 320px; }\n.note-preview { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: normal; color: var(--text-main); line-height: 1.4; }\n.note-empty { color: var(--text-sub); }\n',
      '.record-note-inline { display: block; width: 100%; min-width: 0; color: var(--text-sub); font-size: var(--type-label); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n',
      'replace standalone note styles with inline journal summary',
    );
  }

  return out;
};

const files = collectVueFiles(SRC);
let changed = 0;
for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');
  const migrated = migrateStyleBlocks(before);
  const after = applySemanticCorrections(file, migrated);
  if (after === before) continue;
  fs.writeFileSync(file, after);
  changed += 1;
  console.log(`migrated ${path.relative(ROOT, file)}`);
}

/* index.html is a boot screen that renders before the app design system is guaranteed
   to be available. Keep two explicit boot-only sizes instead of creating a second token authority. */
const indexPath = path.join(ROOT, 'index.html');
let indexSource = fs.readFileSync(indexPath, 'utf8');
indexSource = indexSource.replace('font-size: var(--type-metric);', 'font-size: 2rem;');
indexSource = indexSource.replace('font-size: var(--type-body);', 'font-size: 0.875rem;');
fs.writeFileSync(indexPath, indexSource);

console.log(`typography migration changed ${changed} Vue file(s)`);
