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

  // File storage (replaces Base44 UploadFile). Uploads go to this S3 bucket via
  // presigned PUT; files are read back through /api/files/raw/<key>. publicBaseUrl
  // is the app's own origin so stored file_urls are absolute + same-origin.
  storage: {
    uploadsBucket: optional('UPLOADS_BUCKET', ''),
    publicBaseUrl: optional('PUBLIC_BASE_URL', ''),
  },

  // AI (replaces Base44 InvokeLLM / ExtractDataFromUploadedFile) via the Anthropic
  // API. The key comes from ANTHROPIC_API_KEY, or is read at runtime from Secrets
  // Manager (secretId) using the task role.
  ai: {
    region: optional('AWS_REGION', 'eu-west-2'),
    model: optional('AI_MODEL', 'claude-sonnet-4-6'),
    maxTokens: parseInt(optional('AI_MAX_TOKENS', '4096'), 10),
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    secretId: optional('ANTHROPIC_SECRET_ID', 'starshipos-dev/anthropic-api-key'),
  },

  // Email (replaces Base44 SendEmail) via Amazon SES. `from` must be an SES-verified
  // identity; in the SES sandbox recipients must be verified too until production
  // access is granted.
  email: {
    region: optional('SES_REGION', optional('AWS_REGION', 'eu-west-2')),
    from: optional('EMAIL_FROM', 'noreply@starshipgroup.co.uk'),
  },

  // Xero accounting integration. Client id/secret come from Secrets Manager
  // (XERO_SECRET_ID, a JSON {client_id, client_secret}) or the plain env vars.
  // redirectUri is where Xero returns the user after login — it must be registered
  // in the Xero app and defaults to <PUBLIC_BASE_URL>/api/xero/callback.
  // writeEnabled is the SAFETY GUARD: while false (the default), sync functions that
  // would POST/PUT into Xero run in dry-run and never touch the live organisation.
  xero: {
    region: optional('AWS_REGION', 'eu-west-2'),
    secretId: optional('XERO_SECRET_ID', 'starshipos-dev/xero-oauth'),
    clientId: process.env.XERO_CLIENT_ID || '',
    clientSecret: process.env.XERO_CLIENT_SECRET || '',
    redirectUri: process.env.XERO_REDIRECT_URI || ((process.env.PUBLIC_BASE_URL || '') + '/api/xero/callback'),
    writeEnabled: (process.env.XERO_WRITE_ENABLED || 'false').toLowerCase() === 'true',
    scopes: optional('XERO_SCOPES', 'offline_access accounting.contacts accounting.transactions accounting.settings'),
  },
} as const;

export function assertRuntimeConfig(): void {
  if (!config.databaseUrl) console.warn('[config] No database configured — DB routes will fail until DATABASE_URL / DB_* is set.');
  if (!config.cognito.userPoolId || !config.cognito.clientId) {
    // Non-fatal in dev, but auth will reject every request until set.
    console.warn('[config] Cognito not configured — protected routes will 401.');
  }
}
