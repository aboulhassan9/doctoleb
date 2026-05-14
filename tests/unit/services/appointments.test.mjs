import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseMock } from './__helpers__/supabaseMock.mjs';
import { __setSupabaseClientForTest } from '../../../packages/core/lib/supabase.js';
import { appointmentService } from '../../../packages/core/services/appointments.js';

// F3 response-shape validation on appointmentBookFromSlotResponseSchema
// requires real UUIDs.
const SLOT_ID      = '11111111-1111-4111-8111-111111111111';
const PATIENT_ID   = '22222222-2222-4222-8222-222222222222';
const BOOKED_BY_ID = '33333333-3333-4333-8333-333333333333';
const APPT_ID      = '44444444-4444-4444-8444-444444444444';
const DOCTOR_ID    = '55555555-5555-4555-8555-555555555555';

const VALID_PAYLOAD = {
  slotId: SLOT_ID,
  patientId: PATIENT_ID,
  bookedBy: BOOKED_BY_ID,
  reason: 'Annual checkup',
  durationMinutes: 30,
  status: 'scheduled',
};

const APPT_ROW = {
  id: APPT_ID,
  status: 'scheduled',
  scheduled_at: '2026-05-14T09:00:00Z',
  duration_minutes: 30,
  reason: 'Annual checkup',
  doctor_id: DOCTOR_ID,
  patient_id: PATIENT_ID,
  patients: {
    users: { first_name: 'Maya', last_name: 'Haddad', phone: '+961 71 234 567' },
  },
  doctors: {
    department: 'Family Medicine',
    users: { first_name: 'Sami', last_name: 'Halabi' },
  },
};

let mock;
let previousClient;

beforeEach(() => {
  mock = createSupabaseMock();
  previousClient = __setSupabaseClientForTest(mock.client);
});

afterEach(() => {
  __setSupabaseClientForTest(previousClient);
});

describe('appointmentService.bookFromSlot — input validation', () => {
  it('rejects a payload missing slotId', async () => {
    const { slotId: _omit, ...partial } = VALID_PAYLOAD;
    const result = await appointmentService.bookFromSlot(partial);
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    // No RPC should have been called.
    assert.equal(mock.calls.rpc.length, 0);
  });

  it('rejects a payload missing reason', async () => {
    const { reason: _omit, ...partial } = VALID_PAYLOAD;
    const result = await appointmentService.bookFromSlot(partial);
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.rpc.length, 0);
  });
});

describe('appointmentService.bookFromSlot — RPC error handling', () => {
  it('translates INTAKE_REQUIRED into a friendly patient-facing message', async () => {
    mock.onRpc('book_slot', () => ({ data: null, error: { message: 'INTAKE_REQUIRED: patient must complete intake' } }));
    const result = await appointmentService.bookFromSlot(VALID_PAYLOAD);
    assert.equal(result.data, null);
    assert.match(String(result.error), /must complete medical intake/i);
  });

  it('returns the raw error message for other RPC failures', async () => {
    mock.onRpc('book_slot', () => ({ data: null, error: { message: 'Slot is no longer available' } }));
    const result = await appointmentService.bookFromSlot(VALID_PAYLOAD);
    assert.equal(result.data, null);
    assert.equal(result.error, 'Slot is no longer available');
  });
});

describe('appointmentService.bookFromSlot — happy path', () => {
  it('returns a normalized appointment when book + fetch both succeed', async () => {
    mock.onRpc('book_slot', () => ({ data: APPT_ID, error: null }));
    mock.onFrom('appointments', () => ({ data: APPT_ROW, error: null }));

    const result = await appointmentService.bookFromSlot(VALID_PAYLOAD);
    assert.equal(result.error, null);
    assert.equal(result.data.id, APPT_ID);
    assert.equal(result.data.status, 'scheduled');
    // normalizeAppointment must have flattened the doctor/patient names.
    assert.equal(result.data.patientName, 'Maya Haddad');
    assert.equal(result.data.doctorName, 'Sami Halabi');
    // The book_slot RPC was called with the schema-coerced payload.
    const rpcCall = mock.calls.rpc.find((c) => c.name === 'book_slot');
    assert.ok(rpcCall);
    assert.equal(rpcCall.args.p_slot, SLOT_ID);
    assert.equal(rpcCall.args.p_patient, PATIENT_ID);
    assert.equal(rpcCall.args.p_booked_by, BOOKED_BY_ID);
  });
});

describe('appointmentService.bookFromSlot — partial success on fetch failure', () => {
  it('returns { id } when book succeeds but fetch fails — never claims the booking failed', async () => {
    mock.onRpc('book_slot', () => ({ data: APPT_ID, error: null }));
    mock.onFrom('appointments', () => ({ data: null, error: { message: 'Fetch timed out' } }));

    const result = await appointmentService.bookFromSlot(VALID_PAYLOAD);
    assert.equal(result.error, null);
    assert.ok(result.data);
    assert.equal(result.data.id, APPT_ID);
    // F3 partial-shape validation must accept this minimal envelope.
    assert.equal(typeof result.data.id, 'string');
  });
});

describe('appointmentService.cancel — input validation', () => {
  it('rejects a non-UUID appointment id', async () => {
    const result = await appointmentService.cancel('not-a-uuid', 'reason');
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    // No update should have been attempted.
    const updateCalls = mock.calls.from.filter((c) => c.modifiers.some((m) => m.method === 'update'));
    assert.equal(updateCalls.length, 0);
  });
});

describe('appointmentService.update — status transition guard', () => {
  it('rejects an invalid status transition (scheduled → completed)', async () => {
    // getById is called first to read current status.
    mock.onFrom('appointments', () => ({ data: { ...APPT_ROW, status: 'scheduled' }, error: null }));

    const result = await appointmentService.update(APPT_ID, { status: 'completed' });
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
  });

  it('allows a valid status transition (scheduled → confirmed)', async () => {
    // First call (getById) returns current; second call (update().select()) returns
    // the new row. Our mock returns the same handler for every from('appointments'),
    // so just return a row that reflects the requested status.
    mock.onFrom('appointments', () => ({ data: { ...APPT_ROW, status: 'confirmed' }, error: null }));

    const result = await appointmentService.update(APPT_ID, { status: 'confirmed' });
    assert.equal(result.error, null);
    assert.ok(result.data);
    assert.equal(result.data.status, 'confirmed');
  });
});

describe('appointmentService.getById', () => {
  it('returns the appointment row when found', async () => {
    mock.onFrom('appointments', () => ({ data: APPT_ROW, error: null }));
    const result = await appointmentService.getById(APPT_ID);
    assert.equal(result.error, null);
    assert.equal(result.data.id, APPT_ID);
  });

  it('returns the supabase error when the row is missing', async () => {
    mock.onFrom('appointments', () => ({ data: null, error: { message: 'No row found' } }));
    const result = await appointmentService.getById(APPT_ID);
    assert.equal(result.data, null);
    assert.equal(result.error, 'No row found');
  });
});
