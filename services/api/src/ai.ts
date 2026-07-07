import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { config } from './config.js';

/**
 * Shared AI helper (Anthropic Claude). Used by the /api/ai/invoke route and by
 * ported backend functions (e.g. processInvoice) that need document extraction.
 */

const sm = new SecretsManagerClient({ region: config.ai.region });
let cachedKey = config.ai.apiKey || '';

async function getApiKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  const r = await sm.send(new GetSecretValueCommand({ SecretId: config.ai.secretId }));
  const s = (r.SecretString || '').trim();
  cachedKey = s.startsWith('{') ? JSON.parse(s).api_key || JSON.parse(s).ANTHROPIC_API_KEY || '' : s;
  if (!cachedKey) throw new Error('Anthropic API key not found in secret ' + config.ai.secretId);
  return cachedKey;
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

type Block =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'document'; source: { type: 'base64'; media_type: string; data: string } };

async function fetchAsBlock(url: string): Promise<Block> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  let mediaType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const buf = Buffer.from(await res.arrayBuffer());
  if (!mediaType || mediaType === 'application/octet-stream') {
    if (buf.slice(0, 4).toString('hex') === '25504446') mediaType = 'application/pdf';
    else if (buf.slice(0, 3).toString('hex') === 'ffd8ff') mediaType = 'image/jpeg';
    else if (buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a') mediaType = 'image/png';
  }
  const data = buf.toString('base64');
  if (mediaType === 'application/pdf') return { type: 'document', source: { type: 'base64', media_type: mediaType, data } };
  if (IMAGE_TYPES.has(mediaType)) return { type: 'image', source: { type: 'base64', media_type: mediaType, data } };
  throw new Error(`unsupported file type for AI: ${mediaType || 'unknown'} (${url})`);
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error('no JSON found in model response');
  return JSON.parse(candidate.slice(start).trim());
}

export interface InvokeOpts {
  prompt?: string;
  file_urls?: string[];
  response_json_schema?: Record<string, unknown>;
}

/** Returns a parsed object when response_json_schema is given, else the text. */
export async function invokeAI(opts: InvokeOpts): Promise<unknown> {
  const content: Block[] = [];
  for (const u of opts.file_urls || []) content.push(await fetchAsBlock(u));
  let text = opts.prompt || '';
  if (opts.response_json_schema) {
    text +=
      `\n\nRespond with ONLY a single valid JSON value that conforms to this JSON schema. ` +
      `No explanation, no markdown fences.\n\nSchema:\n${JSON.stringify(opts.response_json_schema)}`;
  }
  content.push({ type: 'text', text });

  const key = await getApiKey();
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: config.ai.model, max_tokens: config.ai.maxTokens, messages: [{ role: 'user', content }] }),
  });
  if (!resp.ok) {
    const detail = await resp.text();
    throw Object.assign(new Error(`anthropic ${resp.status}: ${detail}`), { status: resp.status, detail });
  }
  const payload = (await resp.json()) as { content?: Array<{ text?: string }> };
  const out = (payload.content || []).map((c) => c.text || '').join('').trim();
  return opts.response_json_schema ? extractJson(out) : out;
}
