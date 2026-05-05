# CLAUDE.md

Project-specific instructions for Claude Code working on **clinic-web** (a.k.a. **DoctoLeb**).

> Merged from the previous Gemini agent map (`.gemini/AGENT.md`) and verified against the live Supabase schema and the `selects.js` / `api.js` audit.

---

## What this project is

A React + Supabase clinic management SPA with five user roles: `doctor`, `predoctor`, `secretary`, `patient`, `admin`. Built with Vite, React 19, Tailwind, react-router 7, framer-motion, Zod, and `@supabase/supabase-js`.

- **Live Supabase project**: `clinic-website` (`gezmfmskhmjgnquoyosq`, us-east-1, Postgres 17, ACTIVE_HEALTHY)
- **Scripts**: `npm run dev` · `npm run build` · `npm run lint` · Playwright installed
- **Stack**: Postgres + Auth + Edge Functions + Realtime via Supabase

---

## Architecture — the three-layer rule

```
src/lib/selects.js   ← Single Source of Truth (DNA) — Postgres SELECT-field constants
        ↓
src/services/*.js    ← All DB ops via supabase + apiCall() + SELECT constants
        ↓
src/pages/*.jsx      ← Consume services. NEVER import `supabase` directly.
        ↓
supabase/functions/  ← Edge Functions mirror services for mobile
```

**If `selects.js` is wrong → services 400 → pages break silently.** It's the file most likely to cause invisible failures and the most important to verify.

---

## Three rules that are not optional

### 1. Every query goes through `apiCall()`

`src/services/api.js` (9 lines) is the error contract for the entire service layer:

```js
export const apiCall = async (fn) => {
  try {
    const { data, error, count } = await fn;
    if (error) throw error;
    return { data, count: count ?? null, error: null };
  } catch (error) {
    return { data: null, count: null, error: error?.message || 'An unexpected error occurred' };
  }
};
```

- **Never write manual `try/catch` in services.** All 14 services use `apiCall()`. Match the pattern.
- **Never `console.error()` in services.** The wrapper returns `error` as a string; pages decide how to render. Service-layer console logs are a production leak.
- Pages may `console.error` in catch blocks (currently ~24 instances) — that's tolerated for now.

### 2. Every query uses a SELECT constant from `src/lib/selects.js`

- **Never `.select('*')` or bare `.select()`** in services. Use the typed constant for that table.
- If a constant doesn't exist for a table you need, **add one to `selects.js` first**, then import it. Don't inline column lists.
- After editing `selects.js`, **diff against the live DB** before shipping. Use `mcp__supabase__list_tables` on project `gezmfmskhmjgnquoyosq`, schema `public`, `verbose=true`. Past audits found 16 ghost columns silently 400-ing 4 services. See `TIER0_V2_PLAN.md` for the canonical example.

### 3. Clinical and financial data is soft-deleted, never hard-deleted

- Tables with `is_archived` (patients, consultations, medical_reports, certificates, referrals): **always archive, never DELETE**.
- `payments`: financial rows are retained. `archive()` sets `status: 'failed'` — the DB check constraint allows only `pending | completed | failed | refunded`. **`'cancelled'` will fail the constraint**, even though older docs may say otherwise.
- `appointments`: use `cancel()` (`status: 'cancelled'`). There is no `delete()` and there should never be one.
- `notifications` are the only exception — transient UI messages, may be hard-deleted.

---

## Routing Map (`App.jsx`)

### Public routes

| Route | Page | Notes |
|---|---|---|
| `/` | `LandingPage` | Marketing landing |
| `/login` | `LoginPage` | Auth entry |
| `/signup` | `SignUpPage` | Registration |
| `/marketing` | `MarketingPage` | Feature showcase |
| `/demo` | `DemoPage` | ⚠️ **REMOVE OR GATE FOR PRODUCTION** |
| `/forgot-password` | `ForgotPasswordPage` | |
| `/reset-password` | `ResetPasswordPage` | |

### Secretary (`requiredRole: secretary`) — uses `<Sidebar />`

| Route | Page |
|---|---|
| `/dashboard` | `DashboardPage` |
| `/patients` | `PatientsPage` |
| `/appointments` | `AppointmentsPage` |
| `/billing` | `BillingPage` |
| `/billing/new` | `CreateBillPage` |
| `/secretary-slots` | `SecretarySlotsPage` |
| `/secretary-booking` | `SecretaryBookingPage` |

### Pre-Doctor (`requiredRole: predoctor`) — uses `<PreDoctorSidebar />`

| Route | Page |
|---|---|
| `/predoctor-dashboard` | `PreDoctorDashboardPage` |
| `/predoctor-patients` | `PreDoctorPatientsPage` |
| `/predoctor-new-check` | `PreDoctorCheckPage` |
| `/predoctor-appointments` | `PreDoctorAppointmentsPage` |
| `/predoctor-notifications` | `PreDoctorNotificationsPage` |
| `/predoctor-success` | `PreDoctorSuccessPage` |
| `/predoctor-schedule` | `PreDoctorSchedulePage` |

### Doctor (`requiredRole: doctor`) — uses `<DoctorSidebar />`

| Route | Page |
|---|---|
| `/doctor-dashboard` | `DoctorDashboardPage` |
| `/doctor-patients` | `DoctorPatientsPage` |
| `/doctor-appointments` | `DoctorAppointmentsPage` |
| `/doctor-consultation` and `/doctor-consultation/:id` | `DoctorConsultationPage` (inline header) |
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

## Service layer (`src/services/`)

**Rule**: Pages NEVER import `supabase` directly. All database operations go through a service.

| Export | File | Domain |
|---|---|---|
| (helper) `apiCall` | `api.js` | **Error wrapper for every service call** (not Edge Functions) |
| `appointmentService` | `appointments.js` | Appointments CRUD + booking |
| `authService` | `auth.js` | Login, signup, session |
| `certificateService` | `certificates.js` | Medical certificates |
| `clinicService` | `clinics.js` | Clinic profiles |
| `consultationService` | `consultations.js` | Doctor consultation sessions |
| `doctorService` | `doctors.js` | Doctor profiles / availability |
| `notificationService` | `notifications.js` | Push notifications + role-based alerts |
| `patientService` | `patients.js` | Patient CRUD + search |
| `paymentService` | `payments.js` | Billing / invoices |
| `precheckService` | `prechecks.js` | Pre-doctor triage forms |
| `referralService` | `referrals.js` | Doctor referral letters |
| `reportService` | `reports.js` | Medical reports |
| `slotService` | `slots.js` | Appointment slot management (uses `get_available_slots` + `book_slot` RPCs) |

### Service-method conventions

- **Standard names**: `getAll`, `getById`, `getBy<Field>`, `create`, `update`, `archive`/`cancel`/`dismiss` (never `delete` for clinical/financial), and `subscribeTo<Thing>` for realtime.
- **`update()` must use the SELECT constant in `.select()`** — bare `.select()` returns rows without joins and breaks optimistic UI.
- **Notifications are fire-and-forget**: `Promise.allSettled([...]).catch(() => {})`. A failed notification must never break the primary action. See `appointmentService.bookFromSlot` for the canonical pattern.

---

## Context providers (`src/contexts/`)

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

## Shared components (`src/components/`)

| Component | Purpose |
|---|---|
| `Sidebar.jsx` | Secretary sidebar, collapse + mobile drawer |
| `DoctorSidebar.jsx` | Doctor sidebar, collapse + mobile drawer |
| `PreDoctorSidebar.jsx` | Pre-Doctor sidebar, collapse + mobile drawer |
| `MobileTopBar.jsx` | Mobile header (dashboard pages) |
| `BorderGlow.jsx` | Animated glow border (dashboard cards) |
| `CountUp.jsx` | Animated number counter (stat cards) |
| `TrueFocus.jsx` | Focus animation (landing page) |
| `ErrorBoundary.jsx` | React error boundary wrapper |
| `ProtectedRoute.jsx` | Route guard — checks auth + role |

**Never inline sidebar nav.** Always use the role-appropriate shared sidebar.

---

## Shared utilities (`src/lib/`)

| File | Exports | Notes |
|---|---|---|
| **`selects.js`** | `USER_*`, `DOCTOR_*`, `PATIENT_*`, `APPOINTMENT_*`, `CONSULTATION_*`, `REPORT_*`, `CERTIFICATE_*`, `REFERRAL_*`, `NOTIFICATION_*`, `PRECHECK_*`, `PAYMENT_*`, `BILLABLE_SERVICE_*`, `CLINIC_*`, `SECRETARY_SLOT_*` field strings | **Postgres SELECT-field constants — single source of truth.** Each constant is the comma-joined column list for one table. The earlier Gemini doc described this as "dropdown option arrays" — that's incorrect. |
| `supabase.js` | `supabase` client | Single client instance |
| `animations.js` | `stagger`, `fadeUp`, `formFade` | Framer Motion variants — import, don't redeclare |
| `userDisplay.js` | `getUserDisplayName()`, `getUserInitials()`, `getDoctorLabel()` | Identity display — use instead of inline template literals |
| `dateUtils.js` | `timeAgo()` | Relative time — use instead of local `timeAgo` |
| `time.js` | Time formatting helpers | |
| `appointments.js` | `normalizeAppointment` | Joined-row → flat object for UI |
| `authIdentity.js` | Identity helpers | `auth_user_id` ↔ `users.id` mapping |
| `routes.js` | Route-path constants | |

---

## Shared hooks (`src/hooks/`)

| Hook | File | Purpose |
|---|---|---|
| `useSignaturePad` | `useSignaturePad.js` | Canvas signature drawing — used by Certificates & Referrals |

---

## Validation (`src/schemas/index.js`)

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
import { useAuth } from '../contexts/AuthContext';
import { getUserDisplayName, getUserInitials } from '../lib/userDisplay';
const { user } = useAuth();
<p>{getUserDisplayName(user) || 'Doctor'}</p>
<div>{getUserInitials(user) || '?'}</div>
```

Don't inline `${user.first_name} ${user.last_name}` — that pattern was already cleaned up across 15+ files.

### Sidebar

- Secretary → `<Sidebar />`
- Doctor → `<DoctorSidebar />`
- Pre-Doctor → `<PreDoctorSidebar />`

### Animation

```jsx
import { stagger, fadeUp } from '../lib/animations';
```

---

## Database conventions (verified against live schema)

- **Status enums are check-constrained.** Don't invent values:
  - `appointments.status`: `scheduled | confirmed | pre_check | in_consultation | completed | cancelled | no_show`
  - `consultations.status`: `pending | in_progress | completed | cancelled`
  - `referrals.status`: `pending | accepted | in_progress | completed | rejected`
  - `payments.status`: `pending | completed | failed | refunded`
  - `precheck_forms.status`: `draft | submitted | reviewed | completed`
  - `predoctors.status`: `pending | approved | rejected | graduated`
  - `users.role`: `doctor | secretary | patient | predoctor | admin`
- **`symptoms` lives on `precheck_forms`, NOT on `consultations`.** Common confusion that caused a ghost-column bug.
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
    appointments.js, consultations.js, referrals.js, certificates.js
    reports.js (medical_reports)
    patients.js, doctors.js, prechecks.js, clinics.js
    payments.js, notifications.js
supabase/
  migrations/                 # SQL migrations (DB truth)
  functions/                  # Edge Functions (mirror services for mobile)
    _shared/http.ts           # Shared HTTP helpers
    auth/, appointments/, consultations/, patients/, referrals/, process-payment/
```

### Edge Functions (Deno)

Each Edge Function mirrors the matching service for mobile clients that can't use the JS SDK directly. **When you change a service, update the matching Edge Function in the same PR.** Divergence here is the most common source of "works on web, broken on mobile" bugs.

### Migration history (the ghost-column lesson)

`supabase/migrations/` includes:
- `20260505_tier0_schema_alignment.sql` — TIER0 v1 attempted to **add** columns the code referenced (`symptoms` on consultations, `findings` on reports, etc.).
- `20260505_tier0_v2_revert_schema_expansion.sql` — TIER0 v2 **reverted** that, deciding the code should match the existing schema instead.

That revert is *why* `selects.js` had ghost columns — the code still referenced columns the second migration deleted. Treat both migrations as a unit when reading history. **Do not add columns to "match" stale code; remove the code reference instead.**

---

## Tier plans

Read in order before non-trivial changes:

| File | Status |
|---|---|
| `TIER0_PLAN.md` | superseded by V2 |
| `TIER0_V2_PLAN.md` | ✅ implemented (Phase 6 manual UI smoke-test still pending) |
| `TIER1_PLAN.md` | next up |
| `TIER2_PLAN.md` – `TIER4_PLAN.md` | sequenced after T1 |
| `DOCTOLEB_FLOW_GAPS.md` | gap log; reconcile with tier plans before adding features |
| `PLAN.md` | top-level roadmap |

---

## Known issues (open)

| Issue | Location | Priority |
|---|---|---|
| Mock `NOTIFICATIONS` constant (sanitized but static) | `PreDoctorNotificationsPage.jsx` L6-18 | Medium — wire to `notificationService` |
| Hardcoded `AVAILABLE_SERVICES` array | `CreateBillPage.jsx` L13 | Low — could become `billable_services` query |
| `/demo` route exposed in production | `App.jsx` L59 | Medium — gate or remove |
| `console.error` in catch blocks (~24 instances) | Various pages | Low — acceptable in pages, NOT services |
| Bundle > 500KB (~1.2MB) | Build output | Low — code-split with dynamic `import()` |
| Phase 6 UI smoke test of TIER0_V2 not run | — | Medium — use Playwright via the `webapp-testing` skill |

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
- **`is_archived` exists on patients/consultations/reports/referrals/certificates but `archived_at`/`archived_by` aren't in the SELECT constants.** Intentional — the app only filters on `is_archived`. Add audit columns to the constant only when the UI needs to display them.
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
