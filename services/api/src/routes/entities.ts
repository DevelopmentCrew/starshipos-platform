import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db.js';
import { authenticate, type AuthUser } from '../auth.js';

/**
 * Generic entity read endpoints, mirroring the list/get shape the frontend
 * used against Base44, so the API client swaps in with minimal churn.
 *
 *   GET /api/:table            list (paginated, sortable)
 *   GET /api/:table/:id        single record
 *
 * IMPORTANT — this is a scaffold. Two things are deliberately still to come and
 * are tracked in the migration plan (Phase 2, permissions):
 *   1. Table allow-listing: :table is validated against a generated registry of
 *      the 149 known tables (below is a placeholder set), never interpolated raw.
 *   2. Authorization: the WHERE clause is narrowed per user (role, accessible
 *      developments, module access, customer org) — the proper RLS we're fixing
 *      in this migration. `scopeFilter` is where that lands.
 */

// Placeholder — replaced by a generated registry from db/entities.json.
const TABLES = new Set<string>([
  'development',
  'employee',
  'purchase_order',
  'purchase_invoice',
  'supplier',
  'historical_transaction',
  'incident_report',
  'gsd_log',
  'training_record',
]);

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.string().regex(/^-?[a-z_][a-z0-9_]*$/i).default('-created_date'),
});

// Where the real row-level authorization will be built. For now: admins see
// all; everyone else is denied until per-table scoping is implemented, so we
// never accidentally over-share during the scaffold phase.
function scopeFilter(_table: string, user: AuthUser): { sql: string; params: unknown[] } {
  if (user.role === 'admin') return { sql: '', params: [] };
  return { sql: 'WHERE false', params: [] }; // deny-by-default until Phase 2
}

function orderBy(sort: string): string {
  const desc = sort.startsWith('-');
  const col = desc ? sort.slice(1) : sort;
  // col already validated by the schema regex; quote to be safe.
  return `ORDER BY "${col}" ${desc ? 'DESC' : 'ASC'}`;
}

export async function entityRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/api/:table', async (req, reply) => {
    const { table } = req.params as { table: string };
    if (!TABLES.has(table)) return reply.code(404).send({ error: 'unknown_table' });

    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_query', detail: parsed.error.flatten() });
    const { limit, offset, sort } = parsed.data;

    const scope = scopeFilter(table, req.user!);
    const rows = await query(
      `SELECT * FROM "${table}" ${scope.sql} ${orderBy(sort)} LIMIT $${scope.params.length + 1} OFFSET $${scope.params.length + 2}`,
      [...scope.params, limit, offset],
    );
    return reply.send({ data: rows.rows, limit, offset, count: rows.rowCount });
  });

  app.get('/api/:table/:id', async (req, reply) => {
    const { table, id } = req.params as { table: string; id: string };
    if (!TABLES.has(table)) return reply.code(404).send({ error: 'unknown_table' });

    const scope = scopeFilter(table, req.user!);
    const joiner = scope.sql ? `${scope.sql} AND` : 'WHERE';
    const rows = await query(
      `SELECT * FROM "${table}" ${joiner} id = $${scope.params.length + 1} LIMIT 1`,
      [...scope.params, id],
    );
    if (rows.rowCount === 0) return reply.code(404).send({ error: 'not_found' });
    return reply.send({ data: rows.rows[0] });
  });
}
