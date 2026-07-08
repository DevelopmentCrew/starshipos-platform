import type { FastifyInstance, FastifyRequest } from 'fastify';
import crypto from 'node:crypto';
import * as XLSX from 'xlsx';
import { query } from '../db.js';
import { authenticate, type AuthUser } from '../auth.js';
import { invokeAI } from '../ai.js';

const newId = (): string => crypto.randomBytes(12).toString('hex');
const SYSCOLS = ['id', 'created_date', 'updated_date', 'created_by', 'created_by_id'];

const _colCache = new Map<string, Set<string>>();
async function tableCols(table: string): Promise<Set<string>> {
  const hit = _colCache.get(table);
  if (hit) return hit;
  const r = await query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  const s = new Set(r.rows.map((x) => x.column_name));
  _colCache.set(table, s);
  return s;
}

// Insert `data` into `table`, keeping only real columns; adds id + system cols. Returns the row.
async function insertRow(table: string, data: Record<string, unknown>, user: AuthUser): Promise<Record<string, unknown>> {
  const cols = await tableCols(table);
  const now = new Date().toISOString();
  const rec: Record<string, unknown> = {
    ...data, id: newId(), created_date: now, updated_date: now, created_by: user.email, created_by_id: user.sub,
  };
  const keys = Object.keys(rec).filter((k) => cols.has(k));
  const vals = keys.map((k) => {
    const v = rec[k];
    return v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
  });
  const r = await query(
    `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
    vals,
  );
  return r.rows[0] as Record<string, unknown>;
}

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

// createDevelopment — allocate the next development code, create the Development,
// and its default CheckMate GSD log. (Xero tracking-category sync is deferred until
// the Xero module is ported; returns xero_results: [] for now.)
async function createDevelopment(args: Args, user: AuthUser): Promise<unknown> {
  const developmentData = args.developmentData as Record<string, unknown> | undefined;
  if (!developmentData) return { error: 'developmentData is required' };
  const now = new Date().toISOString();

  let code: number;
  const c = await query<{ id: string; value: number }>(`SELECT id, value FROM "app_counter" WHERE key = 'next_development_code' LIMIT 1`);
  if (c.rowCount === 0) {
    code = 200;
    await query(`INSERT INTO "app_counter" (id, key, value, created_date, updated_date) VALUES ($1, 'next_development_code', 201, $2, $2)`, [newId(), now]);
  } else {
    code = Number(c.rows[0].value);
    await query(`UPDATE "app_counter" SET value = $1, updated_date = $2 WHERE id = $3`, [code + 1, now, c.rows[0].id]);
  }

  const newDev = await insertRow('development', { ...developmentData, development_code: String(code) }, user);
  await insertRow('gsd_action_log', {
    development_id: newDev.id, development_name: newDev.name,
    name: 'CheckMate', description: 'Auto-generated log for CheckMate checksheet failures',
  }, user);

  return { success: true, development: newDev, development_code: String(code), xero_results: [] };
}

// syncHSECorrectiveActionsToGSD — mirror an incident report's corrective actions into
// the development's Project GSD log (create/update, deduped by report id + action index).
async function getProjectGSDLog(developmentId: string, developmentName: string, user: AuthUser): Promise<{ id: string; name: string }> {
  const logs = await query<{ id: string; name: string; log_type: string | null }>(
    `SELECT id, name, log_type FROM "gsd_action_log" WHERE development_id = $1`, [developmentId]);
  const pl = logs.rows.find((l) => l.log_type === 'project') || logs.rows.find((l) => l.name === 'Project GSD');
  if (pl) return { id: pl.id, name: pl.name };
  const created = await insertRow('gsd_action_log', {
    development_id: developmentId, development_name: developmentName, name: 'Project GSD',
    log_type: 'project', description: 'Running project action log',
  }, user);
  return { id: created.id as string, name: created.name as string };
}

async function syncOneReport(report: Record<string, any>, user: AuthUser): Promise<{ synced: number; skipped: number }> {
  const actions: any[] = Array.isArray(report.corrective_actions) ? report.corrective_actions : [];
  if (actions.length === 0) return { synced: 0, skipped: 0 };
  const projectLog = await getProjectGSDLog(report.development_id, report.development_name || '', user);
  const existing = await query<any>(`SELECT * FROM "gsd_log" WHERE source_incident_report_id = $1`, [report.id]);
  const today = new Date().toISOString().split('T')[0];
  let synced = 0, skipped = 0;
  for (let i = 0; i < actions.length; i++) {
    const ca = actions[i];
    if (!ca?.action || !String(ca.action).trim()) { skipped++; continue; }
    const ex = existing.rows.find((e: any) => e.source_corrective_action_index === i);
    const reportLabel = `${report.report_type || 'HSE'} Report ${report.reference || report.id}`;
    const status = ca.status === 'complete' || ca.completed_date ? 'Closed' : 'In Progress';
    const owner = ca.owner || ca.assigned_to_name || '';
    const payload = {
      development_id: report.development_id, development_name: report.development_name || '',
      action_log_id: projectLog.id, action_log_name: projectLog.name,
      category: 'Manual', project_category: 'Safety', topic_area: reportLabel,
      summary: `${reportLabel}: ${ca.action}`, action_decision: ca.action, owner,
      assigned_to_employee_id: ca.assigned_to_employee_id ?? null,
      assigned_to_name: ca.assigned_to_name || ca.owner || null,
      target_date: ca.due_date ?? null, status, last_updated: today,
      source_incident_report_id: report.id, source_corrective_action_index: i,
    };
    if (ex) {
      const changed = ex.action_decision !== payload.action_decision || ex.owner !== payload.owner ||
        ex.assigned_to_employee_id !== payload.assigned_to_employee_id || ex.target_date !== payload.target_date || ex.status !== payload.status;
      if (changed) {
        await query(
          `UPDATE "gsd_log" SET action_decision=$1, summary=$2, owner=$3, assigned_to_employee_id=$4, assigned_to_name=$5, target_date=$6, status=$7, last_updated=$8, updated_date=$9 WHERE id=$10`,
          [payload.action_decision, payload.summary, payload.owner, payload.assigned_to_employee_id, payload.assigned_to_name, payload.target_date, payload.status, new Date().toISOString(), ex.id],
        );
        synced++;
      } else skipped++;
    } else {
      await insertRow('gsd_log', payload, user);
      synced++;
    }
  }
  return { synced, skipped };
}

async function syncHSECorrectiveActionsToGSD(args: Args, user: AuthUser): Promise<unknown> {
  if (args.report_id) {
    const r = await query<any>(`SELECT * FROM "incident_report" WHERE id = $1 LIMIT 1`, [args.report_id]);
    if (!r.rowCount) return { error: 'Report not found' };
    return { success: true, ...(await syncOneReport(r.rows[0], user)) };
  }
  if (user.role !== 'admin') return { error: 'Admin only for backfill' };
  const reports = await query<any>(`SELECT * FROM "incident_report"`);
  const withActions = reports.rows.filter((r: any) => Array.isArray(r.corrective_actions) && r.corrective_actions.length > 0 && r.development_id);
  let total_synced = 0, total_skipped = 0;
  const results: unknown[] = [];
  for (const rep of withActions) {
    const res = await syncOneReport(rep, user);
    total_synced += res.synced; total_skipped += res.skipped;
    results.push({ report: rep.reference || rep.id, ...res });
  }
  return { success: true, total_reports: withActions.length, total_synced, total_skipped, results };
}

// undeliverPOLineItems — reverse delivery on a PO (full, or selected line indices).
async function undeliverPOLineItems(args: Args, user: AuthUser): Promise<unknown> {
  if (user.role !== 'admin') {
    const u = await query<{ can_match_invoice: boolean | null }>(`SELECT can_match_invoice FROM "user" WHERE lower(email) = lower($1) LIMIT 1`, [user.email ?? '']);
    if (!u.rows[0]?.can_match_invoice) return { error: 'Forbidden: ProcureIT Admin access required' };
  }
  const po_id = args.po_id as string | undefined;
  const indices = args.line_item_indices as number[] | undefined;
  if (!po_id) return { error: 'po_id is required' };
  const po = await query<any>(`SELECT * FROM "purchase_order" WHERE id = $1 LIMIT 1`, [po_id]);
  if (!po.rowCount) return { error: 'PO not found' };
  const poRow = po.rows[0];
  const mi = await query(`SELECT 1 FROM "purchase_invoice" WHERE purchase_order_id = $1 LIMIT 1`, [po_id]);
  if (mi.rowCount) return { error: 'Cannot undeliver PO with matched invoices' };
  const now = new Date().toISOString();

  if (!indices || indices.length === 0) {
    const li = await query<{ id: string }>(`SELECT id FROM "purchase_order_line_item" WHERE purchase_order_id = $1`, [po_id]);
    for (const it of li.rows) {
      await query(`UPDATE "purchase_order_line_item" SET quantity_delivered=0, delivered_value=0, quantity_to_stock=0, updated_date=$1 WHERE id=$2`, [now, it.id]);
    }
    await query(
      `UPDATE "purchase_order" SET status='po_raised', delivered_value=0, outstanding_value=$1, invoice_matched_date=NULL, xero_sync_status='pending', updated_date=$2 WHERE id=$3`,
      [Number(poRow.total_value) || 0, now, po_id],
    );
    return { success: true, message: 'PO fully undelivered', po_id, line_items_reset: li.rowCount };
  }
  const items: any[] = Array.isArray(poRow.extracted_line_items) ? poRow.extracted_line_items : [];
  const valid = indices.filter((i) => i >= 0 && i < items.length);
  if (valid.length === 0) return { error: 'Invalid line item indices' };
  const updated = items.map((it, idx) => (valid.includes(idx) ? { ...it, _undelivered: true } : it));
  const totalDelivered = updated.filter((_, idx) => !valid.includes(idx)).reduce((s, it) => s + (Number(it.total_value) || 0), 0);
  await query(`UPDATE "purchase_order" SET extracted_line_items=$1, delivered_value=$2, xero_sync_status='pending', updated_date=$3 WHERE id=$4`, [JSON.stringify(updated), totalDelivered, now, po_id]);
  return { success: true, message: `${valid.length} line item(s) undelivered`, po_id, undelivered_count: valid.length };
}

// updateJ5UserCell — admin: assign a user's Johnny5 cell.
async function updateJ5UserCell(args: Args, user: AuthUser): Promise<unknown> {
  if (user.role !== 'admin') return { error: 'Forbidden' };
  const userId = args.userId as string | undefined;
  if (!userId) return { error: 'userId required' };
  await query(`UPDATE "user" SET johnny5_cell_id = $1, johnny5_cell_name = $2, updated_date = $3 WHERE id = $4`,
    [(args.johnny5_cell_id ?? null) as unknown, (args.johnny5_cell_name ?? null) as unknown, new Date().toISOString(), userId]);
  return { success: true };
}

// reclassifyInvoiceToSubcontractor — move a supply-chain PO to subcontractor and add it
// to the development's payment pack for the invoice period (creating the pack if needed).
async function reclassifyInvoiceToSubcontractor(args: Args, user: AuthUser): Promise<unknown> {
  if (user.role !== 'admin') {
    const u = await query<{ can_match_invoice: boolean | null }>(`SELECT can_match_invoice FROM "user" WHERE lower(email) = lower($1) LIMIT 1`, [user.email ?? '']);
    if (!u.rows[0]?.can_match_invoice) return { error: 'Forbidden: ProcureIT Admin access required' };
  }
  const po_id = args.po_id as string | undefined;
  const development_package_id = args.development_package_id as string | undefined;
  if (!po_id || !development_package_id) return { error: 'Missing po_id or development_package_id' };

  const poR = await query<any>(`SELECT * FROM "purchase_order" WHERE id = $1 LIMIT 1`, [po_id]);
  if (!poR.rowCount) return { error: 'PO not found' };
  const po = poR.rows[0];
  if (po.invoice_type !== 'supply_chain') return { error: 'PO is not a supply chain invoice' };

  const dpR = await query<any>(`SELECT * FROM "development_package" WHERE id = $1 LIMIT 1`, [development_package_id]);
  if (!dpR.rowCount) return { error: 'Development package not found' };
  const dp = dpR.rows[0];
  const dpRef = dp.package_reference || dp.package_category_name || '';
  const dpName = dp.package_category_name || dp.package_reference || '';
  const now = new Date().toISOString();

  await query(`UPDATE "purchase_order" SET invoice_type='subcontractor', subcontractor_development_package_id=$1, subcontractor_development_package_reference=$2, updated_date=$3 WHERE id=$4`,
    [development_package_id, dpRef, now, po_id]);

  const invDate = new Date(po.invoice_date || now);
  const period = `${invDate.getUTCFullYear()}-${String(invDate.getUTCMonth() + 1).padStart(2, '0')}`;
  const ppR = await query<any>(`SELECT * FROM "payment_pack" WHERE development_id = $1 AND period = $2 LIMIT 1`, [po.development_id, period]);
  const pp = ppR.rowCount
    ? ppR.rows[0]
    : await insertRow('payment_pack', {
        development_id: po.development_id, development_name: po.development_name, period, status: 'draft',
        generated_by: user.email, generated_date: now, total_amount_claimed: 0, total_retention: 0, total_net_payable: 0,
      }, user);

  const li = await insertRow('payment_pack_line_item', {
    payment_pack_id: pp.id, purchase_order_id: po_id, subcontractor_name: po.supplier_name, subcontractor_id: po.supplier_id,
    purchase_order_number: po.po_number, development_package_id, package_name: dpName,
    total_contract_value: po.total_value, amount_claimed_this_period: po.invoiced_value || 0, cumulative_claimed: po.invoiced_value || 0,
    certification_status: 'pending', invoice_status: 'pending', xero_sync_status: 'pending',
  }, user);

  return { success: true, message: 'Invoice reclassified to subcontractor and added to payment pack', po_id, payment_pack_id: pp.id, line_item_id: li.id };
}

// clearJ5Data — admin (+ PIN): wipe a development's manufacturing jobs, check responses
// and delivery jobs, and reset its manufacture_started flag.
async function clearJ5Data(args: Args, user: AuthUser): Promise<unknown> {
  if (user.role !== 'admin') return { error: 'Forbidden: Admin access required' };
  const development_id = args.development_id as string | undefined;
  if (!development_id) return { error: 'development_id is required' };
  if (args.pin !== '6370') return { error: 'Invalid PIN' };
  const resp = await query(`DELETE FROM "j5_check_response" WHERE manufacturing_job_id IN (SELECT id FROM "manufacturing_job" WHERE development_id = $1)`, [development_id]);
  const jobs = await query(`DELETE FROM "manufacturing_job" WHERE development_id = $1`, [development_id]);
  const deliv = await query(`DELETE FROM "delivery_job" WHERE development_id = $1`, [development_id]);
  await query(`UPDATE "development" SET manufacture_started=false, manufacture_started_at=NULL, manufacture_started_by=NULL, updated_date=$1 WHERE id=$2`, [new Date().toISOString(), development_id]);
  const dj = jobs.rowCount ?? 0, dr = resp.rowCount ?? 0, dd = deliv.rowCount ?? 0;
  return { success: true, deleted_jobs: dj, deleted_responses: dr, deleted_delivery_jobs: dd, message: `Cleared ${dj} manufacturing jobs, ${dr} check responses and ${dd} delivery jobs` };
}

// certifyAllPaymentPackLineItems — certify every matched/uploaded line in a pack.
async function certifyAllPaymentPackLineItems(args: Args, user: AuthUser): Promise<unknown> {
  const payment_pack_id = args.payment_pack_id as string | undefined;
  if (!payment_pack_id) return { error: 'payment_pack_id required' };
  const items = await query<any>(`SELECT id, certification_status, invoice_status FROM "payment_pack_line_item" WHERE payment_pack_id = $1`, [payment_pack_id]);
  const now = new Date().toISOString();
  let certified = 0;
  for (const it of items.rows) {
    if (it.certification_status !== 'certified' && (it.invoice_status === 'matched' || it.invoice_status === 'uploaded')) {
      await query(`UPDATE "payment_pack_line_item" SET certification_status='certified', certified_by=$1, certified_at=$2, updated_date=$2 WHERE id=$3`, [user.email, now, it.id]);
      certified++;
    }
  }
  return { success: true, message: `Certified ${certified} line item${certified !== 1 ? 's' : ''}`, certified_count: certified };
}

// certifySubcontractorPayment — certify (creates a subcontractor PO + closes the pack when
// all lines done) or query a payment pack line item.
async function certifySubcontractorPayment(args: Args, user: AuthUser): Promise<unknown> {
  const id = args.payment_pack_line_item_id as string | undefined;
  const action = args.action as string | undefined;
  if (!id || !action) return { error: 'Missing required parameters' };
  if (!['certify', 'query'].includes(action)) return { error: 'Invalid action' };
  const liR = await query<any>(`SELECT * FROM "payment_pack_line_item" WHERE id = $1 LIMIT 1`, [id]);
  if (!liR.rowCount) return { error: 'Line item not found' };
  const lineItem = liR.rows[0];
  const now = new Date().toISOString();

  if (action === 'query') {
    await query(`UPDATE "payment_pack_line_item" SET certification_status='queried', invoice_status='queried', query_notes=$1, updated_date=$2 WHERE id=$3`, [args.query_notes || '', now, id]);
    return { success: true, message: 'Payment queried' };
  }

  const ppR = await query<any>(`SELECT * FROM "payment_pack" WHERE id = $1 LIMIT 1`, [lineItem.payment_pack_id]);
  const paymentPack = ppR.rows[0];
  if (!paymentPack) return { error: 'Payment pack not found' };

  if (!lineItem.invoice_status || lineItem.invoice_status === 'pending' || (Number(lineItem.net_total_payable) || 0) === 0) {
    const preserved = lineItem.previously_claimed || lineItem.cumulative_claimed || 0;
    await query(`UPDATE "payment_pack_line_item" SET certification_status='certified', certified_by=$1, certified_at=$2, invoice_status=$3, cumulative_claimed=$4, updated_date=$2 WHERE id=$5`, [user.email, now, lineItem.invoice_status || 'pending', preserved, id]);
  }

  const devR = await query<any>(`SELECT * FROM "development" WHERE id = $1 LIMIT 1`, [paymentPack.development_id]);
  if (!devR.rowCount) return { error: 'Development not found' };
  const dev = devR.rows[0];
  const seqR = await query<{ n: number }>(`SELECT count(*)::int AS n FROM "purchase_order" WHERE development_id=$1 AND invoice_type='subcontractor'`, [paymentPack.development_id]);
  const seq = Number(seqR.rows[0].n) + 1;
  const compR = await query<{ po_prefix: string | null }>(`SELECT po_prefix FROM "company" WHERE id = $1 LIMIT 1`, [dev.company_id]);
  const prefix = compR.rows[0]?.po_prefix || dev.development_code;
  const poNumber = `${prefix}-${dev.development_code}-${String(paymentPack.period).split('-')[1]}-${String(seq).padStart(4, '0')}`;
  const uR = await query<{ full_name: string | null }>(`SELECT full_name FROM "user" WHERE lower(email)=lower($1) LIMIT 1`, [user.email ?? '']);

  const po = await insertRow('purchase_order', {
    company_id: dev.company_id, company_name: dev.company_name, supplier_id: lineItem.subcontractor_id, supplier_name: lineItem.subcontractor_name,
    development_id: paymentPack.development_id, development_name: paymentPack.development_name, po_number: poNumber, status: 'invoiced', invoice_type: 'subcontractor',
    total_value: lineItem.net_total_payable, delivered_value: lineItem.net_total_payable, outstanding_value: 0,
    supplier_invoice_number: lineItem.invoice_number, invoice_date: lineItem.invoice_date, invoice_file_url: lineItem.invoice_file_url,
    invoiced_value: lineItem.invoice_value, extracted_line_items: lineItem.extracted_line_items || [],
    raised_date: now.split('T')[0], raised_by: user.email, raised_by_name: uR.rows[0]?.full_name || user.email,
    required_by_date: now.split('T')[0], delivery_address: `Payment Pack ${paymentPack.period}`, xero_sync_status: 'pending',
  }, user);

  await query(`UPDATE "payment_pack_line_item" SET certification_status='certified', certified_by=$1, certified_at=$2, invoice_status='certified', purchase_order_id=$3, purchase_order_number=$4, updated_date=$2 WHERE id=$5`, [user.email, now, po.id, poNumber, id]);

  const allItems = await query<any>(`SELECT id, certification_status FROM "payment_pack_line_item" WHERE payment_pack_id = $1`, [lineItem.payment_pack_id]);
  const allCertified = allItems.rows.every((li: any) => li.id === id || li.certification_status === 'certified');
  if (allCertified) await query(`UPDATE "payment_pack" SET status='closed', updated_date=$1 WHERE id=$2`, [now, lineItem.payment_pack_id]);

  return { success: true, message: 'Payment certified', purchase_order_id: po.id, purchase_order_number: poNumber };
}

// populateTimesheetFromSignIns — fill a timesheet's daily hours from sign-in/out records.
const TS_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
function tsMinutes(hhmm: string): number { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; }
function tsShiftHours(signIn: string, signOut: string, shift: any): number {
  const shiftStart = tsMinutes(shift.start_time), shiftEnd = tsMinutes(shift.end_time);
  const si = new Date(signIn), so = new Date(signOut);
  const siMin = si.getHours() * 60 + si.getMinutes(), soMin = so.getHours() * 60 + so.getMinutes();
  let effStart = shiftStart, effEnd = shiftEnd;
  if (siMin - shiftStart >= 15) effStart = siMin;
  if (shiftEnd - soMin >= 15) effEnd = soMin;
  const worked = effEnd - effStart;
  if (worked <= 0) return 0;
  return Math.min(worked / 60, Number(shift.max_hours));
}
async function populateTimesheetFromSignIns(args: Args): Promise<unknown> {
  const timesheet_id = args.timesheet_id as string | undefined;
  if (!timesheet_id) return { error: 'timesheet_id required' };
  const tsR = await query<any>(`SELECT * FROM "timesheet" WHERE id = $1 LIMIT 1`, [timesheet_id]);
  if (!tsR.rowCount) return { error: 'Timesheet not found' };
  const timesheet = tsR.rows[0];
  const shiftsR = await query<any>(`SELECT * FROM "shift" WHERE development_id = $1`, [timesheet.development_id]);
  if (!shiftsR.rowCount) return { error: 'No shifts configured for this development', updated: 0 };
  const shifts = shiftsR.rows;

  const weekEndDate = new Date(timesheet.week_ending_date);
  const weekEndDay = weekEndDate.getDay();
  const daysFromMonday = weekEndDay === 0 ? 6 : weekEndDay - 1;
  const weekStartDate = new Date(weekEndDate); weekStartDate.setDate(weekEndDate.getDate() - daysFromMonday);
  const weekDays: Record<string, Date> = {};
  for (let i = 0; i < 7; i++) { const d = new Date(weekStartDate); d.setDate(weekStartDate.getDate() + i); weekDays[TS_DAYS[d.getDay()]] = d; }

  const entriesR = await query<any>(`SELECT * FROM "timesheet_entry" WHERE timesheet_id = $1`, [timesheet_id]);
  if (!entriesR.rowCount) return { error: 'No entries in timesheet', updated: 0 };
  const signInsR = await query<any>(`SELECT * FROM "sign_in_record" WHERE development_id = $1`, [timesheet.development_id]);
  const weekStart = new Date(weekStartDate); weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekEndDate); weekEnd.setHours(23, 59, 59, 999);
  const weekSignIns = signInsR.rows.filter((r: any) => { const t = new Date(r.sign_in_time); return t >= weekStart && t <= weekEnd && r.sign_out_time; });

  const cols = await tableCols('timesheet_entry');
  let updated = 0;
  for (const entry of entriesR.rows) {
    const upd: Record<string, unknown> = {};
    let hasAny = false;
    for (const [dayName, dayDate] of Object.entries(weekDays)) {
      const dow = dayDate.getDay();
      const shift = shifts.find((s: any) => Array.isArray(s.days_of_week) && s.days_of_week.includes(dow));
      if (!shift) continue;
      const dayStr = dayDate.toISOString().split('T')[0];
      const dayRecords = weekSignIns.filter((r: any) => new Date(r.sign_in_time).toISOString().split('T')[0] === dayStr && r.visitor_name?.toLowerCase() === entry.employee_name?.toLowerCase());
      if (dayRecords.length === 0) continue;
      const earliest = dayRecords.reduce((a: any, b: any) => (new Date(a.sign_in_time) < new Date(b.sign_in_time) ? a : b));
      const latest = dayRecords.reduce((a: any, b: any) => (new Date(a.sign_out_time) > new Date(b.sign_out_time) ? a : b));
      const hrs = Math.round(tsShiftHours(earliest.sign_in_time, latest.sign_out_time, shift) * 4) / 4;
      upd[`${dayName}_sign_in_hours`] = hrs;
      upd[`${dayName}_hours`] = hrs;
      hasAny = true;
    }
    if (hasAny && entry.id) {
      const keys = Object.keys(upd).filter((k) => cols.has(k));
      if (keys.length) {
        upd['updated_date'] = new Date().toISOString(); keys.push('updated_date');
        await query(`UPDATE "timesheet_entry" SET ${keys.map((k, i) => `"${k}"=$${i + 1}`).join(', ')} WHERE id=$${keys.length + 1}`, [...keys.map((k) => upd[k]), entry.id]);
        updated++;
      }
    }
  }
  return { success: true, updated, sign_ins_found: weekSignIns.length, week_range: `${weekStart.toISOString().split('T')[0]} to ${weekEnd.toISOString().split('T')[0]}`, message: `Updated ${updated} timesheet entries from ${weekSignIns.length} sign-in records` };
}

// autoCreateCVRPackages — top up a development with a DevelopmentPrelim / DevelopmentProfessionalFee
// record for every GLOBAL prelim/fee type it doesn't already have. Idempotent.
async function autoCreateCVRPackages(args: Args, user: AuthUser): Promise<unknown> {
  const developmentId = (args.developmentId || (args.event as any)?.entity_id) as string | undefined;
  if (!developmentId) return { error: 'developmentId required' };
  const dev = await query(`SELECT id FROM "development" WHERE id = $1 LIMIT 1`, [developmentId]);
  if (!dev.rowCount) return { error: 'Development not found' };
  const prelimTypes = await query<any>(`SELECT id, name, heading_id, heading_name FROM "prelim_cost_type" WHERE development_id IS NULL OR development_id = ''`);
  const feeTypes = await query<any>(`SELECT id, name FROM "professional_fee_type" WHERE development_id IS NULL OR development_id = ''`);
  const exP = await query<{ cost_type_id: string }>(`SELECT cost_type_id FROM "development_prelim" WHERE development_id = $1`, [developmentId]);
  const exF = await query<{ fee_type_id: string }>(`SELECT fee_type_id FROM "development_professional_fee" WHERE development_id = $1`, [developmentId]);
  const haveP = new Set(exP.rows.map((r) => r.cost_type_id));
  const haveF = new Set(exF.rows.map((r) => r.fee_type_id));
  const prelimsToCreate = prelimTypes.rows.filter((ct: any) => !haveP.has(ct.id));
  const feesToCreate = feeTypes.rows.filter((pf: any) => !haveF.has(pf.id));
  for (const ct of prelimsToCreate) {
    await insertRow('development_prelim', { development_id: developmentId, cost_type_id: ct.id, cost_type_name: ct.name, heading_id: ct.heading_id, heading_name: ct.heading_name, budget_cost: 0 }, user);
  }
  for (const pf of feesToCreate) {
    await insertRow('development_professional_fee', { development_id: developmentId, fee_type_id: pf.id, fee_type_name: pf.name, budget_cost: 0 }, user);
  }
  await query(`UPDATE "development" SET cvr_packages_provisioned=true, cvr_packages_provisioned_at=$1, cvr_packages_provisioned_by=$2, updated_date=$1 WHERE id=$3`,
    [new Date().toISOString(), (args.triggered_by as string) || 'automation', developmentId]);
  return { success: true, skipped: false, prelimsCreated: prelimsToCreate.length, feesCreated: feesToCreate.length };
}

// instantiatePlotMeasuredWorks — clone template measured-work items onto plots (qty/rate/total 0).
async function instantiatePlotMeasuredWorks(args: Args, user: AuthUser): Promise<unknown> {
  const development_id = args.development_id as string | undefined;
  if (!development_id) return { error: 'development_id is required' };
  const plotsToProcess = (args.plot_ids as string[] | undefined) || (args.plot_id ? [args.plot_id as string] : []);
  if (plotsToProcess.length === 0) return { error: 'plot_id or plot_ids is required' };
  const allItems = await query<any>(`SELECT * FROM "measured_work_master_item" WHERE development_id = $1`, [development_id]);
  const templates = allItems.rows.filter((i: any) => i.is_template === true);
  if (templates.length === 0) return { success: true, created: 0, message: 'No template items found — nothing to instantiate' };
  let totalCreated = 0;
  for (const pid of plotsToProcess) {
    if (allItems.rows.some((i: any) => i.plot_id === pid)) continue;
    for (const t of templates) {
      await insertRow('measured_work_master_item', {
        development_id, plot_id: pid, is_template: false, category: t.category || '', subcategory: t.subcategory || '',
        reference_number: t.reference_number || '', name: t.name, unit: t.unit, quantity: 0, rate: 0, total_value: 0,
        sort_order: t.sort_order || 0, is_subcategory_header: t.is_subcategory_header || false,
      }, user);
      totalCreated++;
    }
  }
  return { success: true, created: totalCreated, message: `Created ${totalCreated} measured work items across ${plotsToProcess.length} plot(s)` };
}

// deleteMyAccount — delete the signed-in user's own account record (login/profile only).
async function deleteMyAccount(_args: Args, user: AuthUser): Promise<unknown> {
  await query(`DELETE FROM "user" WHERE lower(email) = lower($1)`, [user.email ?? '']);
  return { success: true };
}

// approveApiToken — admin: approve (mints a token), reject, or revoke an API token request.
async function approveApiToken(args: Args, user: AuthUser): Promise<unknown> {
  if (user.role !== 'admin') return { error: 'Admin access required' };
  const token_id = args.token_id as string | undefined;
  const action = args.action as string | undefined;
  if (!token_id || !action) return { error: 'token_id and action are required' };
  if (!['approve', 'reject', 'revoke'].includes(action)) return { error: 'action must be approve, reject, or revoke' };
  const rec = await query<any>(`SELECT * FROM "api_token" WHERE id = $1 LIMIT 1`, [token_id]);
  if (!rec.rowCount) return { error: 'Token request not found' };
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { notes: (args.notes as string) ?? rec.rows[0].notes, updated_date: now };
  let generatedToken: string | null = null;
  if (action === 'approve') {
    generatedToken = 'ssg_' + crypto.randomBytes(32).toString('hex');
    updates.status = 'approved'; updates.token = generatedToken; updates.approved_by = user.email; updates.approved_date = now;
  } else if (action === 'reject') {
    updates.status = 'rejected';
  } else {
    updates.status = 'revoked'; updates.token = null;
  }
  const keys = Object.keys(updates);
  await query(`UPDATE "api_token" SET ${keys.map((k, i) => `"${k}"=$${i + 1}`).join(', ')} WHERE id=$${keys.length + 1}`, [...keys.map((k) => updates[k]), token_id]);
  return { success: true, message: `Token ${action}d successfully`, ...(generatedToken ? { token: generatedToken } : {}) };
}

// Read the first sheet of an Excel file (by URL) into an array of row-arrays.
async function readSheetRows(file_url: string): Promise<any[][]> {
  const res = await fetch(file_url);
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
  const wb = XLSX.read(Buffer.from(await res.arrayBuffer()), { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
}

// importPrelims — load prelim cost items from an Excel file (ref, heading, description, qty, unit, rate).
async function importPrelims(args: Args, user: AuthUser): Promise<unknown> {
  const file_url = args.file_url as string | undefined;
  const development_id = args.development_id as string | undefined;
  if (!file_url || !development_id) return { error: 'Missing file_url or development_id' };
  const data = await readSheetRows(file_url);
  const devR = await query<{ development_code: string | null }>(`SELECT development_code FROM "development" WHERE id=$1 LIMIT 1`, [development_id]);
  const devCode = devR.rows[0]?.development_code || '000';
  const hR = await query<{ id: string; name: string | null }>(`SELECT id, name FROM "prelim_heading" ORDER BY sort_order`);
  const headingMap = new Map<string, string>();
  for (const h of hR.rows) headingMap.set((h.name || '').toUpperCase(), h.id);
  const getHeading = async (nm: string | null): Promise<string | null> => {
    if (!nm) return null;
    const key = nm.toUpperCase();
    if (headingMap.has(key)) return headingMap.get(key)!;
    const created = await insertRow('prelim_heading', { name: nm, sort_order: headingMap.size + 1 }, user);
    headingMap.set(key, created.id as string);
    return created.id as string;
  };
  const serialToMonthYear = (serial: number) => new Date(Math.round((serial - 25569) * 86400 * 1000)).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  let counter = 1, imported = 0;
  const failures: any[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;
    const reference_number = row[0] != null ? String(row[0]).trim() : '';
    const headingName = row[1] != null ? String(row[1]).trim() : '';
    const rawName = row[2] != null ? String(row[2]).trim() : '';
    const quantity = parseFloat(row[3]) || 0;
    const unit = row[4] != null ? String(row[4]).trim() || 'item' : 'item';
    const rate = parseFloat(row[5]) || 0;
    const total = quantity * rate;
    const numericVal = parseFloat(rawName);
    const name = !isNaN(numericVal) && /^\d+$/.test(rawName) && numericVal > 40000 ? serialToMonthYear(numericVal) : rawName;
    if (!name || !rate) continue;
    const heading_id = await getHeading(headingName || null);
    try {
      await insertRow('prelim_cost_item', { development_id, reference_number: reference_number || `${devCode}-PFS-${String(counter).padStart(2, '0')}`, name, unit, quantity, rate, total, prelim_heading_id: heading_id, sort_order: i }, user);
      imported++;
    } catch (e: any) { failures.push({ reference: reference_number || '—', name, reason: e.message || 'Unknown error' }); }
    counter++;
  }
  return { success: true, imported, failed: failures.length, failures, message: `Imported ${imported} prelim item(s)${failures.length > 0 ? `, ${failures.length} failed` : ''}` };
}

// importProfessionalFees — load professional fee items from an Excel file (ref, description, fee type, unit, qty, rate).
async function importProfessionalFees(args: Args, user: AuthUser): Promise<unknown> {
  const file_url = args.file_url as string | undefined;
  const development_id = args.development_id as string | undefined;
  if (!file_url || !development_id) return { error: 'Missing file_url or development_id' };
  const data = await readSheetRows(file_url);
  const ftR = await query<{ id: string; name: string | null }>(`SELECT id, name FROM "professional_fee_type" WHERE development_id=$1 ORDER BY sort_order`, [development_id]);
  const typeMap = new Map<string, string>();
  for (const ft of ftR.rows) typeMap.set((ft.name || '').toUpperCase(), ft.id);
  const getType = async (nm: string | null): Promise<string | null> => {
    if (!nm) return null;
    const key = nm.toUpperCase();
    if (typeMap.has(key)) return typeMap.get(key)!;
    const created = await insertRow('professional_fee_type', { name: nm, development_id, sort_order: typeMap.size + 1 }, user);
    typeMap.set(key, created.id as string);
    return created.id as string;
  };
  let imported = 0;
  const failures: any[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;
    const name = row[1] != null ? String(row[1]).trim() : '';
    const feeTypeName = row[2] != null ? String(row[2]).trim() : '';
    const unit = row[3] != null ? String(row[3]).trim() || 'sum' : 'sum';
    const quantity = parseFloat(row[4]) || 1;
    const rate = parseFloat(row[5]) || 0;
    const total = quantity * rate;
    if (!name || !rate) continue;
    const fee_type_id = await getType(feeTypeName || null);
    try {
      await insertRow('professional_fee_item', { development_id, name, unit, quantity, rate, total, professional_fee_type_id: fee_type_id, sort_order: i }, user);
      imported++;
    } catch (e: any) { failures.push({ name, reason: e.message || 'Unknown error' }); }
  }
  return { success: true, imported, failed: failures.length, failures, message: `Imported ${imported} item(s)${failures.length > 0 ? `, ${failures.length} failed` : ''}` };
}

// ---- Budget auto-provision ---------------------------------------------------
// Shared: recompute a work_items array, replacing/adding the single is_provision item.
function withProvision(workItems: any[], provisionValue: number, reference: string, extra: Record<string, unknown> = {}): any[] {
  const idx = workItems.findIndex((wi) => wi?.is_provision === true);
  if (idx >= 0) {
    return workItems.map((wi, i) => (i === idx ? { ...wi, value: provisionValue, description: 'Auto Provision to Budget', classification: 'Provisions' } : wi));
  }
  return [...workItems, { reference, description: 'Auto Provision to Budget', classification: 'Provisions', value: provisionValue, is_provision: true, ...extra }];
}
function sumItems(items: any[], predicate: (i: any) => boolean = () => true): number {
  return items.filter(predicate).reduce((s, i) => s + (Number(i?.value) || 0), 0);
}
async function updateWorkItems(table: string, id: string, workItems: any[], total?: number): Promise<void> {
  const cols = await tableCols(table);
  const sets: string[] = ['work_items = $1'];
  const vals: unknown[] = [JSON.stringify(workItems)];
  if (total !== undefined && cols.has('total_package_value')) { vals.push(total); sets.push(`total_package_value = $${vals.length}`); }
  vals.push(new Date().toISOString()); sets.push(`updated_date = $${vals.length}`);
  vals.push(id);
  await query(`UPDATE "${table}" SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
}

// autoProvisionWorkPackages — top every work package (or its linked development packages)
// up to its locked budget with a single "Auto Provision to Budget" line item. Idempotent.
async function autoProvisionWorkPackages(args: Args, user: AuthUser): Promise<unknown> {
  if (user.role !== 'admin') {
    const u = await query<{ can_manage_budgets: boolean | null }>(`SELECT can_manage_budgets FROM "user" WHERE lower(email)=lower($1) LIMIT 1`, [user.email ?? '']);
    if (!u.rows[0]?.can_manage_budgets) return { error: 'Forbidden: Budget management permission required' };
  }
  const developmentId = args.developmentId as string | undefined;
  if (!developmentId) return { error: 'developmentId is required' };
  const devR = await query<any>(`SELECT * FROM "development" WHERE id = $1 LIMIT 1`, [developmentId]);
  if (!devR.rowCount) return { error: 'Development not found' };
  const development = devR.rows[0];
  if (!development.budget_locked) return { error: 'Budget must be locked before running Auto Provision' };

  const wpR = await query<any>(`SELECT * FROM "work_package" WHERE development_id = $1`, [developmentId]);
  const dpR = await query<any>(`SELECT * FROM "development_package" WHERE development_id = $1`, [developmentId]);
  const workPackages = wpR.rows, devPackages = dpR.rows;

  let updated = 0, created = 0;
  for (const wp of workPackages) {
    const budget = Number(wp.budget_cost) || 0;
    const linked = devPackages.filter((dp: any) => dp.work_package_id === wp.id);

    if (linked.length === 0 && budget > 0) {
      const workItems: any[] = Array.isArray(wp.work_items) ? wp.work_items : [];
      const allocated = sumItems(workItems);
      const provisionValue = Math.max(0, budget - allocated);
      if (provisionValue > 0) {
        await updateWorkItems('work_package', wp.id, [...workItems, { reference: 'PROV', description: 'Auto Provision to Budget', classification: 'Provisions', value: provisionValue, is_provision: true }]);
        created++;
      }
      continue;
    }

    for (const devPkg of linked) {
      const workItems: any[] = Array.isArray(devPkg.work_items) ? devPkg.work_items : [];
      const allocated = sumItems(workItems, (i) => !i?.is_provision);
      const provisionValue = Math.max(0, budget - allocated);
      if (provisionValue <= 0) {
        if (workItems.some((i) => i?.is_provision)) {
          const cleaned = workItems.filter((i) => !i?.is_provision);
          await updateWorkItems('development_package', devPkg.id, cleaned, sumItems(cleaned));
        }
        continue;
      }
      const hadProvision = workItems.some((i) => i?.is_provision);
      const newItems = withProvision(workItems, provisionValue, 'PROV');
      await updateWorkItems('development_package', devPkg.id, newItems, sumItems(newItems));
      if (hadProvision) updated++; else created++;
    }
  }
  return { success: true, message: `Auto Provision complete. ${created} created, ${updated} updated.`, created, updated };
}

// generateAutoProvisionDraft — preview the suggested provisions (no writes) for
// work_packages | prelims | professional_fees.
async function generateAutoProvisionDraft(args: Args): Promise<unknown> {
  const developmentId = args.developmentId as string | undefined;
  const type = args.type as string | undefined;
  if (!developmentId || !type) return { error: 'developmentId and type required' };
  const devR = await query<any>(`SELECT * FROM "development" WHERE id = $1 LIMIT 1`, [developmentId]);
  if (!devR.rowCount) return { error: 'Development not found' };
  const development = devR.rows[0];
  const drafts: any[] = [];

  if (type === 'work_packages') {
    const wpR = await query<any>(`SELECT * FROM "work_package" WHERE development_id = $1`, [developmentId]);
    for (const wp of wpR.rows) {
      const budget = Number(wp.budget_cost) || 0;
      if (budget === 0) continue;
      const items: any[] = Array.isArray(wp.work_items) ? wp.work_items : [];
      const projected = sumItems(items, (i) => !i?.is_provision);
      const existing = Number(items.find((i) => i?.is_provision)?.value) || 0;
      const suggested = Math.max(0, budget - projected);
      if (suggested <= 0) continue;
      drafts.push({ id: wp.id, type: 'work_package', reference: wp.reference || '', name: wp.description || wp.reference || 'Work Package', budget, projected_ex_provision: projected, existing_provision: existing, suggested_provision: suggested, prov_reference: `${development.development_code}-${wp.reference || 'WP'}-PROV01` });
    }
  } else if (type === 'prelims') {
    const dpR = await query<any>(`SELECT * FROM "development_prelim" WHERE development_id = $1`, [developmentId]);
    const ctR = await query<any>(`SELECT id, code FROM "prelim_cost_type" ORDER BY sort_order NULLS LAST`);
    const cts = ctR.rows;
    for (const prelim of dpR.rows) {
      const budget = Number(prelim.budget_cost) || 0;
      if (budget === 0) continue;
      const items: any[] = Array.isArray(prelim.work_items) ? prelim.work_items : [];
      const projected = sumItems(items, (i) => !i?.is_provision);
      const existing = Number(items.find((i) => i?.is_provision)?.value) || 0;
      const suggested = Math.max(0, budget - projected);
      if (suggested <= 0) continue;
      const ctIndex = cts.findIndex((c: any) => c.id === prelim.cost_type_id);
      const ctCode = cts[ctIndex]?.code || (ctIndex >= 0 ? `PR${String(ctIndex + 1).padStart(2, '0')}` : 'PR');
      drafts.push({ id: prelim.id, type: 'prelim', reference: prelim.cost_type_name || '', name: prelim.cost_type_name || 'Prelim', budget, projected_ex_provision: projected, existing_provision: existing, suggested_provision: suggested, cost_type_id: prelim.cost_type_id, prov_reference: `${development.development_code}-${ctCode}-PROV01` });
    }
  } else if (type === 'professional_fees') {
    const dfR = await query<any>(`SELECT * FROM "development_professional_fee" WHERE development_id = $1`, [developmentId]);
    const ftR = await query<any>(`SELECT id, code FROM "professional_fee_type" ORDER BY sort_order NULLS LAST`);
    const fts = ftR.rows;
    for (const devFee of dfR.rows) {
      const budget = Number(devFee.budget_cost) || 0;
      if (budget === 0) continue;
      const items: any[] = Array.isArray(devFee.work_items) ? devFee.work_items : [];
      const projected = sumItems(items, (i) => !i?.is_provision);
      const existing = Number(items.find((i) => i?.is_provision)?.value) || 0;
      const suggested = Math.max(0, budget - projected);
      if (suggested <= 0) continue;
      const ftIndex = fts.findIndex((f: any) => f.id === devFee.fee_type_id);
      const ftCode = fts[ftIndex]?.code || (ftIndex >= 0 ? `PF${String(ftIndex + 1).padStart(2, '0')}` : 'PF');
      drafts.push({ id: devFee.id, type: 'professional_fee', reference: devFee.fee_type_name || '', name: devFee.fee_type_name || 'Professional Fee', budget, projected_ex_provision: projected, existing_provision: existing, suggested_provision: suggested, fee_type_id: devFee.fee_type_id, prov_reference: `${development.development_code}-${ftCode}-PROV01` });
    }
  }
  return { success: true, drafts };
}

// applyAutoProvisions — write the approved provision drafts back, with a BudgetAuditLog entry each.
async function applyAutoProvisions(args: Args, user: AuthUser): Promise<unknown> {
  const developmentId = args.developmentId as string | undefined;
  const provisions = args.provisions as any[] | undefined;
  if (!developmentId || !provisions?.length) return { error: 'developmentId and provisions required' };
  const uR = await query<{ full_name: string | null }>(`SELECT full_name FROM "user" WHERE lower(email)=lower($1) LIMIT 1`, [user.email ?? '']);
  const fullName = uR.rows[0]?.full_name || user.email;
  const now = new Date().toISOString();
  let applied = 0;

  for (const prov of provisions) {
    const newValue = Number(prov.suggested_provision) || 0;
    const map: Record<string, { table: string; itemKey: string }> = {
      work_package: { table: 'work_package', itemKey: 'id' },
      prelim: { table: 'development_prelim', itemKey: 'cost_type_id' },
      professional_fee: { table: 'development_professional_fee', itemKey: 'fee_type_id' },
    };
    const cfg = map[prov.type];
    if (!cfg) continue;
    const rR = await query<any>(`SELECT * FROM "${cfg.table}" WHERE id = $1 LIMIT 1`, [prov.id]);
    if (!rR.rowCount) continue;
    const rec = rR.rows[0];
    const workItems: any[] = Array.isArray(rec.work_items) ? rec.work_items : [];
    const fallbackRef = prov.type === 'work_package' ? `${rec.reference}-${String(workItems.length + 1).padStart(3, '0')}` : 'PROV';
    const extra = prov.type === 'work_package' ? { cost_category: 'Subcontracted', allocated: false } : {};
    const newItems = withProvision(workItems, newValue, prov.prov_reference || fallbackRef, extra);
    await updateWorkItems(cfg.table, prov.id, newItems);
    await insertRow('budget_audit_log', {
      development_id: developmentId, item_type: prov.type, item_id: prov[cfg.itemKey] ?? prov.id, item_name: prov.name,
      old_value: prov.existing_provision, new_value: newValue, reason: 'Auto Provision',
      changed_by: user.email, changed_by_name: fullName, changed_at: now,
    }, user);
    applied++;
  }
  return { success: true, applied };
}

// importMeasuredWorks — import measured-work master items from Excel. Supports 'plot_based'
// (per-plot qty/rate columns + optional Dev Wide) and flat mode (single qty/rate). NOTE:
// the Base44 version also mirrored discovered categories into a generic AppConfig KV row;
// our app_config table is typed (no config_value), so category persistence is skipped here
// (returned under categoriesFound instead).
async function importMeasuredWorks(args: Args, user: AuthUser): Promise<unknown> {
  const file_url = args.file_url as string | undefined;
  const development_id = args.development_id as string | undefined;
  const mode = args.mode as string | undefined;
  const as_template = args.as_template === true;
  if (!file_url || !development_id) return { error: 'Missing file_url or development_id' };
  const data = await readSheetRows(file_url);
  const itemsToCreate: Record<string, unknown>[] = [];
  const categoryMap: Record<string, Set<string>> = {};
  const track = (cat: string, subcat: string) => { if (!cat) return; (categoryMap[cat] ||= new Set()); if (subcat) categoryMap[cat].add(subcat); };
  const cell = (v: any) => (v != null ? String(v).trim() : '');

  if (mode === 'plot_based') {
    if (data.length < 2) return { error: 'File appears empty' };
    const headerRow: any[] = data[0] || [];
    const plotColumns: { qtyColIndex: number; rateColIndex: number | null; plotLabel: string }[] = [];
    for (let c = 5; c < headerRow.length; c++) {
      const header = headerRow[c] ? String(headerRow[c]).trim() : '';
      if (!header) continue;
      const hl = header.toLowerCase();
      if (['dev wide qty', 'dev wide rate', 'dw qty', 'dw rate'].includes(hl)) continue;
      const qtyMatch = header.match(/^(.+?)\s+qty$/i);
      const rateMatch = header.match(/^(.+?)\s+rate$/i);
      if (qtyMatch) {
        const plotLabel = qtyMatch[1].trim();
        const nextHeader = (headerRow[c + 1] || '').toString().trim();
        const nextRateMatch = nextHeader.match(/^(.+?)\s+rate$/i);
        if (nextRateMatch && nextRateMatch[1].trim().toLowerCase() === plotLabel.toLowerCase()) { plotColumns.push({ qtyColIndex: c, rateColIndex: c + 1, plotLabel }); c++; }
        else plotColumns.push({ qtyColIndex: c, rateColIndex: null, plotLabel });
      } else if (!rateMatch) {
        plotColumns.push({ qtyColIndex: c, rateColIndex: null, plotLabel: header });
      }
    }
    const plotsR = await query<any>(`SELECT id, plot_label, plot_number FROM "plot" WHERE development_id = $1`, [development_id]);
    const plotByLabel: Record<string, any> = {};
    for (const p of plotsR.rows) { if (p.plot_label) plotByLabel[String(p.plot_label).toLowerCase()] = p; plotByLabel[`plot ${p.plot_number}`] = p; }
    let devWideQtyCol: number | null = null, devWideRateCol: number | null = null;
    for (let c = 0; c < headerRow.length; c++) {
      const h = (headerRow[c] || '').toString().trim().toLowerCase();
      if (h === 'dev wide qty' || h === 'dw qty') devWideQtyCol = c;
      if (h === 'dev wide rate' || h === 'dw rate') devWideRateCol = c;
    }
    for (let i = 1; i < data.length; i++) {
      const row = data[i]; if (!row) continue;
      const catStr = cell(row[0]), subcatStr = cell(row[1]), referenceNumber = row[2] != null ? String(row[2]) : '';
      const description = cell(row[3]), unit = cell(row[4]) || 'sum';
      if (!description) continue;
      track(catStr, subcatStr);
      const base = { development_id, category: catStr, subcategory: subcatStr, reference_number: referenceNumber, name: description, unit, sort_order: i };
      const devQty = devWideQtyCol !== null ? (parseFloat(row[devWideQtyCol]) || 0) : 0;
      const devRate = devWideRateCol !== null ? (parseFloat(row[devWideRateCol]) || 0) : 0;
      const hasDevWide = devQty > 0 || devRate > 0;
      itemsToCreate.push({ ...base, plot_id: null, is_template: !hasDevWide, quantity: devQty, rate: devRate, total_value: devQty * devRate });
      for (const { qtyColIndex, rateColIndex, plotLabel } of plotColumns) {
        const plot = plotByLabel[plotLabel.toLowerCase()];
        if (!plot) continue;
        const qty = parseFloat(row[qtyColIndex]) || 0;
        const rateValue = rateColIndex !== null ? (parseFloat(row[rateColIndex]) || 0) : 0;
        if (qty === 0 && rateValue === 0) continue;
        itemsToCreate.push({ ...base, plot_id: plot.id, is_template: false, quantity: qty, rate: rateValue, total_value: qty * rateValue });
      }
    }
  } else {
    for (let i = 1; i < data.length; i++) {
      const row = data[i]; if (!row) continue;
      const catStr = cell(row[0]), subcatStr = cell(row[1]), referenceNumber = row[2] != null ? String(row[2]) : '';
      const description = cell(row[3]), unit = cell(row[4]) || 'sum';
      const qty = parseFloat(row[5]) || 0, rateValue = parseFloat(row[6]) || 0;
      if (!description) continue;
      track(catStr, subcatStr);
      itemsToCreate.push({ development_id, plot_id: null, is_template: as_template, category: catStr, subcategory: subcatStr, reference_number: referenceNumber, name: description, unit, quantity: qty, rate: rateValue, total_value: qty * rateValue, sort_order: i });
    }
  }

  for (const item of itemsToCreate) await insertRow('measured_work_master_item', item, user);
  return { success: true, imported: itemsToCreate.length, categoriesFound: Object.keys(categoryMap), message: `Successfully imported ${itemsToCreate.length} measured work items` };
}

// generatePaymentPacks — admin: create a draft PaymentPack (+ a line per approved
// subcontractor DevelopmentPackage) for each development, for the given/next period.
async function generatePaymentPacks(args: Args, user: AuthUser): Promise<unknown> {
  if (user.role !== 'admin') return { error: 'Admin access required' };
  const development_id = args.development_id as string | undefined;
  const customPeriod = args.period as string | undefined;
  const devsR = await query<any>(`SELECT id, name FROM "development"`);
  const pkgsR = await query<any>(`SELECT * FROM "development_package" WHERE status = 'active' AND approval_status = 'approved'`);
  const subPkgs = pkgsR.rows.filter((p: any) => p.supplier_id && p.supplier_name);

  let period = customPeriod;
  if (!period) { const n = new Date(); n.setMonth(n.getMonth() + 1); period = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; }

  const byDev: Record<string, any[]> = {};
  for (const pkg of subPkgs) (byDev[pkg.development_id] ||= []).push(pkg);
  const targetIds = development_id ? [development_id] : Object.keys(byDev);
  const created: string[] = [];
  const now = new Date().toISOString();

  for (const devId of targetIds) {
    const dev = devsR.rows.find((d: any) => d.id === devId);
    if (!dev) continue;
    const exists = await query(`SELECT 1 FROM "payment_pack" WHERE development_id = $1 AND period = $2 LIMIT 1`, [devId, period]);
    if (exists.rowCount) continue;
    const pack = await insertRow('payment_pack', {
      development_id: devId, development_name: dev.name, period, status: 'draft', generated_date: now, generated_by: user.email,
      total_amount_claimed: 0, total_retention: 0, total_net_payable: 0,
    }, user);
    for (const pkg of byDev[devId] || []) {
      const li = await query(`SELECT 1 FROM "payment_pack_line_item" WHERE payment_pack_id = $1 AND development_package_id = $2 LIMIT 1`, [pack.id, pkg.id]);
      if (li.rowCount) continue;
      await insertRow('payment_pack_line_item', {
        payment_pack_id: pack.id, development_package_id: pkg.id, subcontractor_name: pkg.supplier_name, subcontractor_id: pkg.supplier_id,
        package_name: pkg.package_category_name, total_contract_value: pkg.total_package_value || 0, amount_claimed_this_period: 0,
        previously_claimed: 0, cumulative_claimed: 0, in_contract_retention_percentage: pkg.in_contract_retention_percentage || 0,
        cumulative_retention: 0, net_total_payable: 0, invoice_status: 'pending', certification_status: 'pending',
      }, user);
    }
    created.push(pack.id as string);
  }
  return { success: true, message: `Created ${created.length} payment pack(s) for period ${period}`, payment_pack_ids: created };
}

// --- Caller ID lookups (Phone screen) ---------------------------------------
const digits = (s: unknown): string => String(s ?? '').replace(/\D/g, '');
// lookupCaller — exact-match phone lookup across employees, suppliers, residents, owners.
async function lookupCaller(args: Args): Promise<unknown> {
  const phone_number = args.phone_number as string | undefined;
  if (!phone_number) return { error: 'phone_number required' };
  const n = digits(phone_number);
  const emp = await query<any>(`SELECT id, first_name, last_name FROM "employee" WHERE regexp_replace(coalesce(phone,''),'\\D','','g') = $1 LIMIT 1`, [n]);
  if (emp.rowCount) return { id: emp.rows[0].id, type: 'Employee', name: `${emp.rows[0].first_name || ''} ${emp.rows[0].last_name || ''}`.trim() };
  const sup = await query<any>(`SELECT id, company_name FROM "supplier" WHERE regexp_replace(coalesce(phone,''),'\\D','','g') = $1 OR regexp_replace(coalesce(callout_phone,''),'\\D','','g') = $1 LIMIT 1`, [n]);
  if (sup.rowCount) return { id: sup.rows[0].id, type: 'Supplier', name: sup.rows[0].company_name };
  const res = await query<any>(`SELECT id, full_name FROM "resident" WHERE regexp_replace(coalesce(phone,''),'\\D','','g') = $1 LIMIT 1`, [n]);
  if (res.rowCount) return { id: res.rows[0].id, type: 'Resident', name: res.rows[0].full_name };
  const own = await query<any>(`SELECT id, contact_person, company_name FROM "property_owner" WHERE regexp_replace(coalesce(phone,''),'\\D','','g') = $1 LIMIT 1`, [n]);
  if (own.rowCount) return { id: own.rows[0].id, type: 'PropertyOwner', name: own.rows[0].contact_person || own.rows[0].company_name };
  return { match: null };
}

// searchCallerIdentity — partial (contains) phone match; returns a labelled caller or Unknown.
async function searchCallerIdentity(args: Args): Promise<unknown> {
  const phone_number = args.phone_number as string | undefined;
  if (!phone_number) return { error: 'Phone number required' };
  const n = digits(phone_number);
  if (!n) return { id: null, type: null, name: 'Unknown Caller', phone: phone_number };
  const like = `%${n}%`;
  const emp = await query<any>(`SELECT id, first_name, last_name, job_role_name FROM "employee" WHERE regexp_replace(coalesce(phone,''),'\\D','','g') LIKE $1 LIMIT 1`, [like]);
  if (emp.rowCount) return { id: emp.rows[0].id, type: 'Employee', name: `${emp.rows[0].first_name || ''} ${emp.rows[0].last_name || ''}`.trim(), job_role_name: emp.rows[0].job_role_name, phone: phone_number };
  const sup = await query<any>(`SELECT id, company_name FROM "supplier" WHERE regexp_replace(coalesce(phone,''),'\\D','','g') LIKE $1 OR regexp_replace(coalesce(callout_phone,''),'\\D','','g') LIKE $1 LIMIT 1`, [like]);
  if (sup.rowCount) return { id: sup.rows[0].id, type: 'Supplier', name: sup.rows[0].company_name, company_name: sup.rows[0].company_name, phone: phone_number };
  const own = await query<any>(`SELECT id, contact_person, company_name FROM "property_owner" WHERE regexp_replace(coalesce(phone,''),'\\D','','g') LIKE $1 LIMIT 1`, [like]);
  if (own.rowCount) return { id: own.rows[0].id, type: 'PropertyOwner', name: own.rows[0].contact_person || own.rows[0].company_name, phone: phone_number };
  const res = await query<any>(`SELECT id, full_name FROM "resident" WHERE regexp_replace(coalesce(phone,''),'\\D','','g') LIKE $1 LIMIT 1`, [like]);
  if (res.rowCount) return { id: res.rows[0].id, type: 'Resident', name: res.rows[0].full_name, phone: phone_number };
  return { id: null, type: null, name: 'Unknown Caller', phone: phone_number };
}

// deleteUserAccount — delete the signed-in user's own account record.
async function deleteUserAccount(_args: Args, user: AuthUser): Promise<unknown> {
  await query(`DELETE FROM "user" WHERE lower(email) = lower($1)`, [user.email ?? '']);
  return { success: true, message: 'Account deleted successfully' };
}

// checkUserSuspension — is the signed-in user suspended?
async function checkUserSuspension(_args: Args, user: AuthUser): Promise<unknown> {
  const r = await query<{ is_suspended: boolean | null }>(`SELECT is_suspended FROM "user" WHERE lower(email) = lower($1) LIMIT 1`, [user.email ?? '']);
  if (r.rows[0]?.is_suspended) return { suspended: true, message: 'Your access has been suspended. Please contact your administrator.' };
  return { suspended: false };
}

// analyseProgrammeChange — AI picks the tasks directly affected by an instruction, then
// dependency shifts cascade to successors in code (deterministic BFS).
async function analyseProgrammeChange(args: Args): Promise<unknown> {
  const tasks = args.tasks as any[] | undefined;
  const instruction = args.instruction as string | undefined;
  if (!tasks || !instruction) return { error: 'Missing tasks or instruction' };

  const keywords = instruction.toLowerCase().match(/\b[\w]+\b/g) || [];
  const filtered = tasks.filter((t) => { const nm = String(t.name || '').toLowerCase(); return keywords.some((kw) => nm.includes(kw)); });
  const toAnalyze = filtered.length > 0 ? filtered : tasks;
  const taskListText = toAnalyze.map((t) => `UID: ${t.uid} | Name: ${t.name} | Start: ${t.start || 'N/A'} | Finish: ${t.finish || 'N/A'}`).join('\n');
  const prompt = `You are a construction programme assistant. Given the task list and a change instruction, identify ONLY the tasks that are DIRECTLY affected by the instruction (not their dependants - dependency cascading will be handled separately). For each directly affected task, return its UID and how many days to shift it (positive = delay, negative = bring forward).\n\nTASK LIST:\n${taskListText}\n\nCHANGE INSTRUCTION:\n${instruction}`;

  const result: any = await invokeAI({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: { changes: { type: 'array', items: { type: 'object', properties: { uid: { type: 'number' }, name: { type: 'string' }, shiftDays: { type: 'number' }, reason: { type: 'string' } } } } },
    },
  });
  let directChanges: any[];
  if (Array.isArray(result)) directChanges = result;
  else if (result?.changes && Array.isArray(result.changes)) directChanges = result.changes;
  else return { error: 'AI returned unexpected format. Please try again.' };
  if (!directChanges.length) return { changes: [] };

  const successorMap: Record<string, number[]> = {};
  for (const t of tasks) for (const predUid of (t.predecessorUids || [])) (successorMap[predUid] ||= []).push(t.uid);
  const taskByUid: Record<string, any> = {};
  for (const t of tasks) taskByUid[t.uid] = t;

  const shiftMap: Record<string, { shiftDays: number; reason: string }> = {};
  for (const c of directChanges) shiftMap[c.uid] = { shiftDays: c.shiftDays, reason: c.reason };
  const queue = directChanges.map((c) => ({ uid: c.uid, shiftDays: c.shiftDays }));
  const visited = new Set<string>();
  while (queue.length > 0) {
    const { uid, shiftDays } = queue.shift()!;
    const key = `${uid}-${shiftDays}`;
    if (visited.has(key)) continue;
    visited.add(key);
    for (const succUid of (successorMap[uid] || [])) {
      const existing = shiftMap[succUid];
      if (!existing || Math.abs(shiftDays) > Math.abs(existing.shiftDays)) {
        shiftMap[succUid] = { shiftDays, reason: `Cascaded from "${taskByUid[uid]?.name || uid}" (${shiftDays > 0 ? '+' : ''}${shiftDays} days)` };
        queue.push({ uid: succUid, shiftDays });
      }
    }
  }
  const changes = Object.entries(shiftMap).map(([uid, { shiftDays, reason }]) => ({ uid: parseInt(uid, 10), name: taskByUid[uid]?.name || `Task ${uid}`, shiftDays, reason }));
  return { changes };
}

const handlers: Record<string, Handler> = {
  processInvoice: (args) => processInvoice(args),
  getAppConfig: () => getAppConfig(),
  getAppUsers: () => getAppUsers(),
  getGoogleMapsKey: () => getGoogleMapsKey(),
  generateIncidentReference: (args) => generateIncidentReference(args),
  checkCategoryTransactions: (args) => checkCategoryTransactions(args),
  reassignTransactionDevelopment: (args, user) => reassignTransactionDevelopment(args, user),
  createDevelopment: (args, user) => createDevelopment(args, user),
  syncHSECorrectiveActionsToGSD: (args, user) => syncHSECorrectiveActionsToGSD(args, user),
  undeliverPOLineItems: (args, user) => undeliverPOLineItems(args, user),
  updateJ5UserCell: (args, user) => updateJ5UserCell(args, user),
  reclassifyInvoiceToSubcontractor: (args, user) => reclassifyInvoiceToSubcontractor(args, user),
  clearJ5Data: (args, user) => clearJ5Data(args, user),
  certifyAllPaymentPackLineItems: (args, user) => certifyAllPaymentPackLineItems(args, user),
  certifySubcontractorPayment: (args, user) => certifySubcontractorPayment(args, user),
  populateTimesheetFromSignIns: (args) => populateTimesheetFromSignIns(args),
  autoCreateCVRPackages: (args, user) => autoCreateCVRPackages(args, user),
  instantiatePlotMeasuredWorks: (args, user) => instantiatePlotMeasuredWorks(args, user),
  importPrelims: (args, user) => importPrelims(args, user),
  importProfessionalFees: (args, user) => importProfessionalFees(args, user),
  deleteMyAccount: (args, user) => deleteMyAccount(args, user),
  approveApiToken: (args, user) => approveApiToken(args, user),
  autoProvisionWorkPackages: (args, user) => autoProvisionWorkPackages(args, user),
  generateAutoProvisionDraft: (args) => generateAutoProvisionDraft(args),
  applyAutoProvisions: (args, user) => applyAutoProvisions(args, user),
  importMeasuredWorks: (args, user) => importMeasuredWorks(args, user),
  generatePaymentPacks: (args, user) => generatePaymentPacks(args, user),
  lookupCaller: (args) => lookupCaller(args),
  searchCallerIdentity: (args) => searchCallerIdentity(args),
  deleteUserAccount: (args, user) => deleteUserAccount(args, user),
  checkUserSuspension: (args, user) => checkUserSuspension(args, user),
  analyseProgrammeChange: (args) => analyseProgrammeChange(args),
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
