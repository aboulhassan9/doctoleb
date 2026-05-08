# CLAUDE.md

Project-specific instructions for Claude Code working on **clinic-web** (a.k.a. **DoctoLeb**).

> Merged from the previous Gemini agent map (`.gemini/AGENT.md`) and verified against the live Supabase schema and the `selects.js` / `api.js` audit.

---

## What this project is

A React + Supabase clinic management SPA with five user roles: `doctor`, `predoctor`, `secretary`, `patient`, `admin`. Built with Vite, React 19, Tailwind, react-router 7, framer-motion, Zod, and `@supabase/supabase-js`.

- **Live Supabase project**: `clinic-website` (`gezmfmskhmjgnquoyosq`, us-east-1, Postgres 17, ACTIVE_HEALTHY)
- **Scripts**: `npm run dev` · `npm run build` · `npm run lint` · `npm run verify` · Playwright installed
- **Stack**: Postgres + Auth + Realtime via Supabase. Edge Functions are currently retired in repo and should only return when a server-side worker/proxy is explicitly designed.
- **Frontend direction**: split the current all-in-one SPA into separate deployable apps: patient web and clinic operations. See `docs/decisions/ADR-002-separate-patient-and-clinic-ops-apps.md` and `FRONTEND_APP_SPLIT_PLAN.md`.

---

## Engineering discipline

Follow the canonical workspace rules in `G:\project\AGENTS.md`. In this repo, those rules mean:

- Pages/components do not own business logic or raw external calls. Use `packages/core` services/hooks and shared contracts.
- No duplicate backend or frontend surfaces. Check `BACKEND_DUPLICATION_AUDIT.md`, `BACKEND_CONTRACT_LEDGER.md`, ADRs, and `rg` before adding tables/services/components.
- No prototype/mock/dead-code paths in production code. Incomplete work must be safe, gated, documented, and tested.
- Small, reviewable changes only. Keep files categorized by layer and avoid large catch-all files.
- Use `npm run verify` or a documented targeted verification path before considering work complete.

---

## Architecture — Phase 3 Monorepo (apps/ + packages/)

```
doctoleb/                   ← Monorepo root
  apps/
    patient-web/            ← Standalone patient-facing app (port 3001)
      src/
        App.jsx             ← Patient-only router
        main.jsx            ← Entry point
        pages/              ← Landing, Login, Signup, PatientDashboard, etc.
      index.html
      vite.config.js        ← Independent Vite config (envDir → root)

    clinic-ops/             ← Standalone staff app (port 3002)
      src/
        App.jsx             ← Staff-only router (secretary, doctor, predoctor)
        main.jsx            ← Entry point
        pages/              ← Dashboard, Doctor*, PreDoctor*, Secretary*, etc.
        components/         ← Encounter tab components
        hooks/              ← useEncounter*, useDoctorEncounterTimeline
      index.html
      vite.config.js        ← Independent Vite config (envDir → root)

  packages/
    core/                   ← Shared business logic (@doctoleb/core)
      services/*.js         ← All DB ops via supabase + apiCall/apiPaged
      schemas/              ← Zod validation schemas
      lib/                  ← selects.js (DNA), stateMachines, supabase client
      hooks/                ← Shared utility + feature hooks
      hooks/features/       ← useAppointments, useBilling, usePatients, etc.

    ui/                     ← Shared UI components (@doctoleb/ui)
      components/ui/        ← DataTable, Modal, FormField, StatusBadge, etc.
      components/           ← AppSidebar, ProtectedRoute, ErrorBoundary
      contexts/             ← AuthContext, ToastContext, ThemeContext, etc.
      styles/               ← animations.js, styles.js

  src/
    App.jsx                 ← Unified dev-mode router (all routes)
    main.jsx                ← Root entry point
    index.css               ← Global Tailwind + custom styles
```

### Dev scripts
| Command | Port | Description |
|---|---|---|
| `npm run dev` | 5173 | Unified dev server (all routes) |
| `npm run dev:patient` | 3001 | Patient-web standalone |
| `npm run dev:ops` | 3002 | Clinic-ops standalone |
| `npm run build:patient` | — | Patient-web production build |
| `npm run build:ops` | — | Clinic-ops production build |

### Vite path aliases (`vite.config.js`)
| Alias | Resolves to | Purpose |
|---|---|---|
| `@core` | `packages/core` | Canonical: shared business logic |
| `@ui` | `packages/ui` | Canonical: shared UI components |
| `@patient-web` | `apps/patient-web/src` | Canonical: patient app pages |
| `@clinic-ops` | `apps/clinic-ops/src` | Canonical: staff app pages |
| `@/services` | `packages/core/services` | **Backward compat** — DO NOT use in new code |
| `@/schemas` | `packages/core/schemas` | **Backward compat** |
| `@/lib` | `packages/core/lib` | **Backward compat** |
| `@/contexts` | `packages/ui/contexts` | **Backward compat** |
| `@/components` | `packages/ui/components` | **Backward compat** |
| `@/hooks` | `packages/core/hooks` | **Backward compat** |
| `@` | `src` | Root catch-all (must be LAST) |

### App boundary enforcement
- `src/core/lib/appBoundaries.js` — single source of truth for role-to-surface mapping
- `ProtectedRoute` accepts `appSurface` prop to prevent cross-surface access
- `AuthRedirect` controls public page behavior for authenticated users:
  - `redirectAll` mode (login/signup): ALL authenticated users → their dashboard
  - Default mode (landing/marketing): only wrong-surface users are redirected

**If `selects.js` is wrong → services 400 → pages break silently.** It's the file most likely to cause invisible failures and the most important to verify.


---

## Three rules that are not optional

### 0. Legacy compatibility burn-down is complete

There is no production data yet. The system is still under development, so dead code and duplicate backend surfaces are removed rather than preserved.

- **Removed legacy tables/services**: `consultations`, `notifications`, `doctor_brand`, `clinic_settings`, `medical_reports`, `certificates`, `referrals`.
- **Canonical replacements**: `encounters` + Tier 2 clinical tables, `notification_events` + notification send-attempt records, `tenant_profile` + `tenant_app_config`, and `clinical_documents`.
- **Already removed**: old role-specific sidebars (`Sidebar.jsx`, `DoctorSidebar.jsx`, `PreDoctorSidebar.jsx`), old doctor consultation route/page, legacy document services, legacy notification service, and legacy brand service. Do not recreate them.
- **Live Edge Function note**: repo source for retired V1 functions (`auth`, `appointments`, `patients`, `process-payment`, `consultations`, `referrals`) is removed, but deleting deployed functions requires project-owner privileges. See `LEGACY_REMOVAL_COMPLETED.md`.
- **Before adding a table/function/service**, check `BACKEND_DUPLICATION_AUDIT.md` and run `npm run audit:backend-contract`.

### 1. Every service query uses `apiCall()` or `apiPaged()`

`src/core/services/api.js` is the error contract for the entire service layer:

```js
export const apiCall = async (fn) => {
  try {
    const { data, error } = await fn;
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error?.message || 'An unexpected error occurred' };
  }
};
```

- **List methods use `apiPaged()`** and return `{ data, meta, error }`.
- **Single reads/writes use `apiCall()`** and return `{ data, error }`.
- **Never write manual `try/catch` in services** unless wrapping multi-step logic that returns the same contract.
- **Never `console.error()` in services.** The wrapper returns `error` as a string; pages decide how to render. Service-layer console logs are a production leak.
- Pages may `console.error` in catch blocks (currently ~24 instances) — that's tolerated for now.

### 2. Every query uses a SELECT constant from `src/core/lib/selects.js`

- **Never `.select('*')` or bare `.select()`** in services. Use the typed constant for that table.
- If a constant doesn't exist for a table you need, **add one to `selects.js` first**, then import it. Don't inline column lists.
- After editing `selects.js`, **diff against the live DB** before shipping. Use `mcp__supabase__list_tables` on project `gezmfmskhmjgnquoyosq`, schema `public`, `verbose=true`.

### 3. Clinical and financial data is soft-deleted, never hard-deleted

- Tables with `is_archived` (patients, encounters, clinical documents, clinical notes, diagnoses, prescriptions, orders, care tasks): **always archive, never DELETE**.
- `payments`: financial rows are retained. `archive()` sets `status: 'failed'` — the DB check constraint allows only `pending | completed | failed | refunded`. **`'cancelled'` will fail the constraint**, even though older docs may say otherwise.
- `appointments`: use `cancel()` (`status: 'cancelled'`). There is no `delete()` and there should never be one.
- Notification inbox state lives in `notification_deliveries`; user dismissal/read state updates delivery status instead of recreating the old `notifications` table.
- Message redaction uses the current scrub model: `enforce_message_redaction` overwrites `messages.body` in place with `[redacted]`; the original content is unrecoverable, even by admins.

---

## Routing Map (`App.jsx`)

Current status: these routes still live in one Vite app during migration. Target status: public/patient routes move to the patient web app; doctor/secretary/predoctor/clinic-admin routes move to clinic operations with its own login and URL. Do not add new staff/admin surfaces to the patient landing journey.

### Public routes

| Route | Page | Notes |
|---|---|---|
| `/` | `LandingPage` | Clinic-branded patient public landing |
| `/login` | `LoginPage` | Auth entry |
| `/signup` | `SignUpPage` | Registration |
| `/marketing` | `LandingPage` | Same clinic-branded patient public landing |
| `/demo` | `DemoPage` | ⚠️ **REMOVE OR GATE FOR PRODUCTION** |
| `/forgot-password` | `ForgotPasswordPage` | |
| `/reset-password` | `ResetPasswordPage` | |

### Secretary (`requiredRole: secretary`) — uses canonical app layout/sidebar

| Route | Page |
|---|---|
| `/dashboard` | `DashboardPage` |
| `/patients` | `PatientsPage` |
| `/appointments` | `AppointmentsPage` |
| `/billing` | `BillingPage` |
| `/billing/new` | `CreateBillPage` |
| `/secretary-slots` | `SecretarySlotsPage` |
| `/secretary-booking` | `SecretaryBookingPage` |

### Pre-Doctor (`requiredRole: predoctor`) — uses canonical app layout/sidebar

| Route | Page |
|---|---|
| `/predoctor-dashboard` | `PreDoctorDashboardPage` |
| `/predoctor-patients` | `PreDoctorPatientsPage` |
| `/predoctor-new-check` | `PreDoctorCheckPage` |
| `/predoctor-appointments` | `PreDoctorAppointmentsPage` |
| `/predoctor-notifications` | `PreDoctorNotificationsPage` |
| `/predoctor-success` | `PreDoctorSuccessPage` |
| `/predoctor-schedule` | `PreDoctorSchedulePage` |

### Doctor (`requiredRole: doctor`) — uses canonical app layout/sidebar

| Route | Page |
|---|---|
| `/doctor-dashboard` | `DoctorDashboardPage` |
| `/doctor-patients` | `DoctorPatientsPage` |
| `/doctor-appointments` | `DoctorAppointmentsPage` |
| `/doctor-encounter/:appointmentId` | `DoctorEncounterPage` |
| `/doctor-encounter-id/:encounterId` | `DoctorEncounterPage` |
| `/doctor-lab-request` | `DoctorLabRequestPage` (inline header) |
| `/doctor-patient/:id` | `DoctorPatientProfilePage` |
| `/doctor-patient-history/:id` | `DoctorMedicalHistoryPage` (inline header) |
| `/doctor-reports` | `DoctorReportsPage` (inline header) |
| `/doctor-referrals` | `DoctorReferralsPage` |
| `/doctor-certificates` | `DoctorCertificatesPage` |

### Patient (`requiredRole: patient`)

| Route | Page |
|---|---|
| `/patient-dashboard` | `PatientDashboardPage` |
| `/patient-profile` | `PatientOwnProfilePage` |
| `/patient-appointments` | `PatientAppointmentsPage` |
| `/patient-history` | `PatientMedicalHistoryPage` |
| `/patient-profile/:id` | `PatientProfilePage` (shared — secretary/doctor can view) |

---

## Service layer (`src/core/services/`)

**Rule**: Pages NEVER import `supabase` directly. All database operations go through a service.

| Export | File | Domain |
|---|---|---|
| (helper) `apiCall` | `api.js` | **Error wrapper for every service call** (not Edge Functions) |
| `appointmentService` | `appointments.js` | Appointments CRUD + booking |
| `authService` | `auth.js` | Login, signup, session |
| `clinicService` | `clinics.js` | Clinic/practice locations |
| `clinicalService` | `clinical.js` | Encounters, notes, diagnoses, prescriptions, orders, documents, care tasks |
| `documentService` | `documents.js` | Reports, certificates, referrals, lab requests, insurance forms via `clinical_documents` |
| `doctorService` | `doctors.js` | Doctor profiles / availability |
| `notificationCoreService` | `notificationCore.js` | Notification events, inbox deliveries, devices, reminders |
| `patientService` | `patients.js` | Patient CRUD + search |
| `paymentService` | `payments.js` | Billing / invoices |
| `precheckService` | `prechecks.js` | Pre-doctor triage forms |
| `slotService` | `slots.js` | Appointment slot management (uses `get_available_slots` + `book_slot` RPCs) |
| `storageService` | `storage.js` | Private Supabase Storage signed URLs for clinical documents and message attachments |
| `tenantConfigService` | `tenantConfig.js` | Tenant profile, mobile app config, content, consents |

### Service-method conventions

- **Standard names**: `getAll`, `getById`, `getBy<Field>`, `create`, `update`, `archive`/`cancel`/`dismiss` (never `delete` for clinical/financial), and `subscribeTo<Thing>` for realtime.
- **`update()` must use the SELECT constant in `.select()`** — bare `.select()` returns rows without joins and breaks optimistic UI.
- **Notifications are fire-and-forget**: `Promise.allSettled([...]).catch(() => {})`. A failed notification must never break the primary action. See `appointmentService.bookFromSlot` for the canonical pattern.

---

## Context providers (`src/shared-ui/contexts/`)

| Context | Hook | Provides |
|---|---|---|
| `AuthContext` | `useAuth()` | `user`, `login()`, `logout()`, `signup()`, `loading` |
| `ToastContext` | `useToast()` | `showToast(message, type)` |
| `SidebarContext` | `useSidebar()` | `isCollapsed`, `toggleSidebar()`, `mobileOpen`, `closeMobile()` |
| `ThemeContext` | `useTheme()` | `isDarkMode`, `setIsDarkMode()`, `customBg`, `setCustomBg()` |

### `useAuth()` returns

```js
{
  user: { … },         // see shape below — null when signed out
  loading,             // true during initial session restore
  error,               // string | null — non-fatal session errors
  login(),             // wraps authService.login + setUserSession
  logout(),
  signup(),
}
```

### `user` object shape

```js
{
  id: 'uuid',
  email: '...',
  first_name: '...',
  last_name: '...',
  role: 'doctor' | 'predoctor' | 'secretary' | 'patient' | 'admin',
  phone: '...',
  patient_id: 'uuid' | null,   // present when role === 'patient'; pages may read it directly
  // NO .name, NO .initials — always compute via lib/userDisplay.js
}
```

`AuthProvider` also wires `supabase.auth.onAuthStateChange` and enforces a **30-minute idle timeout** (`IDLE_TIMEOUT_MS`). Don't add a second auth listener — extend the provider instead.

---

## Shared components (`src/shared-ui/components/`)

| Component | Purpose |
|---|---|
| `AppSidebar.jsx` | Canonical role-aware sidebar for secretary, doctor, predoctor, and patient contexts |
| `MobileTopBar.jsx` | Mobile header (dashboard pages) |
| `BorderGlow.jsx` | Animated glow border (dashboard cards) |
| `CountUp.jsx` | Animated number counter (stat cards) |
| `TrueFocus.jsx` | Focus animation (landing page) |
| `ErrorBoundary.jsx` | React error boundary wrapper |
| `ProtectedRoute.jsx` | Route guard — checks auth + role |

**Never inline sidebar nav.** Always use the role-appropriate shared sidebar.

---

## Shared utilities (`src/core/lib/`)

| File | Exports | Notes |
|---|---|---|
| **`selects.js`** | `USER_*`, `DOCTOR_*`, `PATIENT_*`, `APPOINTMENT_*`, `ENCOUNTER_*`, `CLINICAL_*`, `DOCUMENT_*`, `NOTIFICATION_EVENT_*`, `NOTIFICATION_DELIVERY_*`, `PRECHECK_*`, `PAYMENT_*`, `BILLABLE_SERVICE_*`, `CLINIC_*`, `SECRETARY_SLOT_*` field strings | **Postgres SELECT-field constants — single source of truth.** Each constant is the comma-joined column list for one table. The earlier Gemini doc described this as "dropdown option arrays" — that's incorrect. |
| `supabase.js` | `supabase` client | Single client instance |
| `animations.js` | `stagger`, `fadeUp`, `formFade` | Framer Motion variants — import, don't redeclare |
| `userDisplay.js` | `getUserDisplayName()`, `getUserInitials()`, `getDoctorLabel()` | Identity display — use instead of inline template literals |
| `dateUtils.js` | `timeAgo()` | Relative time — use instead of local `timeAgo` |
| `time.js` | Time formatting helpers | |
| `appointments.js` | `normalizeAppointment` | Joined-row → flat object for UI |
| `authIdentity.js` | Identity helpers | `auth_user_id` ↔ `users.id` mapping |
| `routes.js` | Route-path constants | |
| `stateMachines.js` | lifecycle status helpers | Appointment, encounter, document, order, prescription, care-task transitions |

---

## Shared hooks (`src/core/hooks/`)

| Hook | File | Purpose |
|---|---|---|
| `useSignaturePad` | `useSignaturePad.js` | Canvas signature drawing — used by Certificates & Referrals |

---

## Validation (`src/core/schemas/index.js`)

All Zod schemas live in **one file**. Don't scatter validation logic across services or pages. Use `parseWithSchema(schema, payload)` — it returns `{ data, error }` matching the service-layer contract, so service methods can short-circuit on validation failure with one line.

| Schema | Used by |
|---|---|
| `authSignInSchema`, `authSignUpSchema` | login/signup pages + `authService` |
| `forgotPasswordSchema`, `resetPasswordSchema` | password reset flow |
| `appointmentBookingSchema` | `appointmentService.bookFromSlot` (mirrors the DB status enum exactly) |
| `patientProfileUpdateSchema` | patient profile editing |
| `precheckDraftSchema` / `precheckSubmitSchema` | precheck forms — draft is lenient, submit requires BP/HR/temp |

Helpers exposed: `nullableTrimmedString(maxLength)`, `nullablePhone`, `nullableNumber({ integer, min, max })`, `parseWithSchema(schema, payload)`. Reuse them — `''` ↔ `null` coercion is the most error-prone part of form submission and these utilities encode the right behavior.

---

## Per-page patterns

### Header identity

```jsx
import { useAuth } from '@/contexts/AuthContext';
import { getUserDisplayName, getUserInitials } from '@/lib/userDisplay';
const { user } = useAuth();
<p>{getUserDisplayName(user) || 'Doctor'}</p>
<div>{getUserInitials(user) || '?'}</div>
```

Don't inline `${user.first_name} ${user.last_name}` — that pattern was already cleaned up across 15+ files.

### Sidebar

- All roles use the canonical `AppSidebar` through the app layout.
- Do not recreate the deleted role-specific sidebars.

### Animation

```jsx
import { stagger, fadeUp } from '@/lib/animations';
```

---

## Database conventions (verified against live schema)

- **Status enums are check-constrained.** Don't invent values:
  - `appointments.status`: `scheduled | confirmed | pre_check | in_consultation | completed | cancelled | no_show`
  - `encounters.status`: `planned | in_progress | completed | cancelled | entered_in_error`
  - `clinical_documents.status`: `draft | final | superseded | void`
  - `lab_orders.status` / `imaging_orders.status`: `draft | ordered | in_progress | resulted | cancelled`
  - `prescriptions.status`: `draft | active | completed | stopped | cancelled`
  - `care_tasks.status`: `open | in_progress | done | cancelled`
  - `payments.status`: `pending | completed | failed | refunded`
  - `precheck_forms.status`: `draft | submitted | reviewed | completed`
  - `predoctors.status`: `pending | approved | rejected | graduated`
  - `users.role`: `doctor | secretary | patient | predoctor | admin`
- **`symptoms` lives on `precheck_forms`, not on encounter/clinical note rows.** Common confusion that caused a ghost-column bug in the old consultation model.
- **FK joins use explicit FK names** when a table has multiple paths to the same target — e.g. `users!doctors_user_id_fkey(${USER_CONTACT_FIELDS})` and `users!patients_user_id_fkey(...)`. PostgREST needs the disambiguation.
- **Slot booking is atomic via `book_slot` RPC.** Don't re-implement booking by inserting rows — call `bookSlot()` from `slots.js`, then `getById(appointmentId)` for the full row. See `appointmentService.bookFromSlot`.
- **Available slots come from `get_available_slots` RPC** via `slotService`. A duplicate `clinicService.getAvailableTimeSlots` doing manual math was removed in TIER0_V2 and must not return.

---

## Project map

```
src/
  App.jsx, main.jsx           # Entry + router
  contexts/                   # Auth, Toast, Sidebar, Theme
  hooks/                      # useSignaturePad
  pages/                      # Route components (consume services only)
  components/                 # Shared UI (sidebars, ProtectedRoute, etc.)
  schemas/                    # Zod validation schemas
  lib/
    selects.js                # ⭐ SINGLE SOURCE OF TRUTH for queries
    supabase.js               # Supabase client
    animations.js, dateUtils.js, time.js, userDisplay.js, routes.js
    appointments.js (normalizeAppointment)
    authIdentity.js
  services/
    api.js (apiCall wrapper)  # ⭐ ERROR CONTRACT
    auth.js, slots.js
    appointments.js, clinical.js, documents.js, notificationCore.js
    patients.js, doctors.js, prechecks.js, clinics.js
    payments.js, intakes.js, insurance.js, schedules.js, staff.js, tenantConfig.js
supabase/
  migrations/                 # SQL migrations (DB truth)
  functions/
    README.md                 # No canonical Edge Functions right now
```

### Edge Functions (Deno)

There are no canonical Edge Functions in the repo right now. The previous V1 wrappers were removed because they duplicated service/RPC contracts and were not consumed by the current app.

When Edge Functions return, they must be intentionally designed as server-side workers/proxies only, for example notification fan-out, purge orchestration, or signed document URL helpers. They must validate input, authorize the caller, call canonical RPC/service paths, and return the same envelope as services. Do not recreate the retired V1 wrappers.

### Migration history (the ghost-column lesson)

`supabase/migrations/` includes early Tier 0/Tier 1 files that reference now-deleted legacy tables. Treat them as migration history only. The active domain model is the latest Tier 2/Tier 2.5 schema plus `20260506190000_legacy_compatibility_burndown.sql`, which drops the duplicate legacy surfaces. **Do not add columns or tables to "match" stale code; remove the stale code reference instead.**

---

## Tier plans

Read in order before non-trivial changes:

| File | Status |
|---|---|
| `docs/archive/legacy-tier-plans/TIER0_PLAN.md` / `docs/archive/legacy-tier-plans/TIER0_V2_PLAN.md` | historical remediation context |
| `TIER1_DOCTOR_PIVOT_PLAN.md` / `TIER1_SCHEMA_DESIGN.md` | doctor-branded practice pivot |
| `TIER2_PRODUCT_ARCHITECTURE_PLAN.md` / `TIER2_5_HARDENING_PLAN.md` | canonical backend/API foundation |
| `BACKEND_CONTRACT_LEDGER.md` / `BACKEND_DUPLICATION_AUDIT.md` | current source-of-truth guardrails |
| `TIER3_PLAN.md` / `BLOCK_D_PLAN.md` | current frontend hardening track |
| `DOCTOLEB_FLOW_GAPS.md` / `PLAN.md` | historical gap logs; reconcile before using |

---

## Known issues (open)

| Issue | Location | Priority |
|---|---|---|
| Browser encounter E2E needs known doctor login | `BLOCK_D_AGENT_HANDOFF_PROMPT.md` | Medium — do not reset passwords silently |
| Some page data-fetching still lives inline instead of hooks | `TIER3_PLAN.md` Phase 3 | Medium — migrate large pages incrementally |
| `/demo` route exposed in production | `App.jsx` | Medium — gate or remove |
| `console.error` in catch blocks (~24 instances) | Various pages | Low — acceptable in pages, NOT services |
| Bundle > 500KB (~1.2MB) | Build output | Low — code-split with dynamic `import()` |

## Resolved this sprint

- ✅ All `user?.initials` references (15+ locations) → computed initials
- ✅ All `user?.name` references → `getUserDisplayName()`
- ✅ "PRECISION" watermark → "DOCTOLEB"
- ✅ "Dr. Sarah Jenkins" testimonial → generic
- ✅ "Draft v1.2" → "Draft"
- ✅ Signature pad duplication → `useSignaturePad` hook
- ✅ Animation constants in 10+ pages → `lib/animations.js`
- ✅ `timeAgo()` duplicated in 2 pages → `lib/dateUtils.js`
- ✅ Mock patient names in notifications → sanitized
- ✅ TIER0_V2: 16 ghost columns removed from `selects.js`
- ✅ TIER0_V2: `payments.js` standardised on `apiCall()`
- ✅ TIER0_V2: hard-delete methods removed from clinical/financial services

---

## Things that look wrong but aren't

- **`payments.archive()` sets `status: 'failed'`, not `'cancelled'`.** The DB enum has no `cancelled`. The inline comment explains it. Don't "fix" it.
- **Some older migration files mention removed tables.** That's history, not an active contract. Current executable code must use `encounters`, `clinical_documents`, `notification_events`/`notification_deliveries`, and `tenant_profile`/`tenant_app_config`.
- **`auth_user_id` on `users` isn't in `USER_PUBLIC_FIELDS`.** Auth lookups go through `lib/authIdentity.js`, not bulk selects.

---

## Tools available

- **Supabase MCP** (user-scope) — `list_tables`, `execute_sql`, `get_advisors`, `get_logs` against project `gezmfmskhmjgnquoyosq`. **Ground-truth assumptions before writing code.** Never assume a column exists; verify.
- **context7 MCP** — fetch current docs for React 19, Supabase JS, react-router 7, Tailwind, Zod before answering library questions. Training data is often stale.
- **filesystem MCP** — `G:\project` is in scope.

---

## When in doubt

1. **Diff against the live DB** — `mcp__supabase__list_tables` with `verbose=true`. Trust the schema, not the docs.
2. **Read `selects.js` and `services/api.js`** — they encode every convention this codebase enforces. If you're tempted to deviate, you're probably wrong.
3. **Check the relevant `TIER*_PLAN.md`** — past decisions and rationale live there.
