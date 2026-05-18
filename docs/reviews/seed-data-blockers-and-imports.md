# Seed Data — Blockers, Import Patterns & Control-Plane

**Date**: 2026-05-17

## ❌ Hard Blockers: Tables Not in Live DB

These tables were not present in the MCP-accessible reference tenant `gezmfmskhmjgnquoyosq` when checked. This is **not** a direct statement about `aaaa` / Assad, because `rpfhdbtyzuznhfcudrgt` is not accessible through Supabase MCP in this workspace.

For `aaaa`, use the SaaS provisioning runner and control-plane migration ledger as the source of operational evidence, then confirm through clinic-ops/API behavior. If clinic-ops reports `404 table not found`, the target tenant is behind the expected bundle regardless of what the reference tenant contains.

| Table | Migration File | Select Constant |
|---|---|---|
| `document_template_versions` | `20260515170000_report_definition_versions.sql` | `DOCUMENT_TEMPLATE_VERSION_SELECT_FIELDS` |
| `document_template_assets` | (same migration) | `DOCUMENT_TEMPLATE_ASSET_SELECT_FIELDS` |
| `document_render_jobs` | (same migration) | `DOCUMENT_RENDER_JOB_SELECT_FIELDS` |
| `analytical_reports` | `20260515200000_analytical_reports_foundation.sql` | `ANALYTICAL_REPORT_SELECT_FIELDS` |
| `analytical_report_versions` | `20260515200000_analytical_reports_foundation.sql` | `ANALYTICAL_REPORT_VERSION_SELECT_FIELDS` |
| `analytical_report_runs` | `20260515210000_analytical_reports_runtime.sql` | `ANALYTICAL_REPORT_RUN_SELECT_FIELDS` |
| `analytical_report_shares` | `20260517100000_analytical_report_shares.sql` | `ANALYTICAL_REPORT_SHARE_SELECT_FIELDS` |
| `analytical_report_schedules` | `20260517110000_analytical_report_schedules.sql` | `ANALYTICAL_REPORT_SCHEDULE_SELECT_FIELDS` |

**Resolution**: A seed runner must first run a target-tenant capability check through the same environment it will seed. If the target tenant does not have a required table/RPC, fail with a migration-precondition error instead of partially seeding.

## `aaaa` / Assad Control-Plane Evidence Boundary

The control-plane tenant registry contains an `aaaa` row with display name `assad`, project ref `rpfhdbtyzuznhfcudrgt`, status `active`, and plan `starter`. The tenant row's `schema_version` is currently `null`, so do not use that field alone as proof of schema readiness.

The control-plane migration ledger records multiple `database_url` runs for `aaaa`, including later `succeeded` runs after earlier blocked/failed attempts. This proves the SaaS runner executed and logged work; it does **not** prove direct tenant table contents because MCP cannot query that project. The proof chain for `aaaa` must be:

1. SaaS admin runner accepts the tenant DB setup step.
2. `tenant_migration_runs` latest run is `succeeded`.
3. `tenant_migration_items` contains every required migration at `succeeded` or intentionally `skipped` because it was already applied.
4. Clinic-ops can call the real feature path without `404 table not found`, missing-RPC, or schema-cache errors.

Point-in-time check on 2026-05-17:
- Local migration audit reports 67 migrations ending at `20260517110000_analytical_report_schedules.sql`.
- Local bundle checksum is `891c274ecaa818688046316db39f0234fefe5e0796662b190d65c31e7c1d0881`.
- Latest visible `aaaa` migration run expected 66 migrations with checksum `a1b57b68dd0237637ee8e4e663bb93ad6c7ed6bb2b8740b0fd601aaaeb6b81b6`.
- Therefore `aaaa` is not proven against the exact local bundle in this workspace.

## ⚠️ Import Pattern Inconsistency

Per AGENTS.md, service files in `packages/core/services/*.js` **MUST** use relative imports (`../lib/*.js`) because `node:test` doesn't resolve Vite aliases. Currently:

**Using `@/` aliases (10 files — VIOLATION)**:
- `catalogs.js`, `intakes.js`, `insurance.js`, `documents.js`, `doctors.js`, `clinics.js`, `prechecks.js`, `staff.js`, `schedules.js`, `tenantConfig.js`

**Using `../` relative paths (14 files — CORRECT)**:
- `clinical.js`, `auth.js`, `appointments.js`, `patients.js`, `messaging.js`, `slots.js`, `payments.js`, `notificationCore.js`, `medicationCatalog.js`, `templates.js`, `storage.js`, `reportDefinitions.js`, `analyticalReports.js`, `tenantResolver.js`

**Seed script implication**: If the seed script runs outside Vite (e.g., via `node:test` or a standalone script), it must use relative imports or the 10 violating files will fail to resolve. The seed script should either:
1. Run in a Vite context (dev server), or
2. Only import from the 14 correctly-importing service files, or
3. Fix the 10 violating files first

## Control-Plane Architecture

### Tables (14 total, all RLS-enabled)
`tenants`, `plans`, `plan_entitlements`, `tenant_entitlements`, `provisioning_jobs`, `provisioning_steps`, `tenant_domains`, `tenant_domain_drafts`, `tenant_secrets`, `provider_connections`, `provider_secrets`, `tenant_runtime_config`, `prospect_leads`, `audit_log`

### Control-Plane Tenant Rows

These rows are control-plane metadata only. They do not prove direct tenant database schema state.

| Tenant | project_ref | schema_version | plan | entitlements |
|---|---|---|---|---|
| "dev" | `gezmfmskhmjgnquoyosq` | 20260508 | starter | Only plan defaults (messaging, staff_accounts) |
| "aaaa" | `rpfhdbtyzuznhfcudrgt` | null | starter | Control-plane shows 6 visible `manual_override` entitlement rows; verify feature behavior through `admin-sync-entitlements` + clinic-ops |

### Plans
| Plan | Features |
|---|---|
| starter | messaging, staff_accounts |
| growth | + custom_branding, advanced_reports |
| scale | + patient_self_booking, mobile_push_notifications, multi_clinic, clinical_note_templates, document_render_engine |

### Entitlement Alias
`advanced_reports` ↔ `analytical_reports` — alias mapping exists only in `admin-sync-entitlements` Edge Function (`LEGACY_FEATURE_ALIASES`). The `feature_flags` table in tenant DB has only `advanced_reports` code (is_enabled=false).

## Seed Script Execution Order (Dependency Chain)

```
1. authService.signUp() → creates auth.users → trigger creates users + patients
2. doctors service → create doctor profile (links to users.id)
3. clinics service → create clinic
4. scheduleService.createTemplate() + slots → create schedule templates + slots
5. slotService.bookSlot() / appointmentService.bookFromSlot() → creates appointment
6. clinicalService.startEncounter() → creates encounter (auto-fills from appointment)
7. intakeService.saveDraft() + markCompleted() → medical intake
8. precheckService.saveDraft() + submit() → precheck
9. clinicalService.addDiagnosis() → diagnosis (REQUIRED before prescription)
10. clinicalService.addPrescription() → prescription (requires diagnosis)
11. clinicalService.createOrder() → lab/imaging orders
12. clinicalService.addNote() / saveNoteDraft() → clinical notes
13. clinicalService.createDocument() → clinical documents
14. clinicalService.createCareTask() → care tasks
15. paymentService.create() → payments
16. messagingService.createConversation() + sendMessage() → messaging
17. notificationCoreService.createEvent() + createDelivery() → notifications
18. insuranceService.* → insurance contracts, policies, claims
19. catalogService.create() → custom catalog entries (NOT is_system=true ones)
20. tenantConfigService.* → tenant profile, app config, feature flags, consents
```

**Staff members** require Edge Function calls (service-role key) — separate from the above chain.

## Vite Alias Configuration

From `vite.config.js`:
- `@core/*` → `packages/core/*` (canonical)
- `@ui/*` → `packages/ui/*` (canonical)
- `@patient-web/*` → `apps/patient-web/src/*` (canonical)
- `@clinic-ops/*` → `apps/clinic-ops/src/*` (canonical)
- `@/services/*` → `packages/core/services/*` (legacy)
- `@/schemas/*` → `packages/core/schemas/*` (legacy)
- `@/lib/*` → `packages/core/lib/*` (legacy)
- `@/contexts/*` → `packages/ui/contexts/*` (legacy)
- `@/components/*` → `packages/ui/components/*` (legacy)
- `@/hooks/*` → `packages/core/hooks/*` (legacy)
- `@` → `src/*` (root catch-all, must be LAST)

## Test Infrastructure

- Unit tests: `tests/unit/**/*.test.mjs` with `node:test`
- Mock: `tests/unit/services/__helpers__/supabaseMock.mjs` — chainable Supabase fake with `onAuth`, `onFrom`, `onRpc` handlers
- Test hook: `__setSupabaseClientForTest()` in `packages/core/lib/supabase.js`
- Green unit tests = regression guard only, NOT proof against real RLS/constraints
