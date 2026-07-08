import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { exchangeCodeAndStore } from '../xero.js';

/**
 * Xero OAuth callback — a PUBLIC browser redirect endpoint (no auth), because Xero
 * sends the user's browser here after they approve the connection. It exchanges the
 * code for tokens, stores the connection(s), then redirects back to the app's
 * AppSettings screen with a success/error flag.
 *
 * GET /api/xero/callback?code=...&state=...
 */
export async function xeroRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/xero/callback', async (req, reply) => {
    const appBase = config.storage.publicBaseUrl || '';
    const settingsUrl = (params: string) => `${appBase}/AppSettings?${params}`;
    try {
      const { code, state } = req.query as { code?: string; state?: string };
      if (!code || !state) {
        return reply.redirect(settingsUrl('xeroError=' + encodeURIComponent('Missing authorization code')));
      }
      let companyId = '';
      let redirectUri = config.xero.redirectUri;
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
        companyId = decoded.companyId;
        redirectUri = decoded.redirectUri || redirectUri;
      } catch {
        return reply.redirect(settingsUrl('xeroError=' + encodeURIComponent('Invalid state')));
      }
      if (!companyId) return reply.redirect(settingsUrl('xeroError=' + encodeURIComponent('Missing company')));

      const { connected } = await exchangeCodeAndStore(code, redirectUri, companyId);
      req.log.info({ companyId, connected }, 'xero oauth callback stored connections');
      return reply.redirect(settingsUrl(`xeroSuccess=true&company=${encodeURIComponent(companyId)}&connected=${connected}`));
    } catch (err) {
      req.log.error({ err }, 'xero oauth callback failed');
      return reply.redirect(settingsUrl('xeroError=' + encodeURIComponent((err as Error).message || 'Xero connection failed')));
    }
  });
}
