import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseMock } from './__helpers__/supabaseMock.mjs';
import { __setSupabaseClientForTest } from '../../../packages/core/lib/supabase.js';
import { patientService } from '../../../packages/core/services/patients.js';

// F3 walkInPatientCreateResponseSchema requires real UUIDs for `id` and
// `users.id`.
const PATIENT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID    = '22222222-2222-4222-8222-222222222222';
const DOCTOR_ID  = '33333333-3333-4333-8333-333333333333';

const VALID_WALKIN = {
  full_name: 'Maya Haddad',
  phone: '+961 71 234 567',
  email: 'maya@example.com',
  date_of_birth: '1992-04-15',
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

describe('patientService.createWalkIn — input validation', () => {
  it('rejects an empty full_name with the standard error envelope', async () => {
    const result = await patientService.createWalkIn({ ...VALID_WALKIN, full_name: '' });
    assert.equal(result.data, null);
    assert.ok(result.error);
    assert.notEqual(result.error.message, undefined);
    // No DB writes should have happened.
    assert.equal(mock.calls.from.length, 0);
  });

  it('rejects an invalid email format', async () => {
    const result = await patientService.createWalkIn({ ...VALID_WALKIN, email: 'not-an-email' });
    assert.equal(result.data, null);
    assert.ok(result.error);
    assert.equal(mock.calls.from.length, 0);
  });
});

describe('patientService.createWalkIn — happy path', () => {
  it('returns the combined user + patient row when both inserts succeed', async () => {
    const newUser = {
      id: USER_ID,
      email: 'maya@example.com',
      first_name: 'Maya',
      last_name: 'Haddad',
      role: 'patient',
      phone: '+961 71 234 567',
      is_active: true,
    };
    const newPatient = {
      id: PATIENT_ID,
      user_id: USER_ID,
      date_of_birth: '1992-04-15',
      is_archived: false,
    };

    let callCount = 0;
    mock.onFrom('users', () => {
      callCount += 1;
      return { data: newUser, error: null };
    });
    mock.onFrom('patients', () => ({ data: newPatient, error: null }));

    const result = await patientService.createWalkIn(VALID_WALKIN);
    assert.equal(result.error, null);
    assert.ok(result.data);
    assert.equal(result.data.id, PATIENT_ID);
    assert.equal(result.data.users.id, USER_ID);
    assert.equal(result.data.full_name, 'Maya Haddad');
    // Verify the users table was hit exactly once for insert (no compensation).
    assert.equal(callCount, 1);
  });

  it('synthesizes a placeholder email when none is provided', async () => {
    const newUser = {
      id: USER_ID,
      email: 'will-be-synthesized@clinic.local',
      first_name: 'Walk',
      last_name: 'In',
      role: 'patient',
      is_active: true,
    };
    const newPatient = { id: PATIENT_ID, user_id: USER_ID, is_archived: false };

    let insertedRow = null;
    mock.onFrom('users', ({ callEntry }) => {
      // Capture the row that was passed to .insert()
      const insertMod = callEntry.modifiers.find((m) => m.method === 'insert');
      if (insertMod && !insertedRow) insertedRow = insertMod.args[0]?.[0] ?? null;
      return { data: newUser, error: null };
    });
    mock.onFrom('patients', () => ({ data: newPatient, error: null }));

    const result = await patientService.createWalkIn({
      full_name: 'Walk In',
      phone: null,
      email: null,
      date_of_birth: null,
    });
    assert.equal(result.error, null);
    assert.ok(insertedRow);
    assert.match(insertedRow.email, /^walkin_\d+_[0-9a-f-]+@clinic\.local$/);
  });
});

describe('patientService.createWalkIn — compensation', () => {
  it('deactivates the orphan user when patient insert fails', async () => {
    const newUser = {
      id: USER_ID,
      email: 'maya@example.com',
      first_name: 'Maya',
      last_name: 'Haddad',
      role: 'patient',
      is_active: true,
    };

    let usersCallSequence = [];
    mock.onFrom('users', ({ callEntry }) => {
      const isUpdate = callEntry.modifiers.some((m) => m.method === 'update');
      usersCallSequence.push(isUpdate ? 'update' : 'insert');
      if (isUpdate) return { data: null, error: null };
      return { data: newUser, error: null };
    });
    mock.onFrom('patients', () => ({ data: null, error: { message: 'Patient insert failed' } }));

    const result = await patientService.createWalkIn(VALID_WALKIN);
    assert.equal(result.data, null);
    assert.ok(result.error);
    assert.match(String(result.error.message), /Patient insert failed/);
    // First users call inserted the orphan, second users call deactivated it.
    assert.deepEqual(usersCallSequence, ['insert', 'update']);
  });

  it('still returns the original error if the compensation update also fails', async () => {
    const newUser = {
      id: USER_ID,
      email: 'maya@example.com',
      first_name: 'Maya',
      last_name: 'Haddad',
      role: 'patient',
      is_active: true,
    };

    mock.onFrom('users', ({ callEntry }) => {
      const isUpdate = callEntry.modifiers.some((m) => m.method === 'update');
      if (isUpdate) return { data: null, error: { message: 'Compensation also failed' } };
      return { data: newUser, error: null };
    });
    mock.onFrom('patients', () => ({ data: null, error: { message: 'Patient insert failed' } }));

    const result = await patientService.createWalkIn(VALID_WALKIN);
    assert.equal(result.data, null);
    // The user-facing error remains the original patient insert failure.
    assert.match(String(result.error.message), /Patient insert failed/);
  });
});

describe('patientService.getById', () => {
  it('returns the patient row when found', async () => {
    const row = { id: PATIENT_ID, user_id: USER_ID, is_archived: false };
    mock.onFrom('patients', () => ({ data: row, error: null }));
    const result = await patientService.getById(PATIENT_ID);
    assert.equal(result.error, null);
    assert.equal(result.data.id, PATIENT_ID);
  });

  it('returns the supabase error when the row is missing', async () => {
    mock.onFrom('patients', () => ({ data: null, error: { message: 'Patient not found' } }));
    const result = await patientService.getById(PATIENT_ID);
    assert.equal(result.data, null);
    assert.equal(result.error, 'Patient not found');
  });
});

describe('patientService.getPatientsByDoctor', () => {
  it('returns an empty list when the doctor has no appointment patients', async () => {
    mock.onFrom('appointments', () => ({ data: [], error: null }));
    // patients table is never queried because the appointment-id list is empty.

    const result = await patientService.getPatientsByDoctor(DOCTOR_ID);
    assert.equal(result.error, null);
    assert.deepEqual(result.data, []);
  });
});
