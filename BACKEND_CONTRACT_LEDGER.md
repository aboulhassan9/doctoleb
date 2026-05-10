# DoctoLeb Backend Contract Ledger

> Status: contract-freeze working ledger.
> Scope: backend/API only; no large frontend implementation in this phase.
> Live source of truth: Supabase project `gezmfmskhmjgnquoyosq` (currently the development tenant; will become tenant 1 in the control-plane registry).
> Tenancy model: one Supabase project/database per doctor tenant; no `tenant_id` inside tenant DB.
> Runtime routing: `hostname → tenant resolver → tenant Supabase client → existing canonical services`. See `docs/decisions/ADR-004-domain-routing-and-control-plane-contract.md`.

## Contract Rules

- List reads return `{ data, meta, error }`, where `meta.pagination` exists for paged lists.
- Single reads and writes return `{ data, error }`.
- Every write validates through Zod before touching Supabase.
- Retryable mobile writes include `client_request_id`.
- Lifecycle status changes go through a named lifecycle method/RPC, never a raw page-level status update.
- Pages/components do not import Supabase directly.
- Services own DB selectors, normalizers, RPC calls, and DB-to-UI shape.
- Canonical repo Edge Functions are listed in the domain ledger below. Future Edge Functions must not duplicate business logic; they validate/authenticate and call canonical RPC/service paths.
- Old duplicate tables are removed once replacement consumers are migrated. There is no production data yet, so dead/duplicate surfaces should not be preserved by default.
- New work must not recreate or build on the removed legacy surfaces: `consultations`, `notifications`, `doctor_brand`, `clinic_settings`, `medical_reports`, `certificates`, or `referrals`.
- **No `tenant_id` columns inside any tenant DB table.** Tenant isolation is at the Supabase project level. Adding `tenant_id` to a tenant table is a contract violation, blocked by `npm run audit:backend-contract` (Slice F of ADR-004).
- **No service-role keys may be returned by any frontend-reachable response.** Anon keys are public (resolver may return them); service-role keys live only in server-side env vars or a secret manager.
- Production bundles must be scanned during deploy. `npm run audit:bundle-secrets` blocks service/provider/payment secret markers for all three apps and blocks tenant local-fallback URL/JWT material from patient/ops bundles.

## Runtime Tenant Connection

Per ADR-004, the Supabase client a service talks to is no longer a static singleton built from `import.meta.env.VITE_SUPABASE_URL`. It is configured at runtime by the app bootstrap, after the resolver returns the tenant connection blob.

```txt
window.location.hostname
        -> classifyHostname(hostname)            (packages/core, pure function)
        -> tenantResolverService.resolve({...})  ({ data, error } envelope)
        -> configureSupabaseClient({ url, anonKey })
        -> services in packages/core call supabase.from(...) / supabase.rpc(...) as before
```

Service contracts are unchanged. Every existing `import { supabase } from '@/lib/supabase'` continues to work via a Proxy compatibility shim. What changed is when the underlying client is constructed and against which tenant.

The resolver endpoint itself is **public** but returns only routing metadata. PHI never flows through it. The control-plane database backing it stores only tenant routing/provisioning rows (`tenants`, `tenant_domains`, etc.) — see ADR-004 for the schema. Direct browser execution of `public.resolve_tenant(text,text)` is revoked; the public interface is the `tenant-resolve` Edge Function, which calls the RPC with service-role access.
The public resolver contract is post-deploy smoked by `npm run smoke:tenant-resolver`: Vercel patient/ops hosts must resolve, uppercase host lookup must remain case-insensitive, unknown hosts and wrong surfaces must fail with stable errors, pending not-purchased domains must remain inactive, and responses must not contain forbidden secret markers.
The control-plane admin Edge Functions are authenticated and RBAC-gated, and their browser CORS boundary must remain explicit. `CONTROL_PLANE_ALLOWED_ORIGINS` must list verified console origins such as `https://doctoleb-control-plane.vercel.app`; wildcard admin CORS is blocked by `tests/unit/saasFoundationContracts.test.mjs` and live-smoked by `npm run smoke:control-plane-admin-cors`.
Control-plane zero-PHI drift is also a backend contract: `npm run audit:backend-contract` fails if `supabase-control-plane` migrations/functions introduce tenant clinical tables, PHI-owned columns, or direct clinical table access.
Provider-aware tenant draft creation is now part of the control-plane contract. `admin-create-provisioning-job` may accept `automationMode`, `supabaseConnectionId`, and `vercelConnectionId`, but it must only store provider metadata and secret references. `admin_create_tenant_draft_atomic(...)` seeds `tenant_provisioning_steps` with idempotency keys, preconditions, postconditions, and undo strategies before any runner executes provider-aware work.
Provisioning runner APIs are server-owned. `admin-run-provisioning-step` can verify provider readiness, operator-linked Supabase runtime config, tenant DB migration readiness, tenant profile/app config, first doctor/admin seed, Vercel/free-alias routing, resolver smoke, and activation. `admin-cancel-provisioning-job`, `admin-resume-provisioning-job`, and `admin-compensate-provisioning-step` expose cancel/recovery/undo through authenticated admin functions only. Cancelled jobs stay terminal for audit; recovery creates a new provisioning ledger for the same tenant and carries forward only safe completed checkpoints. React may call these named admin functions but must never mutate `tenant_provisioning_jobs` or `tenant_provisioning_steps` directly.

Local development fallback: setting `VITE_DEV_TENANT_SLUG` plus the existing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` lets `npm run dev:patient` / `npm run dev:ops` boot without a control plane.

## Legacy Removal Reminder

Read this before every backend/UI slice:

- Legacy history compatibility is deleted. New clinical workflow is `encounters` plus Tier 2 clinical tables.
- Legacy in-app notifications are deleted. New notification core is `notification_events` plus notification send-attempt records and devices.
- Legacy branding/config surfaces are deleted. New tenant/mobile config is `tenant_profile` plus `tenant_app_config`.
- Legacy report/certificate/referral tables are deleted. Generated/printable/downloadable records live in `clinical_documents` plus attachments/templates.
- Old role sidebars and old doctor consultation route are already removed. Do not recreate them.
- Each implementation pass should run `npm run audit:backend-contract` so removed legacy table/service references cannot return.
- Live Supabase still needs a project-owner action to delete deployed retired V1 Edge Functions (`auth`, `appointments`, `patients`, `process-payment`, `consultations`, `referrals`) if they appear in the dashboard. Repo source is gone and the current web app has no consumer for them.

## Migration Replay Baseline

The live tenant originally had several tables created outside the tracked migration history. Fresh tenant replay is now handled by:

- `supabase/migrations/20240625000000_baseline_core_tables.sql`
- `supabase/migrations/20240627000000_cleanup_bootstrap_scheduling_artifacts.sql`

The baseline runs before the old `20240626_create_scheduling_tables.sql` migration and creates the current core table shape plus temporary legacy shells required by historical migrations. The cleanup migration removes prototype scheduling RLS policies and the transient `patients.created_by` column immediately afterward. Do not move this baseline to 2026 ordering; fresh replay needs it before the 2024 scheduling migration. The legacy shells are not canonical surfaces and are still dropped by `20260506190000_legacy_compatibility_burndown.sql`.

## Domain Ledger

### Auth And Identity

**Canonical tables**

- `auth.users`: Supabase Auth identity.
- `public.users`: domain identity, role, profile basics, `auth_user_id` link.
- `patients`, `doctors`, `predoctors`, `staff_members`: role/domain extensions.

**Canonical services**

- `authService`: sign-in, sign-up, logout, forgot/reset password.
- `authIdentity`: session profile resolution by `auth_user_id`; email inference is not allowed for new identity work.
- `staffService.invite`: doctor-owned staff invite request; calls the `staff-invite` Edge Function.
- `staffService.deactivate`: doctor-owned staff access disable/cancel request; calls the `staff-member-disable` Edge Function.
- `staffService.resendInvite`: doctor-owned pending staff invite resend request; calls the `staff-invite-resend` Edge Function with a client request id.
- `staffService.reissueInvite`: doctor-owned cancelled-pending-invite reissue request; calls the `staff-invite-reissue` Edge Function with a client request id.
- `staffService.reactivate`: doctor-owned accepted-staff reactivation request; calls the `staff-member-reactivate` Edge Function.

**Canonical Edge Functions**

- `staff-invite`: authenticated tenant Edge Function for doctor staff onboarding. It validates the caller JWT, requires an active doctor profile, sends the Supabase Auth invite with the service-role key server-side, calls `create_staff_invite_domain_identity` for atomic domain rows, and soft-deletes the just-created Auth identity if domain creation fails.
- `staff-member-disable`: authenticated tenant Edge Function for staff invite cancellation and accepted-staff access disable. It validates the caller JWT, calls `disable_staff_member_domain_identity` through service-role access, soft-deletes only pending/non-accepted Auth identities, and preserves accepted Auth identities for future reactivation.
- `staff-invite-resend`: authenticated tenant Edge Function for pending invite resends. It validates the caller JWT, creates or reuses an idempotent `staff_invite_resend_events` row, sends the Supabase Auth invite server-side, and finalizes the event as `sent` or `failed` without exposing service-role material.
- `staff-invite-reissue`: authenticated tenant Edge Function for cancelled pending invite recovery. It validates the caller JWT, creates or reuses an idempotent `staff_invite_reissue_events` row, sends a new Supabase Auth invite server-side, relinks the tenant domain user through `finish_staff_invite_reissue_event`, and can be undone by the existing disable/cancel flow.
- `staff-member-reactivate`: authenticated tenant Edge Function for re-enabling previously accepted staff. It validates the caller JWT and calls `reactivate_staff_member_domain_identity`; v1 rejects cancelled pending invites because they use `staff-invite-reissue`.

**Writes**

- Patient sign-up is auth-backed and should provision domain profile through DB/server-backed creation.
- Staff/doctor creation is staff/admin workflow; public signup must not create staff.
- Staff invite creation is server-side only. Browser code must not directly insert `staff_members` onboarding rows.
- Staff lifecycle disable/cancel is server-side only. Browser code must not directly update `staff_members.user_id`, `invite_status`, `is_active`, disable metadata, or Auth linkage.
- Staff invite resend is server-side only. Browser code must not directly update `invite_resent_at`, `invite_resent_by`, `invite_resend_count`, or insert resend event rows.
- Staff invite reissue is server-side only. Browser code must not directly update `invite_reissued_at`, `invite_reissued_by`, `invite_reissue_count`, Auth linkage, or insert reissue event rows.
- Staff member reactivation is server-side only. Browser code must not directly update `reactivated_at`, `reactivated_by`, `reactivation_count`, `invite_status`, `is_active`, or linked user active state.

**Security**

- `password_hash` is legacy only and must not be read/written by frontend code.
- Inactive users are blocked at auth/profile resolution.
- Role redirects are centralized through role route helpers.
- v1 staff roles are limited to `secretary` and `predoctor` until additional dashboards, route guards, RLS policy coverage, and tests are designed.

**Tests**

- Session resolves through `auth_user_id`.
- Inactive users cannot enter.
- Frontend source has no `password_hash` references.

### Appointments, Slots, And Schedule

**Canonical tables**

- `secretary_slots`: concrete bookable availability.
- `doctor_schedule_templates`: recurring schedule rules for locations.
- `appointments`: booked visits with snapshot fields `clinic_id`, `visit_type_id`, `scheduled_at`, `duration_minutes`, `reason`, `status`.
- `visit_types`: appointment product/flow rules, including intake requirement.
- `clinics`: practice locations.

**Canonical lifecycle**

- Appointment statuses: `scheduled`, `confirmed`, `pre_check`, `in_consultation`, `completed`, `cancelled`, `no_show`.
- Allowed transitions live in `src/lib/stateMachines.js`.

**Canonical operations**

- Appointment creation owner: `book_slot` RPC, called through `bookSlot()` and `appointmentService.bookFromSlot()`.
- Direct appointment inserts are forbidden by service contract and should also be blocked by RLS/trigger.
- Appointment status updates use service lifecycle methods and state-machine validation.

**Services**

- `appointmentService`: read appointments, canonical slot booking, lifecycle updates.
- `slotService`: read/create slot inventory and call booking RPC.
- `scheduleService`: schedule templates and materialization.

**Tests**

- Patient/secretary both book through `book_slot`.
- Direct insert without slot is rejected.
- Double booking fails under concurrent calls.
- Staff cannot spoof `booked_by`.
- First/follow-up booking respects intake gate.

### Intake And Patient History

**Canonical tables**

- `medical_intake`: one-time patient intake scalars and completion gate.
- `precheck_forms`: per-visit vitals and predoctor workflow.
- `patient_vaccinations`, `patient_surgeries`, `patient_diseases`, `patient_family_history`: structured history timelines.
- Catalogs: `blood_groups`, `occupations`, `vaccines`, `diseases`, `surgery_types`, `family_relations`.

**Canonical operations**

- Intake draft/save/complete/reopen belongs to `intakeService`.
- Booking gate reads `patients.intake_completed_at` and/or visit type rules.
- Patient history writes are staff-mediated; patients can read own history only.

**Services**

- `intakeService`: medical intake and structured history.
- `precheckService`: per-appointment precheck forms.

**Security**

- PHI tables use soft archive.
- Audit triggers cover medical/legal records.
- DELETE is admin-only or service-role purge workflow.

**Tests**

- Patient cannot read another patient's intake/history.
- Staff can record history with valid catalog references.
- Reopen intake does not silently erase completed history.

### Encounters And Clinical Care

**Canonical tables**

- `encounters`: visit/encounter timeline.
- `clinical_notes`: SOAP/general/private notes.
- `clinical_note_drafts`: active doctor-authored note drafts with RLS ownership, scheduled TTL expiry, and explicit discard/converted states.
- `diagnoses`: structured encounter diagnoses.
- `prescriptions`: medication orders.
- `lab_orders`, `imaging_orders`: clinical orders.
- `clinical_documents`, `document_attachments`: reports/certificates/results/files.
- `care_tasks`: follow-up work items.

**Canonical lifecycle**

- Encounter: `planned -> in_progress -> completed`, with cancel/error paths.
- Clinical document: `draft -> final`, plus `void`/`superseded`.
- Orders, prescriptions, and care tasks use `src/lib/stateMachines.js`.

**Canonical operations**

- `start_encounter`, `complete_encounter`, `cancel_encounter` RPCs own encounter status and appointment coupling.
- `save_clinical_note_draft`, `get_active_clinical_note_draft`, `discard_clinical_note_draft`, and `expire_clinical_note_drafts` own draft persistence; pages/hooks must not store clinical note PHI in browser storage.
- `finalize_clinical_document`, `void_clinical_document` RPCs own document status.
- Clinical document file bytes live in the private `clinical-documents` Storage bucket. Clients receive short-lived signed URLs through `clinicalService.getDocumentSignedUrl()` / `documentService.getDownloadUrl()`, never direct public URLs.
- Direct status updates from pages are not allowed.

**Services**

- `clinicalService`: current broad service for encounter, notes, diagnoses, prescriptions, orders, documents, care tasks.
- Planned split: `encounterService`, `prescriptionService`, `orderService`, `documentService` once UI stabilizes.

**Tests**

- Doctor starts encounter from appointment and appointment moves to `in_consultation`.
- Doctor completes encounter and appointment moves to `completed`.
- Completed encounter cannot return to `in_progress`.
- Draft document finalizes through RPC only.
- Clinical writes enforce author/current user identity.
- Clinical note drafts autosave to tenant DB only, are scoped to the current doctor/author, and expire/clear stale content through the scheduled service-role cleanup RPC.

### Insurance And Billing

**Canonical tables**

- `insurance_providers`
- `doctor_insurance_contracts`
- `patient_insurance_policies`
- `insurance_claims`
- `claim_form_templates`
- `payments`
- `billable_services`

**Canonical operations**

- Provider/contract/policy management belongs to `insuranceService`.
- Claims are financial/legal records: soft archive, audit, admin-only purge.
- Generated insurance forms should eventually be stored as `clinical_documents` or generated from `claim_form_templates`.

**Tests**

- Expired policy cannot be selected without warning.
- Patient can read own policies/claims.
- Staff can create claim; patient cannot spoof claim amounts.
- Claims preserve audit history.

### Messaging And Communication

**Canonical tables**

- `conversations`
- `conversation_participants`
- `messages`
- `message_attachments`
- `message_read_receipts`

**Canonical operations**

- Message creation owner: `messagingService.sendMessage()`.
- Retryable sends include `client_request_id`.
- Message body edits are not allowed; redaction is the safe mutation.
- Message file bytes live in the private `message-attachments` Storage bucket. Clients receive short-lived signed URLs through `messagingService.getAttachmentSignedUrl()`.
- Realtime subscription owner: `messagingService.subscribeToConversation()`.

**Tests**

- Patient can only access conversations where they are participant/owner.
- Staff cannot spoof patient sender.
- Duplicate retry with same `client_request_id` is idempotent.
- Redacted messages cannot be edited back.

### Notifications And Mobile Push/Send Attempts

**Canonical tables**

- `notification_events`: source event.
- `notification_deliveries`: channel/device notification send attempts. This is not physical delivery; it records whether push/in-app/email/SMS notification attempts were sent, failed, retried, or acknowledged.
- `patient_devices`: push token/device registration.
- `reminder_rules`: reminder scheduling rules.

**Canonical operations**

- New work should create `notification_events`; a notification worker fans out into `notification_deliveries` send-attempt records.
- `notificationCoreService` owns inbox reads, mark-read/dismiss actions, role events, and realtime notification subscriptions.
- Device writes must prove both `user_id` and `patient_id` ownership.

**Tests**

- Patient cannot register a device for another patient.
- Staff cannot create arbitrary patient-target notifications unless authorized by service/RPC.
- Failed notification send-attempt records retry safely.

### Tenant Branding And Mobile Config

**Canonical tables**

- `tenant_profile`
- `tenant_app_config`
- `feature_flags`
- `content_pages`
- `consent_documents`
- `patient_consents`

**Canonical operations**

- Public brand/config reads go through safe public RPC/view only.
- Authenticated app config writes are staff/doctor/admin only.
- Feature flags are audience-gated (`public`, `patient`, `staff`, `admin`) through RLS and `tenantConfigService.getFeatureFlags({ audience })`.

**Tests**

- Anon can only read safe public fields.
- Patients cannot read staff-only/internal feature flags.
- Consent acceptance records who accepted and by what method.

## Backend Test Harness Targets

- `npm run audit:backend-contract`: static contract checks in repo.
- `supabase/sql/backend_contract_audit.sql`: read-only live/branch DB introspection checks.
- `supabase/tests/pgtap_rls.sql`: branch/local synthetic RLS matrix covering patient owner reads, cross-patient denials, staff reads, feature-flag audiences, and spoof/bypass write attempts.
- Future expansion: lifecycle RPC transitions and idempotency assertions with branch-local seed data.

## ERD And Schema Export Targets

- `docs/erd/tables.txt`: active public table inventory from the migration replay manifest.
- `docs/erd/schema_dump.sql`: generated only from a branch/local database with `pg_dump --schema-only`; do not fake this from partial introspection output.
- `docs/erd/erd.png`: generated from `schema_dump.sql` after a clean replay.

## Remaining Contract Work

- Keep new list services on `{ data, meta, error }` and block regressions through `npm run audit:backend-contract`.
- Treat the removed legacy surfaces as forbidden names in executable code; document-only references must explain history or removal.
- Add Zod validation to any remaining write path discovered by audit/review.
- Decide Edge Function parity for mobile before adding new function source: direct Supabase JS vs minimal Edge Function wrappers per domain. Do not resurrect the retired V1 wrappers.
- Run the automated DB/RLS tests against a Supabase branch/local database and wire them into CI.
