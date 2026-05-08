# DoctoLeb Next Tier Agent Handoff Prompt

> Copy this entire file into the next agent session before any implementation.
> This is not a casual summary. Treat it as the operating context, product contract, and engineering brief for the next tier of work.
> Date prepared: 2026-05-07.

---

## 1. Your Role

You are taking over DoctoLeb as a senior agent. Act as all of the following at once:

- Senior platform architect
- Supabase/Postgres DBA
- API contract engineer
- SaaS/domain-routing engineer
- React/Vite runtime engineer
- Security and RLS reviewer
- Healthcare workflow product analyst
- Code reviewer who is allowed to challenge prior work

Do not blindly trust previous agents. Verify the repo, live Supabase shape, documentation, scripts, and runtime behavior before making architectural changes. If something in this handoff conflicts with the repo or live DB, trust verified evidence and update the docs.

Your job is to protect the architecture from duplication, hardcoding, accidental PHI leakage, and fake product assumptions.

---

## 2. Workspace And Commands

Repository:

```txt
G:\project\doctoleb
```

Primary commands:

```bash
npm run verify
npm run build:patient
npm run build:ops
npm run audit:backend-contract
npm run test:backend-db-contract
```

Local apps:

```txt
Patient web:  http://localhost:3001
Clinic ops:   http://localhost:3002
```

Important note: backend DB contract tests may skip live SQL/pgTAP execution unless `BACKEND_TEST_DATABASE_URL` is set. That is expected for now, but do not confuse "skipped branch DB execution" with full database proof.

Use PowerShell-safe commands on Windows. Do not leak or print secrets. Do not commit `.env` files.

---

## 3. Mandatory Read Order

Read these before serious work, in this exact order:

```txt
G:\project\doctoleb\CLAUDE.md
G:\project\doctoleb\PRODUCT.md
G:\project\doctoleb\DESIGN.md
G:\project\doctoleb\AGENT_HANDOFF_TIER2_STATUS.md
G:\project\doctoleb\NEXT_STEPS_PLAN.md
G:\project\doctoleb\FRONTEND_APP_SPLIT_PLAN.md
G:\project\doctoleb\BACKEND_CONTRACT_LEDGER.md
G:\project\doctoleb\BACKEND_DUPLICATION_AUDIT.md
G:\project\doctoleb\docs\decisions\ADR-002-separate-patient-and-clinic-ops-apps.md
G:\project\doctoleb\docs\decisions\ADR-003-tenant-branding-and-control-plane-config.md
```

Then inspect these code areas before implementation:

```txt
G:\project\doctoleb\packages\core\lib\supabase.js
G:\project\doctoleb\packages\core\services\tenantConfig.js
G:\project\doctoleb\packages\ui\contexts\BrandContext.jsx
G:\project\doctoleb\packages\core\lib\appBoundaries.js
G:\project\doctoleb\apps\patient-web\vite.config.js
G:\project\doctoleb\apps\clinic-ops\vite.config.js
G:\project\doctoleb\scripts\backend-contract-audit.mjs
```

---

## 4. Current Verified State

The current product has moved far beyond the original prototype.

Verified repo state:

- The repo has separate deployable Vite apps:
  - `apps/patient-web`
  - `apps/clinic-ops`
- Shared business/runtime code lives in:
  - `packages/core`
  - `packages/ui`
- The old all-in-one route concept is being retired.
- Tenant branding is already partly runtime-driven by `BrandContext`.
- `packages/core/lib/supabase.js` still creates one static Supabase client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. This is the major next-tier runtime blocker.

Verified live Supabase state for project `gezmfmskhmjgnquoyosq`:

```txt
Public tables:       57
RLS-enabled tables:  57
Public functions:    34
Public triggers:     75
Public policies:     216
Live Edge Functions: 0
```

The live tenant DB has these major domains:

- Auth/profile: `users`, `patients`, `doctors`, `predoctors`, `staff_members`
- Scheduling: `clinics`, `doctor_schedule_templates`, `secretary_slots`, `appointments`, `visit_types`
- Intake/history: `medical_intake`, `precheck_forms`, `patient_vaccinations`, `patient_surgeries`, `patient_diseases`, `patient_family_history`
- Clinical care: `encounters`, `clinical_notes`, `diagnoses`, `prescriptions`, `lab_orders`, `imaging_orders`, `clinical_documents`, `document_attachments`, `care_tasks`
- Messaging: `conversations`, `conversation_participants`, `messages`, `message_attachments`, `message_read_receipts`
- Notifications/mobile: `patient_devices`, `notification_events`, `notification_deliveries`, `reminder_rules`
- Insurance/billing: `insurance_providers`, `doctor_insurance_contracts`, `patient_insurance_policies`, `claim_form_templates`, `insurance_claims`, `payments`, `billable_services`
- Tenant config: `tenant_profile`, `tenant_app_config`, `feature_flags`, `content_pages`, `consent_documents`, `patient_consents`

Live Edge Functions are currently zero. If a doc says the old deployed V1 functions still need deletion, that doc is stale and should be corrected after verification.

---

## 5. Product Truth

This is the real direction now:

```txt
doctoleb.com                   -> DoctoLeb marketing site for doctors/clinic owners
console.doctoleb.com           -> future SaaS owner/super-admin control plane
{tenant}.doctoleb.com          -> patient site for one doctor/clinic tenant
{tenant}.ops.doctoleb.com      -> internal clinic operations for that tenant
customclinic.com               -> paid custom patient domain later
ops.customclinic.com           -> optional paid custom ops domain later
```

Patient web and clinic ops are different products:

- Patient web is for patients and visitors.
- Clinic ops is for doctors, secretaries, predoctors, nurses/assistants, and clinic-admin users.
- The patient landing page must not be the staff/admin login entry.
- Staff accounts are internal. Patients may self-register.
- The clinic-admin role is inside the tenant. It is not the SaaS super-admin.
- The future SaaS super-admin/control plane manages tenants, billing, domains, migration drift, and releases. It stores no PHI.

Do not turn this into:

- A public doctor marketplace
- A generic fake AI startup
- A single mixed app where patients and staff enter through the same public landing
- A multi-tenant single database with `tenant_id` columns
- A system where tenant branding is hardcoded in React pages

---

## 6. Non-Negotiable Architecture Principles

1. Use database-per-tenant.
2. Do not add `tenant_id` columns inside tenant DB tables.
3. Tenant DB stores all PHI and operational clinic records.
4. Control plane stores routing/provisioning/billing metadata only; no PHI.
5. Tenant identity and theme are configuration, not code.
6. Do not hardcode doctor name, clinic name, logo, favicon, phone, colors, domains, or mobile app theme constants.
7. Shared business logic remains in `packages/core`.
8. Shared UI primitives remain in `packages/ui`.
9. Do not copy services per app or per tenant.
10. Do not recreate deleted legacy tables/services.
11. RLS and RPC authorization are the real security boundary; domain separation is not security by itself.
12. Edge Functions, if added later, must validate/authenticate and call canonical RPC/service paths. They must not duplicate business logic.
13. Every list API/service returns `{ data, meta, error }` when paginated.
14. Every single read/write returns `{ data, error }`.
15. Every write validates with Zod before touching Supabase.
16. Retryable mobile writes use `client_request_id` where supported.
17. Lifecycle changes go through named lifecycle service/RPC methods, never page-level raw status updates.

Deleted legacy surfaces must stay deleted:

```txt
consultations
notifications
doctor_brand
clinic_settings
medical_reports
certificates
referrals
old role sidebars
old doctor consultation route/page
```

Canonical replacements:

```txt
consultations                 -> encounters + clinical tables
notifications                 -> notification_events + notification_deliveries
doctor_brand/clinic_settings  -> tenant_profile + tenant_app_config
medical reports/certificates/referrals -> clinical_documents
old sidebars                  -> AppSidebar + DashboardLayout
old consultation page         -> DoctorEncounterPage
```

---

## 7. MCPs And Skills To Use

Use MCPs and skills proactively. Do not pretend to know if tools can verify it.

Preferred MCPs:

- Supabase MCP: live schema, policies, functions, migrations, and Edge Function verification.
- GitHub MCP or `gh`: remote, PR, issue, workflow, commit, and push context.
- Context7: current React, Vite, Supabase, Vercel, and library docs.
- Exa or web search: broader SaaS/domain-routing best-practice research when needed.
- Sequential thinking: complex DB/runtime migration reasoning.
- Playwright/browser tools: patient-web and clinic-ops visual/runtime verification.

Skills to apply when relevant:

- `api-and-interface-design`
- `supabase-postgres-best-practices`
- `security-and-hardening`
- `security-best-practices`
- `documentation-and-adrs`
- `deprecation-and-migration`
- `frontend-ui-engineering`
- `code-review-and-quality`
- `test-driven-development`
- `git-workflow-and-versioning`
- `planning-and-task-breakdown`
- `context-engineering`

If a skill says "contract first", obey it. If a DB change could create duplicated concepts, check `BACKEND_DUPLICATION_AUDIT.md` first.

---

## 8. The Next Tier: What We Want To Achieve

The next tier is not random UI polish.

The next tier is:

```txt
Tenant Domain Routing + Control Plane Contract + Runtime Tenant Resolution
```

The goal is to make the system ready for real doctor/clinic-branded domains:

1. A user opens `dr-hassan.doctoleb.com`.
2. The app knows this is the patient site for tenant `dr-hassan`.
3. The app resolves which Supabase project belongs to that tenant.
4. The app creates a tenant-scoped Supabase client at runtime.
5. The app loads tenant branding/config from that tenant DB.
6. All patient actions go through existing canonical services/RPCs in that tenant DB.
7. Staff opens `dr-hassan.ops.doctoleb.com`.
8. The ops app resolves the same tenant but uses the ops surface.
9. Staff auth happens against that tenant DB.
10. The future Flutter app uses the same tenant resolver/config contract.

The current hard blocker is this:

```txt
packages/core/lib/supabase.js currently assumes one static Supabase tenant from env.
```

That is acceptable for one development tenant, but not for subdomain/custom-domain routing.

---

## 9. Target Runtime Architecture

Target runtime shape:

```txt
Browser hostname
  -> tenant resolver
  -> tenant connection/config
  -> runtime Supabase client factory
  -> shared services in packages/core
  -> BrandProvider/useBrand
  -> patient-web or clinic-ops UI
```

Target app surfaces:

```txt
apps/marketing-site   -> DoctoLeb SaaS marketing for doctors/clinic owners
apps/patient-web      -> tenant patient website/portal
apps/clinic-ops       -> tenant staff/doctor/clinic-admin operations
apps/control-plane    -> future SaaS super-admin; no PHI
packages/core         -> shared services, schemas, selectors, state machines
packages/ui           -> shared primitives and contexts
```

Do not build all of this in one giant change. The next agent should proceed in small, verified slices.

---

## 10. Control Plane Data Contract

Design and document the control-plane DB contract before building UI.

Recommended control-plane tables:

```txt
tenants
  id
  slug
  display_name
  status
  plan
  release_channel
  supabase_project_ref
  supabase_url
  schema_version
  created_at
  updated_at

tenant_domains
  id
  tenant_id
  hostname
  surface
  status
  dns_status
  ssl_status
  verification_token
  verified_at
  created_at
  updated_at

tenant_deployments
  id
  tenant_id
  surface
  provider
  deployment_url
  deployed_version
  health_status
  last_checked_at
  created_at
  updated_at

tenant_migration_runs
  id
  tenant_id
  migration_version
  status
  started_at
  finished_at
  error_summary

tenant_events
  id
  tenant_id
  event_type
  actor_id
  metadata
  created_at
```

Allowed control-plane data:

- Tenant slug
- Tenant display name
- Supabase project reference and URL
- Public anon key if needed for runtime bootstrap
- Plan/subscription status
- Domain verification metadata
- Deployment metadata
- Schema version and migration health

Forbidden control-plane data:

- Patient records
- Appointment records
- Clinical documents
- Notes, diagnoses, prescriptions, lab/imaging orders
- Patient messages
- Insurance policy records
- Billing records that reveal patient care
- Staff clinical activity logs
- Supabase service-role keys in frontend-readable rows

If service-role automation is needed later, keep secrets in server-side environment variables or a secret manager. Never return them to browser clients.

---

## 11. Tenant Resolver Contract

Define this public-safe resolver before changing client runtime:

```txt
GET /api/tenant-resolve?host={hostname}&surface=patient|ops
```

Recommended response:

```json
{
  "data": {
    "tenantId": "uuid",
    "slug": "dr-hassan",
    "surface": "patient",
    "status": "active",
    "supabaseUrl": "https://tenant-ref.supabase.co",
    "supabaseAnonKey": "public-anon-key",
    "schemaVersion": "20260507",
    "canonicalHost": "dr-hassan.doctoleb.com"
  },
  "error": null
}
```

Error semantics:

```txt
404 TENANT_NOT_FOUND       -> hostname is not mapped
403 SURFACE_MISMATCH       -> hostname belongs to a different surface
423 TENANT_INACTIVE        -> tenant exists but is inactive/suspended
503 TENANT_RESOLVER_DOWN   -> resolver/control-plane unavailable
```

Security rules:

- Resolver may return tenant Supabase anon key because anon keys are public.
- Resolver must never return service-role keys.
- Resolver must never return PHI.
- Resolver should only return what the web/mobile bootstrap needs.
- Successful resolution can be cached briefly, recommended 5 minutes.
- Inactive tenant should render a safe unavailable/maintenance state, not crash.

Local development fallback:

```txt
localhost:3001 -> patient surface using .env tenant fallback
localhost:3002 -> ops surface using .env tenant fallback
VITE_DEV_TENANT_SLUG may identify the fallback tenant
```

---

## 12. Required Implementation Slices

Implement in this order. Keep each slice small and verified.

### Slice A: Documentation And ADR

Create:

```txt
docs/decisions/ADR-004-domain-routing-and-control-plane-contract.md
```

Update:

```txt
PRODUCT.md
FRONTEND_APP_SPLIT_PLAN.md
BACKEND_CONTRACT_LEDGER.md
BACKEND_DUPLICATION_AUDIT.md
AGENT_HANDOFF_TIER2_STATUS.md
NEXT_STEPS_PLAN.md
```

Docs must clearly say:

- DoctoLeb marketing site targets doctors/clinic owners.
- Tenant patient site targets patients of that tenant.
- Clinic ops is internal.
- Control plane stores no PHI.
- Tenant resolver is the runtime boundary.
- Static one-tenant env config is a development fallback only.

Also correct stale statements about old Edge Functions if verification still shows zero live functions.

### Slice B: Hostname And Surface Parser

Add a small, tested module in `packages/core`.

It should classify:

```txt
doctoleb.com                    -> marketing
www.doctoleb.com                -> marketing
console.doctoleb.com            -> control-plane
dr-hassan.doctoleb.com          -> tenant patient
dr-hassan.ops.doctoleb.com      -> tenant ops
customclinic.com                -> custom domain lookup required
ops.customclinic.com            -> custom ops lookup required
localhost:3001                  -> local patient
localhost:3002                  -> local ops
```

Do not hardcode a real doctor's name as production data. Use test-only fixtures.

### Slice C: Tenant Resolver Client Contract

Add a shared resolver client in `packages/core`.

It should:

- Accept `host` and `surface`.
- Return `{ data, error }`.
- Support local `.env` fallback for development.
- Normalize resolver errors.
- Never expose service-role secrets.

Do not build the full server-side control-plane API yet unless the user explicitly asks. Define the contract and browser-side client boundary first.

### Slice D: Runtime Supabase Client Factory

Refactor `packages/core/lib/supabase.js`.

Target behavior:

- Support runtime configuration.
- Export `configureSupabaseClient(...)`.
- Export `getSupabaseClient()` or equivalent.
- Preserve existing service imports with minimum churn.
- Keep local dev static env fallback.
- Prevent services from creating their own Supabase clients.

Important: this is risky because many services import `supabase` directly. Use a compatibility approach first:

- Keep a named export that still works for current imports.
- Internally route it to the configured client if possible.
- Do not big-bang rewrite every service unless required.

### Slice E: Tenant Bootstrap Provider

Add a bootstrap layer before `BrandProvider` depends on tenant config.

Target behavior:

```txt
App starts
  -> resolve host/surface
  -> configure Supabase client
  -> render AuthProvider/BrandProvider/routes
```

Patient and ops apps should show:

- Loading state while resolving tenant.
- Safe not-found state for unknown tenant.
- Safe inactive/maintenance state for inactive tenant.
- Normal app if resolved.

### Slice F: Verification And Guardrails

Add or update audit checks so future agents cannot regress:

- No hardcoded tenant Supabase URLs in executable code except approved dev fallback.
- No service-role key string patterns in frontend packages.
- No `tenant_id` added to tenant DB migrations.
- No legacy table/service references return.
- No tenant branding hardcoded in patient/ops pages.

Run:

```bash
npm run verify
npm run build:patient
npm run build:ops
```

Browser smoke:

```txt
http://localhost:3001 -> patient web resolves development tenant and renders
http://localhost:3002/login -> clinic ops resolves same development tenant and renders
```

---

## 13. Existing DB/API Contract Rules

Do not break these.

Service envelopes:

```txt
List reads:          { data, meta, error }
Single reads/writes: { data, error }
```

Appointment creation:

```txt
book_slot RPC -> appointmentService.bookFromSlot
```

Encounter lifecycle:

```txt
start_encounter
complete_encounter
cancel_encounter
```

Clinical document lifecycle:

```txt
finalize_clinical_document
void_clinical_document
```

Tenant config:

```txt
tenant_profile + tenant_app_config
  -> get_public_tenant_app_config
  -> tenantConfigService.getPublicConfig
  -> BrandProvider/useBrand
```

Storage:

```txt
clinical documents and message attachments use private buckets and signed URLs
```

Notifications:

```txt
notification_events + notification_deliveries
```

Do not reintroduce `notifications`.

---

## 14. Review Checklist Before Editing

Before making changes, answer:

- Does this change duplicate an existing DB table, service, RPC, trigger, or status machine?
- Does it store PHI in the wrong place?
- Does it require `tenant_id` inside a tenant DB? If yes, stop.
- Does it hardcode tenant identity?
- Does it create a second auth path?
- Does it let patient web import clinic-ops code?
- Does it let clinic-ops import patient-only routes unnecessarily?
- Does it bypass RLS/RPC lifecycle rules?
- Does it make Flutter/mobile harder to support later?
- Does it require custom-domain behavior that should be in the control plane instead?

If any answer is risky, stop and document the decision before coding.

---

## 15. UX And Frontend Rules

When touching UI:

- Use `PRODUCT.md`, `DESIGN.md`, and `.codex/instructions.md`.
- Patient web should feel like the tenant doctor's/clinic's public patient site.
- Clinic ops should feel dense, operational, left-anchored, and trust-first.
- Do not use patient landing as staff/admin login.
- Do not use purple-blue generic startup gradients.
- Do not invent fake logos, fake doctors, fake scale, fake countries, fake AI features.
- Do not expand the current Inter-only typography as if it is final.
- Use semantic tokens and tenant CSS variables.
- Respect WCAG 2.2 AA and `prefers-reduced-motion`.

Public copy rules:

- DoctoLeb marketing site: sells DoctoLeb to doctors/clinic owners.
- Tenant patient site: helps patients trust and book with that tenant.
- Clinic ops: no marketing fluff; operational clarity.

---

## 16. Testing Expectations

For every meaningful change:

```bash
npm run verify
```

When touching app boundaries:

```bash
npm run build:patient
npm run build:ops
```

When touching backend contracts:

```bash
npm run audit:backend-contract
npm run test:backend-db-contract
```

When touching browser runtime:

- Use Playwright or browser tooling.
- Verify both `localhost:3001` and `localhost:3002`.
- Capture console errors.
- Confirm document title and tenant CSS variables still come from tenant config.

When touching Supabase:

- Prefer branch/local validation before live mutation.
- Use Supabase MCP for live read verification.
- Avoid broad `supabase db push` against live if migration history drift exists.
- Apply single forward migrations deliberately.

---

## 17. Known Gaps After This Tier

Do not get distracted, but keep these visible:

- Full DoctoLeb marketing site is not built yet.
- Full SaaS control-plane UI is not built yet.
- Custom domain verification UI is not built yet.
- Flutter app is not built yet.
- Notification delivery worker/push/email/SMS is not fully live.
- pgTAP branch/local DB execution still needs DB env setup.
- ERD visual export still needs branch/local schema dump or Supabase visualizer export.
- Patient web landing likely still needs stronger tenant-patient copy and no SaaS-doctor marketing copy.

These are important, but the next tier is specifically the runtime/domain/control-plane contract.

---

## 18. What Success Looks Like

After the next tier:

- The architecture has `ADR-004`.
- Docs consistently describe:
  - `doctoleb.com` as doctor-facing SaaS marketing.
  - `{tenant}.doctoleb.com` as patient web.
  - `{tenant}.ops.doctoleb.com` as clinic ops.
  - `console.doctoleb.com` as future no-PHI control plane.
- The runtime no longer fundamentally assumes one static tenant Supabase client.
- Local dev still works without a control-plane server.
- The tenant resolver contract is clear enough for Flutter and web.
- Patient web and clinic ops can resolve/configure a tenant before loading tenant-specific data.
- No PHI is introduced into control-plane docs/contracts.
- No `tenant_id` appears inside tenant DB design.
- `npm run verify`, `npm run build:patient`, and `npm run build:ops` pass.

---

## 19. Final Warning

Do not build random UI first.

Do not start a fake marketplace.

Do not add `tenant_id` to tenant tables.

Do not put PHI in the control plane.

Do not copy services into each app.

Do not hardcode tenant identity.

Do not recreate deleted legacy surfaces.

The next tier is a platform/runtime boundary tier:

```txt
hostname -> tenant resolver -> tenant Supabase client -> existing canonical services -> patient-web / clinic-ops
```

If you keep that line clean, DoctoLeb can grow into doctor-branded web, clinic operations, Flutter, custom domains, and SaaS provisioning without becoming spaghetti. If you blur it, every future tenant will become expensive.

