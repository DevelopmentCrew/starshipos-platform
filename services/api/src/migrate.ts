import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './db.js';
import { config } from './config.js';

/**
 * Migrate-on-boot. Runs any *.sql files in ../migrations (bundled into the image)
 * that haven't been applied yet, in filename order, each in its own transaction,
 * and records them in schema_migrations. The DDL is idempotent (CREATE TABLE IF
 * NOT EXISTS / ADD COLUMN IF NOT EXISTS) so re-running is always safe. Failures
 * are logged but don't stop the API booting — a bad migration must never take the
 * live service down.
 */
export async function runMigrations(): Promise<void> {
  if (!config.databaseUrl) {
    console.warn('[migrate] no database configured, skipping migrations');
    return;
  }
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations');
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  } catch {
    console.warn(`[migrate] no migrations dir at ${dir}, skipping`);
    return;
  }
  if (files.length === 0) return;

  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz DEFAULT now())`,
  );
  const done = new Set(
    (await pool.query<{ filename: string }>('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename),
  );

  for (const f of files) {
    if (done.has(f)) continue;
    const sql = readFileSync(path.join(dir, f), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
      await client.query('COMMIT');
      console.log(`[migrate] applied ${f}`);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`[migrate] FAILED ${f} (rolled back):`, err);
    } finally {
      client.release();
    }
  }
}
