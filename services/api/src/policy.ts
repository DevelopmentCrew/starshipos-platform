// Row-level authorization policy.
//
// The JWT proves *who* the user is; this module decides *which rows* they may
// see in a given table, from their profile (role, accessible developments,
// module access, employee id, customer id) loaded from the `user` table.
//
// This is the proper, central RLS we wanted after the Base44 `.data` saga:
// one place, driven by the actual columns each table has, plus a small set of
// curated overrides for sensitive and reference data.
import type { AuthUser } from './auth.js';

export interface ScopeResult {
  sql: string; // a WHERE fragment ("" means no restriction)
  params: unknown[]; // params for $1.. used by the fragment
}

const allow = (): ScopeResult => ({ sql: '', params: [] });
const deny = (): ScopeResult => ({ sql: 'WHERE false', params: [] });

// Sensitive tables: admins only, regardless of development access.
const ADMIN_ONLY = new Set<string>([
  'xero_connection', 'xero_invoice', 'xero_invoice_cache', 'xero_sync_log',
  'xero_sync_queue', 'xero_account_code', 'xero_tax_rate',
  'employee_bank_details', 'employee_salary_details', 'employee_salary_audit',
  'employee_compliance_review',
  'api_token', 'user', 'app_config', 'pricing_setting',
  'payment_run', 'payment_pack_line_item', 'creditor_payment_schedule', 'creditor_record',
]);

// Reference / lookup tables: any authenticated user may read.
const REFERENCE = new Set<string>([
  'country', 'company', 'department', 'job_role', 'category', 'gsd_category',
  'check_group', 'check_sheet_category', 'kit_category', 'kit_sub_category',
  'product_category', 'material_category', 'unit_of_measure', 'priority',
  'depreciation_method', 'sales_hub_category', 'sales_hub_market',
  'sales_hub_proposal_type', 'global_package_category', 'help_article',
  'appliance_category', 'appliance_type', 'prelim_cost_type',
  'professional_fee_type', 'property_type', 'manufacturing_cell',
]);

// Tables gated behind a module toggle: user needs module_access.<module> = true.
const MODULE_MAP: Record<string, string> = {
  purchase_order: 'procureit', purchase_order_line_item: 'procureit',
  purchase_invoice: 'procureit', credit_note: 'procureit', supplier: 'procureit',
  procurement_schedule: 'procureit',
  training_record: 'peoplehub', training_module: 'peoplehub',
  training_session: 'peoplehub', training_matrix_rule: 'peoplehub',
  onboarding_record: 'peoplehub', employee: 'peoplehub', employee_note: 'peoplehub',
  employee_contract: 'peoplehub', employee_development_history: 'peoplehub',
  timesheet: 'peoplehub', timesheet_entry: 'peoplehub', shift: 'peoplehub',
  hired_asset: 'kitbag', delivery_job: 'kitbag',
  resident: 'homecare', service_call: 'homecare', visit: 'homecare',
  maintenance_job: 'homecare', maintenance_schedule: 'homecare',
};

/**
 * Build the WHERE fragment for `table`, given the user and the table's columns.
 * Order matters: admin bypass, then sensitive deny, then module gate, then the
 * column-driven scopes, then reference allow, then deny-by-default.
 */
export function scopeFor(table: string, user: AuthUser, cols: Set<string>): ScopeResult {
  if (user.role === 'admin') return allow();

  if (ADMIN_ONLY.has(table)) return deny();

  const mod = MODULE_MAP[table];
  if (mod && !user.moduleAccess?.[mod]) return deny();

  // Development-scoped: the bulk of operational data.
  if (cols.has('development_id')) {
    if (!user.accessibleDevelopments?.length) return deny();
    return { sql: 'WHERE "development_id" = ANY($1)', params: [user.accessibleDevelopments] };
  }

  // Customer-scoped (e.g. HomeCare resident data).
  if (cols.has('customer_id')) {
    if (!user.customerId) return deny();
    return { sql: 'WHERE "customer_id" = $1', params: [user.customerId] };
  }

  // Employee-linked: your own records, unless you hold the relevant module.
  if (cols.has('employee_id')) {
    if (mod && user.moduleAccess?.[mod]) return allow();
    if (!user.employeeId) return deny();
    return { sql: 'WHERE "employee_id" = $1', params: [user.employeeId] };
  }

  // Passed a module gate with no row-scoping column → the module grants access.
  if (mod) return allow();

  // Reference / lookup data.
  if (REFERENCE.has(table)) return allow();

  // Unclassified → deny by default (safe).
  return deny();
}
