import fs from 'node:fs';

const path = 'tools/td_b_design_semantic_cleanup.mjs';
const source = fs.readFileSync(path, 'utf8');
const before = "  assert.doesNotMatch(source, /ctx\\.font\\s*=\\s*`[^`]*\\$\\{[^}]+\\}px/);";
const after = "  assert.doesNotMatch(source, /ctx\\.font\\s*=\\s*[^;]*\\$\\{[^}]+\\}px/);";
const count = source.split(before).length - 1;
if (count !== 1) throw new Error(`expected parser-sensitive assertion once, found ${count}`);
fs.writeFileSync(path, source.replace(before, after));
console.log('TD-B codemod parser fixed');
