import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config, assertRuntimeConfig } from './config.js';
import { healthRoutes } from './routes/health.js';
import { entityRoutes } from './routes/entities.js';
import { fileRoutes } from './routes/files.js';

export function buildServer() {
  const app = Fastify({
    logger: {
      level: config.env === 'production' ? 'info' : 'debug',
    },
  });

  app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  });

  app.register(healthRoutes);
  app.register(entityRoutes);
  app.register(fileRoutes);

  return app;
}

async function main() {
  assertRuntimeConfig();
  const app = buildServer();
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(`StarshipOS API listening on :${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Only run when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
