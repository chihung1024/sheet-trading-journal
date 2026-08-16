import { readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { readLatestSchemaActivation } from "./schema_activation_metadata.mjs";

const manifest = JSON.parse(await readFile("worker-manifest.json", "utf8"));
const expectedSchemaVersion = Number(manifest.schemaVersion);
const schemaActivation = await readLatestSchemaActivation();
if (!Number.isInteger(expectedSchemaVersion) || expectedSchemaVersion < 0) {
  throw new Error("Worker manifest has invalid schema metadata");
}
if (schemaActivation.schemaVersion !== expectedSchemaVersion) {
  throw new Error(
    `Latest schema activation ${schemaActivation.migration} declares schema ${schemaActivation.schemaVersion}, expected ${expectedSchemaVersion}`,
  );
}

await rm(".wrangler/state", { recursive: true, force: true });
run(["wrangler", "d1", "migrations", "apply", "DB", "--local", "--config", "wrangler.toml"]);
const result = run([
  "wrangler",
  "d1",
  "execute",
  "DB",
  "--local",
  "--config",
  "wrangler.toml",
  "--command",
  "SELECT schema_version, release_version FROM schema_metadata WHERE id = 1;",
  "--json",
], true);

const parsed = JSON.parse(result.stdout);
const row = parsed?.[0]?.results?.[0];
if (
  Number(row?.schema_version) !== expectedSchemaVersion
  || row?.release_version !== schemaActivation.releaseVersion
) {
  throw new Error(`Unexpected schema activation metadata: ${JSON.stringify(row)}`);
}

const tablesResult = run([
  "wrangler",
  "d1",
  "execute",
  "DB",
  "--local",
  "--config",
  "wrangler.toml",
  "--command",
  "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('records','portfolio_snapshots','user_settings','schema_metadata','calculation_jobs') ORDER BY name;",
  "--json",
], true);
const tables = JSON.parse(tablesResult.stdout)?.[0]?.results?.map((item) => item.name) || [];
const expected = ["calculation_jobs", "portfolio_snapshots", "records", "schema_metadata", "user_settings"];
if (JSON.stringify(tables) !== JSON.stringify(expected)) {
  throw new Error(`Unexpected D1 tables: ${JSON.stringify(tables)}`);
}

const recordColumnsResult = run([
  "wrangler", "d1", "execute", "DB", "--local", "--config", "wrangler.toml",
  "--command", "PRAGMA table_info(records);",
  "--json",
], true);
const recordColumns = JSON.parse(recordColumnsResult.stdout)?.[0]?.results || [];
const recordColumnByName = new Map(recordColumns.map((column) => [column.name, column]));
for (const name of ["currency", "executed_at", "execution_sequence", "event_source"]) {
  const column = recordColumnByName.get(name);
  if (!column) {
    throw new Error(`Missing R2.2A records metadata column: ${name}`);
  }
  if (String(column.type || "").toUpperCase() !== "TEXT") {
    throw new Error(`Unexpected ${name} storage type: ${JSON.stringify(column)}`);
  }
  if (Number(column.notnull) !== 0 || column.dflt_value !== null) {
    throw new Error(`R2.2A metadata must stay nullable with no default: ${JSON.stringify(column)}`);
  }
}

const legacyRecordResult = run([
  "wrangler", "d1", "execute", "DB", "--local", "--config", "wrangler.toml",
  "--command", `
    INSERT INTO records (user_id, txn_date, symbol, txn_type, qty, price)
    VALUES ('legacy-r2-2a@example.com', '2026-08-16', 'SPY', 'BUY', 1, 1);
    SELECT currency, executed_at, execution_sequence, event_source
    FROM records
    WHERE user_id = 'legacy-r2-2a@example.com'
    ORDER BY id DESC
    LIMIT 1;
  `,
  "--json",
], true);
const legacyMetadata = JSON.parse(legacyRecordResult.stdout)?.at(-1)?.results?.[0];
if (!legacyMetadata || ["currency", "executed_at", "execution_sequence", "event_source"].some((key) => legacyMetadata[key] !== null)) {
  throw new Error(`Legacy record compatibility failed: ${JSON.stringify(legacyMetadata)}`);
}

const atomicMetadataResult = run([
  "wrangler", "d1", "execute", "DB", "--local", "--config", "wrangler.toml",
  "--command", `
    INSERT INTO records
      (user_id, txn_date, symbol, txn_type, qty, price, fee, tax, tag, note,
       currency, executed_at, execution_sequence, event_source)
    VALUES
      ('atomic-r2-2b@example.com', '2026-08-16', 'NVDA', 'BUY', 1, 100, 0, 0, 'Growth', 'initial',
       'USD', '2026-08-16T09:30:00-04:00', 'order-1:fill-1', 'IBKR');

    INSERT INTO records
      (user_id, txn_date, symbol, txn_type, qty, price, fee, tax, tag, note,
       currency, executed_at, execution_sequence, event_source)
    VALUES
      ('atomic-r2-2b-other@example.com', '2026-08-16', 'NVDA', 'BUY', 1, 100, 0, 0, 'Growth', 'sentinel',
       'USD', '2026-08-16T09:30:00-04:00', 'other-order', 'IMPORT');

    UPDATE records
    SET txn_date='2026-08-16', symbol='NVDA', txn_type='BUY',
        qty=2, price=101, fee=1, tax=0, tag='Growth', note='same identity',
        currency=CASE
          WHEN 0 = 1 THEN NULL
          WHEN txn_date <> '2026-08-16' OR symbol <> 'NVDA' OR txn_type <> 'BUY' THEN NULL
          ELSE currency
        END,
        executed_at=CASE
          WHEN 0 = 1 THEN NULL
          WHEN txn_date <> '2026-08-16' OR symbol <> 'NVDA' OR txn_type <> 'BUY' THEN NULL
          ELSE executed_at
        END,
        execution_sequence=CASE
          WHEN 0 = 1 THEN NULL
          WHEN txn_date <> '2026-08-16' OR symbol <> 'NVDA' OR txn_type <> 'BUY' THEN NULL
          ELSE execution_sequence
        END,
        event_source=CASE
          WHEN 0 = 1 THEN NULL
          WHEN txn_date <> '2026-08-16' OR symbol <> 'NVDA' OR txn_type <> 'BUY' THEN NULL
          ELSE event_source
        END
    WHERE id = (
      SELECT id FROM records
      WHERE user_id = 'atomic-r2-2b@example.com'
      ORDER BY id DESC
      LIMIT 1
    )
      AND user_id = 'atomic-r2-2b@example.com';

    SELECT 'same_identity' AS phase, symbol, currency, executed_at, execution_sequence, event_source
    FROM records
    WHERE user_id = 'atomic-r2-2b@example.com'
    ORDER BY id DESC
    LIMIT 1;

    UPDATE records
    SET txn_date='2026-08-16', symbol='MSFT', txn_type='BUY',
        qty=2, price=101, fee=1, tax=0, tag='Growth', note='identity changed',
        currency=CASE
          WHEN 0 = 1 THEN NULL
          WHEN txn_date <> '2026-08-16' OR symbol <> 'MSFT' OR txn_type <> 'BUY' THEN NULL
          ELSE currency
        END,
        executed_at=CASE
          WHEN 0 = 1 THEN NULL
          WHEN txn_date <> '2026-08-16' OR symbol <> 'MSFT' OR txn_type <> 'BUY' THEN NULL
          ELSE executed_at
        END,
        execution_sequence=CASE
          WHEN 0 = 1 THEN NULL
          WHEN txn_date <> '2026-08-16' OR symbol <> 'MSFT' OR txn_type <> 'BUY' THEN NULL
          ELSE execution_sequence
        END,
        event_source=CASE
          WHEN 0 = 1 THEN NULL
          WHEN txn_date <> '2026-08-16' OR symbol <> 'MSFT' OR txn_type <> 'BUY' THEN NULL
          ELSE event_source
        END
    WHERE id = (
      SELECT id FROM records
      WHERE user_id = 'atomic-r2-2b@example.com'
      ORDER BY id DESC
      LIMIT 1
    )
      AND user_id = 'atomic-r2-2b@example.com';

    SELECT 'identity_changed' AS phase, symbol, currency, executed_at, execution_sequence, event_source
    FROM records
    WHERE user_id = 'atomic-r2-2b@example.com'
    ORDER BY id DESC
    LIMIT 1;

    SELECT 'other_tenant' AS phase, symbol, currency, executed_at, execution_sequence, event_source
    FROM records
    WHERE user_id = 'atomic-r2-2b-other@example.com'
    ORDER BY id DESC
    LIMIT 1;
  `,
  "--json",
], true);
const atomicRows = JSON.parse(atomicMetadataResult.stdout)
  .flatMap((statement) => (Array.isArray(statement?.results) ? statement.results : []))
  .filter((item) => item?.phase);
const sameIdentity = atomicRows.find((item) => item.phase === "same_identity");
const identityChanged = atomicRows.find((item) => item.phase === "identity_changed");
const otherTenant = atomicRows.find((item) => item.phase === "other_tenant");

if (
  !sameIdentity
  || sameIdentity.symbol !== "NVDA"
  || sameIdentity.currency !== "USD"
  || sameIdentity.executed_at !== "2026-08-16T09:30:00-04:00"
  || sameIdentity.execution_sequence !== "order-1:fill-1"
  || sameIdentity.event_source !== "IBKR"
) {
  throw new Error(`Same-identity metadata preservation failed: ${JSON.stringify(sameIdentity)}`);
}
if (
  !identityChanged
  || identityChanged.symbol !== "MSFT"
  || ["currency", "executed_at", "execution_sequence", "event_source"].some((key) => identityChanged[key] !== null)
) {
  throw new Error(`Identity-change metadata clearing failed: ${JSON.stringify(identityChanged)}`);
}
if (
  !otherTenant
  || otherTenant.symbol !== "NVDA"
  || otherTenant.currency !== "USD"
  || otherTenant.executed_at !== "2026-08-16T09:30:00-04:00"
  || otherTenant.execution_sequence !== "other-order"
  || otherTenant.event_source !== "IMPORT"
) {
  throw new Error(`Tenant-scoped atomic update isolation failed: ${JSON.stringify(otherTenant)}`);
}

const workerSource = await readFile("worker.js", "utf8");
const enrichmentSqlMatch = workerSource.match(
  /async enrichMetadata\(db, userId, body\)[\s\S]*?const update = await db\.prepare\(`([\s\S]*?)`\)\.bind\(/,
);
if (!enrichmentSqlMatch?.[1]) {
  throw new Error("Unable to locate production record metadata enrichment SQL");
}
const enrichmentSql = enrichmentSqlMatch[1];
const enrichmentBindValues = ({
  id = 900001,
  userId = "enrich-r2-2c@example.com",
  txnDate = "2026-08-16",
  symbol = "NVDA",
  txnType = "BUY",
  qty = 15,
  price = 103.33333333333333,
  fee = 1.5,
  tax = 0.1,
  currency = "USD",
  executedAt = null,
  executionSequence = "IBKR-ORDER:487287953",
  eventSource = "IBKR",
} = {}) => [
  currency,
  executedAt,
  executionSequence,
  eventSource,
  id,
  userId,
  txnDate,
  symbol,
  txnType,
  qty,
  price,
  fee,
  tax,
  currency,
  currency,
  executedAt,
  executedAt,
  executionSequence,
  executionSequence,
  eventSource,
  eventSource,
  currency,
  executedAt,
  executionSequence,
  eventSource,
];

const enrichmentResult = run([
  "wrangler", "d1", "execute", "DB", "--local", "--config", "wrangler.toml",
  "--command", `
    INSERT INTO records
      (id, user_id, txn_date, symbol, txn_type, qty, price, fee, tax, tag, note,
       currency, executed_at, execution_sequence, event_source)
    VALUES
      (900001, 'enrich-r2-2c@example.com', '2026-08-16', 'NVDA', 'BUY', 15, 103.33333333333333, 1.5, 0.1,
       'Growth', 'keep user journal', NULL, NULL, NULL, NULL);

    INSERT INTO records
      (id, user_id, txn_date, symbol, txn_type, qty, price, fee, tax, tag, note,
       currency, executed_at, execution_sequence, event_source)
    VALUES
      (900002, 'enrich-r2-2c-other@example.com', '2026-08-16', 'NVDA', 'BUY', 15, 103.33333333333333, 1.5, 0.1,
       'Other', 'tenant sentinel', 'EUR', NULL, 'OTHER-SEQUENCE', 'IMPORT');

    ${bindSql(enrichmentSql, enrichmentBindValues())};
    SELECT 'updated' AS phase, changes() AS mutation_changes, qty, price, tag, note,
           currency, executed_at, execution_sequence, event_source
    FROM records WHERE id = 900001 AND user_id = 'enrich-r2-2c@example.com';

    ${bindSql(enrichmentSql, enrichmentBindValues())};
    SELECT 'replay' AS phase, changes() AS mutation_changes, currency, execution_sequence, event_source
    FROM records WHERE id = 900001 AND user_id = 'enrich-r2-2c@example.com';

    ${bindSql(enrichmentSql, enrichmentBindValues({ executionSequence: "IBKR-ORDER:DIFFERENT" }))};
    SELECT 'metadata_conflict' AS phase, changes() AS mutation_changes, execution_sequence
    FROM records WHERE id = 900001 AND user_id = 'enrich-r2-2c@example.com';

    ${bindSql(enrichmentSql, enrichmentBindValues({ qty: 99, executedAt: "2026-08-16T10:00:00+08:00" }))};
    SELECT 'economic_conflict' AS phase, changes() AS mutation_changes, qty, executed_at
    FROM records WHERE id = 900001 AND user_id = 'enrich-r2-2c@example.com';

    ${bindSql(enrichmentSql, enrichmentBindValues({ userId: "enrich-r2-2c-other@example.com", currency: "JPY" }))};
    SELECT 'tenant_isolation' AS phase, changes() AS mutation_changes, currency, execution_sequence, event_source
    FROM records WHERE id = 900002 AND user_id = 'enrich-r2-2c-other@example.com';
  `,
  "--json",
], true);
const enrichmentRows = JSON.parse(enrichmentResult.stdout)
  .flatMap((statement) => (Array.isArray(statement?.results) ? statement.results : []))
  .filter((item) => item?.phase);
const enriched = enrichmentRows.find((item) => item.phase === "updated");
const replayed = enrichmentRows.find((item) => item.phase === "replay");
const metadataConflict = enrichmentRows.find((item) => item.phase === "metadata_conflict");
const economicConflict = enrichmentRows.find((item) => item.phase === "economic_conflict");
const tenantIsolation = enrichmentRows.find((item) => item.phase === "tenant_isolation");

if (
  !enriched
  || Number(enriched.mutation_changes) !== 1
  || Number(enriched.qty) !== 15
  || Number(enriched.price) !== 103.33333333333333
  || enriched.tag !== "Growth"
  || enriched.note !== "keep user journal"
  || enriched.currency !== "USD"
  || enriched.executed_at !== null
  || enriched.execution_sequence !== "IBKR-ORDER:487287953"
  || enriched.event_source !== "IBKR"
) {
  throw new Error(`Real D1 metadata enrichment failed: ${JSON.stringify(enriched)}`);
}
if (
  !replayed
  || Number(replayed.mutation_changes) !== 0
  || replayed.currency !== "USD"
  || replayed.execution_sequence !== "IBKR-ORDER:487287953"
  || replayed.event_source !== "IBKR"
) {
  throw new Error(`Real D1 metadata enrichment replay failed: ${JSON.stringify(replayed)}`);
}
if (
  !metadataConflict
  || Number(metadataConflict.mutation_changes) !== 0
  || metadataConflict.execution_sequence !== "IBKR-ORDER:487287953"
) {
  throw new Error(`Real D1 metadata conflict protection failed: ${JSON.stringify(metadataConflict)}`);
}
if (
  !economicConflict
  || Number(economicConflict.mutation_changes) !== 0
  || Number(economicConflict.qty) !== 15
  || economicConflict.executed_at !== null
) {
  throw new Error(`Real D1 economic conflict protection failed: ${JSON.stringify(economicConflict)}`);
}
if (
  !tenantIsolation
  || Number(tenantIsolation.mutation_changes) !== 0
  || tenantIsolation.currency !== "EUR"
  || tenantIsolation.execution_sequence !== "OTHER-SEQUENCE"
  || tenantIsolation.event_source !== "IMPORT"
) {
  throw new Error(`Real D1 tenant isolation failed: ${JSON.stringify(tenantIsolation)}`);
}

const indexesResult = run([
  "wrangler", "d1", "execute", "DB", "--local", "--config", "wrangler.toml",
  "--command", "SELECT name FROM sqlite_master WHERE type='index' AND name IN ('idx_calculation_jobs_user_created','idx_calculation_jobs_status_created') ORDER BY name;",
  "--json",
], true);
const indexes = JSON.parse(indexesResult.stdout)?.[0]?.results?.map((item) => item.name) || [];
if (JSON.stringify(indexes) !== JSON.stringify(["idx_calculation_jobs_status_created", "idx_calculation_jobs_user_created"])) {
  throw new Error(`Unexpected calculation job indexes: ${JSON.stringify(indexes)}`);
}

const idempotencyResult = run([
  "wrangler", "d1", "execute", "DB", "--local", "--config", "wrangler.toml",
  "--command", `
    INSERT OR IGNORE INTO calculation_jobs
      (public_id, user_id, idempotency_hash, status, benchmark)
    VALUES
      ('job_ABCDEFGHIJKLMNOPQRSTUV', 'duplicate@example.com', '${"a".repeat(64)}', 'queued', 'SPY');
    INSERT OR IGNORE INTO calculation_jobs
      (public_id, user_id, idempotency_hash, status, benchmark)
    VALUES
      ('job_ZYXWVUTSRQPONMLKJIHGFE', 'duplicate@example.com', '${"a".repeat(64)}', 'queued', 'SPY');
    SELECT COUNT(*) AS total FROM calculation_jobs
    WHERE user_id = 'duplicate@example.com' AND idempotency_hash = '${"a".repeat(64)}';
  `,
  "--json",
], true);
const duplicateCount = Number(JSON.parse(idempotencyResult.stdout)?.at(-1)?.results?.[0]?.total);
if (duplicateCount !== 1) {
  throw new Error(`Calculation job idempotency uniqueness failed: ${duplicateCount}`);
}

console.log(
  "D1 migrations applied; schema activation history, nullable timeline expansion, atomic metadata PUT semantics, and idempotent metadata enrichment verified locally.",
);


function bindSql(sql, values) {
  let index = 0;
  const bound = sql.replace(/\?/g, () => {
    if (index >= values.length) throw new Error("Not enough enrichment SQL bind values");
    return sqlLiteral(values[index++]);
  });
  if (index !== values.length) {
    throw new Error(`Unused enrichment SQL bind values: ${values.length - index}`);
  }
  return bound;
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Cannot bind non-finite SQL number: ${value}`);
    return String(value);
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

function run(args, capture = false) {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: { ...process.env, CI: "true" },
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: npx ${args.join(" ")}\n${result.stderr || ""}`);
  }
  return result;
}
