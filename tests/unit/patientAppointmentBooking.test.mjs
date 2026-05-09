import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canLoadPatientBookingSlots,
  getDoctorDisplayName,
  normalizeBookingDoctorOptions,
  resolveInitialBookingDoctorId,
} from '../../packages/core/lib/patientAppointmentBooking.js';
import {
  appointmentCancelSchema,
  parseWithSchema,
} from '../../packages/core/schemas/index.js';

describe('patient appointment booking helpers', () => {
  it('formats doctor labels from joined user names without needing page logic', () => {
    assert.equal(
      getDoctorDisplayName({
        users: {
          first_name: 'Maya',
          last_name: 'Haddad',
        },
      }),
      'Dr. Maya Haddad',
    );
  });

  it('keeps specialization separate from the base doctor label', () => {
    assert.deepEqual(
      normalizeBookingDoctorOptions([
        { id: 'doctor-a', specialization: 'General Medicine' },
      ]),
      [
        {
          id: 'doctor-a',
          label: 'Doctor',
          specialization: 'General Medicine',
          department: null,
        },
      ],
    );
  });

  it('normalizes selectable doctors and ignores invalid rows', () => {
    assert.deepEqual(
      normalizeBookingDoctorOptions([
        { id: 'doctor-a', users: { first_name: 'Maya', last_name: 'Haddad' }, specialization: 'Pediatrics' },
        { users: { first_name: 'No', last_name: 'Id' } },
      ]),
      [
        {
          id: 'doctor-a',
          label: 'Dr. Maya Haddad',
          specialization: 'Pediatrics',
          department: null,
        },
      ],
    );
  });

  it('does not require patient sessions to have doctor_id when multiple doctors exist', () => {
    assert.equal(
      resolveInitialBookingDoctorId({
        sessionDoctorId: null,
        doctors: [
          { id: 'doctor-a', users: { first_name: 'A', last_name: 'One' } },
          { id: 'doctor-b', users: { first_name: 'B', last_name: 'Two' } },
        ],
      }),
      '',
    );
  });

  it('auto-selects the only active doctor to keep single-doctor clinics fast', () => {
    assert.equal(
      resolveInitialBookingDoctorId({
        sessionDoctorId: null,
        doctors: [{ id: 'doctor-a', users: { first_name: 'A', last_name: 'One' } }],
      }),
      'doctor-a',
    );
  });

  it('loads slots only after doctor and date are selected', () => {
    assert.equal(canLoadPatientBookingSlots({ selectedDoctorId: '', selectedDate: '2026-05-10' }), false);
    assert.equal(canLoadPatientBookingSlots({ selectedDoctorId: 'doctor-a', selectedDate: '' }), false);
    assert.equal(canLoadPatientBookingSlots({ selectedDoctorId: 'doctor-a', selectedDate: '2026-05-10' }), true);
  });

  it('validates cancellation payloads before hitting the appointment lifecycle RPC', () => {
    const { data, error } = parseWithSchema(appointmentCancelSchema, {
      appointmentId: '11111111-1111-4111-8111-111111111111',
      reason: '  Patient is unavailable  ',
    });

    assert.equal(error, null);
    assert.deepEqual(data, {
      appointmentId: '11111111-1111-4111-8111-111111111111',
      reason: 'Patient is unavailable',
    });
  });

  it('rejects invalid cancellation payloads without calling the database', () => {
    const { data, error } = parseWithSchema(appointmentCancelSchema, {
      appointmentId: 'not-a-uuid',
      reason: 'Patient is unavailable',
    });

    assert.equal(data, null);
    assert.match(error, /Invalid/);
  });
});
