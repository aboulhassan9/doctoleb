# DoctoLeb — RULES.md
# Non-Negotiable Constraints & Policies

> **These rules are absolute. No feature, deadline, or convenience justifies breaking them.**
> Read `SKILL.md` for HOW to implement. This file defines what you MUST and MUST NOT do.

---

## 🔴 RULE 1 — Medical Data is Sacred

1. **Never hard-delete** any medical record (patients, consultations, prescriptions, reports, certificates, referrals, medical_reports).
2. **Always use soft-delete** — set `is_archived = true`, `archived_at = now()`, `archived_by = auth.uid()`.
3. **Retain all medical data for minimum 7 years** — in compliance with Lebanese medical records law and HIPAA-equivalent standards.
4. **Never expose medical data to unauthorized roles** — a patient's medical history is visible ONLY to:
   - The patient themselves
   - Their treating doctor(s)
   - The predoctor assigned to them
   - The admin (audit purposes only)
   - **NOT the secretary** (secretary sees demographics only)
5. **Never display mock/fake medical data** — if real data fails to load, show an error state. A doctor making clinical decisions on fake data is a patient safety risk.

---

## 🔴 RULE 1A — Single-Clinic Product Boundary

1. **DoctoLeb is not SaaS in V1** — do not add tenant onboarding, public clinic registration, subscription billing, or marketplace discovery.
2. **Support multiple doctors inside one clinic** — never assume there is exactly one doctor unless a function is explicitly named as a temporary fallback.
3. **Patients may self-register publicly** — this creates patient accounts only.
4. **Staff accounts are internal** — doctors, predoctors, secretaries, and future clinic managers must be created through a trusted staff/admin workflow, never public signup.
5. **Future `admin` means clinic manager** — not a SaaS/platform administrator.

---

## 🔴 RULE 2 — One Auth System Only

1. **Use Supabase Auth exclusively** — `signUp()`, `signInWithPassword()`, `signOut()`, `resetPasswordForEmail()`.
2. **Delete `auth-signin` edge function** — plaintext password comparison is a critical vulnerability.
3. **Remove `password_hash` from `users` table** — Supabase Auth handles password storage internally.
4. **Never implement custom auth** — no custom JWT, no custom session tokens, no custom password hashing.
5. **All auth state changes must go through `AuthContext`** — no direct supabase.auth calls from pages.

---

## 🔴 RULE 3 — RLS on Every Table

1. **Every table MUST have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`** — no exceptions.
2. **Every table MUST have policies for ALL operations** — SELECT, INSERT, UPDATE, DELETE.
3. **The `admin` role gets full access** via a policy.
4. **Other roles get scoped access** — doctor sees own patients, patient sees own data, etc.
5. **Test RLS by querying as anon/patient** — if they can see other users' data, the policy is wrong.
6. **If unsure, deny by default** — it's safer to accidentally block access than to accidentally expose data.

---

## 🔴 RULE 4 — Atomic Operations

1. **Multi-table writes MUST be atomic** — use Supabase RPCs (PL/pgSQL functions) or DB triggers.
2. **Sign-up MUST be atomic** — use a DB trigger on `auth.users` insert to auto-create `users` + `patients` rows.
3. **Booking MUST be atomic** — use the `book_slot` RPC with `SELECT ... FOR UPDATE` to prevent double-booking.
4. **Never rely on sequential client-side inserts** — if step 2 fails after step 1 succeeds, the data is inconsistent.

---

## 🔴 RULE 5 — No Direct Supabase in Pages

1. **Pages import services, never `supabase`.**
2. **Services are the only files that import from `@/lib/supabase`.**
3. **No `supabase.from('table')` in any `.jsx` / `.tsx` page file.**
4. This ensures:
   - Centralized validation
   - Consistent error handling
   - Easy migration to API gateway for mobile
   - Testability (mock the service, not supabase)

---

## 🟠 RULE 6 — Input Validation

1. **Every user input MUST be validated with Zod** before reaching the database.
2. **Validation happens in the service layer** — not in the page, not in the component.
3. **Validation error messages MUST be user-friendly** — not raw Zod paths.
4. **Validate on both client AND server** (Edge Functions validate independently).
5. **Sanitize all text inputs** — trim whitespace, normalize unicode.
6. **Medical data fields have strict schemas:**
   - Blood type: enum `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`
   - Phone: Lebanese format validation `+961 XX XXXXXX`
   - Email: RFC 5322 format
   - Date of birth: past date, reasonable age range (0-150)
   - Status fields: enum validation, no arbitrary strings

---

## 🟠 RULE 7 — State Machines for Lifecycle Entities

These entities have strict status transitions. **No arbitrary status changes.**

### Appointment
```
scheduled → confirmed → in_progress → completed
                ↘                        (terminal)
scheduled → cancelled (terminal)
confirmed → cancelled (terminal)
confirmed → no_show → scheduled (rebooking)
```

### Consultation
```
pending → in_progress → completed (terminal)
pending → cancelled (terminal)
```

### Referral
```
pending → accepted → in_progress → completed (terminal)
pending → rejected (terminal)
```

### Payment
```
pending → paid (terminal)
pending → partially_paid → paid (terminal)
pending → waived (terminal)
```

---

## 🟠 RULE 8 — Pagination Always

1. **Every list query MUST support pagination** — `.range(from, to)`.
2. **Default page size: 20** — configurable up to 100.
3. **Return count** — use `{ count: 'exact' }` in the select.
4. **Frontend MUST show pagination controls** — page numbers, prev/next, items per page.
5. **This applies to mobile too** — infinite scroll with cursor-based pagination.

---

## 🟠 RULE 9 — Timezone Handling

1. **All timestamps stored as `TIMESTAMPTZ` in UTC** — Supabase default.
2. **All date comparisons done in UTC** — never use local time for DB queries.
3. **Convert to local time ONLY in the UI layer** — use `Intl.DateTimeFormat` with `Asia/Beirut`.
4. **Slot times (start_time, end_time) are TIME fields** — combined with date for display.
5. **Availability checks MUST account for timezone offset** — Lebanon is UTC+2/UTC+3 (DST).

---

## 🟠 RULE 10 — Error Handling

1. **Every async operation MUST have try/catch or .catch().**
2. **Every error MUST result in user-visible feedback** — toast, inline error, or error state.
3. **Never silently swallow errors** — `console.error` alone is NOT sufficient.
4. **Service methods return `{ data, error }` shape** — error is always a string or null.
5. **Pages display errors via `showToast(error, 'error')` or `<ErrorState>`.**
6. **Auth errors trigger redirect to login** if session is invalid.

---

## 🟡 RULE 11 — No Mock Data in Production Paths

1. **Delete `src/data/mockData.jsx`** — it must not exist in the codebase.
2. **No hardcoded arrays of fake data** in page components.
3. **No fallback to mock data** — `patientData || FAKE_DATA` is forbidden.
4. **Seed data goes in `supabase/seed.sql`** — only used in development.
5. **Demo page can have fake data** — clearly labeled as "Demo" with a banner.

---

## 🟡 RULE 12 — Mobile-Ready Backend

1. **Every Supabase service method MUST be callable from Edge Functions.**
2. **Edge Functions use the same validation schemas** (shared package).
3. **Response shapes are standardized** — `{ success, data, meta, error }`.
4. **Never return unbounded lists** — always paginate.
5. **File URLs use signed URLs** with 1-hour expiry.
6. **Sensitive fields are never returned** — no `password_hash`, no `service_role_key`.

---

## 🟡 RULE 13 — Audit Trail

1. **Every CREATE, UPDATE, DELETE on medical data MUST be logged** to `audit_log`.
2. **Audit log is append-only** — no UPDATE or DELETE allowed on audit_log.
3. **Log includes:** who (`user_id`), what (`action`, `entity_type`, `entity_id`), when (`created_at`), changes (`JSONB diff`).
4. **Admin can view audit logs** — no other role.
5. **Audit log retention: indefinite** — never purge.

---

## 🟡 RULE 14 — Naming & Structure

1. **Pages**: `PascalCaseRolePage.tsx` — e.g., `AdminUsersPage.tsx`, `DoctorConsultationPage.tsx`
2. **Services**: `camelCase.ts` — e.g., `appointments.ts`, `patients.ts`
3. **Components**: `PascalCase.tsx` — e.g., `ConfirmDialog.tsx`, `PatientCard.tsx`
4. **Migrations**: `YYYYMMDD_NN_description.sql`
5. **Edge Functions**: `kebab-case/index.ts` — e.g., `api-appointments/index.ts`
6. **One component per file** — no multi-component files
7. **No circular imports** — services don't import pages, pages don't import other pages

---

## 🟡 RULE 15 — UI/UX Standards

1. **Confirmation dialog required for**: delete, archive, cancel appointment, complete consultation, reject referral.
2. **Loading skeleton required on**: every page that fetches data.
3. **Empty state required on**: every list page (illustration + CTA).
4. **Form validation**: inline errors below fields, not just toasts.
5. **Toast notifications**: success (green), error (red), warning (amber), info (blue) — auto-dismiss after 5s.
6. **Responsive breakpoints**: 375px (mobile), 768px (tablet), 1024px (desktop), 1440px (wide).
7. **Accessible**: proper `aria-labels`, keyboard navigation, focus management.
8. **RTL support**: Arabic layout must work (flex-direction, text-align, margins).

---

## Summary — Rule Severity

| Level | Rules | Meaning |
|---|---|---|
| 🔴 **Critical** | 1–5 | Breaking these causes security vulnerabilities, data loss, or patient safety issues |
| 🟠 **High** | 6–10 | Breaking these causes bugs, data inconsistencies, or poor reliability |
| 🟡 **Medium** | 11–15 | Breaking these causes maintenance burden, tech debt, or UX problems |

**When rules conflict, higher severity wins.**
When RULE 1 (Medical Data) conflicts with any feature request, RULE 1 wins — always.
