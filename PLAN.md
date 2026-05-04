# DoctoLeb — Secure Web V1 Plan

> **Milestone**: Production-safe web dashboard for **1 clinic / 1 doctor**
> **Status**: Phase 1-3 complete — **migrations APPLIED to live DB** ✅
> **Last verified against live DB / functions**: 2026-05-04
> **Supabase project**: `gezmfmskhmjgnquoyosq` (clinic-website)

---

## ✅ DB Migrations Deployed (2026-05-03)

All 9 migration batches applied successfully to live DB:
1. `secure_web_v1_foundation` — auth_user_id column, helper functions
2. `secure_web_v1_timestamps_constraints` — timestamptz, status CHECK constraints
3. `secure_web_v1_audit_softdelete` — audit_log table, soft-delete columns, audit triggers
4. `secure_web_v1_triggers_rpcs_views` — sign-up trigger, update_patient_profile RPC, views
5. `secure_web_v1_rpcs_hardening_v2` — book_slot, cancel_appointment, get_next_appointment hardened
6. `secure_web_v1_rls_policies_part1-4` — 35+ role-scoped RLS policies replacing old permissive ones
7. `revoke_anon_execute_on_helpers` — revoked anon access to all SECURITY DEFINER functions

## ⚠️ Remaining Manual Action
- **Enable leaked password protection** in Supabase Dashboard → Authentication → Settings → Security
- **Optional cleanup:** remove the safe `auth` edge function only if `/auth/profile` is not needed. Verified 2026-05-04: old `auth-signin` and `create-users` functions return `NOT_FOUND`; deployed `auth/register` returns `410` and does not create users.

---

## V1 Success Criteria

- [x] No plaintext/custom auth path remains (auth.js rewritten, `public.users.password_hash` dropped)
- [x] **No `USING (true)` / `WITH CHECK (true)` RLS bypass** — 35+ scoped policies deployed
- [x] **`clinic_settings` has RLS enabled** — deployed
- [x] **3 SECURITY DEFINER views fixed** — `security_invoker = true`
- [x] **All functions search_path fixed** — `SET search_path = public, pg_temp`
- [x] **Anon-callable RPCs locked** — REVOKE EXECUTE on all helpers + RPCs from anon
- [x] **Wildcard selects fixed** — 5 services no longer expose sensitive auth fields through joins
- [x] **Hard-deletes replaced with soft-delete** — patients, reports, certificates
- [x] **RULE 5 compliance** — 0 pages import `supabase` directly (was 4)
- [x] **Notification schema mismatch fixed** — `related_type` stripped from inserts
- [x] **Precheck service expanded** — `getById`, `updateDraft` methods added
- [x] **[P0] update_patient_profile hardened** — auth.uid() ownership + staff check
- [x] **[P0] book_slot hardened** — auth.uid() check, patient ownership validation, atomic with reason/duration
- [x] **[P1] Patient appointment INSERT/UPDATE → staff-only** (must use book_slot/cancel_appointment RPCs)
- [x] **[P1] Notification INSERT → staff-only** (prevents cross-user write via public API)
- [x] **[P1] Booking partial-failure eliminated** — bookFromSlot now fully atomic through RPC
- [x] **[P2] Fallback sign-up rollback** — orphaned user row deleted if patient insert fails
- [x] **Stale book_slot(4-param) overload dropped** — only hardened 6-param version remains
- [ ] Booking, pre-check, notifications, patient profile work against real data
- [ ] No page renders fake medical data on failure
- [x] `npm run build` clean
- [ ] Role-based smoke test passes
- [ ] Leaked password protection enabled in Supabase Auth

---

## New Modules Added (by prior agent session)

| Module | Path | Purpose |
|---|---|---|
| `authIdentity` | `src/lib/authIdentity.js` | Session user resolution via `auth_user_id` FK, with email fallback |
| `selects` | `src/lib/selects.js` | Canonical SELECT field lists (explicit public profile fields only) |
| `time` | `src/lib/time.js` | `CLINIC_TIME_ZONE`, date/time parsing, formatting |
| `appointments` | `src/lib/appointments.js` | Status enum, state machine (`canTransitionAppointmentStatus`), normalizer |
| `routes` | `src/lib/routes.js` | Role → home route mapping |
| `schemas` | `src/schemas/index.js` | Zod schemas: auth, booking, patient profile, precheck |

---

## Phase 1 — Security & Auth Hardening

| # | Task | Status | Notes |
|---|---|:---:|---|
| 1.1 | Deactivate insecure custom auth path | ✅ | Old `auth-signin` and `create-users` deployed function URLs return `NOT_FOUND`. Current `auth/register` returns `410` and does not create users. |
| 1.2 | Stop writing `password_hash` from frontend | ✅ | `auth.js` rewritten — uses Supabase Auth only. `public.users.password_hash` dropped live. |
| 1.3 | Fix AuthContext race conditions | ✅ | Proper `getSession()` → `getCurrentUser()` → `setLoading(false)`. Try/catch on `onAuthStateChange`. |
| 1.4 | Error handling on `logout()` | ✅ | Returns `{ success, error }`, clears state only on success. |
| 1.5 | `isSubmitting` guard on sign-in/sign-up | ✅ | `authActionInFlightRef` prevents double-click. |
| 1.6 | Session timeout (30min idle) | ✅ | `IDLE_TIMEOUT_MS` in `AuthContext.jsx` with activity event listeners. |
| 1.7 | Enable leaked password protection | ❌ | Supabase dashboard setting — not yet toggled. |
| 1.8 | Forgot-password / reset-password flow | ✅ | `ResetPasswordPage.jsx` + `authService.requestPasswordReset()` + `resetPassword()`. |

**Phase 1 Progress: 7/8 ✅** — remaining: enable leaked PW protection

---

## Phase 2 — RLS & Database Security

> ⚠️ **All tasks below are WRITTEN IN MIGRATION FILES but NOT APPLIED to the live database.**

| # | Task | Written | Applied | File |
|---|---|:---:|:---:|---|
| 2.1 | Enable RLS on `clinic_settings` | ✅ | ❌ | `v1_policies.sql:3` |
| 2.2 | Replace `USING(true)` full-access policies | ✅ | ❌ | `v1_policies.sql` — users, patients, appointments, notifications, secretary_slots |
| 2.3 | Replace `WITH CHECK(true)` insert policies | ✅ | ❌ | `v1_policies.sql` — users (patient-only insert), doctors, clinics |
| 2.4 | Replace `USING(true)` update policies | ✅ | ❌ | `v1_policies.sql` — users (self or staff), doctors (self or staff) |
| 2.5 | Add policies to zero-policy tables | ✅ | ❌ | `v1_policies.sql` — certificates, precheck_forms, predoctors, referrals |
| 2.6 | Add INSERT/UPDATE/DELETE to partial tables | ✅ | ❌ | `v1_policies.sql` — consultations, medical_reports, payments |
| 2.7 | Fix 3 SECURITY DEFINER views | ✅ | ❌ | `v1_foundation.sql:385-458` — all 3 recreated with `security_invoker = true` |
| 2.8 | Fix mutable `search_path` on 6 functions | ✅ | ❌ | `v1_foundation.sql` — all functions now have `SET search_path = public, pg_temp` |
| 2.9 | Revoke anon EXECUTE on RPCs | ✅ | ❌ | `v1_foundation.sql:643-646` — `book_slot`, `get_available_slots` |
| 2.10 | Expand appointments CHECK constraint | ✅ | ❌ | `v1_foundation.sql:148-159` — 7 statuses including `pre_check`, `in_consultation` |
| 2.11 | Add `cancelled` to consultations CHECK | ✅ | ❌ | `v1_foundation.sql:161-169` |

**Phase 2 Progress: 11/11 written, 0/11 applied** 🔴

---

## Phase 3 — Atomic Operations & Data Integrity

| # | Task | Status | Notes |
|---|---|:---:|---|
| 3.1 | Atomic sign-up trigger | ✅📝 | `handle_auth_user_created` trigger written in migration. NOT applied. |
| 3.2 | Fix `book_slot` race condition | ✅📝 | `SELECT ... FOR UPDATE` added in migration. NOT applied. |
| 3.3 | Duration-aware availability check | ❌ | `get_available_slots` still doesn't check for overlapping time ranges. |
| 3.4 | Timezone-safe availability | ✅📝 | All timestamp columns → `timestamptz`. `CLINIC_TIME_ZONE` constant in `time.js`. Migration NOT applied. |
| 3.5 | Appointment state machine | ✅ | `canTransitionAppointmentStatus()` in `src/lib/appointments.js` — 7 statuses, explicit transitions. |
| 3.6 | Consultation state machine | ❌ | No `consultations.js` equivalent module created. |
| 3.7 | Referral state machine + auth check | ❌ | No referral state machine module. |
| 3.8 | Medication updates (append not replace) | ❌ | Not addressed. |
| 3.9 | Cancel appointment preserving notes | ✅📝 | `cancel_appointment` RPC uses `concat_ws`. Migration NOT applied. |
| 3.10 | `slotService.deleteGroup()` safety check | ❌ | Not addressed. |
| 3.11 | `clinicService.getMainDoctor()` fix | ❌ | Not addressed. |
| 3.12 | `clinicService.updateClinicSettings()` fix | ❌ | Not addressed. |
| 3.13 | Soft-delete pattern | ✅📝 | `is_archived`, `archived_at`, `archived_by` on 5 tables. Migration NOT applied. |
| 3.14 | `audit_log` table + triggers | ✅📝 | Table + triggers on 7 tables. Migration NOT applied. |

**Phase 3 Progress: 7/14 done (5 pending DB deployment)** — remaining: 7 tasks

---

## Phase 4 — Service Layer Standardization

| # | Task | Status | Notes |
|---|---|:---:|---|
| 4.1 | Zod validation schemas | ✅ Partial | Auth, booking, patient profile, precheck schemas done. Missing: consultation, payment, notification, referral schemas. |
| 4.2 | Standardize return shapes `{ data, error }` | ✅ Partial | Auth service standardized. Other services not yet verified. |
| 4.3 | Pagination on all list queries | ❌ | Not addressed. |
| 4.4 | Create `precheckService` | ❌ | Zod schema exists but no service module created. |
| 4.5 | Move direct supabase out of pages | ✅ Partial | Some pages fixed (PreDoctorDashboard, PreDoctorCheck, PatientOwnProfile). Others still pending. |
| 4.6 | Fix `SELECT users(*)` to exclude sensitive auth fields | ✅ | `USER_PUBLIC_FIELDS` in `selects.js` uses explicit profile fields. Legacy `password_hash` column has been dropped. |
| 4.7 | Role-based filtering on patient queries | ❌ | Not addressed. |
| 4.8 | Fix `notifyRole()` return shape | ❌ | Not addressed. |
| 4.9 | Stop client-side `created_at` | ❌ | Not verified. |
| 4.10 | Patient profile update via RPC | ✅📝 | `update_patient_profile` RPC written. Migration NOT applied. PatientOwnProfilePage wired to use it. |

**Phase 4 Progress: 4/10 done** — remaining: 6 tasks

---

## Phase 5 — Crash Fixes & Mock Data Removal

| # | Task | Status | Notes |
|---|---|:---:|---|
| 5.1 | Fix PreDoctorDashboard crash | ✅ | `PreDoctorDashboardPage.jsx` rewritten. |
| 5.2 | Fix PatientProfilePage medication modal | ❌ | Not verified. |
| 5.3 | Remove ALL mock data from PatientProfilePage | ❌ | Not verified. |
| 5.4 | Replace PreDoctorNotificationsPage mock data | ❌ | Not addressed. |
| 5.5 | Implement PreDoctorCheckPage draft persistence | ✅ | `PreDoctorCheckPage.jsx` rewritten. |
| 5.6 | Implement PreDoctorCheckPage "Add New" allergy | ❌ | Not addressed. |
| 5.7 | Implement PreDoctorDashboard profile save | ❌ | Not addressed. |
| 5.8 | Implement "Mark all read" for notifications | ❌ | Not addressed. |
| 5.9 | Fix silent error swallowing | ❌ | Not addressed project-wide. |
| 5.10 | Fix notification type mismatch | ❌ | Not addressed. |
| 5.11 | Delete `src/data/mockData.jsx` | ❌ | Not addressed. |
| 5.12 | Add loading/error/empty states | ❌ | Not addressed project-wide. |
| 5.13 | Add confirmation dialogs for destructive actions | ❌ | Not addressed. |
| 5.14 | Terms of Service + Privacy Policy pages | ❌ | Not addressed. |

**Phase 5 Progress: 2/14 done** — remaining: 12 tasks

---

## Phase 6 — Edge Function Audit & Mobile API Prep

| # | Task | Status | Notes |
|---|---|:---:|---|
| 6.1 | Audit/deactivate custom auth edge functions | ✅ | `auth-signin` and `create-users` return `NOT_FOUND`; `auth/register` returns `410` retired response. Optional: delete `auth` if `/auth/profile` wrapper is not needed. |
| 6.2 | Audit `appointments` edge function | ❌ | |
| 6.3 | Audit `consultations` edge function | ❌ | |
| 6.4 | Audit `patients` edge function | ❌ | |
| 6.5 | Audit `referrals` edge function | ❌ | |
| 6.6 | Audit `process-payment` edge function | ❌ | |
| 6.7 | Standardize edge function response shape | ❌ | |
| 6.8 | Add role verification to all edge functions | ❌ | |

**Phase 6 Progress: 0/8** — not started

---

## Overall Progress

| Phase | Tasks | Done | Written (not applied) | Remaining | % |
|---|---|---|---|---|---|
| 1 — Security & Auth | 8 | 6 | 0 | 2 | 75% |
| 2 — RLS & DB Security | 11 | 0 | 11 | 0 (pending deploy) | 0% live |
| 3 — Atomic Ops & Integrity | 14 | 2 | 5 | 7 | 14% |
| 4 — Service Layer | 10 | 3 | 1 | 6 | 30% |
| 5 — Crash Fixes & Mock Removal | 14 | 2 | 0 | 12 | 14% |
| 6 — Edge Function Audit | 8 | 0 | 0 | 8 | 0% |
| **TOTAL** | **65** | **13** | **17** | **35** | **20%** |

**Next immediate action**: Apply the two migration files to the live Supabase project, then rerun security advisor to verify.

---

## Post-V1 Backlog (Deferred)

| Item | Reason |
|---|---|
| Admin role + UI | V1 is single-clinic/single-doctor |
| Mobile app (React Native) | Web must be stable first |
| TypeScript migration | Stabilize JS first |
| TanStack Query | Current fetching works |
| Dark mode rewrite | Defer to post-v1 |
| i18n (Arabic, French) | English-only for v1 |
| File uploads / Storage | No medical image upload in v1 |
| PDF generation | Defer to post-v1 |
| Email/SMS notifications | In-app only for v1 |
| Payment processing (Stripe) | CRUD billing only for v1 |
| Multi-clinic architecture | Single-clinic for v1 |
| CI/CD pipeline | Manual deploy for v1 |
| Error monitoring (Sentry) | Console-only for v1 |

---

## Assumptions & Defaults

1. **Live DB is source of truth** — when repo migrations and live schema disagree, live wins
2. **Single-clinic / single-doctor** for v1
3. **Minimal disruption** — preserve route structure, service names, component names
4. **Keep JS for v1** — no TypeScript conversion during stabilization
5. **Roles for v1**: `doctor`, `predoctor`, `secretary`, `patient` (`admin` deferred)
6. **Edge functions already deployed** — audit and fix in-place
