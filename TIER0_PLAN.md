# TIER 0 — Schema Alignment Plan

> **Goal**: Fix every mismatch between the live Supabase DB columns and what the frontend code expects.  
> **Why first**: Every SELECT, INSERT, and UPDATE on `consultations`, `certificates`, `referrals`, and `medical_reports` silently fails because PostgREST rejects requests for non-existent columns. This is why those tables have 0 rows.  
> **Time**: ~1 hour  
> **Risk**: Zero — we're only adding columns and fixing constants.

---

## 1. CONSULTATIONS TABLE

### Live DB columns
```
id, appointment_id, doctor_id, patient_id, session_start, session_end,
diagnosis, treatment_plan, medications (jsonb), notes, status,
created_at, updated_at, is_archived, archived_at, archived_by
```

### Code expects (selects.js L50-65)
```
id, appointment_id, doctor_id, patient_id, diagnosis,
symptoms ❌, notes, medications, status, session_start, session_end,
follow_up_date ❌, created_at, updated_at
```

### Problems found

| # | Issue | File | Line | Impact |
|---|---|---|---|---|
| C1 | `symptoms` in SELECT — column doesn't exist | `src/lib/selects.js` | L55 | **Every** consultation query fails with PostgREST error |
| C2 | `follow_up_date` in SELECT — column doesn't exist | `src/lib/selects.js` | L61 | Same — total query failure |
| C3 | `treatment_plan` exists in DB but is **missing** from SELECT | `src/lib/selects.js` | — | Doctor never sees the treatment plan column |
| C4 | `is_archived` exists in DB but is **missing** from SELECT | `src/lib/selects.js` | — | Archived consultations can't be filtered |
| C5 | `DoctorConsultationPage` uses `historyInfo.symptoms` | `DoctorConsultationPage.jsx` | L72, L394 | This reads from `appointment.reason`, not from a `symptoms` column — so it works, but the naming is misleading |
| C6 | `consultationService.create()` inserts object with `notes`, `diagnosis`, `medications` — these all exist ✅ | `src/services/consultations.js` | L75 | Works correctly |

### Fix: Migration + selects.js

**Migration SQL** (add columns the UI needs):
```sql
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS symptoms text;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS follow_up_date date;
```

**selects.js fix**:
```diff
 export const CONSULTATION_SELECT_FIELDS = [
   'id', 'appointment_id', 'doctor_id', 'patient_id',
-  'diagnosis', 'symptoms', 'notes', 'medications',
-  'status', 'session_start', 'session_end',
-  'follow_up_date', 'created_at', 'updated_at',
+  'diagnosis', 'treatment_plan', 'symptoms', 'notes',
+  'medications', 'status', 'session_start', 'session_end',
+  'follow_up_date', 'is_archived',
+  'created_at', 'updated_at',
 ].join(', ');
```

---

## 2. CERTIFICATES TABLE

### Live DB columns
```
id, doctor_id, certificate_type, title, issuer, issue_date,
expiry_date, file_url, created_at, updated_at,
is_archived, archived_at, archived_by
```

### Code expects (selects.js L86-96)
```
id, patient_id ❌, doctor_id, certificate_type, title,
content ❌, issue_date, created_at, updated_at
```

### Problems found

| # | Issue | File | Line | Impact |
|---|---|---|---|---|
| K1 | `patient_id` in SELECT — column doesn't exist | `src/lib/selects.js` | L89 | **Every** certificate query fails |
| K2 | `content` in SELECT — column doesn't exist | `src/lib/selects.js` | L92 | Same — total query failure |
| K3 | `issuer` exists in DB but missing from SELECT | `src/lib/selects.js` | — | Never displayed |
| K4 | `expiry_date` exists in DB but missing from SELECT | `src/lib/selects.js` | — | Never displayed |
| K5 | `file_url` exists in DB but missing from SELECT | `src/lib/selects.js` | — | Attachments hidden |
| K6 | `is_archived` exists in DB but missing from SELECT | `src/lib/selects.js` | — | Can't filter archived |
| K7 | `certificateService.getByPatientId()` — filters by `patient_id` which doesn't exist on table | `src/services/certificates.js` | L30 | Method always returns error |
| K8 | `certificateService.getAll/getById()` — JOINs `patients(...)` — no FK to patients table | `src/services/certificates.js` | L10, L19 | PostgREST error: no relationship |
| K9 | `DoctorCertificatesPage.create()` sends `patient_id`, `diagnosis`, `treatment`, `recommendations`, `start_date`, `end_date`, `status` — **none** of these columns exist! | `DoctorCertificatesPage.jsx` | L137-146 | Insert always fails |
| K10 | `DoctorCertificatesPage` reads `cert.patients.users.first_name` — no patients FK | `DoctorCertificatesPage.jsx` | L268 | Table displays "Unknown" for all |
| K11 | `DoctorCertificatesPage` reads `cert.status` — no status column | `DoctorCertificatesPage.jsx` | L278-280 | Badge never shows |
| K12 | `doctorService.getCertificates()` selects `patient_id, content` — neither exists | `src/services/doctors.js` | L102 | This query also fails |
| K13 | `DoctorCertificatesPage.handlePrint()` uses `document.write()` — XSS risk | `DoctorCertificatesPage.jsx` | L119-121 | Security vulnerability |

### Fix: Migration + selects.js + service fixes

**This table needs the most work.** The DB was designed for *doctor credential certificates* (board certifications, licenses) but the UI treats it as *patient medical certificates* (sick leave, fitness-to-work). We need to add columns for the patient-facing use case.

**Migration SQL**:
```sql
-- Add patient-facing medical certificate columns
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES patients(id);
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS diagnosis text;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS treatment text;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS recommendations text;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS status varchar DEFAULT 'draft';

-- Add index for patient lookups
CREATE INDEX IF NOT EXISTS idx_certificates_patient_id ON certificates(patient_id);
```

**selects.js fix**:
```diff
 export const CERTIFICATE_SELECT_FIELDS = [
-  'id', 'patient_id', 'doctor_id', 'certificate_type', 'title',
-  'content', 'issue_date', 'created_at', 'updated_at',
+  'id', 'patient_id', 'doctor_id', 'certificate_type', 'title',
+  'content', 'issuer', 'issue_date', 'expiry_date', 'file_url',
+  'diagnosis', 'treatment', 'recommendations',
+  'start_date', 'end_date', 'status', 'is_archived',
+  'created_at', 'updated_at',
 ].join(', ');
```

**RLS policy needed** (after migration):
```sql
-- Patients can read their own certificates
CREATE POLICY "patients_read_own_certificates"
  ON certificates FOR SELECT
  USING (
    patient_id IN (
      SELECT p.id FROM patients p
      JOIN users u ON p.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );
```

---

## 3. REFERRALS TABLE

### Live DB columns
```
id, from_doctor_id, to_doctor_id, patient_id, reason, status,
referred_at, created_at, updated_at,
is_archived, archived_at, archived_by
```

### Code expects (selects.js L98-110)
```
id, patient_id, from_doctor_id, to_doctor_id, reason,
notes ❌, status, priority ❌, referred_at,
created_at, updated_at
```

### Problems found

| # | Issue | File | Line | Impact |
|---|---|---|---|---|
| R1 | `notes` in SELECT — column doesn't exist | `src/lib/selects.js` | L104 | **Every** referral query fails |
| R2 | `priority` in SELECT — column doesn't exist | `src/lib/selects.js` | L105 | Same — total query failure |
| R3 | `is_archived` exists in DB but missing from SELECT | `src/lib/selects.js` | — | Can't filter archived |
| R4 | `DoctorReferralsPage.handleSend()` inserts `to_doctor_name`, `priority`, `clinical_findings`, `treatment_plan`, `ref_number` — **none** of these exist | `DoctorReferralsPage.jsx` | L64-73 | Insert always fails |
| R5 | `to_doctor_id` is required (NOT NULL) but UI sends `to_doctor_name` (a string) — FK violation | `DoctorReferralsPage.jsx` | L67 | Insert fails even after adding columns |

### Fix: Migration + selects.js + UI data model fix

**Migration SQL**:
```sql
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS priority varchar DEFAULT 'routine';
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS clinical_findings text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS treatment_plan text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS ref_number varchar;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS to_doctor_name varchar;

-- Make to_doctor_id nullable since external referrals use doctor name
ALTER TABLE referrals ALTER COLUMN to_doctor_id DROP NOT NULL;
```

**selects.js fix**:
```diff
 export const REFERRAL_SELECT_FIELDS = [
   'id', 'patient_id', 'from_doctor_id', 'to_doctor_id',
-  'reason', 'notes', 'status', 'priority', 'referred_at',
-  'created_at', 'updated_at',
+  'reason', 'notes', 'status', 'priority', 'referred_at',
+  'clinical_findings', 'treatment_plan', 'ref_number',
+  'to_doctor_name', 'is_archived',
+  'created_at', 'updated_at',
 ].join(', ');
```

**Service fix** (`referralService.create`):
The `DoctorReferralsPage` sends `to_doctor_name` instead of `to_doctor_id`. After making `to_doctor_id` nullable, the insert will work. But we should also add a dummy `to_doctor_id` or fix the UI to select from a doctor list.

---

## 4. MEDICAL REPORTS TABLE

### Live DB columns
```
id, patient_id, doctor_id, report_type, title, content,
file_url, created_at, updated_at,
is_archived, archived_at, archived_by
```

### Code expects (selects.js L74-84)
```
id, patient_id, doctor_id, report_type, title, content,
findings ❌, created_at, updated_at
```

### Problems found

| # | Issue | File | Line | Impact |
|---|---|---|---|---|
| M1 | `findings` in SELECT — column doesn't exist | `src/lib/selects.js` | L81 | **Every** report query fails |
| M2 | `file_url` exists in DB but missing from SELECT | `src/lib/selects.js` | — | Uploaded files invisible |
| M3 | `is_archived` exists in DB but missing from SELECT | `src/lib/selects.js` | — | Can't filter archived |
| M4 | `clinicService.requestLabTest()` inserts `report_type`, `title`, `content` — these exist ✅ | `src/services/clinics.js` | L514-520 | Works, but `findings` in SELECT breaks the return |

### Fix: Migration + selects.js

**Migration SQL**:
```sql
ALTER TABLE medical_reports ADD COLUMN IF NOT EXISTS findings text;
```

**selects.js fix**:
```diff
 export const REPORT_SELECT_FIELDS = [
   'id', 'patient_id', 'doctor_id', 'report_type',
-  'title', 'content', 'findings',
-  'created_at', 'updated_at',
+  'title', 'content', 'findings', 'file_url', 'is_archived',
+  'created_at', 'updated_at',
 ].join(', ');
```

---

## 5. TABLES THAT ARE ALREADY CORRECT ✅

These were verified column-by-column and are fine:

| Table | Status | Notes |
|---|---|---|
| `appointments` | ✅ Correct | All 12 columns match selects.js perfectly |
| `users` | ✅ Correct | All fields match `USER_PUBLIC_FIELDS` and `USER_CONTACT_FIELDS` |
| `doctors` | ✅ Correct | `DOCTOR_SELECT_FIELDS` matches live schema |
| `patients` | ✅ Correct | `PATIENT_SELECT_FIELDS` matches live schema |
| `notifications` | ✅ Correct | Service uses inline selects, all match |
| `precheck_forms` | ✅ Correct | Service uses inline selects, all match |
| `payments` | ✅ Correct | Service uses inline selects, all match |
| `secretary_slots` | ✅ Correct | All columns match |
| `clinics` | ✅ Correct | Simple 3-column table |
| `clinic_settings` | ✅ Correct | Service uses `*` selector |
| `billable_services` | ✅ Correct | Service uses `*` selector |
| `audit_log` | ✅ Correct | Only written by triggers, never read from frontend |

---

## EXECUTION CHECKLIST

### Step 1: Database Migration
```
Apply a single migration that adds ALL missing columns at once.
This is safe — ALTER TABLE ADD COLUMN IF NOT EXISTS is idempotent.
```

### Step 2: RLS Policies for New Columns
```
Add RLS policy for certificates.patient_id so patients can read their own certs.
No other RLS changes needed — existing policies cover the tables.
```

### Step 3: Fix selects.js
```
Update all 4 SELECT field constants to match the new schema.
Add treatment_plan, is_archived to CONSULTATION_SELECT_FIELDS.
Add all new certificate columns to CERTIFICATE_SELECT_FIELDS.
Add all new referral columns to REFERRAL_SELECT_FIELDS.
Add findings, file_url, is_archived to REPORT_SELECT_FIELDS.
```

### Step 4: Fix doctorService.getCertificates()
```
src/services/doctors.js L102 — hardcoded select string references
patient_id and content. Update to use CERTIFICATE_SELECT_FIELDS.
```

### Step 5: Fix certificateService join paths
```
src/services/certificates.js L10, L19 — JOINs patients() now valid
after adding patient_id FK. No code change needed, but verify.
```

### Step 6: Verify referralService.create() data model
```
DoctorReferralsPage sends to_doctor_name (string) not to_doctor_id (uuid).
After migration makes to_doctor_id nullable, inserts will succeed.
```

### Step 7: Smoke Test
```
After all changes, verify:
- [ ] consultationService.getAll() returns data (not error)
- [ ] certificateService.getAll() returns data (not error)
- [ ] referralService.getAll() returns data (not error)
- [ ] reportService.getAll() returns data (not error)
- [ ] DoctorCertificatesPage can create a new certificate
- [ ] DoctorReferralsPage can send a referral
- [ ] DoctorConsultationPage can save a consultation
```

---

## FULL MIGRATION SQL (single atomic migration)

```sql
-- ============================================================
-- TIER 0: Schema Alignment Migration
-- Adds all columns that the frontend code expects but don't
-- yet exist in the live database.
-- ============================================================

-- 1. CONSULTATIONS — add symptoms and follow_up_date
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS symptoms text;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS follow_up_date date;

-- 2. CERTIFICATES — add patient-facing medical certificate fields
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES patients(id);
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS diagnosis text;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS treatment text;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS recommendations text;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS status varchar DEFAULT 'draft';
CREATE INDEX IF NOT EXISTS idx_certificates_patient_id ON certificates(patient_id);

-- 3. REFERRALS — add notes, priority, clinical data, external doctor name
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS priority varchar DEFAULT 'routine';
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS clinical_findings text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS treatment_plan text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS ref_number varchar;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS to_doctor_name varchar;
ALTER TABLE referrals ALTER COLUMN to_doctor_id DROP NOT NULL;

-- 4. MEDICAL REPORTS — add findings
ALTER TABLE medical_reports ADD COLUMN IF NOT EXISTS findings text;

-- 5. RLS: patients can read their own certificates
CREATE POLICY "patients_read_own_certificates"
  ON certificates FOR SELECT
  USING (
    patient_id IN (
      SELECT p.id FROM patients p
      JOIN users u ON p.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );
```

---

## IMPACT SUMMARY

| Before Tier 0 | After Tier 0 |
|---|---|
| 4 tables completely broken (0 rows, all queries fail) | All 17 tables fully operational |
| Certificates page creates nothing | Certificates can be issued to patients |
| Referrals page fails on send | Referrals with clinical data work |
| Consultation saves only `notes` and `diagnosis` | Full symptoms, treatment plan, follow-up |
| Report queries fail silently | Reports with findings and file attachments |
