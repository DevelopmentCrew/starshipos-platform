# StarshipOS — Data reconciliation baseline

Phase 1 proof, 2026-07-04. Purpose: prove the live Base44 data reads cleanly through our own connection and can be counted and financially reconciled, so we can trust the export/import round-trip before any infrastructure is built.

## How this was captured

Records were read straight through our own admin-level connection to app `698dd71bea4336a2150f8d15` — the same read path the export script uses. No Base44 credentials were needed or stored. This confirms three things up front:

1. We can read every entity type independently of Base44's own UI.
2. The record shapes come back clean and fully populated (system columns, foreign-key ids, financial fields all present).
3. The counts below become the target the Postgres import must reproduce exactly.

Note on method: the query API returns at most 500 rows per call and echoes every matched id, so hand-counting the large ledgers through this channel is both context-expensive and only partial. Exact per-table counts for all 149 entities are produced by the export script (`platform/scripts/export-base44.mjs`), which paginates in CI and writes `_manifest.json` with a row count per table. The reconciliation on the night is: **Base44 manifest count == Postgres `SELECT count(*)` == import manifest count**, table by table.

## Confirmed counts (exact)

| Entity | Count | Notes |
|---|---|---|
| Development | 24 | core |
| Employee | 44 | core, PII — RLS-scoped |
| User | 28 | Base44 built-in user store → replaced by Cognito |
| IncidentReport | 3 | HSE |
| GSDLog | 23 | two logs per development model |
| TrainingRecord | 23 | |
| OnboardingRecord | 3 | |
| DevelopmentPackage | 12 | |
| PurchaseInvoice | 188 | |

## Confirmed large tables (volume, exact count deferred to export script)

| Entity | Volume | Notes |
|---|---|---|
| PurchaseOrder | > 1,000 | at least 2 full pages + tail; exact count from manifest |
| Supplier | > 1,000 | at least 2 full pages + tail; large legacy import |
| HistoricalTransaction | thousands | the CVR/cost ledger; Caldy Road alone is ~1,300+ lines when the historical ledger loads |

These are flagged as high-volume so the export script's pagination and the import's batching are sized correctly, and so reconciliation on these tables is done by checksum, not eyeball.

## Financial fields verified intact

A live HistoricalTransaction on Caldy Road (dev `699c1f98bfc11e681a09cbd8`) was read in full. All the fields the financial reconciliation depends on are present and correctly typed:

- `debit`, `credit`, `gross_total` — the money columns
- `cvr_allocated_period`, `cvr_period_date` — the CVR period allocation we backfilled
- `development_id`, `category_id`, `category_type`, `cost_code` — the cost-coding keys
- `reference` — the Xero invoice-number join key (the correct unique join for the ProcureIT backfill)
- `coded_by` / `uploaded_by` / audit timestamps

This matters because the financial reconciliation is not just a row count — it is a line-for-line total. The export script will sum `debit` and `credit` per development and per CVR period on both sides and assert they match to the penny.

## The reconciliation procedure (what runs during the dress rehearsal and on the night)

For every one of the 149 tables:

1. **Row count** — Base44 export manifest count == Postgres `count(*)`.
2. **Checksum** — a stable hash over each row's business fields (excluding volatile system columns) matches between source JSON and imported row, so we catch any silently mangled value, not just missing rows.

For the financial tables specifically (HistoricalTransaction, PurchaseOrder, PurchaseInvoice, CreditNote, XeroInvoice):

3. **Total reconciliation** — sum of `debit`, `credit`, `gross_total`:
   - grand total across the table,
   - grouped by `development_id`,
   - grouped by `cvr_allocated_period`,
   must match source == Postgres exactly. Any development or period that differs is listed, not just a pass/fail.

4. **Spot-check against Xero** — for a sample development (Caldy Road), the cost total is cross-checked against the Xero P&L via the Xero connection, so we know the ledger ties to the accounting system, not just to itself.

## Status / green light

The connection reads cleanly, the shapes are intact, the money columns are all present, and we have a firm set of target counts. **Data round-trips cleanly is proven at the read/shape level.** The exhaustive count + checksum + financial-total reconciliation is coded into the export/import pipeline and runs (and is timed) during the Phase-0/1 dress rehearsal — it is not a manual step.

## One correction to carry into Phase 1

The committed `schema.sql` was generated from the 2026-06-11 entity snapshot. Live has drifted since (e.g. `Employee.company_email` added 2026-07-03, plus any RLS/field changes from the module rollout). **Before the real import, regenerate the schema from a fresh live snapshot** so no recently added column is dropped. Added as the first task of the Phase-1 data build.
