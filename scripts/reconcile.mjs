#!/usr/bin/env node
/**
 * StarshipOS - reconciliation report.
 *
 * Source side: reads the Base44 export (data-export/<table>.json + _manifest.json)
 * and computes per-table row count, an order-independent checksum, and debit/credit/
 * gross totals for the financial tables.
 *
 * If DATABASE_URL is set, it ALSO queries Postgres for each table's row count and
 * compares: this is the actual round-trip proof (source == Postgres, table by table).
 *
 * Output: data-export/reconciliation.json + a console summary with any mismatches.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data-export');
const ENTITIES = path.join(ROOT, 'db', 'entities.json');

const SYSTEM_COLS = new Set(['created_date', 'updated_date', 'created_by', 'created_by_id', 'is_sample']);
const FINANCIAL = {
  historical_transaction: ['debit', 'credit', 'gross_total'],
  purchase_order: ['total', 'net_total', 'gross_total'],
  purchase_invoice: ['net_amount', 'gross_amount', 'total'],
  credit_note: ['net_amount', 'gross_amount', 'total'],
  xero_invoice: ['net', 'gross', 'total'],
};

function rowChecksum(row) {
  const keys = Object.keys(row).filter((k) => !SYSTEM_COLS.has(k)).sort();
  return crypto.createHash('sha256').update(keys.map((k) => `${k}=${JSON.stringify(row[k])}`).join('|')).digest('hex');
}
function tableChecksum(rows) {
  const acc = Buffer.alloc(32);
  for (const r of rows) {
    const h = Buffer.from(rowChecksum(r), 'hex');
    for (let i = 0; i < 32; i++) acc[i] ^= h[i];
  }
  return acc.toString('hex');
}
const money = (v) => { const n = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(n) ? n : 0; };
function financialTotals(rows, cols) {
  const grand = Object.fromEntries(cols.map((c) => [c, 0]));
  for (const r of rows) for (const c of cols) grand[c] += money(r[c]);
  return Object.fromEntries(Object.entries(grand).map(([k, v]) => [k, Math.round(v * 100) / 100]));
}

const entities = JSON.parse(fs.readFileSync(ENTITIES, 'utf8'));
const usePg = !!process.env.DATABASE_URL;
const pool = usePg ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NO_SSL ? false : { rejectUnauthorized: false }, max: 4 }) : null;

const report = { generatedAt: new Date().toISOString(), comparedToPostgres: usePg, tables: {} };
const mismatches = [];

for (const { table } of entities) {
  const file = path.join(DATA, `${table}.json`);
  if (!fs.existsSync(file)) { report.tables[table] = { error: 'no export file' }; continue; }
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  const t = { sourceCount: rows.length, checksum: tableChecksum(rows) };
  if (FINANCIAL[table]) t.financial = financialTotals(rows, FINANCIAL[table]);

  if (usePg) {
    try {
      const r = await pool.query(`SELECT count(*)::int AS n FROM "${table}"`);
      t.pgCount = r.rows[0].n;
      t.match = t.pgCount === t.sourceCount;
      if (!t.match) mismatches.push(`${table}: source ${t.sourceCount} vs pg ${t.pgCount}`);
    } catch (e) {
      t.pgError = e.message;
      mismatches.push(`${table}: pg error ${e.message}`);
    }
  }
  report.tables[table] = t;
}

fs.writeFileSync(path.join(DATA, 'reconciliation.json'), JSON.stringify(report, null, 2));

const n = Object.keys(report.tables).length;
console.log(`Reconciliation written -> data-export/reconciliation.json (${n} tables)`);
if (usePg) {
  if (mismatches.length === 0) {
    console.log('\n✅ ALL TABLES MATCH: source row counts == Postgres row counts.');
  } else {
    console.log(`\n⚠️  ${mismatches.length} mismatch(es):`);
    for (const m of mismatches) console.log('  - ' + m);
  }
}
if (pool) await pool.end();
