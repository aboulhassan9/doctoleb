# Backend/API Contract Freeze Implementation Notes

> Phase: backend/API contract freeze and duplication audit.
> Intent: stabilize DB/API/service contracts before more frontend work.

## What Was Implemented

- Added `BACKEND_CONTRACT_LEDGER.md` as the domain-level source of truth for auth, appointments, intake, encounters, insurance, messaging, notifications, and tenant config.
- Added `BACKEND_DUPLICATION_AUDIT.md` with explicit keep/deprecate/alias/migrate decisions for overlapping systems.
- Added `BACKEND_FEATURE_ACCEPTANCE_TEMPLATE.md` so every future backend feature must declare data, auth/RLS, service/API, failure modes, tests, and rollback.
- Added `SUPABASE_ADVISOR_SNAPSHOT_20260506.md` with live MCP advisor findings and next DB hardening priorities.
- Added `supabase/sql/backend_contract_audit.sql`, a read-only Supabase branch/live audit query pack.
- Added and applied `supabase/migrations/20260506170000_backend_contract_advisor_cleanup.sql` to close trigger-only RPC exposure and clean duplicate advisor findings in the live development Supabase project.
- Added `scripts/backend-contract-audit.mjs`, a static repo gate for backend contract drift.
- Added `npm run audit:backend-contract` and included it in `npm run verify`.
- Added `npm run test:backend-db-contract` and included it in `npm run verify`. It is safe by default: it skips unless branch/local DB environment variables are provided and refuses the live project unless explicitly overridden.
- Added and applied `supabase/migrations/20260506171000_backend_contract_query_path_indexes.sql` for high-value query-path FK indexes covering encounter tabs, messaging participants, mobile notification send-attempt/device reads, and schedule-by-location screens.
- Added missing clinical service contracts already referenced by encounter UI/hook code:
  - `getDocumentsByEncounter`
  - `createClinicalDocument`
  - `getDiagnosesByEncounter`
  - `getPrescriptionsByEncounter`
  - `getOrdersByEncounter`
  - `getCareTasksByEncounter`
  - `getCareTaskById`
  - `transitionCareTask`
- Fixed `useEncounter.startEncounter()` to handle the real `start_encounter` RPC return shape, which returns an encounter row, not only an ID.
- Standardized higher-priority older list services toward `{ data, meta, error }` by moving appointment, patient, intake history, insurance, schedule, staff, catalog, clinic, slot, and legacy notification list reads onto `apiPaged()`.
- Added Zod validation coverage for older write paths in intake/history, insurance, schedules, staff, catalogs, clinics, slots, patients, and legacy notifications.
- Added compatibility/deprecation comments to legacy services so new work does not expand `consultations`, `notifications`, `doctor_brand`, `clinic_settings`, `medical_reports`, `certificates`, or `referrals` by accident.
- Standardized the remaining legacy list services that still used the old optional `paginateQuery()` helper: `consultations`, `medical_reports`, `certificates`, `referrals`, `payments`, `doctors`, and `precheck_forms`.
- Removed the dead `src/lib/pagination.js` helper so `apiPaged()` is the only list pagination contract.
- Tightened `apiCall()` so single reads/writes return only `{ data, error }`; list methods must use `apiPaged()` and return `{ data, meta, error }`.
- Added a static audit gate that catches imported service method calls with no matching service method implementation.
- Added compatibility fixes discovered by that gate: `authService.setUserSession()` is now a Supabase-auth no-op, `notificationService.getByUserId()` aliases `getAll()`, and `referralService.getByDoctorId()` / `updateStatus()` now exist for hook consumers.
- Fixed notification hook unread/read state to use the real `is_read` field instead of a stale `read` UI field.
- Removed the obsolete doctor-consultation route/page and old role-specific sidebar components now replaced by the canonical encounter flow and `AppSidebar`.
- Repointed doctor dashboard/appointment actions from the legacy consultation screen to `/doctor-encounter/:appointmentId`.

## Contract Gates Added

`npm run audit:backend-contract` currently blocks on:

- page-level raw Supabase calls,
- frontend `password_hash` references,
- wildcard selects in services and Edge Functions,
- legacy `paginateQuery()` usage in services,
- legacy `count` fields returned from single-read/write service paths,
- duplicate service method names,
- imported service method calls with no matching declared method,
- encounter layer calls to missing `clinicalService` methods,
- missing clinical lifecycle RPC service wrappers.

It also warns on known compatibility surfaces:

- legacy `appointmentService.create()` callers,
- repeated public function definitions in migrations that must be verified as replacements, not overload drift.

## What This Phase Intentionally Did Not Do

- Did not delete legacy tables.
- Did not build large frontend flows.
- Did not fully rewrite every old service in one pass.
- Did not deploy Edge Functions.

## Persistent Legacy Removal Reminder

There is no production data yet. Legacy tables should stay only long enough to migrate current consumers, not because we are afraid to remove them.

Every future backend or UI slice should check this list and migrate/delete what it safely can:

- `consultations` -> `encounters` and clinical timeline tables.
- `notifications` -> `notification_events`, notification send-attempt records, devices, and reminder rules.
- `doctor_brand` / `clinic_settings` -> `tenant_profile` and `tenant_app_config`.
- `medical_reports` / `certificates` / `referrals` -> `clinical_documents`, attachments, templates, and explicit clinical workflow tables if needed.

Do not add new features on legacy surfaces. Either migrate a consumer, create a temporary adapter with a removal note, or update `BACKEND_DUPLICATION_AUDIT.md` with a deliberate keep decision.

## Remaining Backend Freeze Work

- Continue adding Zod validation to any remaining legacy write paths discovered by audit, especially doctor profile/admin operations that are still compatibility-only.
- Keep reviewing performance advisor FK-index findings and add only indexes that match actual query paths.
- Add branch/local DB tests for RLS and lifecycle RPCs.
- Decide Edge Function parity for mobile by domain.
- Migrate frontend consumers from compatibility surfaces:
  - `consultations` to `encounters`,
  - `notifications` to notification events and notification send-attempt records,
  - `doctor_brand` to tenant profile/app config,
  - legacy document tables to `clinical_documents`.

## How Another Agent Should Continue

1. Run `npm run audit:backend-contract`.
2. Run the SQL in `supabase/sql/backend_contract_audit.sql` against a Supabase branch or local database.
3. Fill `BACKEND_FEATURE_ACCEPTANCE_TEMPLATE.md` for the next backend slice before coding.
4. Do not create new DB tables/functions/services until `BACKEND_DUPLICATION_AUDIT.md` proves there is no existing canonical concept.
5. Prefer narrow backend corrections and tests over broad UI work until contracts are stable.
