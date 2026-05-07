# DoctoLeb Tier 2.5 Agent Handoff Prompt

> Purpose: paste this prompt into Claude, Codex, or another senior agent after the Tier 2.5 hardening slice.
> Desired role: senior full-stack/product engineer with Supabase/Postgres RLS, healthcare workflow, React systems, mobile API, and SaaS architecture judgment.
> Current milestone: Tier 2.5 Block A is implemented and live. Next work should start with review, then Block B doctor encounter MVP.

---

## Prompt To Give The Next Agent

You are joining the DoctoLeb codebase after a major architecture pivot and several hardening passes. Treat this as a medical practice platform, not a generic CRUD clinic app.

DoctoLeb is now a **doctor-branded medical practice platform**. One doctor tenant comes first, with multiple real-world practice locations such as hospital, medical group, private clinic, second clinic, or other location. The long-term strategy is a reusable white-label/SaaS model where each doctor tenant has its own Supabase project/database, branding, web/mobile app config, locations, staff, and patient data.

Important architectural decision:

- Use **one Supabase project/database per doctor tenant** for now.
- Do **not** add `tenant_id` inside tenant DB tables.
- A future SaaS control-plane project will manage tenant registry, provisioning, billing/subscriptions, migration drift, app releases, and super-admin operations.
- The control plane must store **no PHI**.
- Tenant DBs contain all PHI and operational medical data.

Your first job is **not** to build a large UI immediately. Your first job is to review the implemented Tier 2.5 slice, verify live DB/source alignment, then continue with the next vertical slice only if the contracts are solid.

---

## Must-Read Files

Read these before making any changes:

- `G:\project\AGENTS.md`
- `G:\project\doctoleb\TIER1_DOCTOR_PIVOT_PLAN.md`
- `G:\project\doctoleb\TIER1_SCHEMA_DESIGN.md`
- `G:\project\doctoleb\TIER2_PRODUCT_ARCHITECTURE_PLAN.md`
- `G:\project\doctoleb\TIER2_AGENT_WALKTHROUGH_PROMPT.md`
- `G:\project\doctoleb\TIER2_5_HARDENING_PLAN.md`
- `G:\project\doctoleb\supabase\migrations\20260506150820_tier2_product_core_foundation.sql`
- `G:\project\doctoleb\supabase\migrations\20260506155237_tier2_5_lifecycle_idempotency_hardening.sql`
- `G:\project\doctoleb\supabase\migrations\20260506155321_revoke_set_updated_at_execute.sql`
- `G:\project\doctoleb\src\services\api.js`
- `G:\project\doctoleb\src\services\clinical.js`
- `G:\project\doctoleb\src\services\messaging.js`
- `G:\project\doctoleb\src\services\notificationCore.js`
- `G:\project\doctoleb\src\services\tenantConfig.js`
- `G:\project\doctoleb\src\schemas\index.js`
- `G:\project\doctoleb\src\lib\selects.js`
- `G:\project\doctoleb\src\lib\stateMachines.js`

If Supabase MCP is available, verify live state against the repo. Do not assume local SQL equals the live schema.

---

## Current Live Supabase State

Live project:

- Project ref: `gezmfmskhmjgnquoyosq`
- Project name: `clinic-website`

Tier 2 foundation live migration:

- `20260506150820_tier2_product_core_foundation`

Tier 2.5 live migrations:

- `20260506155237_tier2_5_lifecycle_idempotency_hardening`
- `20260506155321_revoke_set_updated_at_execute`

Already verified live after Tier 2.5:

- 11 expected Tier 2.5 hardening columns exist.
- 7 lifecycle/redaction functions exist.
- 24 `tier2_admin_delete` policies exist.
- 6 idempotency/tenant uniqueness indexes exist.
- `anon` cannot execute internal helper/lifecycle functions.
- `set_updated_at()` cannot be directly executed by `anon` or `authenticated`.
- `npm run lint` passes.
- `npm run build` passes.

Run these checks again if you are about to build on top of this.

---

## Product Model To Preserve

The medical practice sequence should become:

1. Patient sees doctor-branded public experience.
2. Patient registers or books first appointment from available location-aware slots.
3. First visit can happen before full intake.
4. Secretary/predoctor/nurse collects medical intake:
   - occupation/work,
   - family disease history and relationship,
   - vaccines,
   - diseases/conditions,
   - surgeries,
   - blood group,
   - smoking/lifestyle,
   - allergies/current medication summary.
5. Patient becomes established after intake completion.
6. Follow-up booking can be gated by completed intake depending on visit type.
7. Doctor sees the appointment context, patient history, intake, documents, and previous encounters.
8. Doctor starts/completes a clinical encounter.
9. Doctor records notes, diagnoses, prescriptions, lab orders, imaging orders, documents, and care tasks.
10. Staff handle insurance policies, claims, printable forms, billing paperwork, notifications, and patient support.
11. Patient later uses web/mobile for appointments, documents, messages, notifications, consent, and profile/history.

---

## What Tier 2 Added

Tier 2 created the product-core database foundation:

- Clinical workflow:
  - `encounters`
  - `clinical_notes`
  - `diagnoses`
  - `prescriptions`
  - `lab_orders`
  - `imaging_orders`
  - `clinical_documents`
  - `document_attachments`
  - `care_tasks`
- Messaging/chat:
  - `conversations`
  - `conversation_participants`
  - `messages`
  - `message_attachments`
  - `message_read_receipts`
- Notification/mobile:
  - `patient_devices`
  - `notification_events`
  - `notification_deliveries`
  - `reminder_rules`
- Tenant/mobile config:
  - `tenant_profile`
  - `tenant_app_config`
  - `feature_flags`
  - `content_pages`
  - `consent_documents`
  - `patient_consents`

Tier 2 also added frontend service scaffolding:

- `clinicalService`
- `messagingService`
- `notificationCoreService`
- `tenantConfigService`
- Tier 2 select constants in `src/lib/selects.js`
- Tier 2 Zod schemas in `src/schemas/index.js`

---

## What Tier 2.5 Block A Added

Tier 2.5 closed the high-priority backend/API gaps before UI work:

- Added atomic lifecycle RPCs:
  - `start_encounter(p_appointment uuid, p_chief_complaint text default null)`
  - `complete_encounter(p_encounter uuid, p_summary text default null)`
  - `cancel_encounter(p_encounter uuid, p_reason text default null)`
  - `finalize_clinical_document(p_document uuid)`
  - `void_clinical_document(p_document uuid, p_reason text default null)`
- Added lifecycle triggers to reject illegal status transitions for:
  - encounters,
  - clinical documents,
  - lab orders,
  - imaging orders,
  - prescriptions,
  - care tasks.
- Added redact-only message enforcement:
  - no silent body edits,
  - redaction sets body to `[redacted]`,
  - redacted messages are immutable.
- Added mobile retry/idempotency support:
  - `client_request_id` on `messages`,
  - `notification_events`,
  - `notification_deliveries`,
  - `care_tasks`,
  - `clinical_documents`,
  - partial unique indexes for non-null request IDs.
- Added system notification source model:
  - `notification_events.source` = `user | system`,
  - `created_by` may be nullable only for system-originated events.
- Hardened consent tracking:
  - `patient_consents.acceptance_method`,
  - `accepted_by_user_id` made not-null when live data allowed.
- Added explicit admin delete policies on Tier 2 tables.
- Tightened grants:
  - internal helpers no longer anon-callable,
  - `set_updated_at()` no longer directly callable by client roles.
- Added `apiPaged()` with `{ data, meta, error }` pagination envelope.
- Refactored Tier 2 list methods to use paged envelopes.
- Added missing Zod validation for:
  - document attachments,
  - conversation participants,
  - message attachments,
  - notification deliveries,
  - care-task updates,
  - patient consent acceptance.
- Added realtime helpers:
  - `messagingService.subscribeToConversation`
  - `notificationCoreService.subscribeToEvents`
  - `notificationCoreService.subscribeToDeliveries`
- Extended `src/lib/stateMachines.js` with Tier 2 lifecycle helpers.

---

## Non-Negotiable Guardrails

Follow these rules:

- Do not reintroduce custom/plaintext auth.
- Do not infer identity from email.
- Keep `public.users.auth_user_id` as canonical auth linkage.
- Appointment creation must remain slot-backed through canonical booking RPC/service paths.
- Do not create direct appointment insert bypasses.
- DB/RPC owns lifecycle transitions and atomic medical operations.
- Services own DB-to-UI normalization.
- Pages/components should not contain raw Supabase queries.
- Use explicit select fields, never wildcard-select sensitive joined records.
- Use Zod at service/Edge Function boundaries.
- Use state machines for lifecycle UX, but DB/RPC remains authoritative.
- Use `ON DELETE RESTRICT` for PHI/legal/financial relationships unless there is a carefully justified ownership aggregate.
- Prefer archive/status fields over hard deletes for PHI/legal/financial records.
- Do not store PHI in future SaaS control plane.
- Do not add `tenant_id` inside tenant DB tables under the current silo decision.
- Preserve dirty work. Do not revert unrelated changes from the user or another agent.
- Run `npm run lint` and `npm run build` before claiming done.

---

## Immediate Review Assignment

Before implementing Block B, perform a focused senior review of Tier 2.5:

1. Verify live migrations with Supabase MCP:
   - migration versions,
   - columns,
   - indexes,
   - functions,
   - grants,
   - RLS policies.
2. Review SQL functions for:
   - `SECURITY DEFINER`,
   - `SET search_path = public, pg_temp`,
   - caller role checks,
   - doctor ownership checks,
   - invalid transition rejection,
   - no anon execute.
3. Review frontend service contracts:
   - paged list methods return `{ data, meta, error }`,
   - writes validate with Zod,
   - idempotency fields are accepted where needed,
   - lifecycle methods call RPCs, not raw status updates.
4. Search for any pages still calling raw `supabase.from(...)`.
5. Search for direct lifecycle status updates on Tier 2 tables.
6. Run `npm run lint`.
7. Run `npm run build`.

If you find issues, fix them before starting UI.

---

## Next Implementation: Block B — Doctor Encounter MVP

Only start after the review above is clean.

Build a thin, professional vertical slice rather than a giant UI rewrite.

Deliver:

- Feature hook: `useEncounter(appointmentIdOrEncounterId)`
- Feature hook: `useDoctorEncounterTimeline(patientId)`
- Doctor encounter page for starting/resuming an encounter.
- Route option:
  - `/doctor-encounter/:appointmentId` for appointment-driven start/resume.
  - Optional `/doctor-encounter-id/:encounterId` for direct resume if useful.
- Tabs/sections:
  - patient context,
  - visit notes,
  - diagnoses,
  - prescriptions,
  - lab/imaging orders,
  - care tasks,
  - documents.
- Start encounter button calls `clinicalService.startEncounter`.
- Complete encounter button calls `clinicalService.completeEncounter`.
- Document finalization calls `clinicalService.finalizeClinicalDocument`.
- Do not use raw table status updates for lifecycle changes.
- Use loading/error/empty states.
- Keep UI components reusable; extract when a pattern appears 2+ times.
- Keep business logic in hooks/services, not page JSX.

Start small:

1. Hook loads appointment/encounter and patient context.
2. Page can start/resume encounter.
3. Notes can be added/listed.
4. Encounter can be completed with confirmation and summary.
5. Then add diagnoses/prescriptions/orders/tasks/documents incrementally.

---

## Known Deferred Items

Do not accidentally treat these as done:

- Storage bucket policies and signed URL strategy for clinical documents.
- Patient-facing document viewer.
- Messaging MVP UI.
- Notification delivery worker Edge Function.
- Push/email/SMS delivery integrations.
- Consent onboarding UI.
- Tenant settings/BrandContext migration from `doctor_brand` to `tenant_profile` / `tenant_app_config`.
- Feature flag audience hardening.
- Guardian/dependent model.
- Walk-in encounter model.
- Clinical note amendments.
- Prescription refill model.
- Insurance pre-authorization model.
- Control-plane SaaS project.
- RLS automated tests.
- Audit log viewer.

---

## Output Expected From The Next Agent

First output should be one of:

- A concise review report with findings and fixes applied, or
- A clean verification report saying Tier 2.5 is safe to build on, followed by a small implementation plan for Block B.

If implementing, finish with:

- Files changed.
- DB migrations applied, if any.
- Commands run and results.
- Any remaining risks.
