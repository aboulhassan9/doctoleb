# DoctoLeb Tier 2 Agent Walkthrough Prompt

> Purpose: copy this prompt into Claude or another senior agent when handing off DoctoLeb after the Tier 2 product/database architecture foundation.
> Role requested: senior product architect + database architect + security reviewer + React/frontend systems engineer + healthcare workflow/business analyst.
> Expected behavior: review first, verify with tools, then plan what is missing before implementing anything large.

## Prompt To Give The Next Agent

You are joining the DoctoLeb codebase after a major product pivot and Tier 2 foundation implementation. Act as a senior engineer and product architect. Do not treat this as a simple CRUD clinic app. The product direction changed:

DoctoLeb is now a doctor-branded medical practice platform for one doctor tenant first, not generic clinic management. The doctor can work across multiple real-world locations: hospital, medical group, private clinic, second clinic, or other location. Patient booking must understand where the doctor is available on each day/time. The secretary or app should be able to tell the patient, for example, "The doctor is in X hospital on Tuesday morning and Y medical group in the afternoon."

The long-term SaaS strategy is:

- One Supabase project/database per doctor tenant for now.
- No `tenant_id` inside the tenant database.
- A separate future SaaS control-plane project will manage tenant provisioning, app version/config health, billing/subscription, and migration drift.
- The future control plane must not store PHI.
- Each doctor tenant can later have its own branding, web app, mobile app config, domain, staff, locations, and patient data.
- Core domain logic should remain reusable across sibling tenants.

## Current Product Concept

The product should cover the full medical practice sequence:

1. Public/patient sees the doctor's branded landing/app experience.
2. Patient registers or books first appointment from available slots and locations.
3. First visit can happen before full medical intake.
4. After/around first visit, secretary/predoctor/nurse asks medical-intake questions:
   - Work/occupation.
   - Family illness and relationship.
   - Vaccines.
   - Existing diseases/conditions.
   - Past surgeries.
   - Blood group.
   - Smoking/lifestyle.
   - Allergies/current medication summary.
5. Patient becomes established after intake completion.
6. Follow-up bookings may require completed intake, depending visit type.
7. Doctor sees full history and current appointment context.
8. Doctor starts/completes an encounter/visit.
9. Doctor records clinical notes, diagnoses, prescriptions, lab orders, imaging orders, and official documents.
10. Secretary/admin handles insurance provider, patient policy, claim forms, printable documents, and billing paperwork.
11. Staff can include secretary, predoctor, nurse, assistant, and junior doctor under the main doctor.
12. Patient can later use mobile/web for appointments, documents, messages, notifications, consent, and profile/history.

## Key Files To Read First

Read these before making changes:

- `AGENTS.md` if present in the workspace root.
- `docs/archive/legacy-tier-plans/TIER0_PLAN.md`
- `docs/archive/legacy-tier-plans/TIER0_V2_PLAN.md`
- `TIER1_DOCTOR_PIVOT_PLAN.md`
- `TIER1_SCHEMA_DESIGN.md`
- `TIER2_PLAN.md`
- `TIER2_PRODUCT_ARCHITECTURE_PLAN.md`
- `TIER2_5_HARDENING_PLAN.md`
- `supabase/migrations/20260506150820_tier2_product_core_foundation.sql`
- `src/lib/selects.js`
- `src/schemas/index.js`
- `src/services/clinical.js`
- `src/services/messaging.js`
- `src/services/notificationCore.js`
- `src/services/tenantConfig.js`
- Existing services under `src/services/`, especially appointments, slots, intakes, insurance, consultations, notifications.
- Existing role pages under `src/pages/`.

If Supabase MCP is available, verify the live DB against the migration and do not assume local SQL equals live schema.

## What Was Already Done

Tier 2 product architecture foundation was implemented and applied live.

Live project:

- Supabase project: `gezmfmskhmjgnquoyosq`
- Project name: `clinic-website`
- Live migration applied: `20260506150820_tier2_product_core_foundation`

New architecture doc:

- `TIER2_PRODUCT_ARCHITECTURE_PLAN.md`

New live DB foundation:

- 24 new Tier 2 tables were added.
- All 24 have RLS enabled.
- 72 Tier 2 RLS policies were created.
- A safe public config RPC exists: `get_public_tenant_app_config()`.
- Helper functions were added: `current_patient_id()`, `current_doctor_id()`, `set_updated_at()`, updated `is_staff()`, and `can_access_conversation(uuid)`.

Clinical workflow tables:

- `encounters`
- `clinical_notes`
- `diagnoses`
- `prescriptions`
- `lab_orders`
- `imaging_orders`
- `clinical_documents`
- `document_attachments`
- `care_tasks`

Messaging/chat tables:

- `conversations`
- `conversation_participants`
- `messages`
- `message_attachments`
- `message_read_receipts`

Notification/mobile tables:

- `patient_devices`
- `notification_events`
- `notification_deliveries`
- `reminder_rules`

Tenant/mobile config tables:

- `tenant_profile`
- `tenant_app_config`
- `feature_flags`
- `content_pages`
- `consent_documents`
- `patient_consents`

Frontend/API scaffolding added:

- `clinicalService`
- `messagingService`
- `notificationCoreService`
- `tenantConfigService`
- Tier 2 select constants in `src/lib/selects.js`
- Tier 2 Zod schemas in `src/schemas/index.js`

Verification already completed:

- `npm run lint` passed.
- `npm run build` passed.
- Live DB query confirmed 24 Tier 2 tables exist.
- Live DB query confirmed all 24 Tier 2 tables have RLS enabled.
- Live DB query confirmed public tenant config RPC returns safe doctor/app config.

Post-implementation review:

- Claude senior review found no P0 PHI leak findings.
- It did find P1 issues that should block large UI work:
  - missing atomic lifecycle RPCs for encounters/documents,
  - no explicit Tier 2 purge/admin delete strategy,
  - service layer not yet matching the documented `{ data, meta, error }` envelope,
  - missing idempotency keys for mobile retry writes,
  - incomplete Zod validation in several Tier 2 service methods.
- These are now tracked in `TIER2_5_HARDENING_PLAN.md`.

## Engineering Rules And Guardrails

Follow these strictly:

- Do not start with big UI work before reviewing DB/API contracts.
- Do not add `tenant_id` to tenant DB tables in this architecture. Silo model is the decision for now.
- Do not store PHI in the future SaaS control plane.
- No destructive table deletion until replacement tables, backfill, consumer migration, and rollback are planned.
- Keep `public.users.auth_user_id` as the canonical auth link.
- No identity inference from email.
- No custom/plaintext auth paths.
- Appointment creation must remain slot-backed through the canonical booking path/RPC.
- Direct appointment insert bypasses should remain blocked.
- DB/RPC owns lifecycle gates and atomic operations.
- Services own DB-to-UI normalization.
- Pages/components should not contain raw Supabase queries or business rules.
- Use explicit select fields; never wildcard-select sensitive joined records.
- Use Zod at service/edge boundaries.
- Use state machines for appointments, consultations, referrals, and future encounter/document lifecycles.
- Use `ON DELETE RESTRICT` for PHI/legal/financial relationships.
- Use archive/status fields instead of hard deletes for PHI/legal/financial records.
- Audit medical/legal/financial/tenant-config changes.
- Avoid duplicating PHI into audit or logs unnecessarily.
- Design mobile APIs with pagination, idempotency, retry safety, and public-safe config.
- Extract reusable code when the same domain mapping or UI pattern appears in 2+ places.
- Preserve existing dirty work; do not revert unrelated changes.

## Review Assignment

Your first task is not to implement. Your first task is to perform a deep review and produce a plan.

Review from these viewpoints:

- Database architect/DBA.
- Supabase/Postgres RLS/security engineer.
- Healthcare workflow/business analyst.
- React/frontend systems engineer.
- Mobile app/API architect.
- SaaS/platform architect.
- QA/release engineer.
- Data governance/privacy reviewer.

Use MCP/tools where available:

- Supabase MCP to verify live schema, migrations, RLS, policies, functions, and table counts.
- Filesystem/code search to inspect services, pages, migrations, and docs.
- Sequential thinking for complex design review if available.
- Web/external research only when needed for current best practices; prefer official docs or primary sources.

## Specific Things To Review

### Product and business fit

- Does the schema support a doctor working in multiple locations?
- Does booking expose location/time clearly enough for patient and secretary?
- Does the first-visit then intake then follow-up gate make sense?
- Does predoctor/nurse/assistant workflow map cleanly to data tables?
- Does the system support insurance number/policy/claim/document printing workflow?
- Does the system cover realistic doctor needs: visit timeline, history, notes, diagnosis, prescription, lab/imaging, tasks, documents, messaging, notifications, consents?
- What high-value medical workflow is still missing?

### Database/ERD quality

- Are the Tier 1 and Tier 2 tables normalized enough without over-normalizing?
- Are relationships correct and safe for PHI?
- Are FK `ON DELETE` rules appropriate?
- Are indexes aligned with real web/mobile query paths?
- Are there missing uniqueness constraints?
- Are there missing status constraints or lifecycle fields?
- Are audit triggers applied to the right tables?
- Is audit too broad and duplicating PHI unnecessarily anywhere?
- Are messaging tables safe and practical?
- Is the notification delivery model enough for push/email/SMS later?
- Is tenant/mobile config safe for pre-login clients?

### RLS/security

- Can a patient read another patient's encounter, messages, documents, devices, or consents?
- Can secretary/predoctor create diagnosis or prescription records when they should not?
- Can staff spoof `booked_by`, message sender, notification recipient, or document creator?
- Can anon access only safe public doctor/tenant config?
- Are SECURITY DEFINER functions safe and restricted?
- Are helper functions exposed only to proper roles?
- Are direct write bypasses possible for appointment, intake, encounter, chat, insurance, or clinical documents?

### API/frontend layering

- Are services clean enough for mobile and web to share?
- Are selects too large or likely to bloat bundles?
- Should service modules split further before UI work?
- Are schemas reusable by Edge Functions later?
- Are error shapes consistent enough?
- Are pages still holding business logic that should move into services/hooks?
- What feature hooks should be created first?

### UX/product implementation

- What is the best next vertical slice?
- How should the doctor encounter screen work?
- How should patient documents work?
- How should messaging work for patient and staff?
- How should insurance forms be generated/printed?
- How should secretary/predoctor workflows be represented?
- What UI must exist before this can be called a professional product?

### Mobile readiness

- Is `tenant_app_config` enough for mobile app behavior?
- How should app versions, force update, maintenance mode, languages, branding, and public content be handled?
- Are push tokens/device records good enough?
- Are notification delivery records retryable?
- Where should offline retry/idempotency keys be added?

### SaaS/control-plane readiness

- What stays inside tenant DB?
- What belongs in the future owner control-plane project?
- How do we track schema drift across many doctor databases later?
- How do we share migrations and core logic across tenants?
- Should Edge Functions live inside each tenant project, or should some API/backend live outside?
- How do we keep PHI isolated while letting the SaaS owner manage deployments?

## Expected Output From You

Produce a structured review and continuation plan with:

1. Findings, ordered by severity, with file/table/function references.
2. Live DB verification summary if MCP is available.
3. Missing use cases and unexpected scenarios not covered.
4. DB/ERD improvement plan.
5. RLS/security hardening plan.
6. API/service/frontend layering plan.
7. UX implementation plan.
8. Mobile readiness plan.
9. SaaS control-plane plan.
10. A safe implementation order with small slices.

Do not claim the product is finished. The Tier 2 foundation is implemented, but the next agent must identify what is missing and plan the next engineering-safe step before writing large UI or backend features.

## Recommended Next Implementation Slices

After review, likely next slices are:

1. Complete `TIER2_5_HARDENING_PLAN.md` Block A before large UI work.
2. Build feature hooks on top of `clinicalService`, `tenantConfigService`, `messagingService`, and `notificationCoreService`.
3. Implement doctor encounter workflow using `encounters`, `clinical_notes`, `diagnoses`, `prescriptions`, `lab_orders`, `imaging_orders`, `clinical_documents`, and `care_tasks`.
4. Implement patient documents view and clinical document detail.
5. Implement patient-staff messaging MVP with conversation list, thread, send message, read receipts.
6. Implement consent onboarding and patient consent records.
7. Implement notification delivery worker Edge Function and delivery retry model.
8. Implement tenant/mobile config admin UI.
9. Add DB/RLS automated tests for all patient/staff boundaries.

## Tone And Execution Style

Be senior, skeptical, and constructive. The user wants a strong product and architecture, not shallow praise. If something is weak, say so clearly and propose the safer design. Keep the doctor's business workflow in mind, not just the code. The right answer should make the system easier to expand later without turning every future change into a frontend or database rewrite.
