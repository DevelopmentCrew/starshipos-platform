import type { FastifyInstance, FastifyRequest } from 'fastify';
import crypto from 'node:crypto';
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
