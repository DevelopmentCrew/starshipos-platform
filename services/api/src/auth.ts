import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { config } from './config.js';
import { query } from './db.js';

// The authenticated user: identity from the JWT, authorization from the DB.
export interface AuthUser {
  sub: string;
  email?: string;
  role: 'admin' | 'user';
  employeeId?: string;
  customerId?: string;
  accessibleDevelopments: string[];
  moduleAccess: Record<string, boolean>;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

const issuer = () =>
  `https://cognito-idp.${config.cognito.region}.amazonaws.com/${config.cognito.userPoolId}`;

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!jwks) jwks = createRemoteJWKSet(new URL(`${issuer()}/.well-known/jwks.json`));
  return jwks;
}

// Load the user's authorization profile from the migrated `user` table, keyed
// by email (the link between Cognito identity and Base44 permissions).
async function loadProfile(email: string): Promise<AuthUser | null> {
  const r = await query<{
    role: string | null;
    employee_id: string | null;
    customer_id: string | null;
    accessible_developments: unknown;
    module_access: unknown;
  }>(
    `SELECT role, employee_id, customer_id, accessible_developments, module_access
       FROM "user" WHERE lower(email) = lower($1) LIMIT 1`,
    [email],
  );
  if (r.rowCount === 0) return null;
  const row = r.rows[0];
  const devs = Array.isArray(row.accessible_developments)
    ? (row.accessible_developments as string[])
    : [];
  const modules =
    row.module_access && typeof row.module_access === 'object'
      ? (row.module_access as Record<string, boolean>)
      : {};
  return {
    sub: '', // set by caller
    email,
    role: row.role === 'admin' ? 'admin' : 'user',
    employeeId: row.employee_id || undefined,
    customerId: row.customer_id || undefined,
    accessibleDevelopments: devs,
    moduleAccess: modules,
  };
}

/**
 * Fastify preHandler. Verifies the Cognito JWT, then loads the user's
 * authorization profile from Postgres and attaches it to req.user.
 */
export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!config.cognito.userPoolId || !config.cognito.clientId) {
    return reply.code(401).send({ error: 'auth_not_configured' });
  }
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'missing_token' });
  }
  const token = header.slice('Bearer '.length);

  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, getJwks(), { issuer: issuer() }));
  } catch {
    return reply.code(401).send({ error: 'invalid_token' });
  }

  // Cognito access tokens carry client_id; id tokens carry aud.
  const aud = payload.aud ?? payload['client_id'];
  const audOk = Array.isArray(aud) ? aud.includes(config.cognito.clientId) : aud === config.cognito.clientId;
  if (!audOk) return reply.code(401).send({ error: 'wrong_audience' });

  const email = (payload.email as string | undefined) ?? (payload['cognito:username'] as string | undefined);
  if (!email) return reply.code(403).send({ error: 'no_email_claim' });

  const profile = await loadProfile(email);
  if (!profile) {
    // Authenticated with Cognito but no matching app user → no access.
    return reply.code(403).send({ error: 'no_app_user', email });
  }
  profile.sub = String(payload.sub);
  req.user = profile;
}

export function requireAdmin(req: FastifyRequest, reply: FastifyReply, done: () => void): void {
  if (req.user?.role !== 'admin') {
    reply.code(403).send({ error: 'admin_required' });
    return;
  }
  done();
}
