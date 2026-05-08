# DoctoLeb Backend Duplication Audit

> Purpose: prevent duplicated concepts before any more DB/API/UI work.
> Rule: a duplicate is deleted once replacement and consumers are migrated. This repo has no production data yet, so compatibility surfaces should not linger.

## Decisions

| Concept | Existing Surfaces | Decision | Canonical Owner | Migration Plan |
|---|---|---|---|---|
| Doctor branding | `doctor_brand`, `tenant_profile`, `tenant_app_config`, `clinic_settings` | Legacy deleted | `tenant_profile` + `tenant_app_config` | `BrandContext` now reads `get_public_tenant_app_config`; `doctor_brand` and `clinic_settings` are dropped by `20260506190000_legacy_compatibility_burndown.sql` |
| Doctor workflow | `consultations`, `encounters`, `clinical_notes`, `diagnoses`, `prescriptions` | Legacy deleted | `encounters` domain | Patient/doctor history consumers now read encounters/prescriptions; `consultations` is dropped by the burn-down migration |
| Medical documents | `medical_reports`, `certificates`, `referrals`, `clinical_documents` | Legacy deleted | `clinical_documents` | `documentService` owns reports, certificates, referrals, lab requests, and insurance forms; legacy document tables are dropped |
| Notifications | `notifications`, `notification_events`, `notification_deliveries`, `reminder_rules` | Legacy deleted | `notification_events` + notification worker | Dashboards and notification pages use `notificationCoreService`; role notification creation uses `notify_role_event` RPC |
| Dashboard summaries | `doctor_dashboard_summary`, `doctor_patients`, `upcoming_appointments`, service-level reads | Legacy deleted | Domain services over appointments, encounters, patients | Old summary views are dropped by `20260507091235_drop_legacy_helpers_and_views.sql`; new dashboards should compose canonical service reads or purpose-built RPCs |
| Display helper RPCs | `get_user_full_name`, `get_next_appointment`, `get_doctor_info`, JS display/appointment services | Legacy deleted | `userDisplay`, `appointmentService`, `doctorService` | Helper RPCs are dropped by `20260507091235_drop_legacy_helpers_and_views.sql`; do not add display-only RPCs unless they enforce a real backend invariant |
| Appointment creation | Direct insert, `appointmentService.create`, `book_slot` | Direct insert is forbidden; `appointmentService.create` is compatibility wrapper only when slot fields are present | `book_slot` RPC via `appointmentService.bookFromSlot` | Static audit warns on old callers; RLS/trigger must block unslotted direct inserts |
| Schedule source | `doctor_schedule_templates`, `secretary_slots`, direct appointment time checks | Template materializes slots; slots are the only bookable inventory | `doctor_schedule_templates` + `secretary_slots` | Do not create appointments from raw date/time UI without selecting/creating a slot first |
| Patient history | `patients.medical_history`, `medical_intake`, structured `patient_*` tables | `patients.medical_history` becomes narrative compatibility only | `medical_intake` + structured timeline tables | New intake/history UI writes structured records; narrative field not used for analytics |
| Insurance document generation | `insurance_claims`, `claim_form_templates`, `clinical_documents` | Claims own financial facts; documents own generated printable artifacts | `insurance_claims` + `clinical_documents` | Claim finalization creates/generates document artifact with template snapshot |
| Staff identity | `users.role`, `staff_members.role`, nullable `staff_members.user_id` | User role handles login/RLS; staff table handles employment/hierarchy/invite | `users` + `staff_members` | Non-login staff can exist in `staff_members`; login invite later attaches `user_id` |
| Tenant identity (data) | `tenant_profile`, `tenant_app_config` (tenant DB) vs `tenants`, `tenant_domains` (control plane) | Tenant DB owns *what the tenant looks like to its users*; control plane owns *which Supabase project a hostname belongs to*. Both must exist; neither duplicates the other. | Tenant: `tenant_profile` + `tenant_app_config`. Control plane: `tenants` + `tenant_domains`. | Per ADR-004. Adding `tenant_id` columns to tenant DB tables, or PHI columns to control plane, is a contract violation. |
| Tenant identity (runtime) | Static `VITE_SUPABASE_URL` build-time env var vs runtime resolver | Build-time env var is **DEV fallback only**; production resolves at runtime from hostname. | `tenantResolverService.resolve({ host, surface })` + `configureSupabaseClient(...)`. | Per ADR-004. New code must not embed Supabase project URLs as constants. |
| Service-role authorization | Service-role key in browser response vs server-side env var / secret manager | Service-role keys never reach a browser response under any circumstance. | Server-side env var on the control-plane backend, or a dedicated secret manager. | Resolver may return anon keys (public). Returning service-role keys is a P0 vulnerability. |

## Duplicate Status Enum Gate

Every lifecycle must have exactly one canonical state machine in `src/lib/stateMachines.js`.

| Lifecycle | Canonical Statuses | Raw Status Updates Allowed? |
|---|---|---|
| Appointment | `scheduled`, `confirmed`, `pre_check`, `in_consultation`, `completed`, `cancelled`, `no_show` | No page-level raw writes |
| Encounter | `planned`, `in_progress`, `completed`, `cancelled`, `entered_in_error` | No; RPC-backed lifecycle methods |
| Clinical document | `draft`, `final`, `superseded`, `void` | No; RPC-backed lifecycle methods |
| Order | `draft`, `ordered`, `in_progress`, `resulted`, `cancelled` | Service method only |
| Prescription | `draft`, `active`, `completed`, `stopped`, `cancelled` | Service method only |
| Care task | `open`, `in_progress`, `done`, `cancelled` | Service method only |
| Referral | `pending`, `accepted`, `in_progress`, `completed`, `rejected` | Service method only |

## Duplicate Operation Gate

Before adding a new function/RPC/service method, answer:

- Which domain owns this operation?
- Is there already an RPC, trigger, service method, or Edge Function doing this?
- Does this operation mutate lifecycle status? If yes, why is a new lifecycle method needed?
- Is this operation retryable from mobile? If yes, where is `client_request_id` enforced?
- Does an Edge Function duplicate business logic, or only validate and call the canonical path?

## Known Compatibility Surfaces

- `appointmentService.create()` remains only as a compatibility shim that refuses unslotted creation.
- The old legacy tables/services for consultations, notifications, doctor branding/settings, reports, certificates, and referrals are removed. Do not recreate compatibility services.

## Legacy Removal Watchlist

> Reminder for every future agent: there is no production data yet, so we should remove legacy compatibility surfaces as soon as their consumers are migrated. Do not expand these tables, routes, or services. Do not add new features on top of them. Each pass should ask whether one more consumer can move to the canonical replacement.

| Legacy surface | Canonical replacement | Remove when |
|---|---|---|
| `consultations` table + `consultationService` | `encounters`, `clinical_notes`, `diagnoses`, `prescriptions`, `lab_orders`, `imaging_orders`, `care_tasks` via `clinicalService` or split clinical services | Removed |
| `notifications` table + `notificationService` | `notification_events`, `notification_deliveries`, `patient_devices`, `reminder_rules`, notification worker | Removed |
| `doctor_brand` table + `brandService` legacy reads | `tenant_profile` + `tenant_app_config` public-safe RPCs | Removed |
| `clinic_settings` | `tenant_profile`, `tenant_app_config`, `clinics`, `doctor_schedule_templates` | Removed |
| `medical_reports` | `clinical_documents` + `document_attachments` | Removed |
| `certificates` | `clinical_documents` with certificate document type/template | Removed |
| `referrals` | `clinical_documents` with `document_type = 'referral'` | Removed |
| Old role sidebars (`Sidebar.jsx`, `DoctorSidebar.jsx`, `PreDoctorSidebar.jsx`) | `AppSidebar` + `DashboardLayout` | Already removed; do not recreate |
| Old doctor consultation route/page | `/doctor-encounter/:appointmentId` and `/doctor-encounter-id/:encounterId` | Already removed; do not recreate |

## Deleted In This Phase

`20260506190000_legacy_compatibility_burndown.sql` drops `consultations`, `notifications`, `doctor_brand`, `clinic_settings`, `medical_reports`, `certificates`, and `referrals`. The backend audit now fails if executable code reintroduces table/service references for those surfaces.

Repo source for retired V1 Edge Functions (`auth`, `appointments`, `patients`, `process-payment`, `consultations`, `referrals`) is deleted. Supabase live deletion returned `403` for the current CLI account, so a project owner still needs to delete those deployed functions from the dashboard or owner-authenticated CLI. They are not canonical and should not be used.

## Audit Commands

- Static repo gate: `npm run audit:backend-contract`
- DB branch/live read-only audit: run `supabase/sql/backend_contract_audit.sql`
