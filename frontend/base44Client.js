// StarshipOS — Base44 compatibility client.
//
// Drop-in replacement for the app's src/api/base44Client.js. Keeps the exact
// `base44.entities.X.{list,filter,get,create,update,delete}` and `base44.auth`
// shape the app already uses, but talks to the StarshipOS API (/api/*) and
// authenticates with Cognito. The 250 screens keep working; only this one file
// changes.
//
// Dependency: amazon-cognito-identity-js  (npm i amazon-cognito-identity-js)
// Env (Vite): VITE_API_BASE (default /api), VITE_COGNITO_POOL, VITE_COGNITO_CLIENT.
import { CognitoUserPool, CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js';

const API_BASE = import.meta.env?.VITE_API_BASE || '/api';
const POOL = import.meta.env?.VITE_COGNITO_POOL || 'eu-west-2_13HrsjI4H';
const CLIENT = import.meta.env?.VITE_COGNITO_CLIENT || '670t3ll2gn4qsmdsb67iruqg4u';
const userPool = new CognitoUserPool({ UserPoolId: POOL, ClientId: CLIENT });

// PascalCase entity name -> snake_case table (matches the DB schema generator).
function toTable(entity) {
  return String(entity)
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

// --- Cognito session / token ---
function currentUser() { return userPool.getCurrentUser(); }
function getSession() {
  return new Promise((resolve, reject) => {
    const u = currentUser();
    if (!u) return reject(new Error('not_authenticated'));
    u.getSession((err, session) => (err || !session ? reject(err || new Error('no_session')) : resolve(session)));
  });
}
async function getToken() {
  const session = await getSession();
  return session.getIdToken().getJwtToken();
}

async function apiFetch(path, options = {}) {
  let token;
  try { token = await getToken(); } catch { /* anonymous */ }
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error((body && body.error) || ('HTTP ' + res.status)), { status: res.status, body });
  return body;
}

function qs(params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null) continue;
    p.append(k, String(v));
  }
  const s = p.toString();
  return s ? '?' + s : '';
}

// --- entity operations ---
function entityApi(entity) {
  const table = toTable(entity);
  const ops = {
    async list(sort, limit, skip) {
      const r = await apiFetch(`/${table}` + qs({ sort, limit, offset: skip }));
      return r.data;
    },
    async filter(query, sort, limit) {
      const r = await apiFetch(`/${table}` + qs({ ...(query || {}), sort, limit }));
      return r.data;
    },
    async get(id) {
      const r = await apiFetch(`/${table}/${id}`);
      return r.data;
    },
    async create(data) {
      const r = await apiFetch(`/${table}`, { method: 'POST', body: JSON.stringify(data) });
      return r.data;
    },
    async update(id, data) {
      const r = await apiFetch(`/${table}/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
      return r.data;
    },
    async delete(id) {
      await apiFetch(`/${table}/${id}`, { method: 'DELETE' });
      return { success: true };
    },
    async bulkCreate(items) {
      const out = [];
      for (const it of items) out.push(await ops.create(it));
      return out;
    },
  };
  return ops;
}

const entities = new Proxy({}, { get: (_t, name) => entityApi(String(name)) });

// --- auth ---
const auth = {
  async me() { return apiFetch('/me'); },
  async login({ email, password }) {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    const details = new AuthenticationDetails({ Username: email, Password: password });
    return new Promise((resolve, reject) => {
      user.authenticateUser(details, { onSuccess: () => resolve(true), onFailure: reject });
    });
  },
  logout() { const u = currentUser(); if (u) u.signOut(); },
  getToken,
  isAuthenticated() { return !!currentUser(); },
};

// Not yet ported — fail loudly so we know exactly what backend logic to build.
const notPorted = (name) => async () => { throw new Error(`Base44 ${name} is not ported to the StarshipOS API yet.`); };
const integrations = { Core: { InvokeLLM: notPorted('InvokeLLM'), UploadFile: notPorted('UploadFile'), SendEmail: notPorted('SendEmail') } };
const functions = new Proxy({}, { get: (_t, name) => notPorted(`function ${String(name)}`) });

export const base44 = { entities, auth, integrations, functions };
export default base44;
