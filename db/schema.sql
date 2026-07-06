-- StarshipOS PostgreSQL schema (generated from Base44 entity snapshot)
-- FKs documented in comments, not enforced until data is cleansed.

CREATE TABLE IF NOT EXISTS "api_token" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "app_name" text NOT NULL,
  "contact_email" text NOT NULL,
  "description" text,
  "requested_scopes" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "status" text,
  "token" text,
  "approved_by" text,
  "approved_date" text,
  "last_used" text,
  "notes" text
);

CREATE TABLE IF NOT EXISTS "app_config" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "config_key" text NOT NULL,
  "app_logo_url" text,
  "homecare_logo_url" text,
  "checkmate_logo_url" text,
  "kitbag_logo_url" text,
  "procureit_logo_url" text,
  "mobile_logo_url" text,
  "johnny5_logo_url" text,
  "johnny5_avatar_url" text,
  "po_header_logo_url" text,
  "subcontractor_pack_ageing_start_days" numeric,
  "subcontractor_pack_payment_due_days" numeric
);

CREATE TABLE IF NOT EXISTS "app_counter" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "key" text NOT NULL,
  "value" numeric NOT NULL
);

CREATE TABLE IF NOT EXISTS "app_message" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "to_user_email" text NOT NULL,
  "to_user_name" text,
  "from_user_email" text NOT NULL,
  "from_user_name" text,
  "subject" text,
  "body" text NOT NULL,
  "is_read" boolean DEFAULT false,
  "read_at" text
);

CREATE TABLE IF NOT EXISTS "appliance" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "property_id" text NOT NULL,
  "property_address" text,
  "appliance_type_id" text NOT NULL,
  "manufacturer" text,
  "make" text,
  "model_number" text,
  "category_id" text,
  "category" text,
  "manual_url" text,
  "serial_number" text,
  "reference_number" text,
  "installation_date" date,
  "notes" text
);

CREATE TABLE IF NOT EXISTS "appliance_category" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "name" text NOT NULL,
  "value" text NOT NULL,
  "sort_order" numeric
);

CREATE TABLE IF NOT EXISTS "appliance_type" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "manufacturer" text,
  "make" text NOT NULL,
  "model_number" text NOT NULL,
  "category_id" text,
  "category" text,
  "image_url" text,
  "manual_url" text,
  "notes" text
);

CREATE TABLE IF NOT EXISTS "assembly" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "assembly_code" text NOT NULL,
  "name" text NOT NULL,
  "category" text,
  "measured_unit" text,
  "facade_variant" text,
  "active" boolean DEFAULT true,
  "notes" text,
  "metadata" jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS "assembly_layer" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "assembly_id" text NOT NULL,
  "factor" numeric DEFAULT 1,
  "is_facade" boolean DEFAULT false,
  "layer_order" numeric,
  "layer_type" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "notes" text,
  "rate_code" text,
  "rate_id" text,
  "stage" text,
  "waste_pct" numeric
);

CREATE TABLE IF NOT EXISTS "asset_audit_log" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "asset_type" text NOT NULL,
  "owned_asset_id" text,
  "hired_asset_id" text,
  "action" text NOT NULL,
  "field_changed" text,
  "old_value" text,
  "new_value" text,
  "changed_by_name" text
);

CREATE TABLE IF NOT EXISTS "asset_comment" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "asset_type" text NOT NULL,
  "owned_asset_id" text,
  "hired_asset_id" text,
  "comment" text NOT NULL,
  "document_url" text,
  "document_name" text,
  "created_by_name" text
);

CREATE TABLE IF NOT EXISTS "asset_cost" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "hired_asset_id" text NOT NULL,
  "cost_date" date NOT NULL,
  "description" text,
  "amount" numeric NOT NULL
);

CREATE TABLE IF NOT EXISTS "bom_item" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "code" text NOT NULL,
  "description" text NOT NULL,
  "item_type" text,
  "category" text,
  "uom" text,
  "estimated_cost_rate" numeric,
  "is_active" boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS "block" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "name" text NOT NULL,
  "development_id" text NOT NULL,
  "development_name" text,
  "number_of_properties" numeric NOT NULL,
  "plot_ids" jsonb DEFAULT '[]'::jsonb,
  "is_complete" boolean DEFAULT false
);
CREATE INDEX IF NOT EXISTS "idx_block_development_id" ON "block" ("development_id");

CREATE TABLE IF NOT EXISTS "budget_audit_log" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "item_type" text NOT NULL,
  "item_id" text NOT NULL,
  "item_name" text NOT NULL,
  "old_value" numeric,
  "new_value" numeric NOT NULL,
  "reason" text NOT NULL,
  "changed_by" text NOT NULL,
  "changed_by_name" text,
  "changed_at" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_budget_audit_log_development_id" ON "budget_audit_log" ("development_id");

CREATE TABLE IF NOT EXISTS "budget_transfer" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "from_type" text NOT NULL,
  "from_id" text,
  "from_name" text,
  "to_type" text NOT NULL,
  "to_id" text NOT NULL,
  "to_name" text,
  "amount" numeric NOT NULL,
  "reason" text,
  "comments" text,
  "transferred_by" text NOT NULL,
  "transferred_by_name" text,
  "transferred_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_budget_transfer_development_id" ON "budget_transfer" ("development_id");

CREATE TABLE IF NOT EXISTS "bug" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "module" text NOT NULL,
  "what_trying_to_do" text NOT NULL,
  "what_happened" text NOT NULL,
  "suggested_fix" text,
  "status" text,
  "reported_by" text,
  "reported_by_name" text,
  "reported_development_ids" jsonb DEFAULT '[]'::jsonb,
  "comments" jsonb DEFAULT '[]'::jsonb,
  "resolved_at" timestamptz,
  "resolved_by" text,
  "resolved_by_name" text
);

CREATE TABLE IF NOT EXISTS "building_component" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "house_type_id" text NOT NULL,
  "house_type_name" text,
  "name" text NOT NULL,
  "component_type" text NOT NULL,
  "floor_level" text,
  "sort_order" numeric,
  "notes" text,
  "active_stages" jsonb DEFAULT '[]'::jsonb,
  "is_party_wall" boolean DEFAULT false,
  "party_wall_side" text,
  "is_shared_component" boolean DEFAULT false,
  "linked_plot_ids" jsonb DEFAULT '[]'::jsonb,
  "original_component_status" text,
  "system_drawing_reference" text,
  "drawing_urls" jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS "call_group" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "name" text NOT NULL,
  "members" jsonb DEFAULT '[]'::jsonb,
  "ring_timeout_seconds" numeric DEFAULT 20,
  "ring_strategy" text
);

CREATE TABLE IF NOT EXISTS "call_log" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "call_sid" text NOT NULL,
  "direction" text,
  "from_number" text,
  "to_number" text,
  "status" text,
  "duration_seconds" numeric DEFAULT 0,
  "recording_url" text,
  "started_at" timestamptz,
  "ended_at" timestamptz,
  "linked_entity_type" text,
  "linked_entity_id" text,
  "linked_entity_label" text,
  "agent_email" text,
  "agent_name" text,
  "notes" text,
  "outcome" text
);

CREATE TABLE IF NOT EXISTS "category" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "name" text NOT NULL,
  "value" text NOT NULL,
  "sort_order" numeric
);

CREATE TABLE IF NOT EXISTS "check" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "check_group_id" text NOT NULL,
  "check_sheet_id" text NOT NULL,
  "question" text NOT NULL,
  "photo_mandatory" boolean DEFAULT false,
  "photo_requirement" text,
  "fail_risk_level" text,
  "sort_order" numeric
);

CREATE TABLE IF NOT EXISTS "check_group" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "check_sheet_id" text NOT NULL,
  "description" text NOT NULL,
  "sort_order" numeric
);

CREATE TABLE IF NOT EXISTS "check_instance" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "check_sheet_id" text NOT NULL,
  "development_id" text NOT NULL,
  "development_name" text,
  "start_date" date NOT NULL,
  "due_date" date,
  "week_ending_date" date,
  "period_month" text,
  "status" text,
  "completed_date" date,
  "signature_url" text,
  "completed_by" text
);
CREATE INDEX IF NOT EXISTS "idx_check_instance_development_id" ON "check_instance" ("development_id");

CREATE TABLE IF NOT EXISTS "check_response" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "check_instance_id" text NOT NULL,
  "check_id" text NOT NULL,
  "check_sheet_id" text NOT NULL,
  "question" text NOT NULL,
  "result" text NOT NULL,
  "fail_comment" text,
  "photo_url" text,
  "fail_risk_level" text
);

CREATE TABLE IF NOT EXISTS "check_sheet" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "check_ref" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "category_id" text NOT NULL,
  "category_name" text,
  "frequency" text NOT NULL,
  "status" text
);

CREATE TABLE IF NOT EXISTS "check_sheet_category" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "name" text NOT NULL,
  "description" text,
  "sort_order" numeric
);

CREATE TABLE IF NOT EXISTS "company" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "country_id" text NOT NULL,
  "country_name" text,
  "company_name" text NOT NULL,
  "nickname" text,
  "po_prefix" text,
  "logo_url" text,
  "address" text,
  "telephone_number" text NOT NULL,
  "sort_order" numeric,
  "xero_tenant_id" text,
  "xero_tenant_name" text,
  "sharepoint_site_name" text,
  "sharepoint_file_path" text
);

CREATE TABLE IF NOT EXISTS "component_drawing" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "building_component_id" text NOT NULL,
  "component_name" text,
  "house_type_id" text,
  "drawing_number" text,
  "title" text NOT NULL,
  "version" text,
  "file_url" text NOT NULL,
  "status" text,
  "uploaded_by" text,
  "uploaded_by_name" text,
  "notes" text
);

CREATE TABLE IF NOT EXISTS "contingency_item" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "description" text NOT NULL,
  "qty" numeric,
  "unit_rate" numeric
);
CREATE INDEX IF NOT EXISTS "idx_contingency_item_development_id" ON "contingency_item" ("development_id");

CREATE TABLE IF NOT EXISTS "contract_sum_adjustment" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "development_name" text,
  "type" text NOT NULL,
  "description" text,
  "reference" text,
  "internal_reference" text,
  "client_reference" text,
  "value" numeric NOT NULL,
  "comment" text,
  "document_url" text,
  "document_name" text,
  "adjustment_date" date,
  "changed_by" text,
  "changed_by_name" text
);
CREATE INDEX IF NOT EXISTS "idx_contract_sum_adjustment_development_id" ON "contract_sum_adjustment" ("development_id");

CREATE TABLE IF NOT EXISTS "country" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "currency" text NOT NULL,
  "currency_symbol" text,
  "time_zone" text,
  "date_format" text,
  "sort_order" numeric,
  "notes" text
);

CREATE TABLE IF NOT EXISTS "credit_note" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "credit_note_type" text NOT NULL,
  "purchase_order_id" text,
  "po_number" text,
  "company_id" text,
  "company_name" text,
  "development_id" text,
  "development_name" text,
  "development_code" text,
  "supplier_id" text,
  "supplier_name" text,
  "credit_note_number" text,
  "credit_value" numeric NOT NULL,
  "description" text,
  "extracted_line_items" jsonb DEFAULT '[]'::jsonb,
  "credit_note_file_url" text,
  "xero_account_code" text,
  "xero_sync_status" text,
  "xero_credit_note_id" text,
  "original_invoice_value" numeric,
  "net_after_credit" numeric,
  "raised_by" text,
  "raised_by_name" text
);
CREATE INDEX IF NOT EXISTS "idx_credit_note_development_id" ON "credit_note" ("development_id");
CREATE INDEX IF NOT EXISTS "idx_credit_note_company_id" ON "credit_note" ("company_id");

CREATE TABLE IF NOT EXISTS "creditor_payment_schedule" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "creditor_record_id" text NOT NULL,
  "company_id" text NOT NULL,
  "invoice_number" text,
  "week_ending_date" date NOT NULL,
  "payment_amount" numeric NOT NULL,
  "synced_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_creditor_payment_schedule_company_id" ON "creditor_payment_schedule" ("company_id");

CREATE TABLE IF NOT EXISTS "creditor_record" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "company_id" text NOT NULL,
  "company_name" text NOT NULL,
  "contact" text,
  "invoice_number" text,
  "invoice_date" text,
  "due_date" text,
  "current_age" numeric,
  "total" numeric,
  "include_in_totals" numeric,
  "status" text,
  "raw_data" text,
  "synced_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_creditor_record_company_id" ON "creditor_record" ("company_id");

CREATE TABLE IF NOT EXISTS "delivery_job" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "development_name" text,
  "delivery_address" text NOT NULL,
  "manufacturing_job_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "delivery_date" date NOT NULL,
  "delivery_time" text,
  "vehicle_registration" text,
  "supplier_id" text NOT NULL,
  "supplier_name" text,
  "status" text,
  "notes" text,
  "confirmed_by" text,
  "confirmed_by_email" text,
  "confirmed_at" text,
  "confirmed_location_lat" numeric,
  "confirmed_location_lng" numeric,
  "confirmed_location_address" text,
  "defects_reported" boolean DEFAULT false,
  "defects_count" numeric DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "idx_delivery_job_development_id" ON "delivery_job" ("development_id");

CREATE TABLE IF NOT EXISTS "department" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "name" text NOT NULL,
  "sort_order" numeric,
  "has_stock_management" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS "depreciation_method" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "name" text NOT NULL,
  "sort_order" numeric
);

CREATE TABLE IF NOT EXISTS "development" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_code" text NOT NULL,
  "country_id" text NOT NULL,
  "country_name" text,
  "company_id" text NOT NULL,
  "company_name" text,
  "customer_id" text,
  "customer_name" text,
  "name" text NOT NULL,
  "nickname" text,
  "use_nickname_in_display" boolean DEFAULT false,
  "total_plots" numeric,
  "type" text,
  "status" text,
  "build_status" text,
  "address" text,
  "post_code" text,
  "notes" text,
  "site_plan_url" text,
  "site_plan_grid_data" text,
  "has_homecare" boolean DEFAULT false,
  "has_kitbag" boolean DEFAULT false,
  "has_procureit" boolean DEFAULT false,
  "has_stock_management" boolean DEFAULT false,
  "has_johnny5" boolean DEFAULT false,
  "has_builder_tools" boolean DEFAULT false,
  "has_peoplehub" boolean DEFAULT false,
  "has_timesheets" boolean DEFAULT false,
  "has_cvr" boolean DEFAULT false,
  "manufacture_started" boolean DEFAULT false,
  "manufacture_started_at" text,
  "manufacture_started_by" text,
  "manufacture_ref_counter" numeric DEFAULT 0,
  "nearest_doctor" text,
  "nearest_hospital" text,
  "nearest_fire_station" text,
  "nearest_police_station" text,
  "emergency_contacts" text,
  "local_amenities" text,
  "parking_info" text,
  "waste_collection" text,
  "guide_template_sections" text,
  "budget_locked" boolean DEFAULT false,
  "budget_locked_at" text,
  "budget_locked_by" text,
  "budget_locked_by_name" text,
  "cvr_locked_until_period" text,
  "cvr_locked_at" text,
  "cvr_locked_by" text,
  "cvr_locked_by_name" text,
  "cvr_packages_provisioned" boolean DEFAULT false,
  "cvr_packages_provisioned_at" text,
  "cvr_packages_provisioned_by" text,
  "tendered_margin" numeric,
  "retention_percentage" numeric DEFAULT 0,
  "start_date" date,
  "target_end_date" date,
  "measured_works_scope" text,
  "sharepoint_folder_cache" jsonb DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS "idx_development_company_id" ON "development" ("company_id");
CREATE INDEX IF NOT EXISTS "idx_development_customer_id" ON "development" ("customer_id");

CREATE TABLE IF NOT EXISTS "development_check_allocation" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "development_name" text,
  "check_sheet_id" text NOT NULL,
  "check_sheet_title" text,
  "frequency" text NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_development_check_allocation_development_id" ON "development_check_allocation" ("development_id");

CREATE TABLE IF NOT EXISTS "development_package" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "development_name" text,
  "work_package_id" text,
  "work_package_name" text,
  "package_reference" text,
  "description" text,
  "package_category_id" text NOT NULL,
  "package_category_name" text,
  "supplier_id" text NOT NULL,
  "supplier_name" text,
  "is_subcontractor_package" boolean DEFAULT false,
  "total_package_value" numeric,
  "in_contract_retention_percentage" numeric,
  "post_contract_retention_percentage" numeric,
  "work_items" jsonb DEFAULT '[]'::jsonb,
  "work_items_audit" jsonb DEFAULT '[]'::jsonb,
  "approval_status" text,
  "status" text,
  "version" numeric DEFAULT 1,
  "previous_version_id" text,
  "change_reason" text,
  "changed_at" timestamptz,
  "changed_by" text,
  "changed_by_name" text,
  "notes" text
);
CREATE INDEX IF NOT EXISTS "idx_development_package_development_id" ON "development_package" ("development_id");

CREATE TABLE IF NOT EXISTS "development_prelim" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "cost_type_id" text NOT NULL,
  "cost_type_name" text,
  "heading_id" text,
  "heading_name" text,
  "budget_cost" numeric,
  "comment" text,
  "work_items" jsonb DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS "idx_development_prelim_development_id" ON "development_prelim" ("development_id");

CREATE TABLE IF NOT EXISTS "development_professional_fee" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "fee_type_id" text NOT NULL,
  "fee_type_name" text,
  "budget_cost" numeric,
  "work_items" jsonb DEFAULT '[]'::jsonb,
  "work_items_audit" jsonb DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS "idx_development_professional_fee_development_id" ON "development_professional_fee" ("development_id");

CREATE TABLE IF NOT EXISTS "employee" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "employee_no" text,
  "title" text,
  "first_name" text NOT NULL,
  "middle_name" text,
  "last_name" text NOT NULL,
  "phone" text,
  "dob" date,
  "gender" text,
  "home_address" text,
  "email" text,
  "national_insurance_number" text,
  "pay_cycle" text,
  "company_id" text NOT NULL,
  "company_name" text,
  "employment_start_date" date,
  "current_development_id" text,
  "current_development_name" text,
  "payroll_id" text,
  "job_role_id" text,
  "job_role_name" text,
  "status" text,
  "photo_url" text,
  "sign_in_welcome_message" text
);
CREATE INDEX IF NOT EXISTS "idx_employee_company_id" ON "employee" ("company_id");

CREATE TABLE IF NOT EXISTS "employee_contract" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "employee_id" text NOT NULL,
  "effective_date" date NOT NULL,
  "file_url" text NOT NULL,
  "file_name" text,
  "notes" text
);
CREATE INDEX IF NOT EXISTS "idx_employee_contract_employee_id" ON "employee_contract" ("employee_id");

CREATE TABLE IF NOT EXISTS "employee_development_history" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "employee_id" text NOT NULL,
  "development_id" text NOT NULL,
  "development_name" text,
  "effective_date" date NOT NULL,
  "end_date" date,
  "notes" text
);
CREATE INDEX IF NOT EXISTS "idx_employee_development_history_development_id" ON "employee_development_history" ("development_id");
CREATE INDEX IF NOT EXISTS "idx_employee_development_history_employee_id" ON "employee_development_history" ("employee_id");

CREATE TABLE IF NOT EXISTS "employee_note" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "employee_id" text NOT NULL,
  "employee_name" text,
  "note_text" text NOT NULL,
  "noted_date" timestamptz,
  "noted_by" text
);
CREATE INDEX IF NOT EXISTS "idx_employee_note_employee_id" ON "employee_note" ("employee_id");

CREATE TABLE IF NOT EXISTS "employee_salary_audit" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "employee_id" text NOT NULL,
  "employee_name" text,
  "salary_details_id" text NOT NULL,
  "effective_date" date NOT NULL,
  "changed_fields" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "old_values" jsonb DEFAULT '{}'::jsonb,
  "new_values" jsonb DEFAULT '{}'::jsonb,
  "changed_by" text,
  "notes" text
);
CREATE INDEX IF NOT EXISTS "idx_employee_salary_audit_employee_id" ON "employee_salary_audit" ("employee_id");

CREATE TABLE IF NOT EXISTS "employee_salary_details" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "employee_id" text NOT NULL,
  "employee_name" text,
  "effective_date" date NOT NULL,
  "hourly_rate" numeric,
  "overtime_rate_1" numeric,
  "overtime_rate_2" numeric,
  "weekly_bonus_rate" numeric,
  "notes" text
);
CREATE INDEX IF NOT EXISTS "idx_employee_salary_details_employee_id" ON "employee_salary_details" ("employee_id");

CREATE TABLE IF NOT EXISTS "employers_instruction" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "development_name" text,
  "ref" text,
  "seq_number" numeric,
  "title" text NOT NULL,
  "instruction_detail" text,
  "cost" numeric,
  "date_approved" date,
  "approved_by" text,
  "file_url" text
);
CREATE INDEX IF NOT EXISTS "idx_employers_instruction_development_id" ON "employers_instruction" ("development_id");

CREATE TABLE IF NOT EXISTS "estimate" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "bom_cost" numeric,
  "cost_per_m2" numeric,
  "development_id" text,
  "driver_measures" jsonb DEFAULT '{}'::jsonb,
  "estimate_no" text,
  "first_valuation_date" date,
  "install_cost" numeric,
  "install_inputs" jsonb DEFAULT '{}'::jsonb,
  "manufacturing_cost" numeric,
  "margin" numeric,
  "margin_on_sale_pct" numeric,
  "markup_pct" numeric,
  "number_of_units" numeric DEFAULT 1,
  "plot_id" text,
  "prepared_by" text,
  "project_name" text NOT NULL,
  "proposal_pdf_url" text,
  "sale" numeric,
  "sale_per_m2" numeric,
  "start_date" date,
  "status" text,
  "unit_m2" numeric,
  "valuation_interval_days" numeric,
  "version" numeric DEFAULT 1
);
CREATE INDEX IF NOT EXISTS "idx_estimate_development_id" ON "estimate" ("development_id");

CREATE TABLE IF NOT EXISTS "estimate_line" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "block" text NOT NULL,
  "canvas_geometry" jsonb DEFAULT '{}'::jsonb,
  "driver_key" text,
  "element" text,
  "estimate_id" text NOT NULL,
  "line_total" numeric,
  "measure" numeric DEFAULT 0,
  "name_snapshot" text,
  "rate_id" text,
  "rate_snapshot" numeric,
  "source" text,
  "sort_order" numeric,
  "unit" text,
  "waste_pct" numeric DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "estimating_rate" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "rate_code" text NOT NULL,
  "name" text NOT NULL,
  "rate_type" text NOT NULL,
  "element" text,
  "unit" text NOT NULL,
  "rate" numeric NOT NULL,
  "default_waste_pct" numeric DEFAULT 0,
  "measure_type" text,
  "marker_style" jsonb DEFAULT '{}'::jsonb,
  "category" text,
  "rate_source" text,
  "supplier" text,
  "active" boolean DEFAULT true,
  "effective_date" date,
  "notes" text
);

CREATE TABLE IF NOT EXISTS "gsd_action" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "gsd_log_id" text NOT NULL,
  "action_log_id" text,
  "action_log_name" text,
  "check_response_id" text NOT NULL,
  "question" text NOT NULL,
  "fail_risk_level" text NOT NULL,
  "fail_comment" text,
  "photo_url" text,
  "status" text,
  "action_comment" text,
  "completed_date" date,
  "completed_by" text,
  "development_id" text,
  "development_name" text,
  "comments" jsonb DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS "idx_gsd_action_development_id" ON "gsd_action" ("development_id");

CREATE TABLE IF NOT EXISTS "gsd_action_log" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "development_name" text,
  "name" text NOT NULL,
  "description" text
);
CREATE INDEX IF NOT EXISTS "idx_gsd_action_log_development_id" ON "gsd_action_log" ("development_id");

CREATE TABLE IF NOT EXISTS "gsd_category" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "name" text NOT NULL,
  "value" text NOT NULL,
  "sort_order" numeric
);

CREATE TABLE IF NOT EXISTS "gsd_log" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "development_name" text,
  "action_log_id" text,
  "action_log_name" text,
  "reference" text,
  "category" text NOT NULL,
  "gsd_category_id" text,
  "gsd_category" text,
  "project_category" text,
  "topic_area" text,
  "summary" text,
  "action_decision" text,
  "owner" text,
  "status" text,
  "target_date" date,
  "due_category" text,
  "last_updated" date,
  "comments_notes" text,
  "check_instance_id" text,
  "comments" jsonb DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS "idx_gsd_log_development_id" ON "gsd_log" ("development_id");

CREATE TABLE IF NOT EXISTS "global_package_category" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "name" text NOT NULL,
  "description" text,
  "sort_order" numeric
);

CREATE TABLE IF NOT EXISTS "help_article" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "title" text NOT NULL,
  "module" text NOT NULL,
  "category" text,
  "content" text NOT NULL,
  "summary" text,
  "sort_order" numeric DEFAULT 0,
  "is_published" boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS "hired_asset" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text,
  "development_name" text,
  "company_id" text,
  "company_name" text,
  "supplier_id" text NOT NULL,
  "supplier_name" text,
  "hire_no" text,
  "make" text NOT NULL,
  "model" text NOT NULL,
  "description" text,
  "photo_url" text,
  "kit_category_id" text NOT NULL,
  "category_name" text,
  "kit_sub_category_id" text,
  "sub_category_name" text,
  "is_road_registered" boolean DEFAULT false,
  "registration_number" text,
  "registration_date" date,
  "last_mot_date" date,
  "serial_number" text,
  "on_hire_date" date NOT NULL,
  "weekly_hire_cost" numeric NOT NULL,
  "daily_hire_cost" numeric,
  "total_costs_to_date" numeric DEFAULT 0,
  "status" text,
  "off_hire_date" date,
  "off_hire_method" text,
  "delivery_location" text,
  "damage_recorded" boolean DEFAULT false,
  "off_hire_note_url" text,
  "damage_report_url" text,
  "loler_check_required" boolean DEFAULT false,
  "loler_frequency_months" numeric,
  "loler_start_date" date,
  "needs_mid_insurance" boolean DEFAULT false
);
CREATE INDEX IF NOT EXISTS "idx_hired_asset_development_id" ON "hired_asset" ("development_id");
CREATE INDEX IF NOT EXISTS "idx_hired_asset_company_id" ON "hired_asset" ("company_id");

CREATE TABLE IF NOT EXISTS "historical_transaction" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "transaction_date" date NOT NULL,
  "description" text NOT NULL,
  "reference" text NOT NULL,
  "debit" numeric,
  "credit" numeric,
  "gross_total" numeric NOT NULL,
  "cost_code" text NOT NULL,
  "development_id" text,
  "development_name" text,
  "category_type" text,
  "category_id" text,
  "category_name" text,
  "work_item_reference" text,
  "cvr_period_date" date,
  "cvr_allocated_period" text NOT NULL,
  "uploaded_by" text NOT NULL,
  "uploaded_at" timestamptz NOT NULL,
  "coded_by" text,
  "coded_at" timestamptz,
  "reallocation_audit" jsonb DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS "idx_historical_transaction_development_id" ON "historical_transaction" ("development_id");

CREATE TABLE IF NOT EXISTS "house_type_bom" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "house_type_id" text NOT NULL,
  "house_type_name" text,
  "bom_item_id" text NOT NULL,
  "bom_item_code" text,
  "bom_item_description" text,
  "uom" text,
  "quantity" numeric NOT NULL,
  "estimated_cost_rate" numeric,
  "total_estimated_cost" numeric,
  "notes" text
);

CREATE TABLE IF NOT EXISTS "ivr_route" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "digit" numeric NOT NULL,
  "label" text NOT NULL,
  "primary_group_id" text,
  "primary_group_name" text,
  "fallback_group_id" text,
  "fallback_group_name" text
);

CREATE TABLE IF NOT EXISTS "information_request" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "development_name" text,
  "title" text NOT NULL,
  "category" text,
  "information_requested" text NOT NULL,
  "work_package_id" text,
  "work_package_name" text,
  "priority" text,
  "requested_by" text,
  "requested_by_name" text,
  "request_to_name" text,
  "request_to_email" text,
  "date_required" date,
  "response" text,
  "attachment_url" text,
  "status" text,
  "completed_date" date,
  "completed_by" text
);
CREATE INDEX IF NOT EXISTS "idx_information_request_development_id" ON "information_request" ("development_id");

CREATE TABLE IF NOT EXISTS "invitation" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "email" text NOT NULL,
  "status" text,
  "role" text NOT NULL,
  "user_type" text,
  "customer_id" text,
  "invited_by" text NOT NULL,
  "notes" text,
  "accessible_developments" jsonb DEFAULT '[]'::jsonb,
  "module_access" jsonb DEFAULT '{}'::jsonb,
  "po_permissions" text,
  "po_authority_level_id" text,
  "po_authority_level_value" numeric,
  "can_raise_retro_po" boolean DEFAULT false,
  "can_exclude_retro_po_from_kpi" boolean DEFAULT false,
  "can_match_invoice" boolean DEFAULT false,
  "builder_access" jsonb DEFAULT '{}'::jsonb,
  "peoplehub_permissions" jsonb DEFAULT '{}'::jsonb,
  "mobile_app_access" jsonb DEFAULT '[]'::jsonb,
  "johnny5_level" text,
  "johnny5_cell_id" text,
  "johnny5_cell_name" text,
  "installer_development_ids" jsonb DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS "idx_invitation_customer_id" ON "invitation" ("customer_id");

CREATE TABLE IF NOT EXISTS "j5_check_item" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "phase" text NOT NULL,
  "question" text NOT NULL,
  "sort_order" numeric,
  "is_active" boolean DEFAULT true,
  "photo_required" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS "j5_check_response" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "manufacturing_job_id" text NOT NULL,
  "phase" text NOT NULL,
  "check_item_id" text NOT NULL,
  "question" text,
  "checked" boolean DEFAULT false,
  "checked_by" text,
  "checked_at" text,
  "photo_url" text,
  "photo_upload_token" text,
  "photo_uploaded_at" text
);

CREATE TABLE IF NOT EXISTS "job" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "service_call_id" text NOT NULL,
  "development_package_id" text NOT NULL,
  "package_category_name" text,
  "supplier_id" text,
  "supplier_name" text,
  "supplier_callout_contact" text,
  "supplier_callout_phone" text,
  "supplier_callout_email" text,
  "title" text NOT NULL,
  "description" text,
  "status" text,
  "issued_date" timestamptz,
  "completed_date" timestamptz,
  "notes" text,
  "photos" jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS "job_role" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "name" text NOT NULL,
  "company_id" text,
  "company_name" text,
  "description" text,
  "is_active" boolean DEFAULT true
);
CREATE INDEX IF NOT EXISTS "idx_job_role_company_id" ON "job_role" ("company_id");

CREATE TABLE IF NOT EXISTS "job_update" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "job_id" text NOT NULL,
  "notes" text NOT NULL,
  "photos" jsonb DEFAULT '[]'::jsonb,
  "status_change" text,
  "author_username" text
);

CREATE TABLE IF NOT EXISTS "kit_category" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "name" text NOT NULL,
  "sort_order" numeric
);

CREATE TABLE IF NOT EXISTS "kit_sub_category" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "kit_category_id" text NOT NULL,
  "category_name" text,
  "name" text NOT NULL,
  "sort_order" numeric
);

CREATE TABLE IF NOT EXISTS "maintenance_job" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "asset_type" text NOT NULL,
  "owned_asset_id" text,
  "hired_asset_id" text,
  "asset_id" text,
  "maintenance_schedule_id" text,
  "job_type" text NOT NULL,
  "description" text NOT NULL,
  "due_date" date NOT NULL,
  "status" text,
  "completed_date" text,
  "completed_by" text,
  "completed_by_name" text,
  "maintenance_record_url" text,
  "notes" text
);

CREATE TABLE IF NOT EXISTS "maintenance_schedule" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "asset_type" text NOT NULL,
  "owned_asset_id" text,
  "hired_asset_id" text,
  "asset_id" text,
  "description" text NOT NULL,
  "start_date" date NOT NULL,
  "frequency" text NOT NULL,
  "next_due_date" date
);

CREATE TABLE IF NOT EXISTS "manufacturing_cell" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "name" text NOT NULL,
  "description" text,
  "cell_type" text,
  "development_id" text,
  "development_name" text,
  "is_active" boolean DEFAULT true,
  "sort_order" numeric
);
CREATE INDEX IF NOT EXISTS "idx_manufacturing_cell_development_id" ON "manufacturing_cell" ("development_id");

CREATE TABLE IF NOT EXISTS "manufacturing_job" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "manufacture_ref" text,
  "panel_reference_number" text,
  "development_id" text NOT NULL,
  "development_name" text,
  "plot_id" text NOT NULL,
  "plot_label" text,
  "plot_build_order" numeric,
  "house_type_id" text,
  "house_type_name" text,
  "building_component_id" text NOT NULL,
  "building_component_name" text,
  "component_type" text,
  "active_stages" jsonb DEFAULT '[]'::jsonb,
  "current_stage" text,
  "cell_id" text,
  "cell_name" text,
  "cell_sort_order" numeric,
  "planner_sort_order" numeric,
  "status" text,
  "planner_approved" boolean DEFAULT false,
  "planner_approved_at" text,
  "planner_approved_by" text,
  "current_phase" text,
  "completed_stages" jsonb DEFAULT '[]'::jsonb,
  "preparation_started_at" text,
  "preparation_completed_at" text,
  "preparation_completed_by" text,
  "assembly_started_at" text,
  "assembly_completed_at" text,
  "assembly_completed_by" text,
  "quality_control_started_at" text,
  "quality_control_completed_at" text,
  "quality_control_completed_by" text,
  "sent_to_qa_at" text,
  "qa_started_at" text,
  "qa_completed_at" text,
  "qa_completed_by" text,
  "qa_outcome" text,
  "rework_notes" text,
  "rework_count" numeric DEFAULT 0,
  "rework_started_at" text,
  "rework_completed_at" text,
  "rework_time_seconds" numeric DEFAULT 0,
  "qa_photos" jsonb DEFAULT '[]'::jsonb,
  "notes" text,
  "is_party_wall" boolean DEFAULT false,
  "party_wall_side" text,
  "is_shared_component" boolean DEFAULT false,
  "shared_with_plot_ids" jsonb DEFAULT '[]'::jsonb,
  "installation_status" text,
  "installation_started_at" text,
  "installation_completed_at" text,
  "installation_started_by" text,
  "installation_completed_by" text,
  "installation_notes" text
);
CREATE INDEX IF NOT EXISTS "idx_manufacturing_job_development_id" ON "manufacturing_job" ("development_id");

CREATE TABLE IF NOT EXISTS "material_category" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "name" text NOT NULL,
  "description" text,
  "sort_order" numeric
);

CREATE TABLE IF NOT EXISTS "measured_work_master_item" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "plot_id" text,
  "is_template" boolean DEFAULT false,
  "category" text,
  "subcategory" text,
  "reference_number" text,
  "name" text NOT NULL,
  "unit" text NOT NULL,
  "quantity" numeric NOT NULL,
  "rate" numeric NOT NULL,
  "total_value" numeric NOT NULL,
  "sort_order" numeric,
  "is_subcategory_header" boolean DEFAULT false
);
CREATE INDEX IF NOT EXISTS "idx_measured_work_master_item_development_id" ON "measured_work_master_item" ("development_id");

CREATE TABLE IF NOT EXISTS "ncr" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "ncr_number" text,
  "development_id" text NOT NULL,
  "development_name" text,
  "category_id" text NOT NULL,
  "category_name" text,
  "description" text NOT NULL,
  "resolution_type" text NOT NULL,
  "status" text,
  "photo_urls" jsonb DEFAULT '[]'::jsonb,
  "voice_recording_url" text,
  "submitted_by" text,
  "submitted_by_name" text,
  "submitted_date" timestamptz,
  "completed_by" text,
  "completed_by_name" text,
  "completed_date" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_ncr_development_id" ON "ncr" ("development_id");

CREATE TABLE IF NOT EXISTS "ncr_category" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "name" text NOT NULL,
  "is_active" boolean DEFAULT true,
  "sort_order" numeric
);

CREATE TABLE IF NOT EXISTS "ncr_comment" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "ncr_id" text NOT NULL,
  "comment" text NOT NULL,
  "commented_by" text,
  "commented_by_name" text
);

CREATE TABLE IF NOT EXISTS "opportunity" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "opportunity_type" text,
  "country_id" text,
  "country_name" text,
  "name" text NOT NULL,
  "company_name" text,
  "category_id" text,
  "category_name" text,
  "market_id" text,
  "market_name" text,
  "proposal_type_id" text,
  "proposal_type_name" text,
  "proposal_deadline" date,
  "pricing_submission_deadline" date,
  "sharepoint_url" text,
  "contact_name" text,
  "contact_email" text,
  "contact_phone" text,
  "value" numeric,
  "probability" numeric,
  "stage" text NOT NULL,
  "framework_stage" text,
  "priority" text,
  "source" text,
  "assigned_to" text,
  "assigned_to_name" text,
  "description" text,
  "next_action" text,
  "next_action_date" date,
  "expected_close_date" date,
  "won_lost_reason" text,
  "notes" text,
  "stage_history" jsonb DEFAULT '[]'::jsonb,
  "updates" jsonb DEFAULT '[]'::jsonb,
  "key_dates" jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS "owned_asset" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text,
  "development_name" text,
  "asset_id" text,
  "make" text NOT NULL,
  "model" text NOT NULL,
  "description" text,
  "photo_url" text,
  "kit_category_id" text NOT NULL,
  "category_name" text,
  "kit_sub_category_id" text,
  "sub_category_name" text,
  "is_road_registered" boolean DEFAULT false,
  "registration_number" text,
  "registration_date" date,
  "last_mot_date" date,
  "serial_number" text,
  "manufacturer_supplier" text,
  "date_purchased" date,
  "purchase_cost" numeric,
  "depreciation_method_id" text,
  "depreciation_method_name" text,
  "life_span_months" numeric,
  "warranty_expiry_date" date,
  "loler_check_required" boolean DEFAULT false,
  "loler_frequency_months" numeric,
  "loler_start_date" date,
  "needs_mid_insurance" boolean DEFAULT false
);
CREATE INDEX IF NOT EXISTS "idx_owned_asset_development_id" ON "owned_asset" ("development_id");

CREATE TABLE IF NOT EXISTS "po_audit_log" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "purchase_order_id" text NOT NULL,
  "action" text NOT NULL,
  "actor_email" text NOT NULL,
  "actor_name" text NOT NULL,
  "comments" text,
  "authority_level_description" text,
  "po_value" numeric,
  "delivered_value" numeric,
  "outstanding_value" numeric
);

CREATE TABLE IF NOT EXISTS "po_authority_level" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "description" text NOT NULL,
  "max_value" numeric NOT NULL,
  "sort_order" numeric
);

CREATE TABLE IF NOT EXISTS "package_category" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "development_name" text,
  "name" text NOT NULL,
  "description" text,
  "sort_order" numeric,
  "display_order" numeric DEFAULT 0,
  "global_category_id" text,
  "is_hidden" boolean DEFAULT false,
  "is_bespoke" boolean DEFAULT false
);
CREATE INDEX IF NOT EXISTS "idx_package_category_development_id" ON "package_category" ("development_id");

CREATE TABLE IF NOT EXISTS "payment_pack" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "development_name" text,
  "period" text NOT NULL,
  "status" text,
  "generated_date" timestamptz,
  "generated_by" text,
  "total_amount_claimed" numeric DEFAULT 0,
  "total_retention" numeric DEFAULT 0,
  "total_net_payable" numeric DEFAULT 0,
  "notes" text
);
CREATE INDEX IF NOT EXISTS "idx_payment_pack_development_id" ON "payment_pack" ("development_id");

CREATE TABLE IF NOT EXISTS "payment_pack_line_item" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "payment_pack_id" text NOT NULL,
  "development_package_id" text NOT NULL,
  "subcontractor_name" text NOT NULL,
  "subcontractor_id" text,
  "package_name" text,
  "total_contract_value" numeric,
  "amount_claimed_this_period" numeric DEFAULT 0,
  "previously_claimed" numeric DEFAULT 0,
  "cumulative_claimed" numeric DEFAULT 0,
  "in_contract_retention_percentage" numeric,
  "cumulative_retention" numeric DEFAULT 0,
  "net_total_payable" numeric DEFAULT 0,
  "invoice_status" text,
  "invoice_number" text,
  "invoice_date" date,
  "invoice_value" numeric,
  "invoice_file_url" text,
  "extracted_line_items" jsonb DEFAULT '[]'::jsonb,
  "payment_certificate_url" text,
  "certificate_number" text,
  "certification_status" text,
  "certified_by" text,
  "certified_at" timestamptz,
  "query_notes" text,
  "purchase_order_id" text,
  "purchase_order_number" text,
  "xero_sync_status" text
);

CREATE TABLE IF NOT EXISTS "payment_run" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "name" text NOT NULL,
  "run_date" date NOT NULL,
  "total_amount" numeric DEFAULT 0,
  "budget" numeric NOT NULL,
  "remaining_budget" numeric DEFAULT 0,
  "status" text,
  "company_id" text NOT NULL,
  "company_name" text,
  "payment_method" text,
  "invoice_ids" jsonb DEFAULT '[]'::jsonb,
  "csv_file_url" text,
  "notes" text
);
CREATE INDEX IF NOT EXISTS "idx_payment_run_company_id" ON "payment_run" ("company_id");

CREATE TABLE IF NOT EXISTS "plan_revision" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "calibrated" boolean DEFAULT false,
  "estimate_id" text NOT NULL,
  "is_active" boolean DEFAULT true,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "page_count" numeric,
  "pdf_url" text,
  "plot_scale" text,
  "revision_ref" text,
  "scale_source" text,
  "scale_value" numeric,
  "sheet_name" text
);

CREATE TABLE IF NOT EXISTS "plot" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "development_name" text,
  "plot_number" numeric NOT NULL,
  "plot_label" text,
  "house_type_id" text,
  "house_type_name" text,
  "build_order" numeric,
  "status" text,
  "notes" text,
  "block_id" text,
  "position_in_block" numeric
);
CREATE INDEX IF NOT EXISTS "idx_plot_development_id" ON "plot" ("development_id");

CREATE TABLE IF NOT EXISTS "prelim_cost_item" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "name" text NOT NULL,
  "unit" text NOT NULL,
  "quantity" numeric DEFAULT 0,
  "rate" numeric NOT NULL,
  "total" numeric,
  "prelim_heading_id" text,
  "reference_number" text,
  "sort_order" numeric
);
CREATE INDEX IF NOT EXISTS "idx_prelim_cost_item_development_id" ON "prelim_cost_item" ("development_id");

CREATE TABLE IF NOT EXISTS "prelim_cost_type" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "heading_id" text NOT NULL,
  "heading_name" text,
  "name" text NOT NULL,
  "code" text,
  "description" text,
  "sort_order" numeric,
  "development_id" text
);
CREATE INDEX IF NOT EXISTS "idx_prelim_cost_type_development_id" ON "prelim_cost_type" ("development_id");

CREATE TABLE IF NOT EXISTS "prelim_heading" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "name" text NOT NULL,
  "description" text,
  "sort_order" numeric
);

CREATE TABLE IF NOT EXISTS "pricing_setting" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "category" text,
  "label" text,
  "notes" text,
  "setting_key" text NOT NULL,
  "unit" text,
  "value" numeric NOT NULL
);

CREATE TABLE IF NOT EXISTS "priority" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "value" text NOT NULL,
  "label" text NOT NULL,
  "target_days" numeric NOT NULL,
  "sort_order" numeric
);

CREATE TABLE IF NOT EXISTS "procurement_schedule" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "development_name" text,
  "development_package_id" text NOT NULL,
  "package_category_name" text,
  "enquiry_send_date" date,
  "enquiry_status" text,
  "tender_return_date" date,
  "tender_status" text,
  "place_order_date" date,
  "place_order_status" text,
  "pricing_period_days" numeric,
  "order_lead_time_days" numeric,
  "lead_time_days" numeric,
  "programme_start_date" date,
  "notes" text
);
CREATE INDEX IF NOT EXISTS "idx_procurement_schedule_development_id" ON "procurement_schedule" ("development_id");

CREATE TABLE IF NOT EXISTS "product" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "supplier_id" text NOT NULL,
  "supplier_name" text,
  "product_code" text NOT NULL,
  "description" text NOT NULL,
  "specification" text,
  "size" text,
  "uom" text,
  "category_id" text,
  "category_name" text,
  "is_active" boolean DEFAULT true,
  "low_stock_alert" boolean DEFAULT false,
  "low_stock_level" numeric DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "product_category" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "name" text NOT NULL,
  "description" text,
  "sort_order" numeric
);

CREATE TABLE IF NOT EXISTS "professional_fee_item" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "name" text NOT NULL,
  "unit" text NOT NULL,
  "quantity" numeric DEFAULT 1,
  "rate" numeric NOT NULL,
  "total" numeric,
  "professional_fee_type_id" text,
  "sort_order" numeric
);
CREATE INDEX IF NOT EXISTS "idx_professional_fee_item_development_id" ON "professional_fee_item" ("development_id");

CREATE TABLE IF NOT EXISTS "professional_fee_type" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "name" text NOT NULL,
  "code" text,
  "description" text,
  "sort_order" numeric,
  "development_id" text
);
CREATE INDEX IF NOT EXISTS "idx_professional_fee_type_development_id" ON "professional_fee_type" ("development_id");

CREATE TABLE IF NOT EXISTS "programme_data" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text,
  "development_name" text NOT NULL,
  "file_name" text,
  "tasks" jsonb DEFAULT '[]'::jsonb,
  "raw_xml" text,
  "synced_at" text,
  "synced_by" text
);
CREATE INDEX IF NOT EXISTS "idx_programme_data_development_id" ON "programme_data" ("development_id");

CREATE TABLE IF NOT EXISTS "progress_update" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "service_call_id" text NOT NULL,
  "notes" text NOT NULL,
  "photos" jsonb DEFAULT '[]'::jsonb,
  "comment_type" text,
  "author_username" text,
  "appliance_ids" jsonb DEFAULT '[]'::jsonb,
  "is_private" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS "property" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text,
  "development_name" text,
  "property_owner_id" text NOT NULL,
  "property_owner_name" text,
  "house_number" text NOT NULL,
  "street_address" text,
  "full_address" text,
  "town" text,
  "post_code" text,
  "plot_description" text,
  "property_type_id" text,
  "property_type_name" text,
  "bedrooms" numeric,
  "bathrooms" numeric,
  "square_feet" numeric,
  "year_built" numeric,
  "notes" text
);
CREATE INDEX IF NOT EXISTS "idx_property_development_id" ON "property" ("development_id");

CREATE TABLE IF NOT EXISTS "property_owner" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "user_id" text,
  "company_name" text NOT NULL,
  "contact_person" text,
  "phone" text NOT NULL,
  "email" text,
  "address" text,
  "logo_url" text,
  "notes" text
);

CREATE TABLE IF NOT EXISTS "property_type" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "development_name" text,
  "name" text NOT NULL,
  "house_type" text NOT NULL,
  "m2" numeric,
  "bedrooms" numeric NOT NULL,
  "bathrooms" numeric NOT NULL,
  "number_of_persons" numeric,
  "colour_code" text,
  "is_active" boolean DEFAULT true,
  "floor_plan_config" text
);
CREATE INDEX IF NOT EXISTS "idx_property_type_development_id" ON "property_type" ("development_id");

CREATE TABLE IF NOT EXISTS "purchase_invoice" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "purchase_order_id" text NOT NULL,
  "supplier_invoice_number" text NOT NULL,
  "invoice_file_url" text NOT NULL,
  "invoiced_value" numeric NOT NULL,
  "invoice_date" date,
  "due_date" date,
  "extracted_line_items" jsonb DEFAULT '[]'::jsonb,
  "xero_account_code" text,
  "xero_tax_type" text,
  "xero_sync_status" text,
  "xero_invoice_id" text,
  "match_number" text,
  "matched_by" text,
  "matched_by_name" text,
  "matched_at" timestamptz,
  "development_package_id" text,
  "development_package_name" text,
  "cvr_period" text,
  "cvr_transaction_id" text,
  "cvr_category_type" text,
  "cvr_category_id" text,
  "cvr_category_name" text
);

CREATE TABLE IF NOT EXISTS "purchase_order" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "source_type" text,
  "hired_asset_id" text,
  "po_number" text,
  "company_id" text,
  "company_name" text,
  "department_id" text,
  "department_name" text,
  "supplier_id" text NOT NULL,
  "supplier_name" text,
  "supplier_logo_url" text,
  "development_id" text,
  "development_name" text,
  "cost_centre_development_id" text,
  "cost_centre_development_name" text,
  "delivery_address" text,
  "delivery_address_type" text,
  "required_by_date" date NOT NULL,
  "status" text,
  "approval_status" text,
  "awaiting_approval_from" text,
  "awaiting_approval_from_name" text,
  "required_authority_level_value" numeric,
  "is_retrospective_po" boolean DEFAULT false,
  "exclude_from_no_po_kpi" boolean DEFAULT false,
  "invoice_type" text,
  "subcontractor_development_package_id" text,
  "subcontractor_development_package_reference" text,
  "payment_pack_id" text,
  "payment_pack_period" text,
  "total_value" numeric DEFAULT 0,
  "delivered_value" numeric DEFAULT 0,
  "outstanding_value" numeric DEFAULT 0,
  "total_invoiced_value" numeric DEFAULT 0,
  "invoices_count" numeric DEFAULT 0,
  "raised_date" date,
  "raised_by" text,
  "raised_by_name" text,
  "supplier_invoice_number" text,
  "invoice_file_url" text,
  "invoice_date" date,
  "invoice_due_date" date,
  "invoiced_value" numeric,
  "value_difference" numeric,
  "extracted_line_items" jsonb DEFAULT '[]'::jsonb,
  "invoice_match_number" text,
  "invoice_matched_date" date,
  "hire_period_from" date,
  "hire_period_to" date,
  "xero_account_code" text,
  "xero_tax_type" text,
  "xero_sync_status" text,
  "rejection_comments" text,
  "notes" text,
  "documents" jsonb DEFAULT '[]'::jsonb,
  "payment_run_id" text,
  "payment_run_status" text,
  "xero_payment_status" text,
  "xero_payment_date" date,
  "cvr_period" text,
  "cvr_transaction_id" text,
  "cvr_category_type" text,
  "cvr_category_id" text,
  "cvr_category_name" text
);
CREATE INDEX IF NOT EXISTS "idx_purchase_order_development_id" ON "purchase_order" ("development_id");
CREATE INDEX IF NOT EXISTS "idx_purchase_order_company_id" ON "purchase_order" ("company_id");

CREATE TABLE IF NOT EXISTS "purchase_order_line_item" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "purchase_order_id" text NOT NULL,
  "line_number" numeric,
  "product_code" text,
  "description" text NOT NULL,
  "uom" text,
  "unit_rate" numeric,
  "quantity" numeric,
  "total_value" numeric,
  "quantity_delivered" numeric DEFAULT 0,
  "delivered_value" numeric DEFAULT 0,
  "quantity_to_stock" numeric DEFAULT 0,
  "product_id" text,
  "is_plot_specific" boolean DEFAULT false,
  "plot_specific_development_id" text,
  "plot_specific_development_name" text
);

CREATE TABLE IF NOT EXISTS "qs_accrual" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "cvr_period" text NOT NULL,
  "description" text NOT NULL,
  "category_type" text NOT NULL,
  "category_id" text NOT NULL,
  "category_name" text,
  "work_item_reference" text,
  "work_item_description" text,
  "amount" numeric NOT NULL,
  "created_by" text,
  "locked_at_period" text,
  "is_locked" boolean DEFAULT false
);
CREATE INDEX IF NOT EXISTS "idx_qs_accrual_development_id" ON "qs_accrual" ("development_id");

CREATE TABLE IF NOT EXISTS "red_tag" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "asset_type" text NOT NULL,
  "owned_asset_id" text,
  "hired_asset_id" text,
  "asset_identifier" text,
  "reason" text NOT NULL,
  "actions_required" text NOT NULL,
  "status" text,
  "tagged_by_name" text,
  "resolved_date" text,
  "resolved_by" text,
  "resolved_by_name" text,
  "resolution_notes" text
);

CREATE TABLE IF NOT EXISTS "resident" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "property_id" text NOT NULL,
  "property_address" text,
  "property_owner_id" text,
  "property_owner_name" text,
  "full_name" text NOT NULL,
  "phone" text NOT NULL,
  "email" text,
  "move_in_date" date,
  "move_out_date" date,
  "lease_end_date" date,
  "status" text,
  "additional_contacts" jsonb DEFAULT '[]'::jsonb,
  "notes" text
);

CREATE TABLE IF NOT EXISTS "revenue_application" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "development_name" text,
  "period" text NOT NULL,
  "application_number" numeric NOT NULL,
  "status" text,
  "total_gross_claim_period" numeric DEFAULT 0,
  "retention_percentage" numeric DEFAULT 0,
  "total_net_claim_period" numeric DEFAULT 0,
  "submitted_date" timestamptz,
  "certified_date" timestamptz,
  "notes" text
);
CREATE INDEX IF NOT EXISTS "idx_revenue_application_development_id" ON "revenue_application" ("development_id");

CREATE TABLE IF NOT EXISTS "revenue_application_item" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "revenue_application_id" text NOT NULL,
  "development_id" text NOT NULL,
  "item_type" text NOT NULL,
  "source_item_id" text,
  "item_description_snapshot" text,
  "item_unit_snapshot" text,
  "item_rate_snapshot" numeric,
  "item_quantity_snapshot" numeric,
  "item_total_value_snapshot" numeric,
  "cumulative_claimed_percentage" numeric DEFAULT 0,
  "cumulative_claimed_quantity" numeric DEFAULT 0,
  "prior_cumulative_percentage" numeric DEFAULT 0,
  "prior_cumulative_quantity" numeric DEFAULT 0,
  "this_period_percentage" numeric DEFAULT 0,
  "this_period_quantity" numeric DEFAULT 0,
  "this_period_value" numeric DEFAULT 0,
  "cumulative_value" numeric DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "idx_revenue_application_item_development_id" ON "revenue_application_item" ("development_id");

CREATE TABLE IF NOT EXISTS "risk_opportunity" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "development_name" text,
  "title" text NOT NULL,
  "description" text,
  "impact" numeric,
  "likelihood" numeric,
  "cost_impact" text,
  "notes" text,
  "attachment_url" text
);
CREATE INDEX IF NOT EXISTS "idx_risk_opportunity_development_id" ON "risk_opportunity" ("development_id");

CREATE TABLE IF NOT EXISTS "sales_hub_category" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "name" text NOT NULL,
  "sort_order" numeric
);

CREATE TABLE IF NOT EXISTS "sales_hub_market" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "name" text NOT NULL,
  "icon_name" text,
  "sort_order" numeric
);

CREATE TABLE IF NOT EXISTS "sales_hub_proposal_type" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "name" text NOT NULL,
  "sort_order" numeric
);

CREATE TABLE IF NOT EXISTS "service_call" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "property_id" text NOT NULL,
  "property_ids" jsonb DEFAULT '[]'::jsonb,
  "property_address" text,
  "property_owner_id" text,
  "property_owner_name" text,
  "resident_id" text,
  "resident_name" text,
  "resident_phone" text,
  "contact_name" text,
  "contact_phone" text,
  "contact_email" text,
  "customer_contact_name" text,
  "customer_contact_email" text,
  "title" text NOT NULL,
  "description" text,
  "category" text NOT NULL,
  "priority" text NOT NULL,
  "status" text,
  "scheduled_date" date,
  "visit_date" date,
  "visit_time" text,
  "assigned_technician" text,
  "completed_date" date,
  "resolution_notes" text,
  "resolution_updated_by" text,
  "resolution_updated_date" text,
  "estimated_cost" numeric,
  "actual_cost" numeric
);

CREATE TABLE IF NOT EXISTS "shift" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "development_name" text,
  "shift_name" text NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "max_hours" numeric NOT NULL,
  "days_of_week" jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS "idx_shift_development_id" ON "shift" ("development_id");

CREATE TABLE IF NOT EXISTS "sign_in_record" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "record_id" text NOT NULL,
  "event" text NOT NULL,
  "development_id" text NOT NULL,
  "visitor_name" text NOT NULL,
  "group_name" text,
  "supplier_name" text,
  "site_name" text,
  "sign_in_time" timestamptz NOT NULL,
  "sign_out_time" timestamptz,
  "photo_url" text,
  "received_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_sign_in_record_development_id" ON "sign_in_record" ("development_id");

CREATE TABLE IF NOT EXISTS "site_diary_entry" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "development_name" text,
  "entry_date" date NOT NULL,
  "entry_time" text,
  "weather_condition" text,
  "weather_other" text,
  "weather_temperature_max" numeric,
  "weather_temperature_min" numeric,
  "weather_wind_speed" numeric,
  "weather_gust_speed" numeric,
  "weather_description" text,
  "weather_icon_code" numeric,
  "ground_condition" text,
  "ground_other" text,
  "trades_on_site" jsonb DEFAULT '[]'::jsonb,
  "starship_personnel" numeric,
  "people_on_site_total" numeric,
  "people_on_site_now" numeric,
  "works_carried_out" jsonb DEFAULT '[]'::jsonb,
  "lost_time" jsonb DEFAULT '{}'::jsonb,
  "complaints_compliments" text,
  "incidents_accidents" text,
  "general_comments" text,
  "alert_management" boolean DEFAULT false,
  "created_by_name" text
);
CREATE INDEX IF NOT EXISTS "idx_site_diary_entry_development_id" ON "site_diary_entry" ("development_id");

CREATE TABLE IF NOT EXISTS "stock_allocation" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "allocation_reference" text,
  "allocation_date" date NOT NULL,
  "department_id" text,
  "department_name" text,
  "notes" text,
  "total_value" numeric DEFAULT 0,
  "allocated_by_name" text,
  "line_items" jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS "stock_ledger" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "product_id" text NOT NULL,
  "product_code" text,
  "product_description" text,
  "supplier_id" text NOT NULL,
  "supplier_name" text,
  "uom" text,
  "category_id" text,
  "category_name" text,
  "quantity_in_stock" numeric DEFAULT 0,
  "value_in_stock" numeric DEFAULT 0,
  "unit_cost" numeric,
  "department_id" text,
  "department_name" text,
  "development_id" text,
  "development_name" text
);
CREATE INDEX IF NOT EXISTS "idx_stock_ledger_development_id" ON "stock_ledger" ("development_id");

CREATE TABLE IF NOT EXISTS "stock_take_record" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "stock_take_date" date NOT NULL,
  "status" text,
  "completed_by_name" text,
  "completed_date" timestamptz,
  "total_items_counted" numeric DEFAULT 0,
  "total_variance_value" numeric DEFAULT 0,
  "line_items" jsonb DEFAULT '[]'::jsonb,
  "notes" text
);

CREATE TABLE IF NOT EXISTS "stock_transaction" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "stock_ledger_id" text,
  "product_id" text NOT NULL,
  "product_code" text,
  "product_description" text,
  "supplier_id" text,
  "supplier_name" text,
  "transaction_type" text NOT NULL,
  "quantity" numeric NOT NULL,
  "unit_cost" numeric,
  "total_value" numeric,
  "purchase_order_id" text,
  "po_number" text,
  "stock_allocation_id" text,
  "allocation_reference" text,
  "transaction_date" date NOT NULL,
  "notes" text,
  "created_by_name" text
);

CREATE TABLE IF NOT EXISTS "subcontractor_approval" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "supplier_id" text NOT NULL,
  "supplier_name" text,
  "approval_stage" text,
  "document_check_status" text,
  "financial_review_status" text,
  "quality_review_status" text,
  "approved_date" timestamptz,
  "approved_by" text,
  "approved_by_name" text,
  "rejection_reason" text,
  "vat_certificate_url" text,
  "cis_card_url" text,
  "company_registration_url" text,
  "insurance_documents_url" jsonb DEFAULT '[]'::jsonb,
  "health_safety_policy_url" text,
  "bank_details_verified" boolean DEFAULT false,
  "notes" text
);

CREATE TABLE IF NOT EXISTS "subcontractor_correspondence" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "supplier_id" text NOT NULL,
  "supplier_name" text,
  "correspondence_type" text NOT NULL,
  "subject" text NOT NULL,
  "summary" text,
  "correspondence_date" timestamptz,
  "document_url" text,
  "created_by" text,
  "created_by_name" text
);

CREATE TABLE IF NOT EXISTS "subcontractor_insurance" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "supplier_id" text NOT NULL,
  "supplier_name" text,
  "insurance_type" text NOT NULL,
  "policy_number" text,
  "insurance_level" numeric,
  "expiry_date" date NOT NULL,
  "document_url" text,
  "renewal_reminder_sent" boolean DEFAULT false,
  "notes" text
);

CREATE TABLE IF NOT EXISTS "subcontractor_note" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "supplier_id" text NOT NULL,
  "supplier_name" text,
  "note_text" text NOT NULL,
  "note_category" text,
  "created_by" text,
  "created_by_name" text,
  "created_at" timestamptz
);

CREATE TABLE IF NOT EXISTS "subcontractor_prequalification" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "supplier_id" text NOT NULL,
  "supplier_name" text,
  "preqal_doc_received" boolean DEFAULT false,
  "preqal_doc_received_at" timestamptz,
  "preqal_doc_url" text,
  "prestart_meeting" boolean DEFAULT false,
  "prestart_meeting_at" timestamptz,
  "prestart_meeting_notes" text,
  "notes" text
);

CREATE TABLE IF NOT EXISTS "supplier" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "country_id" text,
  "country_name" text,
  "company_name" text NOT NULL,
  "companies_house_number" text,
  "incorporated_date" text,
  "company_status" text,
  "directors" jsonb DEFAULT '[]'::jsonb,
  "psc" jsonb DEFAULT '[]'::jsonb,
  "vat_number" text,
  "not_registered" boolean DEFAULT false,
  "logo_url" text,
  "contact_name" text,
  "address" text,
  "phone" text,
  "email" text,
  "callout_contact_name" text,
  "callout_phone" text,
  "callout_email" text,
  "notes" text,
  "company_ids" jsonb DEFAULT '[]'::jsonb,
  "xero_company_ids" jsonb DEFAULT '[]'::jsonb,
  "xero_tenant_names" jsonb DEFAULT '[]'::jsonb,
  "cis_registered" boolean DEFAULT false,
  "cis_registered_name" text,
  "cis_rate" text,
  "cis_organisation_type" text,
  "cis_utr" text,
  "cis_trading_name" text,
  "cis_company_registration_number" text,
  "cis_verification_number" text,
  "cis_national_insurance_number" text,
  "cis_deduction_rate" numeric,
  "cis_verification_status" text,
  "cis_verified_date" timestamptz,
  "is_on_hold" boolean DEFAULT false,
  "on_hold_at" timestamptz,
  "on_hold_by" text,
  "on_hold_by_name" text,
  "off_hold_at" timestamptz,
  "off_hold_by" text,
  "off_hold_by_name" text,
  "off_hold_reason" text,
  "is_subcontractor" boolean DEFAULT false,
  "subcontractor_approved" boolean DEFAULT false,
  "subcontractor_approved_at" timestamptz,
  "subcontractor_approved_by" text,
  "subcontractor_approved_by_name" text,
  "priority_supplier" text
);

CREATE TABLE IF NOT EXISTS "timesheet" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "development_name" text,
  "week_ending_date" date NOT NULL,
  "period" text,
  "process_date" date,
  "status" text,
  "submitted_date" timestamptz,
  "submitted_by" text,
  "notes" text
);
CREATE INDEX IF NOT EXISTS "idx_timesheet_development_id" ON "timesheet" ("development_id");

CREATE TABLE IF NOT EXISTS "timesheet_entry" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "timesheet_id" text NOT NULL,
  "employee_id" text NOT NULL,
  "employee_name" text NOT NULL,
  "role" text,
  "department_or_site" text,
  "hourly_rate" numeric DEFAULT 0,
  "monday_hours" numeric DEFAULT 0,
  "tuesday_hours" numeric DEFAULT 0,
  "wednesday_hours" numeric DEFAULT 0,
  "thursday_hours" numeric DEFAULT 0,
  "friday_hours" numeric DEFAULT 0,
  "saturday_hours" numeric DEFAULT 0,
  "sunday_hours" numeric DEFAULT 0,
  "monday_sign_in_hours" numeric DEFAULT 0,
  "tuesday_sign_in_hours" numeric DEFAULT 0,
  "wednesday_sign_in_hours" numeric DEFAULT 0,
  "thursday_sign_in_hours" numeric DEFAULT 0,
  "friday_sign_in_hours" numeric DEFAULT 0,
  "saturday_sign_in_hours" numeric DEFAULT 0,
  "sunday_sign_in_hours" numeric DEFAULT 0,
  "monday_absence" text,
  "tuesday_absence" text,
  "wednesday_absence" text,
  "thursday_absence" text,
  "friday_absence" text,
  "saturday_absence" text,
  "sunday_absence" text,
  "overtime_hours_1" numeric DEFAULT 0,
  "overtime_hours_2" numeric DEFAULT 0,
  "additional_payment" numeric DEFAULT 0,
  "number_of_night_substitutions" numeric DEFAULT 0,
  "gross_substitutions" numeric DEFAULT 0,
  "sick_hours" numeric DEFAULT 0,
  "holiday_hours" numeric DEFAULT 0,
  "bank_holiday_hours" numeric DEFAULT 0,
  "unauthorised_absence_hours" numeric DEFAULT 0,
  "authorised_absence_hours" numeric DEFAULT 0,
  "notes" text
);
CREATE INDEX IF NOT EXISTS "idx_timesheet_entry_employee_id" ON "timesheet_entry" ("employee_id");

CREATE TABLE IF NOT EXISTS "training_matrix_rule" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "job_role_id" text NOT NULL,
  "job_role_name" text,
  "training_module_id" text NOT NULL,
  "training_module_name" text,
  "requirement_type" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "training_module" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "code" text,
  "name" text NOT NULL,
  "delivered_by" text,
  "has_expiry" boolean DEFAULT false,
  "expiry_months" numeric,
  "expiry_alert_days" numeric DEFAULT 30,
  "is_active" boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS "training_record" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "employee_id" text NOT NULL,
  "employee_name" text,
  "training_module_id" text NOT NULL,
  "training_module_name" text,
  "training_module_code" text,
  "delivered_date" date NOT NULL,
  "expiry_date" date,
  "certificate_url" text,
  "employee_signature_url" text,
  "delivered_by" text,
  "trainer_name" text,
  "notes" text
);
CREATE INDEX IF NOT EXISTS "idx_training_record_employee_id" ON "training_record" ("employee_id");

CREATE TABLE IF NOT EXISTS "training_session" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "training_module_id" text NOT NULL,
  "training_module_name" text,
  "session_date" date NOT NULL,
  "session_time" text NOT NULL,
  "location" text,
  "trainer_name" text,
  "delivered_by" text,
  "attendees" jsonb DEFAULT '[]'::jsonb,
  "notes" text,
  "status" text,
  "completed_at" timestamptz
);

CREATE TABLE IF NOT EXISTS "unit_of_measure" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "name" text NOT NULL,
  "abbreviation" text,
  "sort_order" numeric
);

CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "role" text,
  "user_type" text NOT NULL,
  "customer_id" text NOT NULL,
  "territory_ids" jsonb DEFAULT '[]'::jsonb,
  "accessible_developments" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "module_access" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "po_permissions" text NOT NULL,
  "po_authority_level_id" text NOT NULL,
  "po_authority_level_value" numeric NOT NULL,
  "can_raise_retro_po" boolean DEFAULT false,
  "can_exclude_retro_po_from_kpi" boolean DEFAULT false,
  "can_match_invoice" boolean DEFAULT false,
  "can_view_xero_monitor" boolean DEFAULT false,
  "can_manage_budgets" boolean DEFAULT false,
  "can_edit_development" boolean DEFAULT false,
  "builder_access" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "peoplehub_permissions" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "kitbag_permissions" jsonb DEFAULT '{}'::jsonb,
  "payment_run_permissions" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "mobile_app_access" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "johnny5_level" text NOT NULL,
  "johnny5_cell_id" text NOT NULL,
  "johnny5_cell_name" text NOT NULL,
  "johnny5_logo_url" text NOT NULL,
  "installer_development_ids" jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS "idx_user_customer_id" ON "user" ("customer_id");

CREATE TABLE IF NOT EXISTS "visit" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "service_call_id" text NOT NULL,
  "job_id" text,
  "visit_date" date NOT NULL,
  "visit_time" text NOT NULL,
  "assigned_technician" text NOT NULL,
  "status" text,
  "notes" text
);

CREATE TABLE IF NOT EXISTS "work_package" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "development_id" text NOT NULL,
  "development_name" text,
  "reference" text,
  "description" text NOT NULL,
  "package_category_id" text NOT NULL,
  "package_category_name" text,
  "budget_cost" numeric,
  "work_items" jsonb DEFAULT '[]'::jsonb,
  "status" text,
  "notes" text
);
CREATE INDEX IF NOT EXISTS "idx_work_package_development_id" ON "work_package" ("development_id");

CREATE TABLE IF NOT EXISTS "xero_account_code" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "company_id" text NOT NULL,
  "company_name" text,
  "xero_tenant_id" text NOT NULL,
  "code" text NOT NULL,
  "name" text,
  "type" text,
  "tax_code" text,
  "last_synced" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_xero_account_code_company_id" ON "xero_account_code" ("company_id");

CREATE TABLE IF NOT EXISTS "xero_connection" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "company_id" text NOT NULL,
  "company_name" text,
  "xero_tenant_id" text NOT NULL,
  "xero_tenant_name" text,
  "access_token" text,
  "refresh_token" text,
  "token_expiry" timestamptz,
  "status" text,
  "auto_send_suppliers" boolean DEFAULT false,
  "auto_send_invoices" boolean DEFAULT false,
  "field_mappings" jsonb DEFAULT '{}'::jsonb,
  "last_sync_date" timestamptz,
  "notes" text
);
CREATE INDEX IF NOT EXISTS "idx_xero_connection_company_id" ON "xero_connection" ("company_id");

CREATE TABLE IF NOT EXISTS "xero_invoice" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "invoice_id" text NOT NULL,
  "company_id" text NOT NULL,
  "company_name" text,
  "xero_tenant_id" text,
  "invoice_number" text,
  "reference" text,
  "supplier" text,
  "invoice_date" date,
  "due_date" date,
  "status" text,
  "invoice_type" text,
  "net" numeric,
  "tax" numeric,
  "gross" numeric,
  "amount_due" numeric,
  "amount_paid" numeric,
  "date_paid" date,
  "currency" text,
  "synced_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_xero_invoice_company_id" ON "xero_invoice" ("company_id");

CREATE TABLE IF NOT EXISTS "xero_invoice_cache" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "company_id" text NOT NULL,
  "company_name" text,
  "from_date" text,
  "invoices" jsonb DEFAULT '[]'::jsonb,
  "total_fetched" numeric,
  "synced_at" timestamptz,
  "sync_error" text
);
CREATE INDEX IF NOT EXISTS "idx_xero_invoice_cache_company_id" ON "xero_invoice_cache" ("company_id");

CREATE TABLE IF NOT EXISTS "xero_sync_log" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "sync_type" text NOT NULL,
  "record_id" text NOT NULL,
  "record_name" text,
  "supplier_name" text,
  "company_id" text,
  "company_name" text,
  "xero_tenant_id" text,
  "xero_tenant_name" text,
  "status" text NOT NULL,
  "error_message" text,
  "synced_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_xero_sync_log_company_id" ON "xero_sync_log" ("company_id");

CREATE TABLE IF NOT EXISTS "xero_sync_queue" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "purchase_order_id" text NOT NULL,
  "po_number" text,
  "company_id" text NOT NULL,
  "xero_tenant_id" text NOT NULL,
  "status" text,
  "error_message" text,
  "retry_count" numeric DEFAULT 0,
  "queued_at" timestamptz,
  "synced_at" timestamptz,
  "xero_invoice_id" text
);
CREATE INDEX IF NOT EXISTS "idx_xero_sync_queue_company_id" ON "xero_sync_queue" ("company_id");

CREATE TABLE IF NOT EXISTS "xero_tax_rate" (
  "id" text PRIMARY KEY,
  "created_date" timestamptz,
  "updated_date" timestamptz,
  "created_by" text,
  "created_by_id" text,
  "is_sample" boolean DEFAULT false,
  "company_id" text NOT NULL,
  "company_name" text,
  "xero_tenant_id" text NOT NULL,
  "tax_type" text NOT NULL,
  "tax_type_name" text,
  "effective_tax_rate" numeric,
  "last_synced" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_xero_tax_rate_company_id" ON "xero_tax_rate" ("company_id");
