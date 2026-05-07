# DoctoLeb — Patient Web / Clinic Ops Split Agent Handoff

> **Use**: paste this entire file into the next senior agent session.
> **Date**: 2026-05-07.
> **Repo**: `G:\project\doctoleb`.
> **Current branch**: `main`.
> **Latest pushed decision commit at handoff time**: `a8bb03c docs: plan patient and operations app split`.
> **Purpose**: start the frontend app-boundary tier safely, without re-searching the whole project or accidentally changing the active backend/API plan.

---

## 0. Your Role

Act as a **senior frontend/platform engineer + product architect**.

You are not here to redesign the whole product, restart planning, or rebuild the DB. The backend/API foundation is already in motion and must stay intact. Your job is to begin the **frontend app split**:

- Patient-facing web should become the public/client app.
- Doctor/staff/clinic-admin should move to a separate internal operations app.
- Both apps must share the same backend/API/service contracts.

Proceed in small slices. Keep `npm run verify` green after every slice.

---

## 1. Mandatory Reading Order

Read these first, in this order:

1. `CLAUDE.md`
2. `PRODUCT.md`
3. `DESIGN.md`
4. `.codex/instructions.md`
5. `docs/decisions/ADR-002-separate-patient-and-clinic-ops-apps.md`
6. `FRONTEND_APP_SPLIT_PLAN.md`
7. `NEXT_STEPS_PLAN.md`
8. `BACKEND_CONTRACT_LEDGER.md`
9. `BACKEND_DUPLICATION_AUDIT.md`

If files disagree, priority is:

```txt
live code/backend contract
  > CLAUDE.md
  > ADR-002
  > FRONTEND_APP_SPLIT_PLAN.md
  > PRODUCT.md
  > DESIGN.md
  > older tier/handoff docs
```

Do not use old Tier 0 / Tier 1 language to undo the accepted app split.

---

## 2. Product Truth

DoctoLeb is currently a **single-clinic, multi-doctor product**.

It is not:

- a doctor marketplace
- a public staff signup platform
- a SaaS control plane yet
- an AI startup
- a multi-country fake-scale product

Real audiences:

- **Patients**: public web, signup, booking, profile, history, documents.
- **Doctor/staff**: internal operations only.
- **Clinic admin**: internal clinic tenant admin, not SaaS super-admin.
- **Future Flutter app**: patient/client app using same backend contracts.
- **Future SaaS super-admin**: separate control plane, no PHI.

The user explicitly does **not** want doctors, secretaries, staff, or clinic admins entering through the same public landing page at `http://localhost:5173/`.

---

## 3. Accepted Architecture Decision

ADR-002 is accepted:

```txt
apps/
  patient-web/      # public clinic site + patient portal
  clinic-ops/       # doctor/staff/clinic-admin operations
packages/
  core/             # shared services, schemas, selectors, state machines
  ui/               # shared primitives only when truly cross-app
```

Important: this is the **target shape**, not necessarily the first edit.

Current temporary state:

- One Vite app still owns everything in `src/App.jsx`.
- `localhost:5173` still serves public, patient, doctor, secretary, predoctor routes.
- This is now considered a migration state, not the product truth.

Target state:

- Patient web runs on `5173`.
- Clinic operations runs on `5174`.
- Both use the same Supabase tenant backend and shared core.

---

## 4. Non-Negotiables

Do not break these.

- Do not change the active backend/API implementation plan unless explicitly asked.
- Do not create a second database for staff.
- Do not add `tenant_id` inside the tenant DB.
- Do not duplicate services, schemas, select constants, or state machines.
- Do not create staff signup on patient web.
- Do not make the public landing page a portal to staff/admin.
- Do not build SaaS super-admin now.
- Do not recreate removed legacy surfaces:
  - `consultations`
  - `notifications`
  - `doctor_brand`
  - `clinic_settings`
  - `medical_reports`
  - `certificates`
  - `referrals`
- Do not bypass `book_slot`.
- Do not bypass encounter/document lifecycle RPCs.
- Do not import Supabase directly inside pages.
- Do not use `.select('*')` or bare `.select()` in services.
- Do not hard-delete clinical/financial rows from services.

Every implementation must preserve:

- `apiCall()` / `apiPaged()` service envelope.
- Zod validation on writes.
- shared `src/lib/selects.js`.
- shared `src/lib/stateMachines.js`.
- Supabase RLS/RPC as the real security boundary.

---

## 5. Current Backend State

Live Supabase project:

- Project ref: `gezmfmskhmjgnquoyosq`
- Name: `clinic-website`
- Region: East US

Canonical backend surfaces:

- appointments: `secretary_slots`, `appointments`, `visit_types`, `book_slot`
- encounter workflow: `encounters`, `clinical_notes`, `diagnoses`, `prescriptions`, lab/imaging orders, care tasks
- clinical documents: `clinical_documents`, `document_attachments`
- notifications: `notification_events`, `notification_deliveries`, `patient_devices`, reminder rules
- tenant/mobile config: `tenant_profile`, `tenant_app_config`, `feature_flags`, content/consent tables
- staff/config: `staff_members`, schedules, practice locations

Recently landed backend/frontend contract:

- `complete_encounter` blocks:
  - draft clinical documents
  - empty encounters unless there is a clinical note or completion summary
- prescriptions require a diagnosis in the same encounter
- `DoctorEncounterPage` surfaces these rules before DB rejection
- `useEncounterDraft` persists unsaved note text locally per encounter every 30 seconds

Verification before this handoff:

- `npm run verify` passes.
- Live anon RPC diagnostics pass.
- SQL audit + pgTAP still skip unless `BACKEND_TEST_DATABASE_URL` is set.

Known limitation:

- Playwright package exists, but Chromium runtime install timed out.
- Protected doctor-route browser verification still needs a safe known doctor login.

---

## 6. Current Frontend State

Router file:

- `src/App.jsx`

Current route ownership:

### Patient/Public Routes

- `/`
- `/marketing`
- `/login`
- `/signup`
- `/forgot-password`
- `/reset-password`
- `/patient-dashboard`
- `/patient-profile`
- `/patient-appointments`
- `/patient-history`

### Clinic Operations Routes To Move Later

Doctor:

- `/doctor-dashboard`
- `/doctor-patients`
- `/doctor-appointments`
- `/doctor-encounter/:appointmentId`
- `/doctor-encounter-id/:encounterId`
- `/doctor-lab-request`
- `/doctor-patient/:id`
- `/doctor-patient-history/:id`
- `/doctor-reports`
- `/doctor-referrals`
- `/doctor-certificates`

Secretary:

- `/dashboard`
- `/patients`
- `/appointments`
- `/billing`
- `/billing/new`
- `/secretary-slots`
- `/secretary-booking`

Predoctor:

- `/predoctor-dashboard`
- `/predoctor-patients`
- `/predoctor-appointments`
- `/predoctor-new-check`
- `/predoctor-notifications`
- `/predoctor-success`
- `/predoctor-schedule`

Future clinic-admin:

- `/tenant-settings`
- `/staff`
- `/mobile-config`
- `/audit-log`
- `/feature-flags`

---

## 7. Design Contract

When touching UI:

- Follow `PRODUCT.md`, `DESIGN.md`, and `.codex/instructions.md`.
- Default visual direction: industrial/utilitarian with clinical calm.
- Patient/public surfaces can be more editorial, but truthful.
- Clinic ops surfaces should be dense, operational, left-anchored, and trust-first.
- Avoid purple-blue startup gradients, fake scale claims, fake AI, fake logos.
- Do not expand legacy Inter-only typography into new polished public surfaces.
- Prefer semantic tokens and OKLCH direction from `DESIGN.md`.
- Meet WCAG 2.2 AA.
- Respect `prefers-reduced-motion`.

Do not redesign the whole app while doing app-boundary work. Improve only touched surfaces.

---

## 8. First Implementation Slice

Do **not** start with a big file move.

Start with **Phase 1 from `FRONTEND_APP_SPLIT_PLAN.md`**:

### Goal

Make the current app behave like two future apps before physically splitting files.

### Recommended edits

1. Create route ownership constants, likely in a new file such as:

   ```txt
   src/lib/appBoundaries.js
   ```

   Suggested exports:

   ```js
   export const APP_SURFACES = {
     patientWeb: 'patient-web',
     clinicOps: 'clinic-ops',
   };

   export const PATIENT_WEB_ROLES = ['patient'];
   export const CLINIC_OPS_ROLES = ['doctor', 'secretary', 'predoctor', 'admin'];

   export const PATIENT_WEB_ROUTES = [...]
   export const CLINIC_OPS_ROUTES = [...]
   ```

2. Add helpers for role/app matching:

   ```js
   isPatientRole(role)
   isClinicOpsRole(role)
   getAppSurfaceForRole(role)
   ```

3. Add a temporary operations login bridge route in the current app:

   ```txt
   /ops/login
   ```

   This should use existing auth logic, not new auth.

4. Keep `/login` patient-facing by default.

5. If staff login happens through `/login` during migration, redirect or show a clear "Use clinic operations portal" message.

6. If a patient tries clinic ops, redirect or show "Use patient portal."

7. Do not physically create `apps/patient-web` and `apps/clinic-ops` until this app-boundary behavior is verified.

### Likely files to inspect first

- `src/App.jsx`
- `src/components/ProtectedRoute.jsx`
- `src/pages/LoginPage.jsx`
- `src/contexts/AuthContext.jsx`
- `src/lib/routes.js`
- `src/lib/authIdentity.js`
- `src/lib/userDisplay.js`

### Acceptance Criteria

- Existing routes still build and load.
- Patient/public login remains patient-oriented.
- Staff has a clearly separate operations login path.
- Patient role cannot enter operations routes.
- Staff roles are not encouraged to enter from the patient landing journey.
- No duplicated auth/service logic.
- `npm run verify` passes.

---

## 9. Second Implementation Slice

Only after Slice 1 is green:

### Extract shared core gradually

Start moving code toward:

```txt
packages/core/
```

But do this carefully:

- move one module group at a time
- preserve import aliases where possible
- keep `npm run verify` green after every move
- update backend contract audit to scan new package locations

Core must include:

- services
- schemas
- select constants
- state machines
- auth identity helpers
- Supabase client factory/config

Do not copy these into each app.

---

## 10. Future Slices, Not Now

Do not start these until earlier slices are green:

- create `apps/patient-web`
- create `apps/clinic-ops`
- move route files physically
- create operations-specific design shell
- create clinic-admin settings pages
- create Flutter app
- create SaaS control plane

The user cares about doing this correctly, not quickly. Small verified steps are preferred.

---

## 11. Verification Commands

Always run:

```bash
npm run verify
```

If touching UI and browser tooling is available:

```bash
npm run dev
```

Then verify:

- patient landing on `http://localhost:5173/`
- patient login on `/login`
- operations login on `/ops/login` after you add it
- protected route redirects
- mobile and desktop layout basics

Known browser issue:

- Playwright Chromium may need installation.
- If install fails or no safe staff credentials exist, state exactly what could not be visually verified.

---

## 12. Git Workflow

Before editing:

```bash
git status --short --branch
```

After each slice:

```bash
npm run verify
git diff --check
git status --short --branch
```

Commit focused changes only.

Suggested commit style:

```txt
feat: add app boundary guards
chore: prepare shared core package
docs: update app split handoff
```

Do not include `.env` files, secrets, build artifacts, or unrelated user files.

---

## 13. Common Mistakes To Avoid

- Starting a full monorepo migration before route-boundary behavior exists.
- Copying `src/services` into two apps.
- Creating a new staff auth system.
- Creating staff signup on the public website.
- Moving backend code without updating audits.
- Treating clinic admin as SaaS super-admin.
- Adding SaaS tenant tables inside the clinic tenant DB.
- Changing RLS/schema because a frontend split feels like a security split.
- Making patient web import staff pages "temporarily" after the split.
- Using the patient landing page as an index of all roles.

---

## 14. What To Tell The User After Your First Slice

Report:

- what changed
- what was verified
- what could not be verified
- whether staff and patient entry points are now separated in behavior
- whether the repo is still on the staged app-split path

Keep the explanation short and concrete.

---

## 15. One-Sentence Mission

Separate DoctoLeb into a patient/client app and an internal clinic-operations app while preserving one shared backend/API contract and one clinical source of truth.
