# Seed Data — selects.js vs DB Column Drift Audit

**Date**: 2026-05-17
**Ground truth scope**:
- `gezmfmskhmjgnquoyosq` is the MCP-accessible reference/dev tenant used for direct schema inspection.
- `xouqxgwccewvbtkqming` is the MCP-accessible control-plane.
- `rpfhdbtyzuznhfcudrgt` / tenant slug `aaaa` / display name `assad` is **not directly accessible through Supabase MCP**. Any claim about its actual tenant DB schema must come from the SaaS provisioning runner, control-plane migration ledger, or the deployed app behavior. Do not infer `aaaa` tenant table state from `gezmfmskhmjgnquoyosq`.

## Verification Boundary For `aaaa` / Assad

Supabase MCP returns an access-control error for direct queries against `rpfhdbtyzuznhfcudrgt`, so this document cannot assert whether specific tables currently exist inside that tenant database.

The control-plane can confirm metadata about `aaaa` and its migration runs, but the migration ledger is not a substitute for a tenant-side schema query. Treat `aaaa` table existence as verified only when the SaaS migration step reports success **and** the app/API path using that table works without `404 table not found` or RPC-missing errors.

## Missing DB Columns in selects.js (Seed Must Include)

These columns exist in the MCP-accessible reference DB but are **omitted** from the corresponding `*_SELECT_FIELDS` constant. A service-only seed runner should not manually populate these unless the service contract requires them; most are nullable/default metadata. They matter for drift review and raw DB diagnostics, not for bypassing services.

| Select Constant | DB Table | Missing Columns |
|---|---|---|
| `CARE_TASK_SELECT_FIELDS` | `care_tasks` | `archived_at`, `archived_by` |
| `CONVERSATION_SELECT_FIELDS` | `conversations` | `archived_at`, `archived_by` |
| `DIAGNOSIS_SELECT_FIELDS` | `diagnoses` | `archived_at`, `archived_by` |
| `CLINICAL_NOTE_SELECT_FIELDS` | `clinical_notes` | `archived_at`, `archived_by` |
| `LAB_ORDER_SELECT_FIELDS` | `lab_orders` | `archived_at`, `archived_by` |
| `IMAGING_ORDER_SELECT_FIELDS` | `imaging_orders` | `archived_at`, `archived_by` |
| `PRESCRIPTION_SELECT_FIELDS` | `prescriptions` | `archived_at`, `archived_by` |
| `CLINICAL_DOCUMENT_SELECT_FIELDS` | `clinical_documents` | `archived_at`, `archived_by` |
| `DOCUMENT_ATTACHMENT_SELECT_FIELDS` | `document_attachments` | `archived_at`, `archived_by` |
| `PATIENT_DEVICE_SELECT_FIELDS` | `patient_devices` | `push_token` |
| `PATIENT_CONSENT_SELECT_FIELDS` | `patient_consents` | `ip_address`, `user_agent` |

Already correct in current code:
- `CITY_SELECT_FIELDS` includes `country`.
- `OCCUPATION_SELECT_FIELDS` includes `category`.
- `NOTIFICATION_EVENT_SELECT_FIELDS` includes `source`; column ordering in the select string is not a functional drift.

## Select Constants Referencing Non-Existent Tables

These `*_SELECT_FIELDS` constants reference tables that were **not present in the MCP-accessible reference tenant** when checked. The migrations exist in `supabase/migrations/`, but this document does not prove whether they are present in `aaaa` because that tenant project is not directly accessible through MCP.

For `aaaa`, rely on the control-plane `tenant_migration_runs` / `tenant_migration_items` ledger and deployed app behavior. If the app returns `404 table not found`, the target tenant is behind the bundle or the migration runner incorrectly skipped a required migration.

| Select Constant | Referenced Table | Status |
|---|---|---|
| `DOCUMENT_TEMPLATE_VERSION_SELECT_FIELDS` (lines 842-860) | `document_template_versions` | ❌ Not in live DB |
| `DOCUMENT_TEMPLATE_ASSET_SELECT_FIELDS` (lines 862-881) | `document_template_assets` | ❌ Not in live DB |
| `DOCUMENT_RENDER_JOB_SELECT_FIELDS` (lines 883-897) | `document_render_jobs` | ❌ Not in live DB |
| `ANALYTICAL_REPORT_SELECT_FIELDS` (lines 899-912) | `analytical_reports` | ❌ Not in live DB |
| `ANALYTICAL_REPORT_VERSION_SELECT_FIELDS` (lines 914-928) | `analytical_report_versions` | ❌ Not in live DB |
| `ANALYTICAL_REPORT_RUN_SELECT_FIELDS` (lines 930-946) | `analytical_report_runs` | ❌ Not in live DB |
| `ANALYTICAL_REPORT_SHARE_SELECT_FIELDS` (lines 948-955) | `analytical_report_shares` | ❌ Not in live DB |
| `ANALYTICAL_REPORT_SCHEDULE_SELECT_FIELDS` (lines 957-972) | `analytical_report_schedules` | ❌ Not in live DB |

## Column Naming Mismatches (Code vs DB)

| Code/Migration Name | Live DB Name | Affected Tables |
|---|---|---|
| `key` | `code` | `feature_flags`, `billable_services`, `visit_types` |
| `display_name` | `name` | `feature_flags`, `billable_services` |
| `appointment_date` | `scheduled_at` | `appointments` |
| `full_name` (on patients) | `first_name`/`last_name` on `users` | Patient names live on `users` table |
| `tenant_profiles` (plural) | `tenant_profile` (singular) | Live DB uses singular |
| `tenant_app_configs` (plural) | `tenant_app_config` (singular) | Live DB uses singular |
| `medical_intakes` (plural) | `medical_intake` (singular) | Live DB uses singular |
| `disease_types` | `diseases` | Live DB uses `diseases` |
| `is_system` on `billable_services` | N/A | `billable_services` does NOT have `is_system`; only 11 catalog tables do |

## Tables That DO Have `is_system` (11 total)

`blood_groups`, `cities`, `claim_form_templates`, `diseases`, `family_relations`, `insurance_providers`, `occupations`, `specialties`, `surgery_types`, `vaccines`, `visit_types`

`CATALOG_SELECT_FIELDS` includes `is_system` — correct for these 11 tables. `BILLABLE_SERVICE_FIELDS` correctly excludes it.

## `clinical_documents.template_id` Column

Current `CLINICAL_DOCUMENT_SELECT_FIELDS` includes `template_id`, but direct MCP inspection of the reference tenant `gezmfmskhmjgnquoyosq` did **not** show `clinical_documents.template_id`. That means the code/snapshot may be ahead of the accessible reference tenant.

For `aaaa`, this is unverified by direct DB access. The correct proof is: SaaS tenant migration runner applies `clinical_documents_template_link`, then clinic-ops can read/create clinical documents without PostgREST select errors.
