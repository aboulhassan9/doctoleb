# `patientService` — patient CRUD and walk-in registration

**File:** `packages/core/services/patients.js`
**Schemas:** `packages/core/schemas/patients.js`,
`packages/core/schemas/responses.js`

## Methods

### `getAll(options)`

- **Input:** Standard `apiPaged()` options.
- **Returns:** `{ data: Patient[], meta, error }`.
- **Selects:** `PATIENT_SELECT_FIELDS` joined to `users` via
  `users!patients_user_id_fkey`.

### `getById(id)`

- **Input:** patient UUID.
- **Returns:** `{ data: Patient | null, error }`.

### `search(query, options)`

- **Input:** free-text query + pagination options.
- **Sanitization:** the query is stripped of `%,.()` characters before being
  used in an `ilike` filter to avoid breaking PostgREST.
- **Returns:** matching patients, paged.

### `createWalkIn({ full_name, phone, email, date_of_birth })`

The walk-in path used by `QuickAddPatientModal` and `SecretaryBookingPage`
for first-visit patient registration.

- **Input schema:** `walkInPatientSchema`. Required: `full_name`. Optional:
  `phone`, `email`, `date_of_birth`.
- **Steps:**
  1. Validate input.
  2. Insert into `users` (role `'patient'`, `is_active: true`, generated
     `walkin_<ts>_<uuid>@clinic.local` email if none provided).
  3. Insert into `patients` linked by `user_id`.
  4. Return `{ ...newPatient, users: newUser, full_name }`.
- **F3 response validation:** the combined object is validated against
  `walkInPatientCreateResponseSchema`. A missing `users.id` or missing
  patient `id` becomes a clean error instead of a UI crash downstream.
- **Compensation:** if step 3 fails after step 2 succeeded, the orphan user
  is deactivated (`is_active = false`) — not deleted. Compensation failure
  is logged via `logWarn('walkin_compensation_failed', ...)` and surfaces
  to operators in audit logs.
- **Returns:** `{ data: Patient & { users, full_name } | null, error: { message } | null }`.
  Error is wrapped as an object (not a bare string) for compatibility with
  the modal that reads `error.message`.

### `update(id, data)`

- **Input:** patient UUID + partial update.
- **Validation:** runs `patientProfileUpdateSchema` if the payload looks
  like a profile update (contains `first_name`/`phone`/etc.).
- **Returns:** updated patient row with `PATIENT_SELECT_FIELDS` joined.

### `archive(id)` — soft delete

- **Action:** sets `is_archived = true`, `archived_at = now()`, records
  `archived_by`.
- **Never DELETE.** Clinical / billing data retention requires this.

## Conventions specific to this service

- **Walk-in users get synthetic emails.** Never rely on `.email` from a
  walk-in being real — it's `walkin_<ts>_<uuid>@clinic.local` if the
  registering staff didn't provide one.
- **Two-step creation has compensation.** If you ever modify the walk-in
  flow, preserve the orphan-user-disable step. Verified by the
  `walk-in patient creation compensates failures` contract test.
- **`search()` sanitization is not optional.** Removing `%,.()` prevents
  PostgREST from interpreting them as filter operators.

## Related

- Schema: `walkInPatientSchema` in `packages/core/schemas/patients.js`.
- Response schema: `walkInPatientCreateResponseSchema` in
  `packages/core/schemas/responses.js`.
- UI: `apps/clinic-ops/src/components/appointments/QuickAddPatientModal.jsx`.
