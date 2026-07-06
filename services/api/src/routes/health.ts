import type { FastifyInstance } from 'fastify';
import { healthcheck } from '../db.js';

// ALB target-group health check hits /health. Keep it cheap and unauthenticated.
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_req, reply) => {
    return reply.send({ status: 'ok' });
  });

  // Deeper check including the database, for dashboards / manual checks.
  app.get('/health/ready', async (_req, reply) => {
    const db = await healthcheck();
    return reply.code(db ? 200 : 503).send({ status: db ? 'ready' : 'degraded', db });
  });
}
