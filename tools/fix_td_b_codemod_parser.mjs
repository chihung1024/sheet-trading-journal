import fs from 'node:fs';

const path = 'tools/td_b_design_semantic_cleanup.mjs';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected once, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
  "  assert.doesNotMatch(source, /ctx\\.font\\s*=\\s*`[^`]*\\$\\{[^}]+\\}px/);",
  "  assert.doesNotMatch(source, /ctx\\.font\\s*=\\s*[^;]*\\$\\{[^}]+\\}px/);",
  'parser-sensitive canvas assertion',
);

replaceOnce(
  "replaceExact('src/components/StatsGrid.vue', '總資產淨值', '持倉市值', 1);",
  "replaceExact('src/components/StatsGrid.vue', '總資產淨值', '持倉市值', 2);",
  'StatsGrid two same-class total-value labels',
);

replaceOnce(
  "replaceExact('src/components/StrategyGroupOverview.vue', '投入資本', '持倉成本', 1);",
  "replaceExact('src/components/StrategyGroupOverview.vue', '投入資本', '持倉成本', 1);\nreplaceExact('tests/frontend_strategy_group_overview.test.mjs', '總資產淨值', '持倉市值', 1);\nreplaceExact('tests/frontend_strategy_group_overview.test.mjs', '投入資本', '持倉成本', 1);",
  'StrategyGroupOverview semantic regression update',
);

replaceOnce(
  "createNew('tests/frontend_design_typography_bridge.test.mjs', `",
  "createNew('tests/frontend_design_typography_bridge.test.mjs', String.raw`",
  'typography regression raw template',
);

replaceOnce(
  "createNew('tests/frontend_portfolio_terminology.test.mjs', `",
  "createNew('tests/frontend_portfolio_terminology.test.mjs', String.raw`",
  'portfolio terminology regression raw template',
);

fs.writeFileSync(path, source);
console.log('TD-B one-time codemod repaired for reviewed exact semantics');
