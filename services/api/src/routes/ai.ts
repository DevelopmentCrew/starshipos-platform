import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { config } from '../config.js';
import { authenticate } from '../auth.js';

/**
 * AI — port of Base44's integrations.Core.InvokeLLM and ExtractDataFromUploadedFile.
 * One endpoint, POST /api/ai/invoke (auth), backed by the Anthropic API (Claude).
 *   body: { prompt?, file_urls?: string[], response_json_schema?: object }
 *   returns: { result }  — a parsed object when a schema is given, else the text.
 * Vision: each file_url is fetched and passed to Claude as an image (jpeg/png/gif/webp)
 * or a document (pdf) block, so HSE notices / licences / invoices can be read.
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

const invokeSchema = z.object({
  prompt: z.string().default(''),
  file_urls: z.array(z.string()).max(10).optional(),
  response_json_schema: z.record(z.unknown()).optional(),
});

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
    if (buf.slice(0, 4).toString('hex') === '25504446') mediaType = 'application/pdf'; // %PDF
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

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/ai/invoke', { preHandler: authenticate }, async (req, reply) => {
    const parsed = invokeSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request', detail: parsed.error.flatten() });
    const { prompt, file_urls, response_json_schema } = parsed.data;

    const content: Block[] = [];
    if (file_urls?.length) {
      for (const u of file_urls) content.push(await fetchAsBlock(u));
    }
    let text = prompt;
    if (response_json_schema) {
      text +=
        `\n\nRespond with ONLY a single valid JSON value that conforms to this JSON schema. ` +
        `No explanation, no markdown fences.\n\nSchema:\n${JSON.stringify(response_json_schema)}`;
    }
    content.push({ type: 'text', text });

    let out: string;
    try {
      const key = await getApiKey();
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: config.ai.model,
          max_tokens: config.ai.maxTokens,
          messages: [{ role: 'user', content }],
        }),
      });
      if (!resp.ok) {
        const detail = await resp.text();
        req.log.error({ status: resp.status, detail }, 'anthropic call failed');
        return reply.code(502).send({ error: 'ai_failed', status: resp.status, detail });
      }
      const payload = (await resp.json()) as { content?: Array<{ text?: string }> };
      out = (payload.content || []).map((c) => c.text || '').join('').trim();
    } catch (err) {
      req.log.error({ err }, 'ai invoke error');
      return reply.code(502).send({ error: 'ai_failed', detail: (err as Error).message });
    }

    if (response_json_schema) {
      try {
        return reply.send({ result: extractJson(out) });
      } catch (err) {
        req.log.error({ err, out }, 'ai json parse failed');
        return reply.code(502).send({ error: 'ai_bad_json', raw: out });
      }
    }
    return reply.send({ result: out });
  });
}
