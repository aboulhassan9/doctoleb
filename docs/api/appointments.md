# `appointmentService` — appointment lifecycle and booking

**File:** `packages/core/services/appointments.js`
**Schemas:** `packages/core/schemas/appointments.js`,
`packages/core/schemas/responses.js`

## Methods

### `getAll(options)`

- **Input:** Standard `apiPaged()` options (`{ from, to, sort, etc. }`).
- **Returns:** `{ data: Appointment[], meta: PageMeta, error }`.
- **Selects:** `APPOINTMENT_SELECT_FIELDS` (includes joined doctor + patient
  via `users!doctors_user_id_fkey` and `users!patients_user_id_fkey`).
- **Ordering:** `scheduled_at` ascending.

### `getById(id)`

- **Input:** Appointment UUID.
- **Returns:** `{ data: Appointment | null, error }`.
- **Selects:** Same `APPOINTMENT_SELECT_FIELDS`.

### `bookFromSlot(payload)`

The canonical booking path. Atomic via the `book_slot` Postgres RPC.

- **Input schema:** `appointmentBookingSchema`. Required fields:
  - `slotId` (UUID) — the slot being booked
  - `patientId` (UUID)
  - `bookedBy` (UUID) — the user creating the booking (secretary or patient)
  - `reason` (string, non-empty)
  - `status` (enum) — typically `'scheduled'`; the DB check constraint
    enumerates valid states
- **Optional fields:** `durationMinutes`, `visitTypeId`.
- **Returns on success:** `{ data: NormalizedAppointment, error: null }`.
  On post-book fetch failure the partial form `{ data: { id }, error: null }`
  is returned — the slot was consumed and the appointment was created, so
  we never tell the user "booking failed" when it didn't.
- **F3 response validation:** both forms are validated against
  `appointmentBookFromSlotResponseSchema`. A shape mismatch becomes a clean
  `'Appointment booking response was not in the expected shape.'` error.
- **Side effects (fire-and-forget):** doctor and pre-doctor get notification
  events via `notificationCoreService.notifyRole`. Failures here NEVER block
  the primary booking response — wrapped in `Promise.allSettled` + `.catch`.
- **Failure modes:**
  - `'This patient must complete medical intake before booking another
    appointment.'` — DB-side `INTAKE_REQUIRED` enforcement.
  - Validation errors — schema rejected the payload.
  - Slot already consumed — atomic RPC fails and the message is surfaced.

### `cancel(appointmentId, reason)`

- **Input schema:** `appointmentCancelSchema`. Requires `appointmentId`
  (UUID) and trimmed `reason` (non-empty string).
- **Returns:** `{ data, error }` from the `cancel_appointment` RPC.
- **Side effects:** slot release (slot becomes `is_active = true` again),
  status transition validated by the lifecycle migration, notification
  fan-out.
- **Failure modes:** unauthorized (caller did not book and is not staff
  for that appointment), already cancelled, doesn't exist.

### `checkAvailability(doctorId, date)`

- **Input:** doctor UUID, JS `Date` or ISO date string.
- **Returns:** `{ data: Appointment[], error }` — appointments for that
  doctor within the calendar day, filtered to in-flight statuses
  (`scheduled`, `confirmed`, `pre_check`, `in_consultation`).
- **Notes:** This is for UI conflict-detection, not for actual booking
  decisions — those go through `book_slot` which has its own atomicity.

### `update(id, data)`

- **Input:** appointment UUID + partial update payload.
- **Validation:** if `data.status` is set, `assertTransition()` enforces the
  state machine in `lib/stateMachines.js` before the DB call.
- **Returns:** `{ data: Appointment, error }`. Uses `APPOINTMENT_SELECT_FIELDS`
  in `.select()` so the returned row has joined doctor/patient and the UI's
  optimistic update doesn't break.

## Conventions specific to this service

- **Atomic booking via RPC.** Never write code that inserts into
  `appointments` directly to "save a round-trip" — the slot lock and
  notification-side-effect contract live in the RPC.
- **`bookFromSlot` returns partial success on fetch failure** by design.
  The booking is the contract, not the fetched row.
- **Status enum is DB-enforced.** Adding a new appointment status requires
  a migration, an update to the schema, and an update to
  `stateMachines.js`.

## Related

- Slot booking: `slotService.bookSlot` (the underlying RPC wrapper).
- Cancellation hardening: ADR's are in migration history; see
  `20260509020000_harden_cancel_appointment_lifecycle.sql`.
