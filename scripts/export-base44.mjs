#!/usr/bin/env node
/**
 * StarshipOS - export all records from Base44 into local JSON (one file per table).
 *
 * Auth: BASE44_TOKEN (a bearer token from a logged-in admin session) or
 * BASE44_EMAIL + BASE44_PASSWORD. Paced with a delay between requests and
 * exponential backoff on HTTP 429 so Base44's rate limiter doesn't drop entities.
 *
 * Output: <platform>/data-export/<table>.json + _manifest.json = [{entity,table,count|error}]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@base44/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data-export');
const ENTITIES = path.join(ROOT, 'db', 'entities.json');
const PAGE = 100;
const REQ_DELAY_MS = 400;   // pause between requests
const MAX_RETRIES = 8;

const APP_ID = process.env.BASE44_APP_ID;
const EMAIL = process.env.BASE44_EMAIL;
const PASSWORD = process.env.BASE44_PASSWORD;
const TOKEN = process.env.BASE44_TOKEN;
if (!APP_ID || (!TOKEN && !(EMAIL && PASSWORD))) {
  console.error('Set BASE44_APP_ID and either BASE44_TOKEN or BASE44_EMAIL + BASE44_PASSWORD');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const base44 = createClient({ appId: APP_ID });
try {
  if (TOKEN) { base44.auth.setToken(TOKEN, false); console.log('Authenticating with BASE44_TOKEN.'); }
  else { await base44.auth.loginViaEmailPassword(EMAIL, PASSWORD); console.log('Authenticated via email/password.'); }
} catch (err) {
  console.error('Base44 auth failed:', err?.response?.data?.message || err.message);
  process.exit(1);
}

async function listWithRetry(entity, sort, limit, skip) {
  let attempt = 0;
  for (;;) {
    try {
      const r = await base44.entities[entity].list(sort, limit, skip);
      await sleep(REQ_DELAY_MS);
      return r;
    } catch (err) {
      const status = err?.response?.status;
      if (status === 429 && attempt < MAX_RETRIES) {
        attempt++;
        const wait = Math.min(60000, 4000 * attempt);
        console.log(`  429 on ${entity} (skip ${skip}) — waiting ${wait / 1000}s, retry ${attempt}/${MAX_RETRIES}`);
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
}

const entities = JSON.parse(fs.readFileSync(ENTITIES, 'utf8'));
fs.mkdirSync(OUT, { recursive: true });
const manifest = [];

for (const { entity, table } of entities) {
  const outFile = path.join(OUT, `${table}.json`);
  // Skip entities already exported in a previous run (resume support).
  if (fs.existsSync(outFile)) {
    const existing = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    manifest.push({ entity, table, count: existing.length });
    console.log(`${entity.padEnd(34)} ${existing.length} (cached)`);
    continue;
  }
  try {
    let skip = 0;
    const all = [];
    for (;;) {
      const rows = await listWithRetry(entity, '-created_date', PAGE, skip);
      all.push(...rows);
      if (rows.length < PAGE) break;
      skip += PAGE;
    }
    fs.writeFileSync(outFile, JSON.stringify(all, null, 2));
    manifest.push({ entity, table, count: all.length });
    console.log(`${entity.padEnd(34)} ${all.length}`);
  } catch (err) {
    manifest.push({ entity, table, error: err?.response?.data?.message || err.message });
    console.error(`${entity} FAILED: ${err?.response?.data?.message || err.message}`);
  }
}

fs.writeFileSync(path.join(OUT, '_manifest.json'), JSON.stringify(manifest, null, 2));
const total = manifest.reduce((n, m) => n + (m.count || 0), 0);
const failed = manifest.filter((m) => m.error).length;
console.log(`\nExport complete -> ${OUT}`);
console.log(`${manifest.length} entities, ${total} records${failed ? `, ${failed} FAILED` : ''}`);
