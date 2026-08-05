import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMMIT_RE = /^[0-9a-f]{7,40}$/i;

const sourcePath = resolve(process.env.WRANGLER_TEMPLATE || "wrangler.toml");
const outputPath = resolve(process.env.WRANGLER_OUTPUT || ".wrangler/deploy.toml");
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
  throw new Error("SOURCE_COMMIT or GITHUB_SHA must be a 7-40 character Git commit SHA");
}

let config = await readFile(sourcePath, "utf8");
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

function replaceExactly(input, pattern, replacement, label) {
  const matches = input.match(new RegExp(pattern.source, "gm")) || [];
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${label} entry, found ${matches.length}`);
  }
  return input.replace(pattern, replacement);
}
