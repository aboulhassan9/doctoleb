import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseMock } from './__helpers__/supabaseMock.mjs';
import { __setSupabaseClientForTest } from '../../../packages/core/lib/supabase.js';
import { patientBookingService } from '../../../packages/core/services/patientBooking.js';
import { resolvePatientFormDefinition, PATIENT_FORM_CONTEXTS } from '../../../packages/core/schemas/index.js';

const SLOT_ID = '11111111-1111-4111-8111-111111111111';
const PATIENT_ID = '22222222-2222-4222-8222-222222222222';
const BOOKED_BY_ID = '33333333-3333-4333-8333-333333333333';
const APPOINTMENT_ID = '44444444-4444-4444-8444-444444444444';
const DOCTOR_ID = '55555555-5555-4555-8555-555555555555';

const APPOINTMENT_ROW = {
  id: APPOINTMENT_ID,
  status: 'scheduled',
  scheduled_at: '2026-05-18T09:00:00Z',
  duration_minutes: 30,
  reason: 'Medication follow-up',
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

describe('patientBookingService.bookVisit', () => {
  it('submits default allowlisted booking answers even when no custom fields exist', async () => {
    const definition = resolvePatientFormDefinition({
      context: PATIENT_FORM_CONTEXTS.appointmentBooking,
    });

    mock.onRpc('book_slot', () => ({ data: APPOINTMENT_ID, error: null }));
    mock.onFrom('appointments', () => ({ data: APPOINTMENT_ROW, error: null }));
    mock.onRpc('submit_patient_appointment_answers', () => ({
      data: { id: '66666666-6666-4666-8666-666666666666' },
      error: null,
    }));

    const result = await patientBookingService.bookVisit({
      booking: {
        slotId: SLOT_ID,
        patientId: PATIENT_ID,
        bookedBy: BOOKED_BY_ID,
        reason: 'Medication follow-up',
        durationMinutes: 30,
        status: 'scheduled',
      },
      definition,
      form: {
        visit_reason: 'Medication follow-up',
        visit_priority: 'soon',
        visit_modality: 'in_person',
        preferred_contact_method: 'portal',
      },
    });

    assert.equal(result.error, null);
    const answerRpc = mock.calls.rpc.find((call) => call.name === 'submit_patient_appointment_answers');
    assert.ok(answerRpc);
    assert.deepEqual(answerRpc.args.p_custom_answers, {
      visit_priority: 'soon',
      visit_modality: 'in_person',
      preferred_contact_method: 'portal',
    });
  });

  it('books the appointment and submits allowlisted configurable answers', async () => {
    const definition = resolvePatientFormDefinition({
      context: PATIENT_FORM_CONTEXTS.appointmentBooking,
      config: {
        version: 8,
        customFields: [
          {
            key: 'custom.visit_goal',
            section: 'visit',
            label: 'Visit goal',
            type: 'textarea',
          },
        ],
      },
    });

    mock.onRpc('book_slot', () => ({ data: APPOINTMENT_ID, error: null }));
    mock.onFrom('appointments', () => ({ data: APPOINTMENT_ROW, error: null }));
    mock.onRpc('submit_patient_appointment_answers', () => ({
      data: { id: '66666666-6666-4666-8666-666666666666' },
      error: null,
    }));

    const result = await patientBookingService.bookVisit({
      booking: {
        slotId: SLOT_ID,
        patientId: PATIENT_ID,
        bookedBy: BOOKED_BY_ID,
        reason: 'Medication follow-up',
        durationMinutes: 30,
        status: 'scheduled',
      },
      definition,
      form: {
        visit_reason: 'Medication follow-up',
        visit_priority: 'soon',
        visit_modality: 'in_person',
        preferred_contact_method: 'portal',
        'custom.visit_goal': 'Adjust medication',
      },
    });

    assert.equal(result.error, null);
    assert.equal(result.data.appointment.id, APPOINTMENT_ID);
    assert.equal(result.data.partialSuccess.bookingAnswersSaved, true);

    const answerRpc = mock.calls.rpc.find((call) => call.name === 'submit_patient_appointment_answers');
    assert.ok(answerRpc);
    assert.deepEqual(answerRpc.args.p_custom_answers, {
      visit_priority: 'soon',
      visit_modality: 'in_person',
      preferred_contact_method: 'portal',
      'custom.visit_goal': 'Adjust medication',
    });
  });
});
