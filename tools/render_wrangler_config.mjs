import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMMIT_RE = /^[0-9a-f]{40}$/i;
const GOOGLE_CLIENT_ID_RE = /^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i;
const EXPECTED_SERVICE = "journal-backend";
const EXPECTED_DEPLOYMENT_ENVIRONMENT = "production";

const sourcePath = resolve(process.env.WRANGLER_TEMPLATE || "wrangler.toml");
const outputPath = resolve(process.env.WRANGLER_OUTPUT || ".wrangler/deploy.toml");
const contractPath = resolve("config/deployment-environments.json");
const databaseId = String(process.env.CLOUDFLARE_D1_DATABASE_ID || "").trim();
const databaseName = String(process.env.CLOUDFLARE_D1_DATABASE_NAME || "").trim();
const sourceCommit = String(process.env.SOURCE_COMMIT || process.env.GITHUB_SHA || "").trim();

if (!UUID_RE.test(databaseId) || databaseId === ZERO_UUID) {
  throw new Error("CLOUDFLARE_D1_DATABASE_ID must be a non-sentinel D1 UUID");
}
if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(databaseName)) {
  throw new Error("CLOUDFLARE_D1_DATABASE_NAME is missing or invalid");
}
if (!COMMIT_RE.test(sourceCommit)) {
  throw new Error("SOURCE_COMMIT or GITHUB_SHA must be an exact 40-character Git commit SHA");
}

const contract = JSON.parse(await readFile(contractPath, "utf8"));
const production = contract?.production;
if (!production || typeof production !== "object" || Array.isArray(production)) {
  throw new Error("Production deployment environment contract is missing");
}
if (!Array.isArray(production.frontend_origins) || production.frontend_origins.length === 0) {
  throw new Error("production.frontend_origins must be a non-empty array");
}
if (!Array.isArray(production.google_client_ids) || production.google_client_ids.length !== 1) {
  throw new Error("Production Worker requires exactly one reviewed Google OAuth client ID");
}
const expectedAllowedOrigins = production.frontend_origins.join(",");
const expectedGoogleClientId = String(production.google_client_ids[0] || "").trim();
if (!GOOGLE_CLIENT_ID_RE.test(expectedGoogleClientId)) {
  throw new Error("Reviewed production Google OAuth client ID is invalid");
}

let config = await readFile(sourcePath, "utf8");
requireExact(config, `name = "${EXPECTED_SERVICE}"`, "production Worker service");
requireExact(config, 'main = "worker-entry.js"', "production Worker entry point");
requireExact(config, "workers_dev = true", "production workers.dev endpoint");
requireExact(config, "preview_urls = false", "disabled Worker preview URLs");
requireExact(config, "keep_vars = false", "Wrangler source-of-truth variable policy");
requireExact(config, 'required = ["API_SECRET"]', "required production API secret declaration");
requireExact(
  config,
  `DEPLOYMENT_ENVIRONMENT = "${EXPECTED_DEPLOYMENT_ENVIRONMENT}"`,
  "production environment identity",
);
requireExact(
  config,
  `ALLOWED_ORIGINS = "${expectedAllowedOrigins}"`,
  "production frontend origin allowlist",
);
requireExact(
  config,
  `GOOGLE_CLIENT_ID = "${expectedGoogleClientId}"`,
  "production Google OAuth client",
);

config = rewriteRelativeConfigPath(config, /^main = "([^"]+)"$/m, "main");
config = rewriteRelativeConfigPath(
  config,
  /^migrations_dir = "([^"]+)"$/m,
  "migrations_dir",
);
config = replaceExactly(
  config,
  /^database_name = ".*"$/m,
  `database_name = "${databaseName}"`,
  "database_name",
);
config = replaceExactly(
  config,
  /^database_id = ".*"$/m,
  `database_id = "${databaseId}"`,
  "database_id",
);
config = replaceExactly(
  config,
  /^SOURCE_COMMIT = ".*"$/m,
  `SOURCE_COMMIT = "${sourceCommit.toLowerCase()}"`,
  "SOURCE_COMMIT",
);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, config, { encoding: "utf8", mode: 0o600 });
console.log(`Rendered production Wrangler config: ${outputPath}`);
console.log(`Worker source commit: ${sourceCommit.toLowerCase()}`);
console.log(`D1 database name: ${databaseName}`);
console.log(`Production origin count: ${production.frontend_origins.length}`);

function requireExact(input, needle, label) {
  if (!input.includes(needle)) {
    throw new Error(`Tracked production template has an invalid ${label}`);
  }
}

function rewriteRelativeConfigPath(input, pattern, label) {
  const matches = [...input.matchAll(new RegExp(pattern.source, "gm"))];
  if (matches.length !== 1 || !matches[0][1]) {
    throw new Error(`Expected exactly one ${label} path entry, found ${matches.length}`);
  }

  const absoluteTarget = resolve(dirname(sourcePath), matches[0][1]);
  let renderedPath = relative(dirname(outputPath), absoluteTarget).split(sep).join("/");
  if (!renderedPath) renderedPath = ".";

  return input.replace(pattern, `${label} = "${renderedPath}"`);
}

function replaceExactly(input, pattern, replacement, label) {
  const matches = input.match(new RegExp(pattern.source, "gm")) || [];
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${label} entry, found ${matches.length}`);
  }
  return input.replace(pattern, replacement);
}
