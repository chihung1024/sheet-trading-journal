import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMMIT_RE = /^[0-9a-f]{40}$/i;
const GOOGLE_CLIENT_ID_RE = /^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i;
const EXPECTED_SERVICE = 'journal-backend-staging';
const EXPECTED_D1_NAME = 'trading-journal-staging';
const EXPECTED_FRONTEND_ORIGIN = 'https://staging.sheet-trading-journal.pages.dev';
const EXPECTED_DEPLOYMENT_ENVIRONMENT = 'staging';
const PRODUCTION_GOOGLE_CLIENT_ID =
  '951186116587-0ehsmkvlu3uivduc7kjn1jpp9ga7810i.apps.googleusercontent.com';
const PLACEHOLDER_GOOGLE_CLIENT_ID =
  '000000000000-staging-placeholder.apps.googleusercontent.com';

const sourcePath = resolve(
  process.env.WRANGLER_STAGING_TEMPLATE || 'wrangler.staging.toml',
);
const outputPath = resolve(
  process.env.WRANGLER_STAGING_OUTPUT || '.wrangler/staging.toml',
);
const databaseId = String(process.env.CLOUDFLARE_D1_DATABASE_ID || '').trim();
const databaseName = String(process.env.CLOUDFLARE_D1_DATABASE_NAME || '').trim();
const googleClientId = String(process.env.STAGING_GOOGLE_CLIENT_ID || '').trim();
const sourceCommit = String(
  process.env.SOURCE_COMMIT || process.env.GITHUB_SHA || '',
).trim();

if (sourcePath === outputPath) {
  throw new Error('Staging Wrangler output must not overwrite the tracked template');
}
if (!UUID_RE.test(databaseId) || databaseId === ZERO_UUID) {
  throw new Error('CLOUDFLARE_D1_DATABASE_ID must be a non-sentinel D1 UUID');
}
if (databaseName !== EXPECTED_D1_NAME) {
  throw new Error(`CLOUDFLARE_D1_DATABASE_NAME must equal ${EXPECTED_D1_NAME}`);
}
if (!GOOGLE_CLIENT_ID_RE.test(googleClientId)) {
  throw new Error('STAGING_GOOGLE_CLIENT_ID must be a valid Google web OAuth client ID');
}
if (
  googleClientId === PRODUCTION_GOOGLE_CLIENT_ID
  || googleClientId === PLACEHOLDER_GOOGLE_CLIENT_ID
) {
  throw new Error('STAGING_GOOGLE_CLIENT_ID must be a dedicated non-production client');
}
if (!COMMIT_RE.test(sourceCommit)) {
  throw new Error('SOURCE_COMMIT or GITHUB_SHA must be an exact 40-character Git commit SHA');
}

let config = await readFile(sourcePath, 'utf8');
requireExact(config, `name = "${EXPECTED_SERVICE}"`, 'staging Worker service');
requireExact(config, 'main = "staging-worker.js"', 'staging Worker entry point');
requireExact(
  config,
  `DEPLOYMENT_ENVIRONMENT = "${EXPECTED_DEPLOYMENT_ENVIRONMENT}"`,
  'staging deployment environment',
);
requireExact(
  config,
  `ALLOWED_ORIGINS = "${EXPECTED_FRONTEND_ORIGIN}"`,
  'staging frontend origin',
);
requireExact(config, `database_name = "${EXPECTED_D1_NAME}"`, 'staging D1 name');

config = rewriteRelativeConfigPath(config, /^main = "([^"]+)"$/m, 'main');
config = rewriteRelativeConfigPath(
  config,
  /^migrations_dir = "([^"]+)"$/m,
  'migrations_dir',
);
config = replaceExactly(
  config,
  /^database_id = ".*"$/m,
  `database_id = "${databaseId}"`,
  'database_id',
);
config = replaceExactly(
  config,
  /^GOOGLE_CLIENT_ID = ".*"$/m,
  `GOOGLE_CLIENT_ID = "${googleClientId}"`,
  'GOOGLE_CLIENT_ID',
);
config = replaceExactly(
  config,
  /^SOURCE_COMMIT = ".*"$/m,
  `SOURCE_COMMIT = "${sourceCommit.toLowerCase()}"`,
  'SOURCE_COMMIT',
);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, config, { encoding: 'utf8', mode: 0o600 });
console.log(`Rendered staging Wrangler config: ${outputPath}`);
console.log(`Staging Worker source commit: ${sourceCommit.toLowerCase()}`);
console.log(`Staging D1 database name: ${databaseName}`);

function requireExact(input, needle, label) {
  if (!input.includes(needle)) {
    throw new Error(`Tracked staging template has an invalid ${label}`);
  }
}

function rewriteRelativeConfigPath(input, pattern, label) {
  const matches = [...input.matchAll(new RegExp(pattern.source, 'gm'))];
  if (matches.length !== 1 || !matches[0][1]) {
    throw new Error(`Expected exactly one ${label} path entry, found ${matches.length}`);
  }

  const absoluteTarget = resolve(dirname(sourcePath), matches[0][1]);
  let renderedPath = relative(dirname(outputPath), absoluteTarget).split(sep).join('/');
  if (!renderedPath) renderedPath = '.';

  return input.replace(pattern, `${label} = "${renderedPath}"`);
}

function replaceExactly(input, pattern, replacement, label) {
  const matches = input.match(new RegExp(pattern.source, 'gm')) || [];
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${label} entry, found ${matches.length}`);
  }
  return input.replace(pattern, replacement);
}
