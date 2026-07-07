import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'node:crypto';
import { query } from '../db.js';
import { authenticate, type AuthUser } from '../auth.js';
import { scopeFor, canWrite } from '../policy.js';

/**
 * Generic entity CRUD, mirroring the shape the frontend used against Base44.
 *   GET    /api/:table        list (paginated, sortable), row-filtered per policy
 *   GET    /api/:table/:id    single record
 *   POST   /api/:table        create (authorised by canWrite)
 *   PATCH  /api/:table/:id    update a record you can see
 *   DELETE /api/:table/:id    delete a record you can see
 *
 * Allowed tables and their columns come from information_schema (cached).
 */

let schema: Map<string, Set<string>> | null = null;
async function loadSchema(): Promise<Map<string, Set<string>>> {
  if (schema) return schema;
  const r = await query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`,
  );
  const m = new Map<string, Set<string>>();
  for (const row of r.rows) {
    if (!m.has(row.table_name)) m.set(row.table_name, new Set());
    m.get(row.table_name)!.add(row.column_name);
  }
  schema = m;
  return m;
}

// System columns the API manages; never taken from the request body.
const SYSTEM_COLS = new Set(['id', 'created_date', 'updated_date', 'created_by', 'created_by_id']);

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.string().regex(/^-?[a-z_][a-z0-9_]*$/i).default('-created_date'),
});

function orderBy(sort: string, cols: Set<string>): string {
  const desc = sort.startsWith('-');
  const col = desc ? sort.slice(1) : sort;
  if (!cols.has(col)) return 'ORDER BY "created_date" DESC';
  return `ORDER BY "${col}" ${desc ? 'DESC' : 'ASC'}`;
}

function newId(): string {
  return crypto.randomBytes(12).toString('hex'); // 24-char, Base44-style
}

// Build column/value lists from a body, keeping only real, non-system columns.
function pickColumns(body: Record<string, unknown>, cols: Set<string>): { keys: string[]; values: unknown[] } {
  const keys: string[] = [];
  const values: unknown[] = [];
  for (const k of Object.keys(body)) {
    if (!cols.has(k) || SYSTEM_COLS.has(k)) continue;
    keys.push(k);
    const v = body[k];
    values.push(v !== null && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return { keys, values };
}

export async function entityRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  // --- list ---
  app.get('/api/:table', async (req, reply) => {
    const { table } = req.params as { table: string };
    const tables = await loadSchema();
    const cols = tables.get(table);
    if (!cols) return reply.code(404).send({ error: 'unknown_table' });

    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_query', detail: parsed.error.flatten() });
    const { limit, offset, sort } = parsed.data;

    const scope = scopeFor(table, req.user!, cols);
    const n = scope.params.length;
    const rows = await query(
      `SELECT * FROM "${table}" ${scope.sql} ${orderBy(sort, cols)} LIMIT $${n + 1} OFFSET $${n + 2}`,
      [...scope.params, limit, offset],
    );
    return reply.send({ data: rows.rows, limit, offset, count: rows.rowCount });
  });

  // --- get one ---
  app.get('/api/:table/:id', async (req, reply) => {
    const { table, id } = req.params as { table: string; id: string };
    const tables = await loadSchema();
    const cols = tables.get(table);
    if (!cols) return reply.code(404).send({ error: 'unknown_table' });

    const scope = scopeFor(table, req.user!, cols);
    const n = scope.params.length;
    const joiner = scope.sql ? `${scope.sql} AND` : 'WHERE';
    const rows = await query(
      `SELECT * FROM "${table}" ${joiner} "id" = $${n + 1} LIMIT 1`,
      [...scope.params, id],
    );
    if (rows.rowCount === 0) return reply.code(404).send({ error: 'not_found' });
    return reply.send({ data: rows.rows[0] });
  });

  // --- create ---
  app.post('/api/:table', async (req, reply) => {
    const { table } = req.params as { table: string };
    const tables = await loadSchema();
    const cols = tables.get(table);
    if (!cols) return reply.code(404).send({ error: 'unknown_table' });
    const user = req.user! as AuthUser;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const id = newId();
    if (!canWrite(table, user, { ...body, id }, cols)) {
      return reply.code(403).send({ error: 'not_authorised_to_create' });
    }

    const { keys, values } = pickColumns(body, cols);
    const now = new Date().toISOString();
    const sysKeys = ['id', 'created_date', 'updated_date', 'created_by', 'created_by_id'].filter((k) => cols.has(k));
    const sysVals: Record<string, unknown> = { id, created_date: now, updated_date: now, created_by: user.email, created_by_id: user.sub };
    const allKeys = [...keys, ...sysKeys];
    const allVals = [...values, ...sysKeys.map((k) => sysVals[k])];
    const placeholders = allKeys.map((_, i) => `$${i + 1}`).join(', ');
    const collist = allKeys.map((k) => `"${k}"`).join(', ');
    const r = await query(`INSERT INTO "${table}" (${collist}) VALUES (${placeholders}) RETURNING *`, allVals);
    return reply.code(201).send({ data: r.rows[0] });
  });

  // --- update ---
  app.patch('/api/:table/:id', async (req, reply) => {
    const { table, id } = req.params as { table: string; id: string };
    const tables = await loadSchema();
    const cols = tables.get(table);
    if (!cols) return reply.code(404).send({ error: 'unknown_table' });

    // Must be able to see the row to update it.
    const scope = scopeFor(table, req.user!, cols);
    const sn = scope.params.length;
    const joiner = scope.sql ? `${scope.sql} AND` : 'WHERE';
    const seen = await query(`SELECT 1 FROM "${table}" ${joiner} "id" = $${sn + 1} LIMIT 1`, [...scope.params, id]);
    if (seen.rowCount === 0) return reply.code(404).send({ error: 'not_found' });

    const body = (req.body ?? {}) as Record<string, unknown>;
    const { keys, values } = pickColumns(body, cols);
    if (cols.has('updated_date')) { keys.push('updated_date'); values.push(new Date().toISOString()); }
    if (keys.length === 0) return reply.code(400).send({ error: 'nothing_to_update' });
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const r = await query(
      `UPDATE "${table}" SET ${setClause} WHERE "id" = $${keys.length + 1} RETURNING *`,
      [...values, id],
    );
    return reply.send({ data: r.rows[0] });
  });

  // --- delete ---
  app.delete('/api/:table/:id', async (req, reply) => {
    const { table, id } = req.params as { table: string; id: string };
    const tables = await loadSchema();
    const cols = tables.get(table);
    if (!cols) return reply.code(404).send({ error: 'unknown_table' });

    const scope = scopeFor(table, req.user!, cols);
    const n = scope.params.length;
    const joiner = scope.sql ? `${scope.sql} AND` : 'WHERE';
    const r = await query(`DELETE FROM "${table}" ${joiner} "id" = $${n + 1}`, [...scope.params, id]);
    if (r.rowCount === 0) return reply.code(404).send({ error: 'not_found' });
    return reply.code(204).send();
  });
}
