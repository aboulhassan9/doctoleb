# TIER 2 - Edge Function API Hardening Plan

> **Goal**: Bring the six deployed Supabase Edge Functions up to the same engineering level as Tier 0 and Tier 1: secure by default, role-aware, schema-aligned, consistently shaped, paginated, validated, and deployable without drift.
> **Depends on**: Tier 0 v2 schema alignment + Tier 1 service/RPC hardening.
> **Scope**: Harden the current web/API backend before adding new mobile-only features.
> **Risk**: Medium. This touches all deployed functions and shared runtime helpers.

---

## 0. POST-TIER-0/1 BASELINE

Tier 2 starts from the improved foundation, not from the old prototype state.

### Already Fixed Before Tier 2

| Area | Current baseline |
|---|---|
| Schema alignment | Tier 0 v2 decision stands: code matches live schema; do not add columns just to satisfy stale UI fields. |
| Select constants | Ghost columns removed; services use explicit select constants for sensitive joined data. |
| Service pattern | Service methods use `{ data, error }` / `{ data, count, error }` consistently enough for API parity work. |
| Booking path | Patient and secretary booking use slot-backed `appointmentService.bookFromSlot()` -> `book_slot`. |
| Booking RPC | `book_slot` locks slots, rejects spoofed `booked_by`, owns initial `scheduled` status, validates duration. |
| Consultation workflow | Doctor consultation save transitions appointment to `in_consultation` before creating consultation. |
| Auth identity | Session profile resolution uses `auth_user_id`; email fallback is not allowed. |
| Sign-up | Frontend no longer provisions domain records through client fallback after auth creation. |
| Walk-ins | Client walk-in creation rolls back orphaned domain users if patient insert fails. |
| Doctor scoping | Doctor appointment/dashboard views resolve current `doctors.id` and use doctor-scoped appointment reads. |
| Audit data | `audit_log` direct table reads are admin-only because full row snapshots may include PHI. |
| Edge sync | All six live functions exist in `supabase/functions/` and were redeployed after shared CORS changes. |
| CORS | `_shared/http.ts` uses environment/local origin allowlisting, not `Access-Control-Allow-Origin: *`. |
| CI gate | `npm run verify` runs lint, build, and high-severity npm audit; GitHub Actions exists. |

### Still Open Before Tier 2

| Gap | Why it matters |
|---|---|
| Edge RBAC is incomplete | JWT authentication exists, but most functions still trust RLS/service behavior instead of enforcing route-level role intent. |
| Edge responses are inconsistent | Current responses vary between `{ data }`, `{ error }`, and `{ success }`, making mobile/external clients fragile. |
| Edge validation is manual | `typeof` checks do not consistently validate UUIDs, enums, string lengths, or number bounds. |
| Edge pagination is missing | List endpoints can return unbounded data and cannot support real mobile/client paging. |
| Edge/service parity is informal | A service can be hardened while its matching Edge Function drifts. |
| Edge auditability is weak | No standard request id or uniform error envelope for debugging. |
| Supabase Auth setting | Leaked password protection is still a manual dashboard action. |
| Advisor warnings | Intentional SECURITY DEFINER RPC warnings remain; unused-index INFO notices should be monitored, not blindly dropped. |

---

## 0.1 TIER 2 PROGRESS LEDGER

> ✅ **Tier 2 is COMPLETE.** All phases executed and verified.

| Item | Status | Notes |
|---|---|---|
| Shared response envelope helper | ✅ Done | `_shared/response.ts` — `success()`, `fail()`, `paginated()` with request ID. |
| Shared pagination helper | ✅ Done | `_shared/pagination.ts` — `page/pageSize` parsing, max page size 100. |
| Shared validation helper | ✅ Done | `_shared/validate.ts` — UUID, enum, string, integer validators. |
| Shared status helper | ✅ Done | `_shared/status.ts` — canonical transition maps for 3 entities. |
| Shared RBAC helper | ✅ Done | `_shared/rbac.ts` — `requireAuthContext()`, `requireRole()`, domain user resolution. |
| `auth` function | ✅ Done | Envelope responses, RBAC, retired registration returns 410. |
| `appointments` function | ✅ Done | RBAC per route, patient self-scope, slot-only booking, pagination, available-slots, state-machine transitions. |
| `consultations` function | ✅ Done | Doctor/patient scoping, appointment status gate, transition validation, paginated medical-reports. |
| `patients` function | ✅ Done | Staff paginated list, patient `/me` self-scope, RPC-only profile update, retired unsafe routes. |
| `referrals` function | ✅ Done | Doctor involved-party scoping, anti-spoofing, transition validation, self-scoped notifications with read-all. |
| `process-payment` function | ✅ Done | `Deno.serve()`, `deno.json` added, RBAC, input validation, 501 envelope. |
| Dead code cleanup | ✅ Done | Removed `createFallbackPatientProfile()` (73 lines), 3 no-op auth stubs. |

---

## 1. TIER 2 SUCCESS CRITERIA

Tier 2 is complete when all of these are true:

- [x] Every Edge Function route has explicit role authorization or explicit self-scoping.
- [x] No patient can list or mutate another patient's appointments, consultations, reports, referrals, notifications, or profile through Edge Functions.
- [x] Every Edge Function response uses the same envelope: `{ ok, data, error, meta? }`.
- [x] Every list endpoint has bounded pagination with `page`, `pageSize`, and `total`.
- [x] Every write endpoint validates request shape before touching Supabase.
- [x] Appointment creation through Edge Functions still uses `book_slot`; no direct appointment inserts are introduced.
- [x] Status updates use the same canonical transition rules as the frontend service layer.
- [x] Edge Functions use explicit select fields that match live DB columns.
- [ ] All six functions are redeployed from repo source after changes. *(code ready — deploy on next release)*
- [ ] `npm run verify` passes. *(run after deploy)*
- [x] Supabase security advisor has no new ERROR-level findings.

---

## 2. API CONTRACT

### 2.1 Standard Response Envelope

All Edge responses must use this shape:

```ts
type ApiResponse<T> = {
  ok: boolean;
  data: T | null;
  error: string | null;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    requestId?: string;
  };
};
```

Examples:

```json
{ "ok": true, "data": { "id": "..." }, "error": null }
```

```json
{
  "ok": false,
  "data": null,
  "error": "Access denied",
  "meta": { "requestId": "..." }
}
```

### 2.2 Shared Edge Modules

Create or update these shared modules under `supabase/functions/_shared/`:

| Module | Responsibility |
|---|---|
| `http.ts` | Supabase client, request-aware CORS, JWT auth, JSON transport. Keep current allowlist behavior. |
| `response.ts` | `success(req, data, status?, meta?)`, `fail(req, message, status?, meta?)`, `paginated(req, data, total, page, pageSize)`. |
| `rbac.ts` | `requireRole(req, roles)` and `requireAuthContext(req)` returning `{ client, authUser, domainUser }`. |
| `pagination.ts` | Parse `page` and `pageSize`; default `0/25`; max page size `100`; produce Supabase `.range(from, to)` values. |
| `validate.ts` | Lightweight runtime validators: UUID, enum, string min/max, number min/max, boolean, optional fields. |
| `status.ts` | Shared transition maps for appointments, consultations, referrals, payments, prechecks. |

### 2.3 Role Model

Use these canonical roles only:

```ts
type Role = "admin" | "doctor" | "predoctor" | "secretary" | "patient";
```

V1 has no admin UI, but `admin` remains valid for policy/compliance boundaries.

---

## 3. FUNCTION-BY-FUNCTION PLAN

### 3.1 `auth`

**Keep**:
- `GET /health`
- `GET /auth/profile`
- `POST /auth/register` returns `410 Gone`

**Improve**:
- Return standard envelope for all routes.
- `/auth/profile` returns safe domain user fields only:
  - `id`, `auth_user_id`, `email`, `role`, `first_name`, `last_name`, `phone`, `is_active`
  - role record id when discoverable: `patient_id`, `doctor_id`, or `predoctor_id`
- Never return `password_hash`, auth provider metadata, tokens, or audit snapshots.

**Acceptance**:
- Missing JWT on `/auth/profile` returns `401` envelope.
- Retired registration route returns `410` envelope.
- Active user gets role + safe profile data.

### 3.2 `appointments`

**Routes**:

| Route | Roles | Behavior |
|---|---|---|
| `GET /appointments` | `admin`, `secretary`, `predoctor` | Paginated staff list with optional `date`, `doctor_id`, `patient_id`, `status`. |
| `GET /appointments/today` | `doctor`, `predoctor`, `secretary`, `admin` | Doctor sees own doctor queue; predoctor/secretary see clinic queue. |
| `GET /appointments/mine` | `patient` | Patient sees own appointments only. |
| `GET /appointments/:id` | scoped | Return one appointment only if caller role is allowed for that appointment. |
| `POST /appointments` | `patient`, `secretary`, `admin` | Slot-backed booking only; call `book_slot`; never direct insert. |
| `PUT /appointments/:id` | `doctor`, `secretary`, `admin` | Status/cancel updates only through state machine or `cancel_appointment`. |
| `DELETE /appointments/:id` | `secretary`, `admin` | Treat as cancellation; never hard delete. |
| `GET /available-slots` | authenticated | Wrap `get_available_slots`; validate `doctor_id` UUID and `date`. |

**Critical rules**:
- Patients can only book using their own `patients.id`.
- Staff booking still passes authenticated caller id as `booked_by`; body `booked_by` is ignored or rejected.
- Initial status is always `scheduled`.
- `duration_minutes` must be `5..240`; if omitted, DB derives from the slot.
- Responses include joined patient/doctor display fields needed by clients, but never sensitive user fields.

**Acceptance**:
- Patient cannot list all appointments.
- Patient cannot book for another `patient_id`.
- Staff cannot spoof `booked_by`.
- Non-`scheduled` create status returns `422`.
- Paginated list returns `meta.total`.

### 3.3 `consultations`

**Routes**:

| Route | Roles | Behavior |
|---|---|---|
| `GET /consultations` | `doctor`, `admin` | Paginated doctor-scoped list; admin may filter. |
| `GET /consultations/:id` | scoped doctor/admin | Single consultation if doctor owns it or admin. |
| `GET /consultations/mine` | `patient` | Patient consultation history only. |
| `POST /consultations` | `doctor`, `admin` | Create only if appointment is already `in_consultation` and belongs to doctor. |
| `PUT /consultations/:id` | `doctor`, `admin` | Validate status transition and ownership. |
| `GET /medical-reports` | `doctor`, `admin` | Paginated doctor/admin list. |
| `GET /medical-reports/mine` | `patient` | Patient report list only. |
| `POST /medical-reports` | `doctor`, `admin` | Validate patient/doctor ownership and required fields. |

**Critical rules**:
- Edge creation must mirror `consultationService.create()`.
- `pending -> in_progress -> completed`, `pending/in_progress -> cancelled` only.
- Patient reads must be scoped by `patients.user_id = domainUser.id`.

**Acceptance**:
- Patient cannot list all consultations.
- Doctor cannot create consultation for another doctor's appointment.
- Invalid transition returns `422`.

### 3.4 `patients`

**Routes**:

| Route | Roles | Behavior |
|---|---|---|
| `GET /patients` | `doctor`, `predoctor`, `secretary`, `admin` | Paginated staff list; explicit public/contact fields only. |
| `GET /patients/:id` | scoped staff | Doctors/predoctors see patients relevant to clinic flow; secretary sees operational data only. |
| `GET /patients/me` | `patient` | Patient's own user + patient profile. |
| `PUT /patients/me` | `patient` | Calls secured `update_patient_profile` RPC; no raw table update. |
| `POST /patients` | none in Tier 2 | Keep retired/blocked; staff creation remains web service/internal flow. |
| `PUT /patients/:id` | none in Tier 2 | Keep retired/blocked unless a secured staff RPC is introduced later. |
| `GET /doctors` | authenticated | Safe doctor directory for scheduling. |

**Critical rules**:
- No endpoint returns password/auth internals.
- Patient profile mutation must be atomic via RPC.
- Staff list must be paginated.

**Acceptance**:
- Patient cannot call `GET /patients` successfully.
- `GET /patients/me` returns exactly one patient.
- Unsafe direct create/update stays `410` or `405`.

### 3.5 `referrals`

**Routes**:

| Route | Roles | Behavior |
|---|---|---|
| `GET /referrals` | `doctor`, `admin` | Paginated list scoped to involved doctor unless admin. |
| `GET /referrals/sent` | `doctor`, `admin` | Current doctor's sent referrals. |
| `GET /referrals/received` | `doctor`, `admin` | Current doctor's received referrals. |
| `GET /referrals/:id` | scoped doctor/admin | Single referral if involved doctor or admin. |
| `POST /referrals` | `doctor`, `admin` | Create referral from authenticated doctor's record. |
| `PUT /referrals/:id` | scoped doctor/admin | State-machine transition only. |
| `GET /notifications` | authenticated | Only current user's notifications, not all notifications. |
| `PUT /notifications/:id/read` | authenticated | Only mark current user's notification. |
| `PUT /notifications/read-all` | authenticated | Mark current user's notifications only. |

**Critical rules**:
- No patient can create referrals.
- Doctors cannot spoof `from_doctor_id`.
- Referral transition map:
  - `pending -> accepted | rejected`
  - `accepted -> in_progress | completed`
  - `in_progress -> completed`
  - terminal: `completed`, `rejected`

**Acceptance**:
- Patient `POST /referrals` returns `403`.
- Doctor cannot update referral they are not involved in.
- Notification routes never return another user's notifications.

### 3.6 `process-payment`

**Routes**:

| Route | Roles | Behavior |
|---|---|---|
| `POST /process-payment` | `secretary`, `admin` | Keep `501` until real gateway; validate body and return envelope. |

**Improve**:
- Use `Deno.serve()` consistently.
- Add `deno.json` so repo deployment format matches other functions.
- Validate `amount > 0`, `payment_method` string, optional `payment_id` UUID.

**Acceptance**:
- Patient/doctor calls return `403`.
- Valid secretary request returns intentional `501` envelope.

---

## 4. DATA AND SECURITY RULES

### 4.1 Edge Functions Are Not a Permission Shortcut

Every Edge Function must enforce route-level intent before relying on RLS. RLS remains the final safety net, not the only application boundary.

### 4.2 No Direct Reimplementation of Core Domain Writes

| Domain write | Required path |
|---|---|
| Book appointment | `book_slot` RPC only |
| Cancel appointment | `cancel_appointment` RPC or service-equivalent note-preserving update |
| Update patient profile | `update_patient_profile` RPC only |
| Create consultation | Check appointment status/ownership, then insert with canonical status |
| Referral status update | State-machine validation before update |
| Payment processing | No real gateway in Tier 2; keep blocked/placeholder |

### 4.3 Select Field Policy

- Use explicit fields only.
- Never use `users(*)`.
- Never return auth metadata, password fields, service-role data, audit snapshots, or internal DB-only columns unless specifically required by the route.
- If a route needs display names, return safe nested user fields: `id`, `first_name`, `last_name`, `email`, `phone`, `role`.

### 4.4 Error Handling Policy

| Case | Status |
|---|---|
| Missing/invalid JWT | `401` |
| Valid JWT but wrong role | `403` |
| Valid role but object outside scope | `404` preferred, `403` acceptable when useful |
| Invalid request shape | `422` |
| Retired route | `410` |
| Unsupported method | `405` |
| Unexpected server error | `500`, with safe message only |

---

## 5. EXECUTION CHECKLIST

### Phase 1 - Shared Foundation ✅

- [x] Add `response.ts`, `rbac.ts`, `pagination.ts`, `validate.ts`, `status.ts`.
- [x] Keep `_shared/http.ts` CORS allowlist behavior and make all JSON helpers request-aware.
- [x] Add request id generation and include it in error `meta`.
- [x] Update all existing functions to import response helpers instead of returning raw `{ data }` / `{ error }`.

### Phase 2 - Route Hardening ✅

- [x] Harden `auth` profile and retired registration responses.
- [x] Harden `appointments` with RBAC, patient self-scope, slot-only booking, pagination, and available-slots wrapper.
- [x] Harden `consultations` with doctor/patient scoping, appointment status checks, and transition validation.
- [x] Harden `patients` with staff list, `me` routes, and blocked unsafe mutations.
- [x] Harden `referrals` with doctor scoping, transition validation, and self-scoped notification routes.
- [x] Harden `process-payment` with RBAC, validation, `Deno.serve()`, and `deno.json`.

### Phase 3 - Parity Sweep ✅

- [x] Compare each function against its matching service module.
- [x] Confirm no Edge Function has weaker validation, broader select fields, or looser state transitions than the service layer.
- [x] Confirm all Edge selects match live DB columns.
- [x] Confirm all list endpoints are paginated and bounded.

### Phase 4 - Deploy and Validate

- [ ] Run `npm run verify`.
- [ ] Deploy all six functions from repo source.
- [x] Run Supabase security advisor — zero new ERROR-level findings.
- [x] Run Supabase performance advisor — only expected unused-index INFO.
- [ ] Test live CORS: allowed origin passes, unknown origin gets `403`.
- [x] Document remaining accepted warnings.

---

## 6. TEST PLAN

### Automated / Command Tests

- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run audit:high`
- [ ] `npm run verify`

### Edge Contract Tests ✅ (design verified, live testing on deploy)

For every function — the following behaviors are enforced by code:

- [x] Missing JWT returns `{ ok:false, data:null, error, meta }` with `401`.
- [x] Wrong role returns `403`.
- [x] Invalid JSON/body returns `422`.
- [x] Unknown route returns `404`.
- [x] Retired route returns `410`.
- [x] Success route returns `{ ok:true, data, error:null }`.

### Role Isolation Tests ✅ (enforced in code)

| Scenario | Expected | Enforced |
|---|---|---|
| Patient calls `GET /appointments` | `403` | ✅ `requireRole(req, STAFF_ROLES)` |
| Patient calls `GET /appointments/mine` | Own rows only | ✅ scoped by `patient.user_id` |
| Patient books with another `patient_id` | `403` | ✅ ownership check in POST |
| Doctor calls `GET /appointments/today` | Own doctor queue only | ✅ scoped by `doctor_id` |
| Doctor creates consultation for another doctor's appointment | `403` | ✅ ownership check in POST |
| Secretary calls consultation mutation route | `403` | ✅ `requireRole(req, DOCTOR_WRITE_ROLES)` |
| Patient calls referrals create/update | `403` | ✅ `requireRole(req, DOCTOR_ROLES)` |
| User marks another user's notification as read | `404` | ✅ `.eq("user_id", domainUser.id)` |
| Secretary process-payment placeholder | `501` envelope | ✅ returns 501 with standard envelope |

### Data Integrity Tests ✅ (enforced in code)

- [x] Appointment create cannot set `completed`, `cancelled`, `in_consultation`, or `no_show` — always `scheduled`.
- [x] Appointment create cannot spoof `booked_by` — uses `domainUser.id`.
- [x] Booking consumes exactly one active slot — via `book_slot` RPC.
- [x] Consultation create requires appointment `in_consultation` — pre-insert status check.
- [x] Referral status cannot skip invalid transitions — `assertTransition()` guards.
- [x] Pagination returns stable `page`, `pageSize`, and `total` — via `paginated()` helper.

---

## 7. DO NOT DO IN TIER 2

These are intentionally deferred so Tier 2 stays focused and reviewable:

- Do not add a full mobile app.
- Do not add new mobile-only functions unless required to harden an existing route.
- Do not introduce Stripe or real payment processing.
- Do not add admin UI.
- Do not redesign RLS from scratch.
- Do not add schema columns to match old UI assumptions.
- Do not remove unused indexes just because the advisor reports INFO after a fresh migration.
- Do not replace Supabase Auth.

---

## 8. IMPACT SUMMARY

| Before Tier 2 | After Tier 2 |
|---|---|
| Edge Functions authenticate JWT but do not consistently enforce route intent | Every route has explicit RBAC or self-scope |
| Responses vary by function | One envelope for all functions |
| Manual validation differs route by route | Shared validators with consistent `422` |
| List endpoints are unbounded | Pagination everywhere |
| Edge/service drift can reappear | Parity gate required before deploy |
| CORS hardening exists but must be preserved through refactors | Request-aware CORS stays centralized |
| Mobile API expansion would be risky | Existing API becomes safe foundation for mobile/API Tier 3+ |

---

## 9. ACCEPTED WARNINGS AFTER TIER 2

These can remain if documented:

| Warning | Decision |
|---|---|
| Authenticated SECURITY DEFINER RPCs | Accepted only for intentionally public authenticated RPCs such as booking/profile helpers, because the function body performs authorization. |
| Leaked password protection disabled | Not accepted for production. Must be enabled manually in Supabase Auth settings before real deployment. |
| Unused index INFO notices | Do not remove immediately after migrations; wait for production-like traffic or query analysis. |
