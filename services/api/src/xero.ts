import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { config } from './config.js';
import { query } from './db.js';

/**
 * Shared Xero helper: OAuth 2.0 (auth-code + refresh), a token store backed by the
 * xero_connection table, a fetch wrapper that keeps the access token fresh, and the
 * WRITE GUARD.
 *
 * Safety: writeEnabled() gates every call that would POST/PUT into a Xero
 * organisation. It is false by default (env XERO_WRITE_ENABLED unset), so on the dev
 * stack the read/sync functions work but nothing is ever written into the live org.
 * Flip XERO_WRITE_ENABLED=true only when you deliberately want to post to Xero.
 */

const XERO_IDENTITY = 'https://identity.xero.com/connect/token';
const XERO_AUTHORIZE = 'https://login.xero.com/identity/connect/authorize';
const XERO_API = 'https://api.xero.com/api.xro/2.0';
const XERO_CONNECTIONS = 'https://api.xero.com/connections';

export interface XeroConnection {
  id: string;
  company_id: string;
  company_name: string | null;
  xero_tenant_id: string | null;
  xero_tenant_name: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expiry: string | null;
  status: string | null;
  [k: string]: unknown;
}

export function writeEnabled(): boolean {
  return config.xero.writeEnabled;
}

const sm = new SecretsManagerClient({ region: config.xero.region });
let cachedCreds: { clientId: string; clientSecret: string } | null = null;
export async function getXeroCreds(): Promise<{ clientId: string; clientSecret: string }> {
  if (cachedCreds) return cachedCreds;
  if (config.xero.clientId && config.xero.clientSecret) {
    cachedCreds = { clientId: config.xero.clientId, clientSecret: config.xero.clientSecret };
    return cachedCreds;
  }
  const r = await sm.send(new GetSecretValueCommand({ SecretId: config.xero.secretId }));
  const s = (r.SecretString || '').trim();
  let clientId = '', clientSecret = '';
  if (s.startsWith('{')) {
    const j = JSON.parse(s);
    clientId = j.client_id || j.XERO_CLIENT_ID || '';
    clientSecret = j.client_secret || j.XERO_CLIENT_SECRET || '';
  }
  if (!clientId || !clientSecret) {
    throw new Error(`Xero credentials not found in secret ${config.xero.secretId} (expected JSON {client_id, client_secret})`);
  }
  cachedCreds = { clientId, clientSecret };
  return cachedCreds;
}

// --- OAuth ------------------------------------------------------------------

export async function buildAuthUrl(companyId: string): Promise<string> {
  const { clientId } = await getXeroCreds();
  const redirectUri = config.xero.redirectUri;
  const state = Buffer.from(JSON.stringify({ companyId, redirectUri })).toString('base64');
  const u = new URL(XERO_AUTHORIZE);
  u.searchParams.append('response_type', 'code');
  u.searchParams.append('client_id', clientId);
  u.searchParams.append('redirect_uri', redirectUri);
  u.searchParams.append('scope', config.xero.scopes);
  u.searchParams.append('state', state);
  return u.toString();
}

interface TokenResponse { access_token: string; refresh_token: string; expires_in: number }

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret } = await getXeroCreds();
  const res = await fetch(XERO_IDENTITY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...body, client_id: clientId, client_secret: clientSecret }).toString(),
  });
  if (!res.ok) throw new Error(`Xero token request failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as TokenResponse;
}

function decodeJwt(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');
  return JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
}

export interface XeroTenant { tenantId: string; tenantName: string }

async function listTenants(accessToken: string, authEventId?: string): Promise<XeroTenant[]> {
  const url = authEventId ? `${XERO_CONNECTIONS}?authEventId=${authEventId}` : XERO_CONNECTIONS;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Failed to fetch Xero connections (${res.status}): ${await res.text()}`);
  return (await res.json()) as XeroTenant[];
}

const now = () => new Date().toISOString();
const expiryFrom = (expiresIn: number) => new Date(Date.now() + expiresIn * 1000).toISOString();

async function tableHasCol(table: string, col: string): Promise<boolean> {
  const r = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
    [table, col],
  );
  return Number(r.rows[0]?.n) > 0;
}

/**
 * Exchange an OAuth code for tokens, then upsert a xero_connection row for every
 * connected tenant that maps to one of our companies (matching Base44's behaviour).
 * Returns the number of connections written.
 */
export async function exchangeCodeAndStore(code: string, redirectUri: string, companyId: string): Promise<{ connected: number }> {
  const token = await postToken({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
  const payload = decodeJwt(token.access_token);
  const authEventId = payload.authentication_event_id as string | undefined;
  const thisAuth = await listTenants(token.access_token, authEventId);
  if (thisAuth.length === 0) throw new Error('No Xero organisations found for this authorisation.');
  const allTenants = await listTenants(token.access_token);
  const tenants = allTenants.length ? allTenants : thisAuth;

  const compR = await query<{ id: string; company_name: string | null }>(`SELECT id, company_name FROM "company" WHERE id = $1 LIMIT 1`, [companyId]);
  const thisCompany = compR.rows[0];
  const companiesR = await query<{ id: string; company_name: string | null; xero_tenant_id: string | null }>(`SELECT id, company_name, xero_tenant_id FROM "company"`);
  const companies = companiesR.rows;
  const tokenExpiry = expiryFrom(token.expires_in);
  const primaryTenant = thisAuth[0];
  const companyHasTenantCols = await tableHasCol('company', 'xero_tenant_id');

  let connected = 0;
  for (const t of tenants) {
    const matched = companies.find((c) => c.xero_tenant_id === t.tenantId);
    const targetCompanyId = matched ? matched.id : (t.tenantId === primaryTenant.tenantId ? companyId : null);
    const targetCompanyName = matched ? matched.company_name : (t.tenantId === primaryTenant.tenantId ? thisCompany?.company_name ?? null : null);
    if (!targetCompanyId) continue;

    const existR = await query<{ id: string }>(`SELECT id FROM "xero_connection" WHERE company_id = $1 LIMIT 1`, [targetCompanyId]);
    if (existR.rowCount) {
      await query(
        `UPDATE "xero_connection" SET access_token=$1, refresh_token=$2, token_expiry=$3, status='connected', xero_tenant_id=$4, xero_tenant_name=$5, updated_date=$6 WHERE id=$7`,
        [token.access_token, token.refresh_token, tokenExpiry, t.tenantId, t.tenantName, now(), existR.rows[0].id],
      );
    } else {
      const id = (await import('node:crypto')).randomBytes(12).toString('hex');
      await query(
        `INSERT INTO "xero_connection" (id, company_id, company_name, xero_tenant_id, xero_tenant_name, access_token, refresh_token, token_expiry, status, auto_send_suppliers, auto_send_invoices, field_mappings, created_date, updated_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'connected',false,false,$9,$10,$10)`,
        [id, targetCompanyId, targetCompanyName, t.tenantId, t.tenantName, token.access_token, token.refresh_token, tokenExpiry, JSON.stringify({}), now()],
      );
    }
    if (companyHasTenantCols) {
      await query(`UPDATE "company" SET xero_tenant_id=$1, xero_tenant_name=$2, updated_date=$3 WHERE id=$4`, [t.tenantId, t.tenantName, now(), targetCompanyId]);
    }
    connected++;
  }
  return { connected };
}

// --- Token store / refresh --------------------------------------------------

export async function getConnection(companyId: string): Promise<XeroConnection | null> {
  const r = await query<XeroConnection>(`SELECT * FROM "xero_connection" WHERE company_id = $1 AND status = 'connected' LIMIT 1`, [companyId]);
  return r.rows[0] ?? null;
}

export async function listConnections(): Promise<XeroConnection[]> {
  const r = await query<XeroConnection>(`SELECT * FROM "xero_connection"`);
  return r.rows;
}

async function persistTokens(id: string, token: TokenResponse): Promise<void> {
  await query(
    `UPDATE "xero_connection" SET access_token=$1, refresh_token=$2, token_expiry=$3, status='connected', updated_date=$4 WHERE id=$5`,
    [token.access_token, token.refresh_token, expiryFrom(token.expires_in), now(), id],
  );
}

/** Refresh a connection's token now (used by manual/scheduled refresh). */
export async function refreshConnection(conn: XeroConnection): Promise<TokenResponse> {
  if (!conn.refresh_token) throw new Error('No refresh token on connection');
  const token = await postToken({ grant_type: 'refresh_token', refresh_token: conn.refresh_token });
  await persistTokens(conn.id, token);
  return token;
}

/** Return a valid access token, refreshing (and persisting) if it expires within 60s. */
export async function getValidAccessToken(conn: XeroConnection): Promise<string> {
  const expiry = conn.token_expiry ? new Date(conn.token_expiry) : new Date(0);
  if (conn.access_token && expiry > new Date(Date.now() + 60000)) return conn.access_token;
  const token = await refreshConnection(conn);
  conn.access_token = token.access_token;
  conn.refresh_token = token.refresh_token;
  conn.token_expiry = expiryFrom(token.expires_in);
  return token.access_token;
}

// --- API fetch wrapper ------------------------------------------------------

/** Call the Xero Accounting API for a connection. Auto-refreshes the token. */
export async function xeroApi(conn: XeroConnection, path: string, init: RequestInit = {}): Promise<Response> {
  const accessToken = await getValidAccessToken(conn);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Xero-tenant-id': conn.xero_tenant_id || '',
    Accept: 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  return fetch(`${XERO_API}${path}`, { ...init, headers });
}

export async function xeroApiJson<T = unknown>(conn: XeroConnection, path: string, init: RequestInit = {}): Promise<T> {
  const res = await xeroApi(conn, path, init);
  if (!res.ok) throw new Error(`Xero API ${path} failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as T;
}

export const parseXeroDate = (xeroDate: string | null | undefined): string | null => {
  if (!xeroDate) return null;
  const m = String(xeroDate).match(/\/Date\((\d+)([+-]\d{4})?\)\//);
  if (!m) return xeroDate;
  return new Date(parseInt(m[1], 10)).toISOString().split('T')[0];
};
