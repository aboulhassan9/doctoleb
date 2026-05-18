import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseMock } from './__helpers__/supabaseMock.mjs';
import { __setSupabaseClientForTest } from '../../../packages/core/lib/supabase.js';
import { patientFormsService } from '../../../packages/core/services/patientForms.js';

const PATIENT_ID = '11111111-1111-4111-8111-111111111111';
const APPOINTMENT_ID = '22222222-2222-4222-8222-222222222222';

let mock;
let previousClient;

beforeEach(() => {
  mock = createSupabaseMock();
  previousClient = __setSupabaseClientForTest(mock.client);
});

afterEach(() => {
  __setSupabaseClientForTest(previousClient);
});

describe('patientFormsService.getDefinition', () => {
  it('loads a scoped patient form definition from RPC', async () => {
    mock.onRpc('get_patient_form_definition', () => ({
      data: {
        version: 6,
        formContext: 'appointment_booking',
        customFields: [
          {
            key: 'custom.visit_goal',
            section: 'visit',
            label: 'Visit goal',
            type: 'textarea',
            required: true,
          },
        ],
      },
      error: null,
    }));

    const result = await patientFormsService.getDefinition({
      context: 'appointment_booking',
      patientId: PATIENT_ID,
    });

    assert.equal(result.error, null);
    assert.equal(result.data.version, 6);
    assert.equal(result.data.customFieldKeys[0], 'custom.visit_goal');
    assert.deepEqual(mock.calls.rpc[0].args, {
      p_form_context: 'appointment_booking',
      p_patient_id: PATIENT_ID,
      p_doctor_id: null,
      p_visit_type_id: null,
    });
  });
});

describe('patientFormsService.submitAppointmentAnswers', () => {
  it('submits only resolved custom answers to the appointment RPC', async () => {
    const definition = {
      version: 3,
      customFieldKeys: ['custom.visit_goal'],
    };
    mock.onRpc('submit_patient_appointment_answers', () => ({
      data: { id: '33333333-3333-4333-8333-333333333333' },
      error: null,
    }));

    const result = await patientFormsService.submitAppointmentAnswers({
      appointmentId: APPOINTMENT_ID,
      definition,
      form: {
        'custom.visit_goal': 'Follow-up',
        'custom.nope': 'Should not submit',
      },
    });

    assert.equal(result.error, null);
    assert.deepEqual(mock.calls.rpc[0].args, {
      p_appointment_id: APPOINTMENT_ID,
      p_field_config_version: 3,
      p_custom_answers: {
        'custom.visit_goal': 'Follow-up',
      },
    });
  });
});
