import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config.js';
import { authenticate } from '../auth.js';

/**
 * File storage — the port of Base44's integrations.Core.UploadFile.
 *
 *   POST /api/files/presign   (auth) -> { upload_url, file_url, key }
 *       The browser then PUTs the file straight to S3 at upload_url. file_url is
 *       a durable, same-origin URL the app stores on the record.
 *
 *   GET  /api/files/raw/<key>  (public) -> streams the object back
 *       Public with an unguessable key, mirroring how Base44 served file_urls
 *       (an <img> tag can't send a bearer token). Sensitive-doc gating is a
 *       follow-up (signed reads / CloudFront OAC + RLS) tracked for prod.
 */

const s3 = new S3Client({ region: config.cognito.region });

const presignSchema = z.object({
  filename: z.string().min(1).max(300).default('file'),
  content_type: z.string().min(1).max(200).default('application/octet-stream'),
});

// Keep the original name (sanitised) so downloads are sensible, but prefix an
// unguessable id so keys never collide and can't be enumerated.
function buildKey(filename: string): string {
  const safe = filename.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120) || 'file';
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const rand = crypto.randomBytes(12).toString('hex');
  return `uploads/${yyyy}/${mm}/${rand}-${safe}`;
}

export async function fileRoutes(app: FastifyInstance): Promise<void> {
  // --- presign an upload (authenticated) ---
  app.post('/api/files/presign', { preHandler: authenticate }, async (req, reply) => {
    if (!config.storage.uploadsBucket) {
      return reply.code(500).send({ error: 'storage_not_configured' });
    }
    const parsed = presignSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request', detail: parsed.error.flatten() });
    const { filename, content_type } = parsed.data;

    const key = buildKey(filename);
    const upload_url = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: config.storage.uploadsBucket, Key: key, ContentType: content_type }),
      { expiresIn: 300 },
    );
    const base = config.storage.publicBaseUrl.replace(/\/$/, '');
    const file_url = `${base}/api/files/raw/${key}`;
    return reply.send({ upload_url, file_url, key });
  });

  // --- read a file back (public; key is the capability) ---
  app.get('/api/files/raw/*', async (req, reply) => {
    if (!config.storage.uploadsBucket) return reply.code(500).send({ error: 'storage_not_configured' });
    const key = (req.params as Record<string, string>)['*'];
    if (!key || key.includes('..')) return reply.code(400).send({ error: 'bad_key' });

    try {
      const obj = await s3.send(new GetObjectCommand({ Bucket: config.storage.uploadsBucket, Key: key }));
      if (obj.ContentType) reply.header('Content-Type', obj.ContentType);
      if (obj.ContentLength != null) reply.header('Content-Length', String(obj.ContentLength));
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      return reply.send(obj.Body as NodeJS.ReadableStream);
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === 'NoSuchKey' || name === 'NotFound') return reply.code(404).send({ error: 'not_found' });
      req.log.error(err);
      return reply.code(500).send({ error: 'read_failed' });
    }
  });
}
