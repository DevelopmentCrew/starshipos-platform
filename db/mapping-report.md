# StarshipOS entity -> Postgres table mapping

Generated from 149 Base44 entities. Types mapped: string->text (date/date-time typed), number->numeric, boolean->boolean, array/object->jsonb, enum->text+CHECK.

System columns added to every table: id (PK), created_date, updated_date, created_by, created_by_id, is_sample.


| Entity | Table | Cols | jsonb | enums | *_id (likely FK) |
|---|---|---|---|---|---|
| ApiToken | api_token | 10 | 1 | 1 | - |
| AppConfig | app_config | 12 | 0 | 0 | - |
| AppCounter | app_counter | 2 | 0 | 0 | - |
| AppMessage | app_message | 8 | 0 | 0 | - |
| Appliance | appliance | 13 | 0 | 0 | property_id, appliance_type_id, category_id |
| ApplianceCategory | appliance_category | 3 | 0 | 0 | - |
| ApplianceType | appliance_type | 8 | 0 | 0 | category_id |
| Assembly | assembly | 8 | 1 | 2 | - |
| AssemblyLayer | assembly_layer | 11 | 1 | 2 | assembly_id |
| AssetAuditLog | asset_audit_log | 8 | 0 | 1 | owned_asset_id, hired_asset_id |
| AssetComment | asset_comment | 7 | 0 | 1 | owned_asset_id, hired_asset_id |
| AssetCost | asset_cost | 4 | 0 | 0 | hired_asset_id |
| BOMItem | bom_item | 7 | 0 | 1 | - |
| Block | block | 6 | 1 | 0 | development_id |
| BudgetAuditLog | budget_audit_log | 10 | 0 | 1 | development_id |
| BudgetTransfer | budget_transfer | 13 | 0 | 2 | development_id |
| Bug | bug | 12 | 2 | 2 | - |
| BuildingComponent | building_component | 15 | 3 | 4 | - |
| CallGroup | call_group | 4 | 1 | 0 | - |
| CallLog | call_log | 16 | 0 | 2 | - |
| Category | category | 3 | 0 | 0 | - |
| Check | check | 7 | 0 | 2 | check_group_id, check_sheet_id |
| CheckGroup | check_group | 3 | 0 | 0 | check_sheet_id |
| CheckInstance | check_instance | 11 | 0 | 1 | check_sheet_id, development_id |
| CheckResponse | check_response | 8 | 0 | 2 | check_instance_id, check_id, check_sheet_id |
| CheckSheet | check_sheet | 7 | 0 | 2 | category_id |
| CheckSheetCategory | check_sheet_category | 3 | 0 | 0 | - |
| Company | company | 13 | 0 | 0 | country_id |
| ComponentDrawing | component_drawing | 11 | 0 | 1 | building_component_id |
| ContingencyItem | contingency_item | 4 | 0 | 0 | development_id |
| ContractSumAdjustment | contract_sum_adjustment | 14 | 0 | 1 | development_id |
| Country | country | 8 | 0 | 0 | - |
| CreditNote | credit_note | 22 | 1 | 2 | purchase_order_id, company_id, development_id, supplier_id |
| CreditorPaymentSchedule | creditor_payment_schedule | 6 | 0 | 0 | creditor_record_id, company_id |
| CreditorRecord | creditor_record | 12 | 0 | 0 | company_id |
| DeliveryJob | delivery_job | 19 | 1 | 1 | development_id, supplier_id |
| Department | department | 3 | 0 | 0 | - |
| DepreciationMethod | depreciation_method | 2 | 0 | 0 | - |
| Development | development | 58 | 1 | 4 | country_id, company_id |
| DevelopmentCheckAllocation | development_check_allocation | 5 | 0 | 1 | development_id, check_sheet_id |
| DevelopmentPackage | development_package | 25 | 2 | 2 | development_id, work_package_id, package_category_id, supplier_id |
| DevelopmentPrelim | development_prelim | 8 | 1 | 0 | development_id |
| DevelopmentProfessionalFee | development_professional_fee | 6 | 2 | 0 | development_id |
| Employee | employee | 23 | 0 | 4 | company_id, job_role_id |
| EmployeeContract | employee_contract | 5 | 0 | 0 | employee_id |
| EmployeeDevelopmentHistory | employee_development_history | 6 | 0 | 0 | employee_id, development_id |
| EmployeeNote | employee_note | 5 | 0 | 0 | employee_id |
| EmployeeSalaryAudit | employee_salary_audit | 9 | 3 | 0 | employee_id |
| EmployeeSalaryDetails | employee_salary_details | 8 | 0 | 0 | employee_id |
| EmployersInstruction | employers_instruction | 10 | 0 | 0 | development_id |
| Estimate | estimate | 24 | 2 | 1 | development_id, plot_id |
| EstimateLine | estimate_line | 14 | 1 | 2 | estimate_id |
| EstimatingRate | estimating_rate | 15 | 1 | 2 | - |
| GSDAction | gsd_action | 15 | 1 | 2 | gsd_log_id, check_response_id, development_id |
| GSDActionLog | gsd_action_log | 4 | 0 | 0 | development_id |
| GSDCategory | gsd_category | 3 | 0 | 0 | - |
| GSDLog | gsd_log | 20 | 1 | 2 | development_id, gsd_category_id, check_instance_id |
| GlobalPackageCategory | global_package_category | 3 | 0 | 0 | - |
| HelpArticle | help_article | 7 | 0 | 1 | - |
| HiredAsset | hired_asset | 35 | 0 | 3 | development_id, company_id, supplier_id, kit_category_id, kit_sub_category_id |
| HistoricalTransaction | historical_transaction | 20 | 1 | 1 | development_id, category_id |
| HouseTypeBOM | house_type_bom | 10 | 0 | 0 | bom_item_id |
| IVRRoute | ivr_route | 6 | 0 | 0 | - |
| InformationRequest | information_request | 18 | 0 | 2 | development_id, work_package_id |
| Invitation | invitation | 22 | 6 | 3 | po_authority_level_id |
| J5CheckItem | j5_check_item | 5 | 0 | 1 | - |
| J5CheckResponse | j5_check_response | 10 | 0 | 1 | manufacturing_job_id |
| Job | job | 15 | 1 | 1 | service_call_id, development_package_id, supplier_id |
| JobRole | job_role | 5 | 0 | 0 | company_id |
| JobUpdate | job_update | 5 | 1 | 0 | job_id |
| KitCategory | kit_category | 2 | 0 | 0 | - |
| KitSubCategory | kit_sub_category | 4 | 0 | 0 | kit_category_id |
| MaintenanceJob | maintenance_job | 14 | 0 | 3 | owned_asset_id, hired_asset_id, maintenance_schedule_id |
| MaintenanceSchedule | maintenance_schedule | 8 | 0 | 2 | owned_asset_id, hired_asset_id |
| ManufacturingCell | manufacturing_cell | 7 | 0 | 1 | development_id |
| ManufacturingJob | manufacturing_job | 55 | 4 | 6 | development_id, plot_id, building_component_id |
| MaterialCategory | material_category | 3 | 0 | 0 | - |
| MeasuredWorkMasterItem | measured_work_master_item | 13 | 0 | 0 | development_id, plot_id |
| NCR | ncr | 16 | 1 | 2 | development_id, category_id |
| NCRCategory | ncr_category | 3 | 0 | 0 | - |
| NCRComment | ncr_comment | 4 | 0 | 0 | ncr_id |
| Opportunity | opportunity | 34 | 3 | 5 | country_id, category_id |
| OwnedAsset | owned_asset | 27 | 0 | 1 | development_id, kit_category_id, kit_sub_category_id, depreciation_method_id |
| POAuditLog | po_audit_log | 9 | 0 | 1 | purchase_order_id |
| POAuthorityLevel | po_authority_level | 3 | 0 | 0 | - |
| PackageCategory | package_category | 9 | 0 | 0 | development_id |
| PaymentPack | payment_pack | 10 | 0 | 1 | development_id |
| PaymentPackLineItem | payment_pack_line_item | 27 | 1 | 3 | payment_pack_id, development_package_id, purchase_order_id |
| PaymentRun | payment_run | 12 | 1 | 2 | company_id |
| PlanRevision | plan_revision | 11 | 1 | 1 | estimate_id |
| Plot | plot | 11 | 0 | 1 | development_id, block_id |
| PrelimCostItem | prelim_cost_item | 9 | 0 | 0 | development_id, prelim_heading_id |
| PrelimCostType | prelim_cost_type | 7 | 0 | 0 | development_id |
| PrelimHeading | prelim_heading | 3 | 0 | 0 | - |
| PricingSetting | pricing_setting | 6 | 0 | 1 | - |
| Priority | priority | 4 | 0 | 0 | - |
| ProcurementSchedule | procurement_schedule | 15 | 0 | 3 | development_id, development_package_id |
| Product | product | 12 | 0 | 0 | supplier_id, category_id |
| ProductCategory | product_category | 3 | 0 | 0 | - |
| ProfessionalFeeItem | professional_fee_item | 8 | 0 | 0 | development_id, professional_fee_type_id |
| ProfessionalFeeType | professional_fee_type | 5 | 0 | 0 | development_id |
| ProgrammeData | programme_data | 7 | 1 | 0 | development_id |
| ProgressUpdate | progress_update | 7 | 2 | 1 | service_call_id |
| Property | property | 17 | 0 | 0 | development_id, property_owner_id, property_type_id |
| PropertyOwner | property_owner | 8 | 0 | 0 | user_id |
| PropertyType | property_type | 11 | 0 | 1 | development_id |
| PurchaseInvoice | purchase_invoice | 22 | 1 | 2 | purchase_order_id, xero_invoice_id, development_package_id |
| PurchaseOrder | purchase_order | 63 | 2 | 9 | hired_asset_id, company_id, department_id, supplier_id, development_id, payment_pack_id, payment_run_id |
| PurchaseOrderLineItem | purchase_order_line_item | 15 | 0 | 0 | purchase_order_id, product_id |
| QSAccrual | qs_accrual | 12 | 0 | 1 | development_id, category_id |
| RedTag | red_tag | 12 | 0 | 2 | owned_asset_id, hired_asset_id |
| Resident | resident | 13 | 1 | 1 | property_id, property_owner_id |
| RevenueApplication | revenue_application | 11 | 0 | 1 | development_id |
| RevenueApplicationItem | revenue_application_item | 17 | 0 | 1 | revenue_application_id, development_id |
| RiskOpportunity | risk_opportunity | 9 | 0 | 2 | development_id |
| SalesHubCategory | sales_hub_category | 2 | 0 | 0 | - |
| SalesHubMarket | sales_hub_market | 3 | 0 | 0 | - |
| SalesHubProposalType | sales_hub_proposal_type | 2 | 0 | 0 | - |
| ServiceCall | service_call | 28 | 1 | 3 | property_id, property_owner_id, resident_id |
| Shift | shift | 7 | 1 | 0 | development_id |
| SignInRecord | sign_in_record | 11 | 0 | 1 | development_id |
| SiteDiaryEntry | site_diary_entry | 25 | 3 | 2 | development_id |
| StockAllocation | stock_allocation | 8 | 1 | 0 | department_id |
| StockLedger | stock_ledger | 15 | 0 | 0 | product_id, supplier_id, category_id, department_id, development_id |
| StockTakeRecord | stock_take_record | 8 | 1 | 1 | - |
| StockTransaction | stock_transaction | 17 | 0 | 1 | stock_ledger_id, product_id, supplier_id, purchase_order_id, stock_allocation_id |
| SubcontractorApproval | subcontractor_approval | 17 | 1 | 4 | supplier_id |
| SubcontractorCorrespondence | subcontractor_correspondence | 9 | 0 | 1 | supplier_id |
| SubcontractorInsurance | subcontractor_insurance | 9 | 0 | 1 | supplier_id |
| SubcontractorNote | subcontractor_note | 7 | 0 | 1 | supplier_id |
| SubcontractorPrequalification | subcontractor_prequalification | 9 | 0 | 0 | supplier_id |
| Supplier | supplier | 48 | 5 | 3 | country_id |
| Timesheet | timesheet | 9 | 0 | 1 | development_id |
| TimesheetEntry | timesheet_entry | 38 | 0 | 0 | timesheet_id, employee_id |
| TrainingMatrixRule | training_matrix_rule | 5 | 0 | 1 | job_role_id, training_module_id |
| TrainingModule | training_module | 7 | 0 | 1 | - |
| TrainingRecord | training_record | 12 | 0 | 1 | employee_id, training_module_id |
| TrainingSession | training_session | 11 | 1 | 2 | training_module_id |
| UnitOfMeasure | unit_of_measure | 3 | 0 | 0 | - |
| User | user | 25 | 9 | 2 | po_authority_level_id |
| Visit | visit | 7 | 0 | 1 | service_call_id, job_id |
| WorkPackage | work_package | 10 | 1 | 1 | development_id, package_category_id |
| XeroAccountCode | xero_account_code | 8 | 0 | 0 | company_id |
| XeroConnection | xero_connection | 13 | 1 | 1 | company_id |
| XeroInvoice | xero_invoice | 19 | 0 | 0 | company_id |
| XeroInvoiceCache | xero_invoice_cache | 7 | 1 | 0 | company_id |
| XeroSyncLog | xero_sync_log | 11 | 0 | 2 | company_id |
| XeroSyncQueue | xero_sync_queue | 10 | 0 | 1 | purchase_order_id, company_id, xero_invoice_id |
| XeroTaxRate | xero_tax_rate | 7 | 0 | 0 | company_id |

**Totals:** 149 tables, 1762 declared columns (+6 system cols each).