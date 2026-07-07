// Central config, read once from the environment.
// In production these come from the ECS task definition (plain values) and
// Secrets Manager (DB creds injected as env). Locally, from a .env you export.

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3000'), 10),

  // Postgres. DATABASE_URL wins; otherwise assembled from the Secrets Manager fields.
  databaseUrl:
    process.env.DATABASE_URL ??
    (process.env.DB_HOST
      ? `postgres://${required('DB_USER')}:${encodeURIComponent(required('DB_PASSWORD'))}@${required('DB_HOST')}:${optional('DB_PORT', '5432')}/${required('DB_NAME')}`
      : ''),

  // Cognito — used to verify incoming JWTs.
  cognito: {
    region: optional('AWS_REGION', 'eu-west-2'),
    userPoolId: optional('COGNITO_USER_POOL_ID', ''),
    clientId: optional('COGNITO_APP_CLIENT_ID', ''),
  },

  // CORS: the frontend origin allowed to call this API.
  corsOrigin: optional('CORS_ORIGIN', 'http://localhost:5173'),
} as const;

export function assertRuntimeConfig(): void {
  if (!config.databaseUrl) console.warn('[config] No database configured — DB routes will fail until DATABASE_URL / DB_* is set.');
  if (!config.cognito.userPoolId || !config.cognito.clientId) {
    // Non-fatal in dev, but auth will reject every request until set.
    console.warn('[config] Cognito not configured — protected routes will 401.');
  }
}
