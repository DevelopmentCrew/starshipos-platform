import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db.js';
import { authenticate } from '../auth.js';
import { scopeFor } from '../policy.js';

/**
 * Generic entity read endpoints, mirroring the list/get shape the frontend used
 * against Base44:
 *   GET /api/:table         list (paginated, sortable), row-filtered per policy
 *   GET /api/:table/:id     single record, subject to the same policy
 *
 * The set of allowed tables and their columns is discovered from the database
 * (information_schema) and cached. Row-level authorization is delegated to
 * ./policy.ts, keyed off the authenticated user's profile.
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

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.string().regex(/^-?[a-z_][a-z0-9_]*$/i).default('-created_date'),
});

function orderBy(sort: string, cols: Set<string>): string {
  const desc = sort.startsWith('-');
  const col = desc ? sort.slice(1) : sort;
  if (!cols.has(col)) return 'ORDER BY "created_date" DESC'; // ignore unknown sort columns
  return `ORDER BY "${col}" ${desc ? 'DESC' : 'ASC'}`;
}

export async function entityRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

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
}
