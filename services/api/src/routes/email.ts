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

/** Shared SES send used by the /api/email/send route and by backend functions. */
export async function sendEmail(opts: { to: string | string[]; subject?: string; body?: string; cc?: string | string[]; from?: string }): Promise<string | undefined> {
  const body = opts.body ?? '';
  const isHtml = /<[a-z][\s\S]*>/i.test(body);
  const html = isHtml ? body : body.replace(/\n/g, '<br>');
  const text = isHtml ? body.replace(/<[^>]+>/g, ' ').replace(/\s+\n/g, '\n') : body;
  const out = await ses.send(
    new SendEmailCommand({
      Source: opts.from || config.email.from,
      Destination: { ToAddresses: asArray(opts.to), CcAddresses: asArray(opts.cc) },
      Message: {
        Subject: { Data: opts.subject ?? '', Charset: 'UTF-8' },
        Body: { Html: { Data: html, Charset: 'UTF-8' }, Text: { Data: text, Charset: 'UTF-8' } },
      },
    }),
  );
  return out.MessageId;
}

export async function emailRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/email/send', { preHandler: authenticate }, async (req, reply) => {
    const parsed = sendSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request', detail: parsed.error.flatten() });
    const { to, subject, body, cc, from } = parsed.data;
    try {
      const id = await sendEmail({ to, subject, body, cc, from });
      return reply.send({ status: 'success', id });
    } catch (err) {
      req.log.error({ err }, 'ses send failed');
      return reply.code(502).send({ error: 'email_failed', detail: (err as Error).message });
    }
  });
}
