# TIER 0 v2 — Foundation Stone: Code ↔ DB Perfect Alignment

> **Goal**: Make the codebase surgically clean — every SELECT constant, every service file, every Edge Function matches the live Supabase schema exactly. Zero ghost columns, zero duplicate patterns, zero mismatched error styles. This is the bedrock everything else builds on.  
> **Time**: ~3–4 hours  
> **Risk**: Low — read-only audit + targeted fixes. No schema changes.

---

## TABLE OF CONTENTS

1. [SELECT Constants vs DB Reality](#1-select-constants-vs-db-reality)
2. [Service Layer Pattern Inconsistencies](#2-service-layer-pattern-inconsistencies)
3. [Duplicate Service Logic](#3-duplicate-service-logic)
4. [API Wrapper Gaps](#4-api-wrapper-gaps)
5. [File-by-File Fix Map](#5-file-by-file-fix-map)
6. [Execution Checklist](#6-execution-checklist)

---

## 1. SELECT CONSTANTS vs DB REALITY

### The Single Source of Truth: `src/lib/selects.js`

Every service queries the DB through `selects.js` constants. If a constant references a column that doesn't exist, PostgREST returns a **400 error** and the entire query fails silently.

### Ghost Columns (In Code, NOT in DB)

| Constant | Ghost Column | DB Table | Status |
|---|---|---|---|
| `CONSULTATION_SELECT_FIELDS` | `symptoms` | `consultations` | 🔴 **Does NOT exist** — lives in `precheck_forms` |
| `CONSULTATION_SELECT_FIELDS` | `follow_up_date` | `consultations` | 🔴 **Does NOT exist** |
| `REPORT_SELECT_FIELDS` | `findings` | `medical_reports` | 🔴 **Does NOT exist** |
| `CERTIFICATE_SELECT_FIELDS` | `patient_id` | `certificates` | 🔴 **Does NOT exist** |
| `CERTIFICATE_SELECT_FIELDS` | `content` | `certificates` | 🔴 **Does NOT exist** |
| `CERTIFICATE_SELECT_FIELDS` | `diagnosis` | `certificates` | 🔴 **Does NOT exist** |
| `CERTIFICATE_SELECT_FIELDS` | `treatment` | `certificates` | 🔴 **Does NOT exist** |
| `CERTIFICATE_SELECT_FIELDS` | `recommendations` | `certificates` | 🔴 **Does NOT exist** |
| `CERTIFICATE_SELECT_FIELDS` | `start_date` | `certificates` | 🔴 **Does NOT exist** |
| `CERTIFICATE_SELECT_FIELDS` | `end_date` | `certificates` | 🔴 **Does NOT exist** |
| `CERTIFICATE_SELECT_FIELDS` | `status` | `certificates` | 🔴 **Does NOT exist** |
| `REFERRAL_SELECT_FIELDS` | `notes` | `referrals` | 🔴 **Does NOT exist** |
| `REFERRAL_SELECT_FIELDS` | `priority` | `referrals` | 🔴 **Does NOT exist** |
| `REFERRAL_SELECT_FIELDS` | `clinical_findings` | `referrals` | 🔴 **Does NOT exist** |
| `REFERRAL_SELECT_FIELDS` | `treatment_plan` | `referrals` | 🔴 **Does NOT exist** |
| `REFERRAL_SELECT_FIELDS` | `ref_number` | `referrals` | 🔴 **Does NOT exist** |
| `REFERRAL_SELECT_FIELDS` | `to_doctor_name` | `referrals` | 🔴 **Does NOT exist** |

**Impact**: 16 ghost columns = **4 broken services** (consultations, certificates, referrals, reports).

### Missing Columns (In DB, NOT in Code)

| Constant | Missing Column | DB Table | Type |
|---|---|---|---|
| `PATIENT_SELECT_FIELDS` | `is_archived` | `patients` | boolean |
| `PATIENT_SELECT_FIELDS` | `archived_at` | `patients` | timestamptz |
| `PATIENT_SELECT_FIELDS` | `archived_by` | `patients` | uuid |
| `PATIENT_SELECT_FIELDS` | `created_at` | `patients` | timestamptz |
| `PATIENT_SELECT_FIELDS` | `updated_at` | `patients` | timestamptz |
| `DOCTOR_SELECT_FIELDS` | `license_number` | `doctors` | varchar(100) |
| `DOCTOR_SELECT_FIELDS` | `bio` | `doctors` | text |
| `DOCTOR_SELECT_FIELDS` | `availability` | `doctors` | json |
| `DOCTOR_SELECT_FIELDS` | `created_at` | `doctors` | timestamptz |
| `DOCTOR_SELECT_FIELDS` | `updated_at` | `doctors` | timestamptz |
| `USER_PUBLIC_FIELDS` | `avatar_url` | `users` | text |
| `USER_PUBLIC_FIELDS` | `auth_user_id` | `users` | uuid |
| `USER_PUBLIC_FIELDS` | `created_at` | `users` | timestamptz |
| No constant | `notifications.related_type` | `notifications` | — actually doesn't exist, edge func references it |

### Corrected Constants

```js
// ─── USERS ──────────────────────────────────────────────────────────
export const USER_PUBLIC_FIELDS = 'id, email, first_name, last_name, phone, initials, role, is_active, avatar_url, created_at, updated_at';
export const USER_CONTACT_FIELDS = 'id, email, first_name, last_name, phone, initials';

// ─── DOCTORS ────────────────────────────────────────────────────────
export const DOCTOR_SELECT_FIELDS = [
  'id', 'user_id', 'department', 'specialization', 'license_number',
  'bio', 'consultation_fee', 'availability', 'created_at', 'updated_at',
  `users(${USER_CONTACT_FIELDS})`,
].join(', ');

// ─── PATIENTS ───────────────────────────────────────────────────────
export const PATIENT_SELECT_FIELDS = [
  'id', 'user_id', 'date_of_birth', 'sex', 'blood_type', 'allergies',
  'medical_history', 'insurance_id', 'emergency_contact', 'emergency_phone',
  'is_archived', 'created_at', 'updated_at',
  `users(${USER_CONTACT_FIELDS})`,
].join(', ');

// ─── APPOINTMENTS ───────────────────────────────────────────────────
export const APPOINTMENT_BASE_FIELDS = [
  'id', 'doctor_id', 'patient_id', 'scheduled_at', 'duration_minutes',
  'status', 'reason', 'notes', 'slot_id', 'booked_by', 'created_at', 'updated_at',
].join(', ');

export const APPOINTMENT_SELECT_FIELDS = [
  APPOINTMENT_BASE_FIELDS,
  `doctors(${DOCTOR_SELECT_FIELDS})`,
  `patients(${PATIENT_SELECT_FIELDS})`,
].join(', ');

// ─── CONSULTATIONS ──────────────────────────────────────────────────
// REMOVED: symptoms (lives in precheck_forms), follow_up_date (doesn't exist)
export const CONSULTATION_SELECT_FIELDS = [
  'id', 'appointment_id', 'doctor_id', 'patient_id',
  'diagnosis', 'treatment_plan', 'notes', 'medications',
  'status', 'session_start', 'session_end',
  'is_archived', 'created_at', 'updated_at',
].join(', ');

export const CONSULTATION_WITH_RELATIONS = [
  CONSULTATION_SELECT_FIELDS,
  `doctors(${DOCTOR_SELECT_FIELDS})`,
  `patients(${PATIENT_SELECT_FIELDS})`,
  `appointments(${APPOINTMENT_BASE_FIELDS})`,
].join(', ');

// ─── MEDICAL REPORTS ────────────────────────────────────────────────
// REMOVED: findings (doesn't exist)
export const REPORT_SELECT_FIELDS = [
  'id', 'patient_id', 'doctor_id', 'report_type', 'title',
  'content', 'file_url', 'is_archived', 'created_at', 'updated_at',
].join(', ');

// ─── CERTIFICATES ───────────────────────────────────────────────────
// REMOVED: patient_id, content, diagnosis, treatment, recommendations,
//          start_date, end_date, status (none exist in DB)
export const CERTIFICATE_SELECT_FIELDS = [
  'id', 'doctor_id', 'certificate_type', 'title', 'issuer',
  'issue_date', 'expiry_date', 'file_url',
  'is_archived', 'created_at', 'updated_at',
].join(', ');

// ─── REFERRALS ──────────────────────────────────────────────────────
// REMOVED: notes, priority, clinical_findings, treatment_plan, ref_number, to_doctor_name
export const REFERRAL_SELECT_FIELDS = [
  'id', 'patient_id', 'from_doctor_id', 'to_doctor_id',
  'reason', 'status', 'referred_at',
  'is_archived', 'created_at', 'updated_at',
].join(', ');

// ─── NOTIFICATIONS ──────────────────────────────────────────────────
export const NOTIFICATION_SELECT_FIELDS = [
  'id', 'user_id', 'title', 'message', 'type',
  'is_read', 'related_id', 'created_at',
].join(', ');

// ─── PRECHECK FORMS ─────────────────────────────────────────────────
export const PRECHECK_SELECT_FIELDS = [
  'id', 'patient_id', 'predoctor_id', 'blood_pressure', 'heart_rate',
  'temperature', 'weight', 'height', 'current_medications', 'allergies',
  'symptoms', 'status', 'submitted_at', 'image_url', 'is_urgent',
  'created_at', 'updated_at',
].join(', ');

// ─── PAYMENTS ───────────────────────────────────────────────────────
export const PAYMENT_SELECT_FIELDS = [
  'id', 'patient_id', 'doctor_id', 'appointment_id', 'amount',
  'currency', 'status', 'payment_method', 'transaction_id',
  'created_at', 'updated_at',
].join(', ');

// ─── BILLABLE SERVICES ─────────────────────────────────────────────
export const BILLABLE_SERVICE_FIELDS = [
  'id', 'code', 'name', 'description', 'price', 'is_active',
  'created_at', 'updated_at',
].join(', ');
```

---

## 2. SERVICE LAYER PATTERN INCONSISTENCIES

### Two Competing Error-Handling Patterns

**Pattern A — `apiCall()` wrapper** (clean):
```js
// Used by: appointments, consultations, referrals, reports, certificates,
//          notifications, clinics, patients, prechecks, slots
async getAll() {
  return apiCall(
    supabase.from('table').select(FIELDS).order('created_at', { ascending: false })
  );
}
```

**Pattern B — Manual try/catch** (verbose, leaky):
```js
// Used by: payments (ONLY service still using this pattern)
async getAll() {
  try {
    const { data, error } = await supabase.from('payments').select('*');
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching payments:', error.message);
    return { data: null, error };
  }
}
```

**`payments.js` is the ONLY service not using `apiCall()`** — 5 methods × ~10 lines each of redundant try/catch.

### Fix: Rewrite `payments.js` to use `apiCall()` + `PAYMENT_SELECT_FIELDS`

```js
import { supabase } from '../lib/supabase';
import { apiCall } from './api';
import { PAYMENT_SELECT_FIELDS, BILLABLE_SERVICE_FIELDS } from '../lib/selects';

export const paymentService = {
  async getAll() {
    return apiCall(
      supabase.from('payments')
        .select(`${PAYMENT_SELECT_FIELDS}, patients(users(first_name, last_name))`)
        .order('created_at', { ascending: false })
    );
  },
  async getBillableServices() {
    return apiCall(
      supabase.from('billable_services')
        .select(BILLABLE_SERVICE_FIELDS)
        .eq('is_active', true)
        .order('name')
    );
  },
  async create(data) {
    return apiCall(
      supabase.from('payments').insert([data]).select(PAYMENT_SELECT_FIELDS).single()
    );
  },
  async update(id, data) {
    return apiCall(
      supabase.from('payments').update(data).eq('id', id).select(PAYMENT_SELECT_FIELDS).single()
    );
  },
  // Medical data is sacred — soft-delete only
  async archive(id, archivedBy) {
    return apiCall(
      supabase.from('payments')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select(PAYMENT_SELECT_FIELDS)
    );
  },
};
```

---

## 3. DUPLICATE SERVICE LOGIC

### 3.1 `notificationService.markAllAsRead` + `markAllRead`

```js
// Lines 493-505 — TWO methods that do the exact same thing
async markAllAsRead(userId) { ... }
async markAllRead(userId) { return this.markAllAsRead(userId); }
```

**Fix**: Delete `markAllRead`, grep for callers and update to `markAllAsRead`.

### 3.2 `clinicService.getAvailableTimeSlots` vs `slots.js`

`clinicService.getAvailableTimeSlots()` does manual slot calculation (L563-578), but `src/services/slots.js` + `get_available_slots` RPC already handle this properly.

**Fix**: Remove `getAvailableTimeSlots()` from `clinicService`, use `slotsService` instead.

### 3.3 `appointmentService.delete` — Hard Delete

```js
// appointments.js L295-302
async delete(id) {
  return apiCall(supabase.from('appointments').delete().eq('id', id));
}
```

Clinical data should never be hard-deleted. This method should be `cancel()` (which already exists at L338).

**Fix**: Remove `delete()`, ensure all callers use `cancel()`.

### 3.4 `notificationService.delete` — Hard Delete

```js
// notifications.js L507-513
async delete(id) {
  return apiCall(supabase.from('notifications').delete().eq('id', id));
}
```

**Fix**: Keep but rename to `dismiss()` or add a guard comment. Notifications are transient, deletion is acceptable.

### 3.5 `paymentService.delete` — Hard Delete

```js
// payments.js L328-341 — HARD DELETE on financial data
async delete(id) { ... }
```

**Fix**: Replace with `archive()` (status → cancelled). Financial records must never be deleted.

---

## 4. API WRAPPER GAPS

### 4.1 `appointmentService.update` — Doesn't Use SELECT Constant

```js
// appointments.js L328-336
async update(id, data) {
  return apiCall(
    supabase.from('appointments').update(data).eq('id', id).select() // ← bare .select()
  );
}
```

Every other method uses `.select(APPOINTMENT_SELECT_FIELDS)` but `update()` uses bare `.select()`. This means updates return raw data without joins.

**Fix**: Change to `.select(APPOINTMENT_SELECT_FIELDS)`.

### 4.2 `appointmentService.checkAvailability` — Manual Error Handling

```js
// appointments.js L304-326 — uses console.error instead of apiCall
const { data, error } = await supabase...
if (error) {
  console.error('Error checking availability:', error);
  return { data: null, error };
}
```

**Fix**: Wrap in `apiCall()`.

### 4.3 `paymentService` — Uses `SELECT *` Instead of Constants

All 5 methods in `paymentService` use `.select('*')` or bare `.select()`. This returns every column including any future additions, which is unpredictable.

**Fix**: Use `PAYMENT_SELECT_FIELDS` constant.

### 4.4 `notificationService` — Uses `SELECT *` Everywhere

All notification queries use `.select('*')` instead of a constant.

**Fix**: Create and use `NOTIFICATION_SELECT_FIELDS`.

---

## 5. FILE-BY-FILE FIX MAP

### `src/lib/selects.js` — THE CRITICAL FILE

| Change | Lines | What |
|---|---|---|
| Remove `symptoms` from CONSULTATION_SELECT_FIELDS | L57 | Ghost column |
| Remove `follow_up_date` from CONSULTATION_SELECT_FIELDS | L63 | Ghost column |
| Remove `findings` from REPORT_SELECT_FIELDS | L83 | Ghost column |
| Remove 8 ghost columns from CERTIFICATE_SELECT_FIELDS | L92-106 | `patient_id`, `content`, `diagnosis`, `treatment`, `recommendations`, `start_date`, `end_date`, `status` |
| Remove 6 ghost columns from REFERRAL_SELECT_FIELDS | L118-125 | `notes`, `priority`, `clinical_findings`, `treatment_plan`, `ref_number`, `to_doctor_name` |
| Add `is_archived, created_at, updated_at` to PATIENT_SELECT_FIELDS | L15-27 | Missing columns |
| Add `license_number, bio, availability, created_at, updated_at` to DOCTOR_SELECT_FIELDS | L6-13 | Missing columns |
| Add `avatar_url, created_at, updated_at` to USER_PUBLIC_FIELDS | L2 | Missing columns |
| Add new constants: `NOTIFICATION_SELECT_FIELDS`, `PRECHECK_SELECT_FIELDS`, `PAYMENT_SELECT_FIELDS`, `BILLABLE_SERVICE_FIELDS` | New | No constants exist for these tables |

### `src/services/payments.js`

| Change | What |
|---|---|
| Replace all 5 try/catch blocks with `apiCall()` | Pattern standardization |
| Import and use `PAYMENT_SELECT_FIELDS` | Constant alignment |
| Remove `console.error()` calls (4 instances) | Production leak |
| Replace `delete()` with `archive()` | Financial data safety |

### `src/services/appointments.js`

| Change | What |
|---|---|
| `update()` L334: `.select()` → `.select(APPOINTMENT_SELECT_FIELDS)` | Missing SELECT constant |
| `checkAvailability()` L321: `console.error()` → remove | Production leak |
| `delete()` L295-302: Remove entirely | Hard delete on clinical data |

### `src/services/notifications.js`

| Change | What |
|---|---|
| Replace `.select('*')` with `NOTIFICATION_SELECT_FIELDS` (6 instances) | Constant alignment |
| Remove `markAllRead()` duplicate | Dead code |
| `notifyRole()` L576: `console.error()` → remove | Production leak |

### `src/services/certificates.js`

| Change | What |
|---|---|
| Will work correctly once CERTIFICATE_SELECT_FIELDS is fixed in selects.js | Cascading fix |

### `src/services/referrals.js`

| Change | What |
|---|---|
| Will work correctly once REFERRAL_SELECT_FIELDS is fixed in selects.js | Cascading fix |

### `src/services/consultations.js`

| Change | What |
|---|---|
| Will work correctly once CONSULTATION_SELECT_FIELDS is fixed in selects.js | Cascading fix |

### `src/services/reports.js`

| Change | What |
|---|---|
| Will work correctly once REPORT_SELECT_FIELDS is fixed in selects.js | Cascading fix |

### `src/services/clinics.js`

| Change | What |
|---|---|
| Remove `getAvailableTimeSlots()` L563-578 | Duplicate of slots.js |

---

## 6. EXECUTION CHECKLIST

### Phase 1: Fix `selects.js` (Single Source of Truth)
```
- [ ] Remove 16 ghost columns from 4 constants
- [ ] Add missing columns to PATIENT, DOCTOR, USER constants
- [ ] Create 4 new constants: NOTIFICATION, PRECHECK, PAYMENT, BILLABLE_SERVICE
- [ ] Verify every constant matches DB column-by-column
```

### Phase 2: Standardize `payments.js`
```
- [ ] Replace 5 try/catch methods with apiCall()
- [ ] Use PAYMENT_SELECT_FIELDS + BILLABLE_SERVICE_FIELDS
- [ ] Remove 4 console.error() calls
- [ ] Replace delete() with archive() (status → cancelled)
```

### Phase 3: Fix `appointments.js`
```
- [ ] update() → use APPOINTMENT_SELECT_FIELDS
- [ ] Remove delete() method
- [ ] Remove console.error in checkAvailability()
```

### Phase 4: Clean `notifications.js`
```
- [ ] Replace 6 instances of .select('*') with NOTIFICATION_SELECT_FIELDS
- [ ] Remove duplicate markAllRead()
- [ ] Remove console.error in notifyRole()
```

### Phase 5: Clean `clinics.js`
```
- [ ] Remove duplicate getAvailableTimeSlots()
```

### Phase 6: Verify (no code changes)
```
- [ ] Run the app, navigate to every dashboard
- [ ] Confirm consultation list loads (was broken by ghost columns)
- [ ] Confirm certificate list loads (was broken by 8 ghost columns)
- [ ] Confirm referral list loads (was broken by 6 ghost columns)
- [ ] Confirm report list loads (was broken by findings ghost column)
- [ ] Confirm payment list loads with new apiCall pattern
```

---

## IMPACT SUMMARY

| Before Tier 0 v2 | After Tier 0 v2 |
|---|---|
| 16 ghost columns causing 400 errors on 4 services | Zero ghost columns — every SELECT matches DB exactly |
| `payments.js` uses manual try/catch (unique pattern) | All 14 services use `apiCall()` consistently |
| 4 tables have no SELECT constant (notifications, prechecks, payments, billable_services) | All 15 tables have typed SELECT constants |
| 3 hard-delete methods on clinical/financial data | All replaced with soft-delete/archive |
| `markAllRead` + `markAllAsRead` duplicate | Single method |
| `getAvailableTimeSlots` duplicated across clinics.js and slots.js | Single source in slots.js |
| 8+ `console.error()` in services | Zero console leaks in service layer |
| `appointments.update()` returns raw data | Returns full joined data via constant |

---

## WHY THIS IS THE FOUNDATION

```
selects.js (Truth)
    ↓
services/*.js (Use Truth)
    ↓
pages/*.jsx (Consume Services)
    ↓
Edge Functions (Mirror Services for Mobile)
```

If `selects.js` is wrong → services break → pages show errors → edge functions diverge.
If `selects.js` is right → everything downstream works → adding features is trivial.

**This file is the DNA of the application.**
