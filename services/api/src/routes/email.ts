import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { config } from '../config.js';
import { authenticate } from '../auth.js';

/**
 * Email — port of Base44's integrations.Core.SendEmail.
 *   POST /api/email/send (auth): { to, subject, body, cc?, from? }
 * body may be plain text or HTML; we send both a text and an HTML part so it
 * renders either way. Sender defaults to config.email.from (must be SES-verified).
 */

const ses = new SESClient({ region: config.email.region });

const sendSchema = z.object({
  to: z.union([z.string(), z.array(z.string())]),
  subject: z.string().default(''),
  body: z.string().default(''),
  cc: z.union([z.string(), z.array(z.string())]).optional(),
  from: z.string().optional(),
});

const asArray = (v: string | string[] | undefined): string[] =>
  v == null ? [] : Array.isArray(v) ? v : [v];

export async function emailRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/email/send', { preHandler: authenticate }, async (req, reply) => {
    const parsed = sendSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request', detail: parsed.error.flatten() });
    const { to, subject, body, cc, from } = parsed.data;

    const isHtml = /<[a-z][\s\S]*>/i.test(body);
    const html = isHtml ? body : body.replace(/\n/g, '<br>');
    const text = isHtml ? body.replace(/<[^>]+>/g, ' ').replace(/\s+\n/g, '\n') : body;

    try {
      const out = await ses.send(
        new SendEmailCommand({
          Source: from || config.email.from,
          Destination: { ToAddresses: asArray(to), CcAddresses: asArray(cc) },
          Message: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: { Html: { Data: html, Charset: 'UTF-8' }, Text: { Data: text, Charset: 'UTF-8' } },
          },
        }),
      );
      return reply.send({ status: 'success', id: out.MessageId });
    } catch (err) {
      req.log.error({ err }, 'ses send failed');
      return reply.code(502).send({ error: 'email_failed', detail: (err as Error).message });
    }
  });
}
