# DoctoLeb — Logic / Flow / Process Gaps Audit

> **These are issues that make the app a UI shell — buttons that do nothing, data that's fake, flows that break, and processes that silently fail.**  
> Not styling, not animation, not code style — pure functionality gaps.

---

## 🔴 CRITICAL — The App Doesn't Work At All For These

### F1. PreDoctorDashboard CRASHES on render
- **File:** `src/pages/PreDoctorDashboardPage.jsx:275`
- **What:** `PREDOCTOR_STATS.map(...)` — variable is **never defined** anywhere in the file
- **Impact:** The entire PreDoctor dashboard page throws a `ReferenceError` and renders nothing. The predoctor role is completely unusable.

### F2. PatientProfilePage "Add Medication" button CRASHES
- **File:** `src/pages/PatientProfilePage.jsx:497`
- **What:** Calls `setMedicationModal(false)` — but the actual setter is `setShowMedicationModal`
- **Impact:** Runtime `TypeError`. Doctor/predoctor cannot add medications to a patient profile. The modal never opens.

### F3. Appointments table CHECK CONSTRAINT blocks all inserts
- **File:** `supabase/migrations/20240626_create_scheduling_tables.sql:31`
- **What:** DB constraint allows only `pending, confirmed, cancelled`. But `appointments.js:69` forces `status: 'scheduled'` on every create.
- **Impact:** **Every appointment creation fails** with a database constraint violation. The entire booking flow is broken at the database level.

### F4. Appointments table missing `scheduled_at` and `duration_minutes` columns
- **File:** `supabase/migrations/20240626_create_scheduling_tables.sql:25-33`
- **What:** Migration doesn't define these columns, but `appointments.js`, `clinics.js`, and multiple pages depend on them for ordering, filtering, and time-slot calculations.
- **Impact:** Queries fail with "column does not exist", or the migration doesn't represent reality (schema drift). Either way, appointment listing and availability checking is broken.

### F5. No RLS UPDATE/DELETE policies on `appointments` table
- **File:** `supabase/migrations/20240626_create_scheduling_tables.sql:64-72`
- **What:** Only SELECT and INSERT policies exist. No UPDATE or DELETE policies for any role.
- **Impact:** `appointments.js` calls `.update()` (cancel, complete) and `.delete()` — all blocked by RLS. Doctors cannot complete appointments. Secretaries cannot cancel them. The appointment lifecycle is frozen.

### F6. No RLS UPDATE/DELETE policies on `patients` table
- **File:** `supabase/migrations/20240626_create_scheduling_tables.sql:74-80`
- **What:** Same — only SELECT and INSERT.
- **Impact:** `patients.js:update()` and `patients.js:delete()` are blocked. No one can edit patient records (allergies, blood type, medical history). The entire patient management flow is read-only after creation.

### F7. No RLS INSERT/UPDATE/DELETE policies on `clinics` table
- **File:** `supabase/migrations/20240626_create_scheduling_tables.sql:53-54`
- **What:** Only `SELECT` with `USING (true)`.
- **Impact:** `clinics.js` insert/update/delete are all blocked. No clinic can be created, modified, or removed through the app.

### F8. 8 core tables have NO RLS policies at all
- **Tables:** `users`, `doctors`, `notifications`, `consultations`, `payments`, `medical_reports`, `referrals`, `certificates`
- **What:** No `ENABLE ROW LEVEL SECURITY` statement, no policies.
- **Impact:** Two possible states — both bad:
  - **RLS disabled (default if not enabled):** Any client with the anon key can read/write ALL data in these tables. Full data breach + arbitrary data manipulation.
  - **RLS enabled but no policies:** All access is denied. Every query returns empty results. The app shows no data for these tables.

---

## 🟠 HIGH — Core Flows That Are Broken or Fake

### F9. signUp is non-atomic — creates orphaned records
- **File:** `src/services/auth.js:45-84`
- **What:** `signUp` makes 3 sequential non-transactional calls: (1) `supabase.auth.signUp()`, (2) insert into `users`, (3) insert into `patients`.
- **Impact:** If step 2 fails → orphaned auth account. If step 3 fails → user exists with no patient profile. `signIn` then signs them out at line 15-18 because patient lookup fails. **The user is stuck: they "registered" but can never sign in.**

### F10. createWalkIn is non-atomic — same orphan problem
- **File:** `src/services/patients.js:90-133`
- **What:** Two separate inserts (user, then patient) with no transaction.
- **Impact:** If patient insert fails, the user record is orphaned. Error handler at line 129 returns error but doesn't clean up the user record created at line 98.

### F11. Auth race condition — flash of login page on every refresh
- **File:** `src/contexts/AuthContext.jsx:12-24`
- **What:** `getSession().then()` calls `getCurrentUser()` but `setLoading(false)` on line 23 fires **before** `getCurrentUser()` resolves. Meanwhile `onAuthStateChange` also calls `getCurrentUser()`.
- **Impact:** Window where `loading=false` + `user=null` → `ProtectedRoute` redirects to `/login`. Authenticated users see a flash of the login page on every refresh.

### F12. onAuthStateChange has NO error handling
- **File:** `src/contexts/AuthContext.jsx:27-37`
- **What:** `await authService.getCurrentUser()` in the callback — no try/catch.
- **Impact:** If getCurrentUser fails (network error, profile missing), `SIGNED_IN` event leaves `user=null` despite valid session. User is stuck in a redirect loop: session exists → SIGNED_IN fires → getCurrentUser fails → redirect to login → sign in again → repeat.

### F13. getSession() has no .catch() — permanent loading state
- **File:** `src/contexts/AuthContext.jsx:14`
- **What:** `supabase.auth.getSession().then(...)` with no `.catch()`.
- **Impact:** If getSession rejects, `setLoading(false)` never fires. App is permanently stuck showing the loading spinner. User cannot use the app at all.

### F14. logout() has no error handling — phantom sign-out
- **File:** `src/contexts/AuthContext.jsx:83-87`
- **What:** No try/catch. If `authService.logout()` fails, React state is cleared (`user=null`) but Supabase session persists.
- **Impact:** User thinks they logged out. On next page refresh, `getSession()` restores the session and they're logged back in. On shared devices, this is a security issue.

### F15. Availability check ignores appointment DURATION
- **File:** `src/services/appointments.js:83-105`
- **What:** `checkAvailability()` only compares exact `scheduled_at` timestamps. A 9:00 AM 45-minute appointment and a 9:15 AM booking both pass the check.
- **Impact:** **Double-booking is possible.** Two patients can be booked into overlapping time slots because duration is ignored.

### F16. clinicService.getAvailableTimeSlots() also ignores duration
- **File:** `src/services/clinics.js:90-106`
- **What:** Extracts only `getHours()` from appointments, ignores `duration_minutes`. Also only blocks whole-hour slots.
- **Impact:** A 30-minute appointment at 8:00 only blocks the 8:00-9:00 slot. But 8:30 appointments are invisible entirely (no hour slot matches). **The slot picker shows incorrect availability.**

### F17. Availability checks use LOCAL timezone, DB stores UTC
- **File:** `src/services/appointments.js:85-89`, `src/services/clinics.js:95-96`
- **What:** `new Date(date).setHours(0, 0, 0, 0)` uses local time. DB `scheduled_at` is UTC.
- **Impact:** In UTC+3 (Lebanon), checking availability for "May 1" actually queries from April 30 21:00 UTC to May 1 20:59 UTC — missing 3 hours and including 3 wrong hours. **Appointments at the edges of the day are invisible or shown on the wrong day.**

### F18. book_slot RPC has a race condition — double-booking at DB level
- **File:** `supabase/migrations/20240626_create_scheduling_tables.sql:102-120`
- **What:** `SELECT is_active INTO v_is_active ... IF NOT v_is_active THEN ... INSERT ... UPDATE is_active=false` — no row lock between SELECT and UPDATE.
- **Impact:** Two concurrent booking requests can both pass the `is_active` check, both insert appointments, and both deactivate the slot. **One slot = two appointments.** The fix is `SELECT ... FOR UPDATE` or `UPDATE ... WHERE is_active=true` then check `FOUND`.

### F19. Consultation medication updates are last-write-wins
- **File:** `src/services/consultations.js:93-100`
- **What:** `addMedications()` replaces the entire `medications` JSONB column with the new array.
- **Impact:** If Doctor A adds medication while Doctor B also adds medication, Doctor B's write silently overwrites Doctor A's additions. **Lost medications in a medical app.**

### F20. Consultation complete() has no state validation
- **File:** `src/services/consultations.js:83-90`
- **What:** Sets `status: 'completed'` without checking current status.
- **Impact:** An already-completed or cancelled consultation can be "completed" again, overwriting `session_end` and other data.

### F21. Referral accept/reject/complete has no state validation
- **File:** `src/services/referrals.js:73-100`
- **What:** Each method blindly sets status without checking current status.
- **Impact:** A rejected referral can be accepted. A completed referral can be rejected. The referral state machine is non-existent.

### F22. Referral accept/reject/complete has no authorization check
- **File:** `src/services/referrals.js:73-100`
- **What:** Any authenticated user can accept, reject, or complete any referral.
- **Impact:** A patient could accept their own referral. An unrelated doctor could reject a referral meant for another doctor.

### F23. PatientProfilePage displays 100% FAKE medical data
- **File:** `src/pages/PatientProfilePage.jsx:15-49`
- **What:** `patientsData`, `PATIENT_DATA`, `VITALS`, `ALLERGIES`, `CONDITIONS`, `FAMILY_HISTORY`, `SURGICAL_HISTORY`, `VACCINES`, `INITIAL_MEDICATIONS` — all hardcoded mock objects.
- **Impact:** The entire patient detail view shows fabricated medical history. If real data fails to load, it silently falls back to mock data (`patientData || PATIENT_DATA['CP-1001']`). **A doctor could make clinical decisions based on fake data.**

### F24. PreDoctorNotificationsPage is entirely mock data
- **File:** `src/pages/PreDoctorNotificationsPage.jsx:6-18`
- **What:** `NOTIFICATIONS` is a hardcoded object. No API call to fetch real notifications.
- **Impact:** The entire notifications page for predoctor role shows fake notifications. Real notifications are never displayed.

### F25. PreDoctorCheckPage "Save as Draft" doesn't save anything
- **File:** `src/pages/PreDoctorCheckPage.jsx:294`
- **What:** Button click shows `showToast('Draft saved successfully', 'success')` but persists nothing.
- **Impact:** Pre-doctor fills out a pre-check form, clicks "Save as Draft", gets a success toast, navigates away, and **all data is lost**.

### F26. PreDoctorCheckPage file upload is fake
- **File:** `src/pages/PreDoctorCheckPage.jsx:277`
- **What:** File upload handler only does `alert(filename)`. Files are never uploaded.
- **Impact:** Medical documents, lab results, and images cannot be attached to pre-check forms. No Supabase Storage is configured.

### F27. PreDoctorCheckPage "Add New" allergy button has no handler
- **File:** `src/pages/PreDoctorCheckPage.jsx:231`
- **What:** Button is purely visual with no `onClick`.
- **Impact:** Pre-doctor cannot add new allergies to a patient's pre-check form.

### F28. PreDoctorDashboard Profile "Save" is fake
- **File:** `src/pages/PreDoctorDashboardPage.jsx:410`
- **What:** Shows `showToast('Profile updated', 'success')` but never calls Supabase.
- **Impact:** Profile changes are lost on page refresh.

### F29. PreDoctorNotificationsPage "Mark all read" doesn't work
- **File:** `src/pages/PreDoctorNotificationsPage.jsx:79`
- **What:** Button has no `onClick` handler.
- **Impact:** Pre-doctor cannot mark notifications as read. They accumulate forever.

### F30. SignUpPage Terms of Service and Privacy Policy are dead links
- **File:** `src/pages/SignUpPage.jsx:209-210`
- **What:** `href="#"` — goes nowhere.
- **Impact:** Legally, sign-up requires consent to terms. The links don't lead to any document. Consent is meaningless.

### F31. ForgotPasswordPage doesn't call Supabase resetPasswordForEmail()
- **File:** `src/pages/ForgotPasswordPage.jsx`
- **What:** Route exists but likely doesn't implement the actual password reset flow.
- **Impact:** Users who forget their password have no recovery mechanism. They're permanently locked out.

### F32. PatientOwnProfilePage partial-failure leaves inconsistent data
- **File:** `src/pages/PatientOwnProfilePage.jsx:92-108`
- **What:** Uses `Promise.all` with a direct `supabase.from('users').update()` + `patientService.update()`. If one fails, the other succeeds.
- **Impact:** User name updates but patient medical info doesn't, or vice versa. No rollback, no error recovery. The two tables are now out of sync.

---

## 🟡 MEDIUM — Flows That Partially Work or Are Incomplete

### F33. No appointment status state machine
- **File:** `src/services/appointments.js`
- **What:** No explicit `confirm()`, `cancel()`, `complete()` methods. Status changes are ad-hoc string assignments.
- **Impact:** Any status can transition to any other status. `cancelled → confirmed`, `completed → scheduled` — all allowed. No validation of valid transitions.

### F34. Appointment cancel() overwrites notes
- **File:** `src/services/appointments.js:117-124`
- **What:** `cancel()` sets `notes: reason` — replaces any existing clinical notes.
- **Impact:** Secretary or doctor's existing notes are destroyed when an appointment is cancelled.

### F35. No service-layer authorization ANYWHERE
- **Files:** All 13 service files
- **What:** Zero methods check the caller's role or identity. Entirely dependent on Supabase RLS.
- **Impact:** If RLS is missing, misconfigured, or bypassed (service key leak), there is zero defense-in-depth. Any authenticated user can read, modify, or delete any data.

### F36. SELECT users(*) leaks password_hash in 10+ queries
- **Files:** `patients.js:17,39,49`, `doctors.js:17,28,48,58`, `consultations.js:8,18,57`, `reports.js:8,18`, `certificates.js:8,18`
- **What:** Wildcard `users(*)` join returns the `password_hash` column to the frontend.
- **Impact:** The fake password hash (`supabase_auth_${uuid}`) is visible in browser dev tools and React state. If any real password data is ever stored, it would be exposed.

### F37. create-users edge function has no role check
- **File:** `supabase/functions/create-users/index.ts:22-47`
- **What:** Verifies caller has a valid auth session but never checks their role.
- **Impact:** Any patient can create arbitrary users with any role (including `doctor`, `admin`) using the service role key.

### F38. auth-signin edge function is a parallel insecure auth path
- **File:** `supabase/functions/auth-signin/index.ts:40-41`
- **What:** Compares `password_hash === password` in plaintext. Doesn't use Supabase Auth. Issues no JWT.
- **Impact:** If any client calls this function, they bypass all Supabase security (hashing, brute-force protection, MFA, session management).

### F39. No pagination on ANY list query
- **Files:** All 11 service files with `getAll()` / `getByX()` methods
- **What:** Every list query uses `SELECT *` with no `.range()` or `.limit()`.
- **Impact:** As data grows, pages become slower and eventually unusable. A clinic with 5000 patients loads all 5000 on every page visit.

### F40. No soft delete — hard deletes on medical records
- **Files:** `patients.js:149`, `appointments.js:74`, `slots.js:109`, `payments.js:60`, `reports.js:73`, `certificates.js:63`, `notifications.js:65`
- **What:** All `.delete()` calls are hard deletes with no `is_archived` flag or soft-delete pattern.
- **Impact:** Deleted medical reports, certificates, and appointment records are permanently gone. Violates HIPAA data retention requirements (6+ years for medical records).

### F41. slotService.deleteGroup() deletes booked slots
- **File:** `src/services/slots.js:109-119`
- **What:** Deletes all slots in a recurrence group without checking `is_active` or linked appointments.
- **Impact:** A secretary can delete a recurring group, destroying slots that already have appointments linked to them. Those appointments now reference non-existent slots.

### F42. clinicService.getMainDoctor() returns the globally oldest doctor
- **File:** `src/services/clinics.js:41-49`
- **What:** Orders by `created_at` ascending, takes first. No `clinic_id` filter.
- **Impact:** In a multi-clinic setup, the "main doctor" is whoever was created first across ALL clinics, not the actual clinic's doctor. Incorrect doctor is shown.

### F43. clinicService.updateClinicSettings() has no WHERE clause
- **File:** `src/services/clinics.js:60-63`
- **What:** `.update(data).select().single()` — no `.eq('clinic_id', ...)`.
- **Impact:** In multi-clinic mode, this updates ALL rows in `clinic_settings`, or fails with `.single()` ambiguity.

### F44. PatientProfilePage print() has XSS via document.write
- **File:** `src/pages/PatientProfilePage.jsx:213-338`
- **What:** `printContent` template string interpolates `patient.name` and medication data directly into HTML, then writes it via `document.write()`.
- **Impact:** If a patient name contains `<script>` tags or HTML, it's injected into a new window. Though React's JSX escapes, the raw template literal does not.

### F45. Error return shapes are inconsistent across services
- **Files:** `api.js` (string error), `patients.js:131` (object error), `payments.js` (raw error), `slots.js:66` (raw error), `notifications.js:110` (no return at all)
- **What:** `apiCall` returns `error` as a string. `patients.js:createWalkIn` returns `error` as an object. `payments.js` returns raw Supabase error. `notifyRole()` returns nothing.
- **Impact:** Error handling code that works for one service breaks for another. `if (error)` works for all, but `error.message` fails on strings, and `typeof error === 'string'` fails on objects. **UI error messages are broken or missing.**

### F46. Multiple pages silently swallow errors
- **Files:** `BillingPage.jsx:30`, `CreateBillPage.jsx:35`, `DoctorLabRequestPage.jsx:32`, `DoctorReportsPage.jsx:27`, `PreDoctorAppointmentsPage.jsx:34`, `doctors.js:62-83`
- **What:** `const { data } = await service.method()` — destructures only `data`, discards `error`.
- **Impact:** When the API call fails, `data` is `null` and `error` is silently lost. The page shows empty data with no error indication. User thinks there's no data when actually there's an error.

### F47. No cross-tab auth/session synchronization
- **File:** `src/contexts/AuthContext.jsx`
- **What:** No `TOKEN_REFRESHED` event handling. If a token refresh fails silently in one tab, API calls return 401s but the UI still shows the user as logged in.
- **Impact:** User appears authenticated but all their operations fail silently. No automatic redirect to login on expired sessions.

### F48. signIn/signUp has no concurrent request protection
- **File:** `src/contexts/AuthContext.jsx:43-81`
- **What:** No debounce or "isSubmitting" guard. `setLoading(true)` doesn't prevent re-entry.
- **Impact:** Rapid double-click on "Sign In" creates two auth requests, two profile fetches, and interleaved state updates. Can result in corrupted user state.

### F49. DoctorDashboardPage bypasses service layer
- **File:** `src/pages/DoctorDashboardPage.jsx:134`
- **What:** Directly imports `supabase` and runs `UPDATE users` for profile updates.
- **Impact:** Skips all validation, error normalization, and future business logic in the service layer. Also doesn't refresh `AuthContext.user`, so the displayed name/initials are stale until page reload.

### F50. SecretaryBookingPage & SecretarySlotsPage bypass service layer
- **Files:** `src/pages/SecretaryBookingPage.jsx:66`, `src/pages/SecretarySlotsPage.jsx:106,135`
- **What:** Dynamic `import('../lib/supabase')` to call `supabase.from('doctors').select('id').single()` directly.
- **Impact:** If there are 0 or 2+ doctors, `.single()` throws. No error handling. Also bypasses the doctor service's data access patterns.

### F51. PatientOwnProfilePage bypasses service layer
- **File:** `src/pages/PatientOwnProfilePage.jsx:7`
- **What:** Direct `import { supabase }` and `supabase.from('users').update()`.
- **Impact:** Same as F49 — no validation, inconsistent error handling.

### F52. DoctorConsultationPage bypasses service layer
- **File:** `src/pages/DoctorConsultationPage.jsx:6`
- **What:** Direct `import { supabase }` for consultation operations.
- **Impact:** Same pattern — skips service layer validation and normalization.

### F53. PreDoctorCheckPage bypasses service layer
- **File:** `src/pages/PreDoctorCheckPage.jsx:6`
- **What:** `supabase.from('precheck_forms').insert(...)` — direct DB write.
- **Impact:** No `precheck_forms` service exists. No business logic validation. The `precheck_forms` table may not even have RLS policies.

### F54. patients.js getAll() has no role-based filtering
- **File:** `src/services/patients.js:5-11`
- **What:** Returns all patients regardless of caller's role.
- **Impact:** A patient calling `getAll()` sees every other patient in the system. **Data breach in a medical app.**

### F55. patients.js update/delete has no authorization check
- **File:** `src/services/patients.js:43-50, 149-155`
- **What:** Any user can update or delete any patient record.
- **Impact:** A patient could modify another patient's medical history, blood type, or allergies. Could be life-threatening if incorrect data is entered.

### F56. payments.js has no authorization check
- **File:** `src/services/payments.js` (entire file)
- **What:** Any authenticated user can read, create, update, or delete any payment record.
- **Impact:** Patients can see other patients' billing information. Financial data exposure.

### F57. notifyRole() silently swallows errors
- **File:** `src/services/notifications.js:110-124`
- **What:** Catch block only does `console.error`. No return value.
- **Impact:** If a notification to all secretaries about an emergency fails, the caller has no way to know. The notification is silently lost.

### F58. notifications.js create() sets created_at client-side
- **File:** `src/services/notifications.js:40`
- **What:** `created_at: new Date().toISOString()` — overrides DB default.
- **Impact:** Client clock can be wrong or manipulated. Notifications can be backdated or future-dated.

### F59. No confirmation dialogs for destructive actions
- **Files:** PatientsPage, BillingPage, AppointmentsPage, etc.
- **What:** `window.confirm()` used in some places, nothing in others. No styled confirmation modal.
- **Impact:** Accidental clicks on "Delete Patient" or "Delete Appointment" execute immediately with no undo. In a medical app, accidental deletion of records is irreversible.

### F60. Notification type mismatch between UI and service
- **File:** `DashboardPage.jsx:72-78` vs `notifications.js`
- **What:** `NOTIF_ICONS` maps types like `precheck` and `referral`, but `notificationService` only creates `appointment`, `consultation`, and `referral` types.
- **Impact:** Some notification icons will never render because the type string doesn't match the icon map. Users see broken or generic notification icons.

### F61. patients table schema diverges from migration
- **File:** Migration expects `full_name, phone, email, created_by`. App expects `user_id, sex, blood_type, allergies, medical_history, insurance_id`.
- **What:** The migration creates a different table structure than what the application code queries.
- **Impact:** If the migration is run in a fresh environment, the app queries columns that don't exist. If the table was altered outside of migrations, there's no version control of the schema.

### F62. secretary_slots.doctor_id references auth.users instead of doctors table
- **File:** `supabase/migrations/20240626_create_scheduling_tables.sql:13`
- **What:** `doctor_id uuid REFERENCES auth.users(id)` — references the auth table, not the `doctors` table.
- **Impact:** If `doctors.id` is different from `doctors.user_id`, all slot and appointment queries return wrong joins. The foreign key constraint doesn't guarantee the referenced user is actually a doctor.

---

## 🟠 INCOMPLETE FEATURES — UI Exists But Backend Doesn't Exist

### F63. No file/image upload anywhere
- **Impact:** No medical images, X-rays, lab PDFs, or profile photos can be uploaded. No Supabase Storage buckets are configured.

### F64. No PDF generation
- **Impact:** Certificates, reports, referrals, and bills cannot be exported or printed as PDFs. The print button on PatientProfilePage writes raw HTML to a new window — not a proper PDF.

### F65. No email/SMS notifications
- **Impact:** All notifications are in-app only. No appointment reminders, no email confirmations, no SMS alerts. Users don't see notifications unless they're actively using the app.

### F66. No payment processing
- **Impact:** `payments.js` is CRUD only. No Stripe integration, no invoice generation, no receipt emails. The billing page can record a payment amount but cannot actually process it.

### F67. No prescription system
- **Impact:** `medications` is a raw JSONB field on consultations. No drug database, no dosage validation, no drug interaction checks, no printable prescriptions.

### F68. No user management admin panel
- **Impact:** No way to manage users, deactivate accounts, or change roles through the UI. Must be done directly in the database.

### F69. No insurance verification
- **Impact:** `insurance_id` column exists but nothing reads or validates it. The entire insurance workflow is a text field with no backend.

### F70. No analytics/reporting dashboard
- **Impact:** `doctor_dashboard_summary` view exists in DB but no admin analytics page uses it. No revenue reports, no patient volume trends, no operational metrics.

---

## Summary

| Category | Count | Description |
|----------|-------|-------------|
| **App doesn't work at all** | 8 | Crash bugs, DB constraint blocks, RLS blocks all access |
| **Core flows broken or fake** | 24 | Race conditions, fake buttons, mock data, non-atomic writes |
| **Partially working / incomplete** | 30 | No auth checks, inconsistent errors, service layer bypasses, schema drift |
| **Features with UI but no backend** | 8 | File upload, PDF, email, payments, prescriptions, admin, insurance, analytics |
| **TOTAL** | **70** | |

### Top 5 Most Impactful Fixes (to make the app actually functional)

1. **Fix appointment DB constraint** (F3) — change migration to allow `scheduled, completed, cancelled` or the entire booking flow is dead
2. **Add missing RLS UPDATE/DELETE policies** (F5, F6, F7) — without these, no data can ever be modified after creation
3. **Fix auth race conditions** (F11, F12, F13) — the login/refresh flow is unreliable, users get stuck
4. **Remove fake mock data fallbacks** (F23, F24) — doctors seeing fabricated medical data is dangerous
5. **Fix non-atomic sign-up** (F9, F10) — users get stuck with orphaned accounts, no recovery path
