import pg from 'pg';
import { config } from './config.js';

// NUMERIC/BIGINT come back as strings by default; parse to numbers so the app's
// sums don't concatenate into billions (matches how Base44 behaved). Ids are text.
pg.types.setTypeParser(1700, (v) => (v == null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v == null ? null : parseInt(v, 10)));

// Single shared pool. RDS in prod, local Postgres in dev.
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: config.env === 'production' ? { rejectUnauthorized: false } : undefined,
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as never[]);
}

export async function healthcheck(): Promise<boolean> {
  try {
    const r = await pool.query('SELECT 1 AS ok');
    return r.rows[0]?.ok === 1;
  } catch {
    return false;
  }
}
