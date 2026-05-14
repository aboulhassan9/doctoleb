import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAppointment,
  normalizeAppointments,
  normalizeAppointmentStatus,
  getAppointmentStatusLabel,
  canTransitionAppointmentStatus,
  APPOINTMENT_STATUS,
  APPOINTMENT_STATUS_LABELS,
} from '../../../packages/core/lib/appointments.js';

describe('normalizeAppointmentStatus', () => {
  it('passes canonical values through unchanged', () => {
    assert.equal(normalizeAppointmentStatus('scheduled'), 'scheduled');
    assert.equal(normalizeAppointmentStatus('completed'), 'completed');
  });

  it('lowercases and replaces spaces with underscores', () => {
    assert.equal(normalizeAppointmentStatus(' Pre Check '), 'pre_check');
    assert.equal(normalizeAppointmentStatus('IN CONSULTATION'), 'in_consultation');
  });

  it('handles common aliases', () => {
    assert.equal(normalizeAppointmentStatus('no-show'), 'no_show');
    assert.equal(normalizeAppointmentStatus('no_show'), 'no_show');
  });

  it('defaults to scheduled for falsy input', () => {
    assert.equal(normalizeAppointmentStatus(null), 'scheduled');
    assert.equal(normalizeAppointmentStatus(''), 'scheduled');
    assert.equal(normalizeAppointmentStatus(undefined), 'scheduled');
  });
});

describe('getAppointmentStatusLabel', () => {
  it('returns the label from APPOINTMENT_STATUS_LABELS', () => {
    assert.equal(getAppointmentStatusLabel('scheduled'), APPOINTMENT_STATUS_LABELS.scheduled);
    assert.equal(getAppointmentStatusLabel('no_show'), APPOINTMENT_STATUS_LABELS.no_show);
  });

  it('falls back to the normalized status string when no label maps', () => {
    assert.equal(getAppointmentStatusLabel('mystery_state'), 'mystery_state');
  });
});

describe('normalizeAppointment', () => {
  const base = () => ({
    id: 'appt-1',
    scheduled_at: '2026-05-14T09:00:00Z',
    status: 'SCHEDULED',
    reason: 'Visit',
    duration_minutes: 45,
    patients: {
      users: { first_name: 'Maya', last_name: 'Haddad', phone: '+961 71 234 567' },
    },
    doctors: {
      department: 'Cardiology',
      users: { first_name: 'Sami', last_name: 'Halabi' },
    },
  });

  it('joins doctor + patient names from nested users rows', () => {
    const result = normalizeAppointment(base());
    assert.equal(result.patientName, 'Maya Haddad');
    assert.equal(result.doctorName, 'Sami Halabi');
    assert.equal(result.doctorDepartment, 'Cardiology');
  });

  it('emits uppercase patientInitials', () => {
    const result = normalizeAppointment(base());
    assert.equal(result.patientInitials, 'MH');
  });

  it('normalizes status into the canonical lowercase form', () => {
    const result = normalizeAppointment(base());
    assert.equal(result.status, 'scheduled');
    assert.equal(result.statusLabel, 'Scheduled');
  });

  it('marks isCancelled true for cancelled records', () => {
    const result = normalizeAppointment({ ...base(), status: 'cancelled' });
    assert.equal(result.isCancelled, true);
  });

  it('falls back to legacy patient_name and doctor_name fields', () => {
    const result = normalizeAppointment({
      id: 'appt-2',
      scheduled_at: '2026-05-14T09:00:00Z',
      patient_name: 'Anonymous Walk-In',
      doctor_name: 'On-Call Doctor',
    });
    assert.equal(result.patientName, 'Anonymous Walk-In');
    assert.equal(result.doctorName, 'On-Call Doctor');
  });

  it('defaults duration_minutes to 30 when not provided', () => {
    const result = normalizeAppointment({
      id: 'appt-3',
      scheduled_at: '2026-05-14T09:00:00Z',
    });
    assert.equal(result.duration_minutes, 30);
  });

  it('preserves the original record fields via spread', () => {
    const result = normalizeAppointment({ ...base(), foo: 'bar' });
    assert.equal(result.foo, 'bar');
  });

  it('normalizes a list via normalizeAppointments', () => {
    const list = normalizeAppointments([base(), base()]);
    assert.equal(list.length, 2);
    assert.equal(list[0].patientName, 'Maya Haddad');
  });
});

describe('canTransitionAppointmentStatus', () => {
  it('allows valid forward transitions', () => {
    assert.equal(canTransitionAppointmentStatus('scheduled', 'confirmed'), true);
    assert.equal(canTransitionAppointmentStatus('confirmed', 'pre_check'), true);
    assert.equal(canTransitionAppointmentStatus('pre_check', 'in_consultation'), true);
    assert.equal(canTransitionAppointmentStatus('in_consultation', 'completed'), true);
  });

  it('rejects skipping pre_check', () => {
    assert.equal(canTransitionAppointmentStatus('scheduled', 'in_consultation'), false);
  });

  it('rejects transitions out of terminal states', () => {
    assert.equal(canTransitionAppointmentStatus('completed', 'scheduled'), false);
    assert.equal(canTransitionAppointmentStatus('cancelled', 'scheduled'), false);
    assert.equal(canTransitionAppointmentStatus('no_show', 'scheduled'), false);
  });

  it('allows cancellation from any non-terminal state', () => {
    assert.equal(canTransitionAppointmentStatus('scheduled', 'cancelled'), true);
    assert.equal(canTransitionAppointmentStatus('confirmed', 'cancelled'), true);
    assert.equal(canTransitionAppointmentStatus('pre_check', 'cancelled'), true);
  });
});

describe('APPOINTMENT_STATUS constant', () => {
  it('exposes all DB-enum values', () => {
    const values = new Set(Object.values(APPOINTMENT_STATUS));
    for (const required of ['scheduled', 'confirmed', 'pre_check', 'in_consultation', 'completed', 'cancelled', 'no_show']) {
      assert.ok(values.has(required), `${required} missing`);
    }
  });
});
