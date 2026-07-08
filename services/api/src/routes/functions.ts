import type { FastifyInstance, FastifyRequest } from 'fastify';
import { query } from '../db.js';
import { authenticate, type AuthUser } from '../auth.js';
import { invokeAI } from '../ai.js';

/**
 * Backend functions dispatcher — the port of base44.functions.invoke(name, args).
 * POST /api/fn/:name (auth) runs a ported function; unknown names return a clear
 * "not ported yet" in the body (kept 200 so the frontend reads response.data.error,
 * matching how Base44 functions resolved). Each function is ported one at a time.
 */

type Args = Record<string, unknown>;
type Handler = (args: Args, user: AuthUser, req: FastifyRequest) => Promise<unknown>;

const INVOICE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    supplier_invoice_number: { type: 'string', description: 'The invoice number or reference from the supplier' },
    gross_subtotal: { type: 'number', description: 'The gross subtotal before any CIS deductions, early payment discounts, or other reductions. Matches the sum of all line items.' },
    net_amount: { type: 'number', description: 'Net amount before VAT (subtotal excluding VAT), before any CIS or discount deductions' },
    vat_amount: { type: 'number', description: 'Total VAT amount on the invoice. If domestic reverse charge applies, set this to 0.' },
    cis_deduction: { type: 'number', description: 'CIS deduction amount shown on the invoice. Set to 0 if not present.' },
    early_payment_discount: { type: 'number', description: 'Early payment discount amount. Set to 0 if not present.' },
    other_deductions: { type: 'number', description: 'Any other deductions (retention, etc.). Set to 0 if not present.' },
    total_due: { type: 'number', description: 'The final Total Due / Total to Pay after all deductions.' },
    invoice_date: { type: 'string', description: 'Invoice date in YYYY-MM-DD format' },
    due_date: { type: 'string', description: 'Invoice due date in YYYY-MM-DD format' },
    extracted_line_items: {
      type: 'array',
      description: 'Line items at their gross values. Do NOT reduce for CIS or discounts.',
      items: {
        type: 'object',
        properties: {
          product_code: { type: 'string' },
          description: { type: 'string' },
          unit_rate: { type: 'number' },
          quantity: { type: 'number' },
          net_total: { type: 'number', description: 'Gross net amount for this line, excluding VAT' },
          vat_rate: { type: 'string', description: 'VAT rate/type for this line, e.g. "20%", "Zero Rated", "Domestic Reverse Charge @ 20%"' },
        },
        required: ['description', 'quantity', 'net_total'],
      },
    },
  },
  required: ['gross_subtotal', 'net_amount', 'extracted_line_items', 'total_due'],
};

type LineItem = { net_total?: number; total_value?: number; vat_rate?: string | null; [k: string]: unknown };

async function processInvoice(args: Args): Promise<unknown> {
  const purchase_order_id = args.purchase_order_id as string | undefined;
  const invoice_file_url = args.invoice_file_url as string | undefined;
  if (!purchase_order_id || !invoice_file_url) return { error: 'Missing purchase_order_id or invoice_file_url' };

  const poRes = await query<Record<string, unknown>>('SELECT * FROM "purchase_order" WHERE id = $1 LIMIT 1', [purchase_order_id]);
  const po = poRes.rows[0];
  if (!po) return { error: 'Purchase Order not found' };

  let out: Record<string, unknown>;
  try {
    const r = await invokeAI({
      prompt: 'Extract the data from the attached supplier invoice strictly per the schema.',
      file_urls: [invoice_file_url],
      response_json_schema: INVOICE_SCHEMA,
    });
    if (!r || typeof r !== 'object') return { error: 'Failed to extract invoice data: No valid invoice data found' };
    out = r as Record<string, unknown>;
  } catch (e) {
    return { error: `Failed to extract invoice data: ${(e as Error).message}. Please ensure the file is a valid invoice.` };
  }

  const supplier_invoice_number = (out.supplier_invoice_number as string) || '';
  const gross_subtotal = Number(out.gross_subtotal) || 0;
  const net_amount = Number(out.net_amount) || 0;
  const vat_amount = Number(out.vat_amount) || 0;
  const cis_deduction = Number(out.cis_deduction) || 0;
  const early_payment_discount = Number(out.early_payment_discount) || 0;
  const other_deductions = Number(out.other_deductions) || 0;
  const total_due = Number(out.total_due) || 0;
  const invoice_date = (out.invoice_date as string) || '';
  const due_date = (out.due_date as string) || '';
  const extracted_line_items = (out.extracted_line_items as LineItem[]) || [];

  const invoiced_value = gross_subtotal || net_amount || total_due || 0;

  if (!po.is_retrospective_po) {
    const allowed = ['part_delivered', 'delivered', 'part_invoiced', 'invoiced'];
    if (!allowed.includes(po.status as string)) {
      return { error: `Invoice matching is only allowed for POs in 'Part Delivered' or 'Delivered' status. Current status: ${po.status}` };
    }
  }

  // Duplicate checks against our own data (mirrors Base44's asServiceRole checks).
  if (supplier_invoice_number && po.supplier_id) {
    const inv = await query<{ purchase_order_id: string; match_number: string | null; id: string }>(
      'SELECT purchase_order_id, match_number, id FROM "purchase_invoice" WHERE supplier_invoice_number = $1',
      [supplier_invoice_number],
    );
    for (const oi of inv.rows.filter((r) => r.purchase_order_id !== purchase_order_id)) {
      const rp = await query<{ supplier_id: string | null }>('SELECT supplier_id FROM "purchase_order" WHERE id = $1 LIMIT 1', [oi.purchase_order_id]);
      if (rp.rows[0]?.supplier_id === po.supplier_id) {
        return { isDuplicate: true, duplicateInvoiceNumber: supplier_invoice_number, error: `Duplicate invoice: number '${supplier_invoice_number}' has already been matched for this supplier (Match: ${oi.match_number || oi.id}). Please check before proceeding.` };
      }
    }
    const dupPO = await query<{ id: string; po_number: string | null }>(
      'SELECT id, po_number FROM "purchase_order" WHERE supplier_id = $1 AND supplier_invoice_number = $2 AND id <> $3 LIMIT 1',
      [po.supplier_id, supplier_invoice_number, purchase_order_id],
    );
    if (dupPO.rowCount) {
      const d = dupPO.rows[0];
      return { isDuplicate: true, duplicateInvoiceNumber: supplier_invoice_number, duplicatePONumber: d.po_number, error: `Duplicate invoice: number '${supplier_invoice_number}' has already been uploaded against PO ${d.po_number || d.id} for this supplier. Please check before proceeding.` };
    }
  }

  // Xero duplicate check is skipped until the Xero module is ported (was non-fatal in Base44).
  const xeroDuplicateWarning = null;

  let xeroTaxType = 'No VAT';
  if (vat_amount > 0 && net_amount > 0) {
    const vatPct = (vat_amount / net_amount) * 100;
    if (vatPct >= 18 && vatPct <= 22) xeroTaxType = '20% (VAT on Expenses)';
    else if (vatPct >= 3 && vatPct <= 7) xeroTaxType = '5% (VAT on Expenses)';
    else if (vatPct > 0) xeroTaxType = 'Zero Rated Expenses';
  }

  const isRetro = Boolean(po.is_retrospective_po);
  const poTotalValue = isRetro ? invoiced_value : Number(po.total_value) || 0;
  const value_difference = invoiced_value - poTotalValue;

  const processedLineItems = extracted_line_items.map((item) => ({
    ...item,
    total_value: item.net_total ?? item.total_value ?? 0,
    vat_rate: item.vat_rate || null,
  }));

  const set: Record<string, unknown> = {
    invoice_file_url,
    invoiced_value,
    value_difference,
    extracted_line_items: JSON.stringify(processedLineItems),
    supplier_invoice_number: supplier_invoice_number || po.supplier_invoice_number,
    xero_tax_type: xeroTaxType,
    xero_sync_status: 'pending',
    updated_date: new Date().toISOString(),
  };
  if (invoice_date) set.invoice_date = invoice_date;
  if (due_date) set.invoice_due_date = due_date;
  if (cis_deduction > 0 || early_payment_discount > 0 || other_deductions > 0) {
    set.notes = [
      po.notes,
      cis_deduction > 0 ? `CIS deduction: £${cis_deduction.toFixed(2)}` : null,
      early_payment_discount > 0 ? `Early payment discount: £${early_payment_discount.toFixed(2)}` : null,
      other_deductions > 0 ? `Other deductions: £${other_deductions.toFixed(2)}` : null,
      total_due ? `Total due to supplier: £${total_due.toFixed(2)}` : null,
    ].filter(Boolean).join(' | ');
  }
  if (isRetro) set.total_value = invoiced_value;

  const keys = Object.keys(set);
  const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
  await query(`UPDATE "purchase_order" SET ${setClause} WHERE id = $${keys.length + 1}`, [...keys.map((k) => set[k]), purchase_order_id]);

  return {
    success: true,
    invoiced_value,
    value_difference,
    extracted_line_items: processedLineItems,
    supplier_invoice_number,
    detected_tax_type: xeroTaxType,
    autoSynced: false,
    xeroSyncStatus: 'pending',
    xeroDuplicateWarning,
    cis_deduction,
    early_payment_discount,
    other_deductions,
    total_due: total_due || invoiced_value,
  };
}

// getAppConfig — the admin user's app logo (Base44 getAppConfig).
async function getAppConfig(): Promise<unknown> {
  try {
    const r = await query<{ app_logo_url: string | null }>(
      `SELECT app_logo_url FROM "user" WHERE role = 'admin' ORDER BY created_date DESC NULLS LAST LIMIT 1`,
    );
    return { app_logo_url: r.rows[0]?.app_logo_url ?? null };
  } catch {
    return { app_logo_url: null };
  }
}

// getAppUsers — all users for pickers, sorted by name.
async function getAppUsers(): Promise<unknown> {
  const r = await query(`SELECT * FROM "user" ORDER BY full_name NULLS LAST LIMIT 500`);
  return { users: r.rows };
}

// getGoogleMapsKey — Maps key from env (set GOOGLE_MAPS_API_KEY to enable maps).
async function getGoogleMapsKey(): Promise<unknown> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
  if (!apiKey) return { error: 'API key not configured' };
  return { apiKey };
}

// generateIncidentReference — next HSE/accident reference for a development.
async function generateIncidentReference(args: Args): Promise<unknown> {
  const development_id = args.development_id as string | undefined;
  const report_type = args.report_type as string | undefined;
  if (!development_id) return { error: 'development_id is required' };
  const dev = await query<{ development_code: string | null }>('SELECT development_code FROM "development" WHERE id = $1 LIMIT 1', [development_id]);
  if (!dev.rowCount) return { error: 'Development not found' };
  const code = dev.rows[0].development_code || 'UNK';
  const prefix = report_type === 'Accident' ? 'ACC' : 'IND';
  const rows = await query<{ reference: string | null }>(
    'SELECT reference FROM "incident_report" WHERE development_id = $1 AND reference LIKE $2',
    [development_id, `${prefix}-${code}-%`],
  );
  let maxSeq = 0;
  for (const r of rows.rows) {
    const parts = (r.reference || '').split('-');
    if (parts.length === 3) { const s = parseInt(parts[2], 10); if (!Number.isNaN(s) && s > maxSeq) maxSeq = s; }
  }
  return { reference: `${prefix}-${code}-${String(maxSeq + 1).padStart(3, '0')}` };
}

// checkCategoryTransactions — does a package category have work/dev packages?
async function checkCategoryTransactions(args: Args): Promise<unknown> {
  const category_id = args.category_id as string | undefined;
  const development_id = args.development_id as string | undefined;
  if (!category_id || !development_id) return { error: 'category_id and development_id required' };
  const wp = await query<{ n: number }>('SELECT count(*)::int AS n FROM "work_package" WHERE development_id = $1 AND package_category_id = $2', [development_id, category_id]);
  const dp = await query<{ n: number }>('SELECT count(*)::int AS n FROM "development_package" WHERE development_id = $1 AND package_category_id = $2', [development_id, category_id]);
  const w = Number(wp.rows[0].n), d = Number(dp.rows[0].n);
  return { has_transactions: w > 0 || d > 0, work_packages: w, dev_packages: d };
}

// reassignTransactionDevelopment — admin: move a historical transaction to another development.
async function reassignTransactionDevelopment(args: Args, user: AuthUser): Promise<unknown> {
  if (user.role !== 'admin') return { error: 'Unauthorized' };
  const transactionId = args.transactionId as string | undefined;
  const newDevelopmentId = args.newDevelopmentId as string | undefined;
  if (!transactionId || !newDevelopmentId) return { error: 'Missing transactionId or newDevelopmentId' };
  const txn = await query<{ reference: string | null; development_name: string | null }>('SELECT reference, development_name FROM "historical_transaction" WHERE id = $1 LIMIT 1', [transactionId]);
  if (!txn.rowCount) return { error: 'Transaction not found' };
  const dev = await query<{ name: string | null }>('SELECT name FROM "development" WHERE id = $1 LIMIT 1', [newDevelopmentId]);
  if (!dev.rowCount) return { error: 'Development not found' };
  await query('UPDATE "historical_transaction" SET development_id = $1, development_name = $2, updated_date = $3 WHERE id = $4',
    [newDevelopmentId, dev.rows[0].name, new Date().toISOString(), transactionId]);
  return { message: `Reassigned transaction "${txn.rows[0].reference}" from ${txn.rows[0].development_name || 'unknown'} to ${dev.rows[0].name}`, transaction: transactionId };
}

const handlers: Record<string, Handler> = {
  processInvoice: (args) => processInvoice(args),
  getAppConfig: () => getAppConfig(),
  getAppUsers: () => getAppUsers(),
  getGoogleMapsKey: () => getGoogleMapsKey(),
  generateIncidentReference: (args) => generateIncidentReference(args),
  checkCategoryTransactions: (args) => checkCategoryTransactions(args),
  reassignTransactionDevelopment: (args, user) => reassignTransactionDevelopment(args, user),
};

export async function functionRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/fn/:name', { preHandler: authenticate }, async (req, reply) => {
    const { name } = req.params as { name: string };
    const h = handlers[name];
    if (!h) return reply.send({ error: `Function ${name} is not ported to the StarshipOS API yet.`, not_ported: true });
    try {
      const result = await h((req.body ?? {}) as Args, req.user as AuthUser, req);
      return reply.send(result);
    } catch (err) {
      req.log.error({ err, fn: name }, 'function failed');
      return reply.send({ error: (err as Error).message || 'function error' });
    }
  });
}
