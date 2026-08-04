#!/usr/bin/env node
/**
 * StarshipOS - import the Base44 export into Postgres.
 *
 * Reads <platform>/data-export/<table>.json (from export-base44.mjs) and inserts
 * each row into the matching table. Idempotent: ON CONFLICT (id) DO NOTHING, so it
 * can be re-run safely (e.g. after a partial load or a delta).
 *
 * Generic + schema-driven: for each table it reads the real column list from
 * information_schema, and inserts only the keys that map to real columns. jsonb
 * columns get JSON-stringified; empty strings destined for non-text columns become
 * NULL (Base44 uses "" where Postgres wants a typed null).
 *
 * Env: DATABASE_URL (postgres://user:pass@host:5432/db). SSL on by default (RDS
 * forces it); set NO_SSL=1 for a local non-SSL Postgres.
 *
 * Output: <platform>/data-export/_import-manifest.json = [{ table, inserted, skipped, errors }]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data-export');
const ENTITIES = path.join(ROOT, 'db', 'entities.json');

if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL (postgres://user:pass@host:5432/db)');
  process.exit(1);
}

// 'insert' (first load, ON CONFLICT DO NOTHING), 'upsert' (refresh, updates changed
// rows), or 'replace' (mirror: TRUNCATE each table then reload — makes Postgres an
// exact copy of Base44, so any records created only in the AWS test app are removed).
const MODE = (process.env.IMPORT_MODE || 'insert').toLowerCase();
console.log(`Import mode: ${MODE}`);

// SAFETY (replace mode): never TRUNCATE a table whose Base44 export failed — that would
// wipe good data with nothing to reload. Skip any table the export manifest marks failed.
let failedExports = new Set();
if (MODE === 'replace') {
  try {
    const man = JSON.parse(fs.readFileSync(path.join(DATA, '_manifest.json'), 'utf8'));
    failedExports = new Set(man.filter((m) => m.error || typeof m.count !== 'number').map((m) => m.table));
    if (failedExports.size) console.log(`replace mode: ${failedExports.size} table(s) had export errors — those will be preserved, not truncated.`);
  } catch { /* no manifest — the per-table existence check still guards */ }
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NO_SSL ? false : { rejectUnauthorized: false },
  max: 4,
});

const TEXT_TYPES = new Set(['text', 'character varying', 'character', 'uuid']);
const DATE_TYPES = new Set(['date', 'timestamp with time zone', 'timestamp without time zone']);

function coerce(value, dataType) {
  if (value === undefined || value === null) return null;
  if (dataType === 'jsonb' || dataType === 'json') {
    // Objects/arrays -> JSON. Strings: pass through if already valid JSON,
    // otherwise JSON-encode so a bare string becomes a valid JSON value.
    if (typeof value === 'string') {
      try { JSON.parse(value); return value; } catch { return JSON.stringify(value); }
    }
    return JSON.stringify(value);
  }
  // Date/timestamp columns: Base44 free-text fields sometimes hold junk like
  // "Not found" / "ASAP". If it isn't a parseable date, store NULL.
  if (DATE_TYPES.has(dataType)) {
    if (value === '' || value === 'null') return null;
    if (typeof value === 'string' && Number.isNaN(Date.parse(value))) return null;
    return value;
  }
  // Base44 sometimes stores "" or the literal "null" where a typed column wants NULL.
  if ((value === '' || value === 'null') && !TEXT_TYPES.has(dataType)) return null;
  // Objects/arrays landing in a non-json column: stringify so we don't crash.
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

async function columnsFor(table) {
  const r = await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1`,
    [table],
  );
  const m = new Map();
  for (const row of r.rows) m.set(row.column_name, row.data_type);
  return m;
}

async function importTable(entity, table) {
  const file = path.join(DATA, `${table}.json`);
  if (!fs.existsSync(file)) return { table, skipped: 'no export file' };

  const cols = await columnsFor(table);
  if (cols.size === 0) return { table, skipped: 'table not in schema' };

  // replace mode: skip tables whose export failed (don't wipe good data with nothing to load).
  if (MODE === 'replace' && failedExports.has(table)) {
    console.log(`${table.padEnd(34)} SKIP (export failed — existing rows preserved)`);
    return { table, skipped: 'export failed, preserved' };
  }

  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  let inserted = 0;
  let updated = 0;
  let conflicted = 0;
  const errors = [];

  const client = await pool.connect();
  try {
    // replace mode: empty the table first so Postgres ends up an exact copy of Base44.
    if (MODE === 'replace') await client.query(`TRUNCATE TABLE "${table}"`);
    for (const row of rows) {
      const keys = Object.keys(row).filter((k) => cols.has(k));
      if (!keys.includes('id')) {
        errors.push('row without id');
        continue;
      }
      const values = keys.map((k) => coerce(row[k], cols.get(k)));
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const collist = keys.map((k) => `"${k}"`).join(', ');
      // MODE=upsert (data refresh): update existing rows so Base44 edits flow through.
      // Default (first load): DO NOTHING, so re-runs are cheap and non-destructive.
      const updateCols = keys.filter((k) => k !== 'id');
      const conflictClause = MODE === 'upsert' && updateCols.length
        ? `ON CONFLICT (id) DO UPDATE SET ${updateCols.map((k) => `"${k}" = EXCLUDED."${k}"`).join(', ')}`
        : 'ON CONFLICT (id) DO NOTHING';
      // xmax = 0 on a genuine INSERT; non-zero when the row was UPDATEd via the conflict.
      const sql = `INSERT INTO "${table}" (${collist}) VALUES (${placeholders}) ${conflictClause} RETURNING (xmax = 0) AS _inserted`;
      try {
        const res = await client.query(sql, values);
        if (res.rowCount === 1) {
          if (res.rows[0]?._inserted) inserted++;
          else updated++;
        } else conflicted++;
      } catch (e) {
        if (errors.length < 5) errors.push(e.message);
      }
    }
  } finally {
    client.release();
  }

  const line = `${table.padEnd(34)} +${inserted}${updated ? ` ~${updated}` : ''}${conflicted ? ` (${conflicted} unchanged)` : ''}${errors.length ? `  ERRORS: ${errors.length}` : ''}`;
  console.log(line);
  return { table, inserted, updated, conflicted, errors: errors.slice(0, 5), sourceRows: rows.length };
}

const entities = JSON.parse(fs.readFileSync(ENTITIES, 'utf8'));
const report = [];
for (const { entity, table } of entities) {
  try {
    report.push(await importTable(entity, table));
  } catch (e) {
    report.push({ table, error: e.message });
    console.error(`${table} FAILED: ${e.message}`);
  }
}

fs.writeFileSync(path.join(DATA, '_import-manifest.json'), JSON.stringify(report, null, 2));
const totalInserted = report.reduce((n, r) => n + (r.inserted || 0), 0);
const totalUpdated = report.reduce((n, r) => n + (r.updated || 0), 0);
const withErrors = report.filter((r) => (r.errors && r.errors.length) || r.error).length;
console.log(`\nImport complete (${MODE}). ${totalInserted} inserted${MODE === 'upsert' ? `, ${totalUpdated} updated` : ''} across ${report.length} tables${withErrors ? `, ${withErrors} tables had errors` : ''}.`);
await pool.end();
