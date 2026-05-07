# ADR-002: Separate Patient Web From Clinic Operations Web

## Status
Accepted

## Date
2026-05-07

## Context
The current Vite app contains every surface in one router:

- public landing and signup
- patient portal
- doctor dashboard and encounter workflow
- secretary scheduling/billing
- predoctor workflow
- future clinic-admin configuration

That was useful while stabilizing the backend, but it is the wrong product boundary for the real DoctoLeb model. A patient-facing clinic website should not feel like the entry point for doctors, secretaries, predoctors, or clinic admins. Staff accounts are internal accounts, not public self-service users.

The product now has three different audiences with different trust, density, and deployment needs:

- **Patient/client web**: public website, patient signup, booking, profile, history, documents.
- **Clinic operations web**: doctor, secretary, predoctor, assistant/nurse, and clinic-admin work.
- **Future SaaS control plane**: DoctoLeb owner/super-admin tooling that manages tenant projects, billing, migrations, and releases, without PHI.

The future Flutter app will serve the patient/client role and should reuse the same backend contracts as the patient web app, not duplicate business logic.

## Decision
Split DoctoLeb into separate deployable frontend apps while keeping one canonical tenant backend/API contract.

For V1:

- The existing public/patient web becomes the **patient web app**.
- Doctor, secretary, predoctor, assistant/nurse, and clinic-admin routes move to a separate **clinic operations app** with its own login page and no public marketing landing page.
- Both apps use the same Supabase tenant project and the same canonical service/API contracts.
- Staff users must not be created from patient signup.
- Patient users must not see staff login or staff routes as part of the public website journey.

The clinic-admin role is not the SaaS super-admin. Clinic admin belongs inside the tenant and may manage staff, doctor/practice configuration, tenant/mobile app config, schedules, and operational settings. The future SaaS super-admin belongs in a separate control-plane app/project and stores no PHI.

## Recommended Implementation Shape
Use a monorepo with separate deployable Vite apps and shared packages:

```txt
apps/
  patient-web/      # public clinic site + patient portal
  clinic-ops/       # doctor/staff/clinic-admin operations
packages/
  core/             # Supabase client factory, services, schemas, selectors, state machines
  ui/               # shared primitives only when genuinely cross-app
```

This is preferred over separate Git repositories for now because the backend contract is still changing quickly and duplicate services/schemas would become a maintenance risk. Separate repositories can be reconsidered after the contracts stabilize and the team has real deployment needs.

## Routing Consequences
Current temporary state:

- `http://localhost:5173/` is still the single app during migration.
- It currently includes public, patient, and staff routes.

Target state:

- `patient-web`: public landing, patient signup/login, booking, patient portal.
- `clinic-ops`: internal staff login, doctor encounter workflow, front desk, predoctor, billing, clinic-admin settings.
- Local dev can run patient web on `5173` and clinic-ops on `5174`.
- Production should use separate hostnames or clear subdomains, for example:
  - patient/public: clinic-owned domain or `patient.<clinic-domain>`
  - operations: `ops.<clinic-domain>` or `staff.<clinic-domain>`

Role handling:

- If a staff user signs into patient web, redirect or show a clear "Use the clinic operations portal" screen.
- If a patient signs into clinic-ops, redirect or show a clear "Use the patient portal" screen.
- Auth stays Supabase Auth, but each app enforces its allowed roles before rendering protected content.

## Backend Consequences
The split must not create duplicate business logic.

- Appointment booking remains `book_slot` through `appointmentService.bookFromSlot`.
- Encounter lifecycle remains `start_encounter`, `complete_encounter`, and `cancel_encounter`.
- Clinical documents remain `clinical_documents`.
- Notification inbox remains `notification_events` plus `notification_deliveries`.
- Tenant/mobile configuration remains `tenant_profile` plus `tenant_app_config`.
- Shared validation remains Zod schemas from the shared core package.
- Shared status transitions remain one state-machine module mirrored with DB rules.

The split is a frontend/deployment boundary, not permission by obscurity. RLS and RPC authorization remain the security boundary.

## Alternatives Considered

### Keep one app and hide staff links

Pros:

- Fastest short-term path.
- No package/workspace migration.

Cons:

- Patient website remains conceptually mixed with internal operations.
- Staff login still feels public.
- Future mobile/app-config work becomes harder to reason about.
- Higher risk that future agents add staff UX to patient routes.

Rejected as the long-term model.

### Separate Git repositories immediately

Pros:

- Strong physical separation.
- Independent deployment pipelines.

Cons:

- High risk of duplicated services, schemas, select strings, and state machines.
- Backend contract is still moving.
- More overhead before the product has stable app boundaries.

Rejected for now. Reconsider after patient web, clinic-ops, and Flutter contracts are stable.

### Separate Supabase projects for patient and staff

Pros:

- Hard isolation between public and staff surfaces.

Cons:

- Wrong data model: patient bookings, staff operations, encounters, documents, billing, and notifications must be one clinical record.
- Requires synchronization of PHI across projects, which is unsafe and unnecessary.

Rejected. Use one Supabase tenant project per clinic/tenant, with RLS/RPC authorization.

## Consequences

- New staff/admin UI work belongs in `clinic-ops`, not the patient web app.
- New patient/client UI work belongs in `patient-web`, and should be designed so Flutter can reuse the same API contracts later.
- The current app should be split gradually. Do not do a risky big-bang rewrite.
- The first migration step is extracting shared core code so both apps use the same service and schema contracts.
- Any route migration must keep `npm run verify` green after each small slice.
- Documentation and audits must prevent duplicate DB tables, services, route implementations, or auth flows.

## Follow-Up Work

Track implementation in `FRONTEND_APP_SPLIT_PLAN.md`.
