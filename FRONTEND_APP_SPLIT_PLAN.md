# DoctoLeb Frontend App Split Plan

> **Status**: accepted direction, not fully implemented yet.
> **Companion decision**: `docs/decisions/ADR-002-separate-patient-and-clinic-ops-apps.md`.
> **Goal**: split the current all-in-one Vite app into patient web and clinic operations apps without duplicating DB/API/business logic.

---

## 1. Product Boundary

DoctoLeb should have separate user-facing products:

| Product | Audience | Purpose | Signup/Login |
|---|---|---|---|
| Patient Web | Patients and visitors | Public clinic website, self-registration, booking, patient portal, documents/history | Patient signup allowed |
| Clinic Operations | Doctor, secretary, predoctor, assistant/nurse, clinic admin | Internal operational work: schedule, encounters, intake, billing, documents, staff/config | Internal staff login only |
| Flutter App | Patients | Mobile version of patient portal and booking | Patient auth, same backend contracts |
| SaaS Control Plane | DoctoLeb owner/super-admin | Future tenant/project management, billing, migration drift, releases | Separate auth, no PHI |

The clinic-admin role is inside the clinic tenant. It is not the SaaS super-admin.

---

## 2. Target Repo Shape

Recommended target is a monorepo with separate deployable apps and shared packages:

```txt
apps/
  patient-web/
    src/
    vite.config.js
    index.html
  clinic-ops/
    src/
    vite.config.js
    index.html
packages/
  core/
    services/
    schemas/
    lib/selects.js
    lib/stateMachines.js
    lib/supabase.js
  ui/
    components/
    styles/
```

Why monorepo first:

- one backend contract
- one schema/service/state-machine implementation
- one CI verification gate
- less duplication while DB/API contracts still evolve

Do not split into separate Git repos until the shared core is stable.

---

## 3. Route Ownership

### Patient Web Owns

| Route group | Current routes |
|---|---|
| Public marketing | `/`, `/marketing` |
| Patient auth | `/login`, `/signup`, `/forgot-password`, `/reset-password` initially; later patient-specific login copy |
| Patient portal | `/patient-dashboard`, `/patient-profile`, `/patient-appointments`, `/patient-history` |
| Public booking | future public/patient booking flow |

### Clinic Operations Owns

| Role | Current routes to move |
|---|---|
| Doctor | `/doctor-dashboard`, `/doctor-patients`, `/doctor-appointments`, `/doctor-encounter/*`, `/doctor-lab-request`, `/doctor-patient/*`, `/doctor-patient-history/*`, `/doctor-reports`, `/doctor-referrals`, `/doctor-certificates` |
| Secretary | `/dashboard`, `/patients`, `/appointments`, `/billing`, `/billing/new`, `/secretary-slots`, `/secretary-booking` |
| Predoctor | `/predoctor-dashboard`, `/predoctor-patients`, `/predoctor-appointments`, `/predoctor-new-check`, `/predoctor-notifications`, `/predoctor-success`, `/predoctor-schedule` |
| Clinic admin | future `/tenant-settings`, `/staff`, `/mobile-config`, `/audit-log`, `/feature-flags` |

### Control Plane Owns Later

No current routes. Future app only:

- tenant registry
- tenant project references
- billing/subscription state
- schema version/migration drift
- release management
- no patient/clinical data

---

## 4. Auth Rules

### Patient Web

- Public routes are available without auth.
- Signup creates only patient accounts.
- Patient login is allowed.
- If a staff/admin role logs in here, redirect to the configured operations app URL or show a clear staff-portal message.

### Clinic Operations

- No public marketing landing page.
- No public staff signup.
- Login accepts only `doctor`, `secretary`, `predoctor`, and clinic `admin` roles.
- If a patient logs in here, redirect to the patient web URL or show a patient-portal message.

### Shared

- Supabase Auth stays the identity provider.
- `public.users.auth_user_id` remains the canonical domain link.
- RLS/RPC authorization remains the true security boundary.

---

## 5. Shared Core Boundary

The following must be shared, not copied:

- `services/api.js`
- all canonical services (`appointments`, `clinical`, `documents`, `notificationCore`, `tenantConfig`, etc.)
- `schemas/index.js`
- `lib/selects.js`
- `lib/stateMachines.js`
- `lib/authIdentity.js`
- `lib/routes.js` split into app-specific route maps
- Supabase client factory/config loader

If a page in either app needs a new DB operation, add it once to the shared core package.

---

## 6. Implementation Order

### Phase 0 — Decision And Guardrails

Acceptance:

- [x] ADR exists for patient web vs clinic operations split.
- [ ] `PRODUCT.md`, `CLAUDE.md`, and `NEXT_STEPS_PLAN.md` mention that staff/admin UI moves to clinic-ops.
- [ ] Backend audit blocks new legacy/duplicate surfaces as it does today.

### Phase 1 — App Boundary Without Moving Files Yet

Goal: make the current app behave like two future apps before physically splitting.

Tasks:

- Add route-group constants for `patientWebRoutes` and `clinicOpsRoutes`.
- Add app-role guards:
  - patient web accepts patient/public only
  - operations accepts staff/admin only
- Update login copy so staff login is visually distinct when used in the operations context.
- Keep the current router working while marking route ownership.

Verification:

- `npm run verify`
- patient role can enter patient routes
- staff role is redirected away from patient app routes
- patient role is redirected away from operations routes

### Phase 2 — Extract Shared Core

Goal: prepare two apps without copying services.

Tasks:

- Create `packages/core`.
- Move service, schema, select, state-machine, auth identity, and Supabase-client code into core.
- Keep temporary import aliases so existing pages still build.
- Update backend contract audit to scan the new package.

Verification:

- `npm run verify`
- no duplicated service modules
- no page-level Supabase imports

### Phase 3 — Create `apps/patient-web`

Goal: patient app becomes the default public/client product.

Tasks:

- Create Vite app shell under `apps/patient-web`.
- Move public and patient routes.
- Keep patient `BrandProvider`, patient auth, patient protected routes.
- Remove staff navigation from this app.
- Set dev port to `5173`.

Verification:

- patient landing loads on `5173`
- patient signup/login routes work
- patient route chunks do not import staff pages

### Phase 4 — Create `apps/clinic-ops`

Goal: staff/admin app gets its own login and operational shell.

Tasks:

- Create Vite app shell under `apps/clinic-ops`.
- Move doctor, secretary, predoctor, and future clinic-admin routes.
- Add operations login route with staff/admin wording.
- Keep dense operational design direction from `DESIGN.md`.
- Set dev port to `5174`.

Verification:

- operations login loads on `5174`
- doctor encounter route works
- secretary booking route works
- predoctor workflow routes work
- patient cannot enter operations app

### Phase 5 — Delete Mixed App Shell

Goal: remove the old all-in-one router after both apps are live.

Tasks:

- Remove obsolete top-level `src/App.jsx` route ownership or convert it to one app only.
- Update scripts:
  - `dev:patient`
  - `dev:ops`
  - `build:patient`
  - `build:ops`
  - `verify`
- Update docs and handoff prompts.

Verification:

- both apps build
- contract audits scan both apps and shared packages
- no staff pages are imported by patient web
- no patient portal pages are imported by clinic-ops unless intentionally shared as read-only patient detail components

---

## 7. Staff/Admin Future Scope

Clinic operations app should later include:

- staff management
- doctor profiles and location schedules
- mobile app configuration via `tenant_app_config`
- content pages and consent documents
- feature flags by audience
- audit log viewer
- notification/reminder rules
- clinical document templates
- insurance provider and form configuration

This belongs to clinic admin, not SaaS super-admin.

---

## 8. Mobile Readiness

Flutter app should not get unique business logic.

Mobile should reuse:

- Supabase tenant URL/key
- shared schemas/contracts
- same RLS/RPC authorization
- public tenant app config RPC
- notification device registration tables
- patient document signed URL contract

The mobile UI can be configurable from `tenant_app_config`, `feature_flags`, `content_pages`, `consent_documents`, and future theme/assets settings.

---

## 9. Anti-Goals

- Do not create a staff signup page on patient web.
- Do not make the patient landing page a portal to staff/admin.
- Do not create a second database for staff.
- Do not duplicate services/schemas/select strings between apps.
- Do not start SaaS control-plane UI before patient web and clinic-ops are stable.
- Do not add `tenant_id` inside the tenant database.
- Do not recreate removed legacy tables/services.

---

## 10. Immediate Next Slice

Before moving files:

1. Add route ownership constants and role guard helpers.
2. Make `/login` behavior explicit for patient web vs operations app.
3. Add a temporary `/ops/login` or similar internal entry inside the current app only as a migration bridge.
4. Keep all existing DB/API work unchanged.

After that bridge is verified, start the physical app split.
