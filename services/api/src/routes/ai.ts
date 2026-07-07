import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth.js';
import { invokeAI } from '../ai.js';

/**
 * AI — port of Base44's Core.InvokeLLM / ExtractDataFromUploadedFile.
 * POST /api/ai/invoke (auth): { prompt?, file_urls?, response_json_schema? } -> { result }
 */

const invokeSchema = z.object({
  prompt: z.string().default(''),
  file_urls: z.array(z.string()).max(10).optional(),
  response_json_schema: z.record(z.unknown()).optional(),
});

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/ai/invoke', { preHandler: authenticate }, async (req, reply) => {
    const parsed = invokeSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request', detail: parsed.error.flatten() });
    try {
      const result = await invokeAI(parsed.data);
      return reply.send({ result });
    } catch (err) {
      req.log.error({ err }, 'ai invoke failed');
      return reply.code(502).send({ error: 'ai_failed', detail: (err as Error).message });
    }
  });
}
