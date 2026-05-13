# `slotService` — appointment slots and atomic booking

**File:** `packages/core/services/slots.js`
**Schemas:** `packages/core/schemas/scheduling.js`

Slots are the availability layer. Appointments book against slots via an
atomic RPC; the slot becomes `is_active = false` only when the booking
succeeds.

## Methods

### `getAvailableSlots(doctorId, date)`

- **RPC:** `get_available_slots(p_doctor uuid, p_date date)`.
- **Returns:** `{ data: Slot[], error }` with joined clinic name and
  address.
- **Filter:** only `is_active = true` slots that match the doctor and
  date.

### `createManualSlot(payload)`

Creates a single slot for a specific date.

- **Input schema:** `manualSlotSchema`. Requires `doctor_id`, `clinic_id`,
  `date` (`YYYY-MM-DD`), `start_time`, `end_time`, `created_by`.
- **Refinement:** `end_time > start_time`. Schema-side check, no need to
  re-do it in the UI.
- **Returns:** the created slot row.

### `createRecurringSlots(payload)`

Creates a series of slots across selected weekdays.

- **Input schema:** `recurringSlotsSchema`. Requires `doctor_id`,
  `clinic_id`, `start_time`, `end_time`, `weekdays[]` (1-7 ints, 1+
  required), `occurrences` (1-730), `created_by`.
- **Refinement:** `end_time > start_time`.
- **Server-side:** uses a `recurrence_group_id` so the whole batch can be
  edited / deactivated together later.
- **Returns:** the created slots (server-emitted, not just an id).

### `bookSlot({ slotId, patientId, bookedBy, status, reason, durationMinutes, visitTypeId })`

The atomic booking RPC wrapper. Use it via `appointmentService.bookFromSlot`
in almost all cases — direct usage is reserved for replay tooling.

- **RPC:** `book_slot` (`SECURITY DEFINER`, transactional).
- **Steps inside the RPC:**
  1. Lock the slot row.
  2. Reject if `is_active = false`.
  3. Insert into `appointments`.
  4. Deactivate the slot.
  5. Return the new appointment UUID.
- **Returns from the wrapper:** `{ data: appointmentUuid, error }`.
- **Failure modes:** `'Slot is no longer available'` for double-booking
  races, `INTAKE_REQUIRED` if the patient must finish intake first, plus
  any DB-side validation rejection.

### `editSlot(slotId, fields)`

Updates a single slot (typically date/time changes by the secretary).

- **Validation:** the calling code currently does `editForm.date &&
  start_time && end_time` — could be migrated to `manualSlotSchema.partial()`
  in a future F2 follow-up.

### `deactivateSlot(slotId)`

Soft-deactivation. Sets `is_active = false`. Slots that were already booked
keep their appointment rows intact — only future bookings are blocked.

## Conventions specific to this service

- **Never insert into `appointments` directly to "save a hop."** The
  atomicity contract lives in `book_slot`. A previous duplicate
  `clinicService.getAvailableTimeSlots` doing manual math was removed in
  TIER0_V2 and must not return.
- **`get_available_slots` is the source of truth for what's bookable.**
  UIs should not filter against another query.
- **Weekday integers are 1-7 (Mon-Sun) per the DB convention.** The
  Tailwind day labels in the slot creation UI happen to start at Sunday;
  the schema coerces.
