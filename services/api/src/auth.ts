import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { config } from './config.js';

// The authenticated user, resolved from a verified Cognito JWT.
export interface AuthUser {
  sub: string;
  email?: string;
  role: 'admin' | 'user';
  employeeId?: string;
  // Custom claims we mirror from Cognito into the token (or look up in Postgres).
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

function toAuthUser(payload: JWTPayload): AuthUser {
  const groups = (payload['cognito:groups'] as string[] | undefined) ?? [];
  const role: AuthUser['role'] = groups.includes('admin') ? 'admin' : 'user';
  return {
    sub: String(payload.sub),
    email: payload.email as string | undefined,
    role,
    employeeId: (payload['custom:employee_id'] as string | undefined) || undefined,
    accessibleDevelopments: parseList(payload['custom:accessible_developments']),
    moduleAccess: {},
  };
}

function parseList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string' && v.trim()) return v.split(',').map((s) => s.trim());
  return [];
}

/**
 * Fastify preHandler. Verifies the bearer token against Cognito's JWKS and
 * attaches req.user. Reject if missing/invalid. Authorization (what this user
 * may see) is enforced downstream, not here.
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
  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: issuer(),
    });
    // Cognito access tokens carry client_id; id tokens carry aud.
    const aud = payload.aud ?? payload['client_id'];
    const audOk = Array.isArray(aud) ? aud.includes(config.cognito.clientId) : aud === config.cognito.clientId;
    if (!audOk) return reply.code(401).send({ error: 'wrong_audience' });

    req.user = toAuthUser(payload);
  } catch {
    return reply.code(401).send({ error: 'invalid_token' });
  }
}

export function requireAdmin(req: FastifyRequest, reply: FastifyReply, done: () => void): void {
  if (req.user?.role !== 'admin') {
    reply.code(403).send({ error: 'admin_required' });
    return;
  }
  done();
}
