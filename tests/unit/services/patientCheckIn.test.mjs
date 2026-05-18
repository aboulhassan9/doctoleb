import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseMock } from './__helpers__/supabaseMock.mjs';
import { __setSupabaseClientForTest } from '../../../packages/core/lib/supabase.js';
import { patientCheckInService } from '../../../packages/core/services/patientCheckIn.js';
import { resolvePatientFormDefinition, PATIENT_FORM_CONTEXTS } from '../../../packages/core/lib/patientForms.js';

const APPOINTMENT_ID = '11111111-1111-4111-8111-111111111111';

let mock;
let previousClient;

beforeEach(() => {
  mock = createSupabaseMock();
  previousClient = __setSupabaseClientForTest(mock.client);
});

afterEach(() => {
  __setSupabaseClientForTest(previousClient);
});

describe('patientCheckInService.submit', () => {
  it('validates required check-in fields before calling the RPC', async () => {
    const definition = resolvePatientFormDefinition({ context: PATIENT_FORM_CONTEXTS.checkIn });

    const result = await patientCheckInService.submit({
      appointmentId: APPOINTMENT_ID,
      definition,
      form: {},
    });

    assert.equal(result.data, null);
    assert.match(result.error, /Blood pressure|required/i);
    assert.equal(mock.calls.rpc.length, 0);
  });

  it('submits only allowlisted patient check-in RPC args', async () => {
    const definition = resolvePatientFormDefinition({
      context: PATIENT_FORM_CONTEXTS.checkIn,
      config: {
        customFields: [
          {
            key: 'custom.arrival_note',
            fieldKind: 'custom',
            section: 'symptoms',
            type: 'textarea',
            visible: true,
            required: false,
            label: 'Arrival note',
          },
        ],
      },
    });

    mock.onRpc('submit_patient_check_in', () => ({
      data: {
        id: '22222222-2222-4222-8222-222222222222',
        appointmentId: APPOINTMENT_ID,
        status: 'submitted',
      },
      error: null,
    }));

    const result = await patientCheckInService.submit({
      appointmentId: APPOINTMENT_ID,
      definition,
      form: {
        blood_pressure: '120/80',
        heart_rate: '72',
        temperature: '36.8',
        respiratory_rate: '14',
        weight: '76.5',
        height: '178',
        symptoms: 'Mild cough',
        allergies: 'None',
        current_medications: 'None',
        'custom.arrival_note': 'Prefers quiet waiting area',
      },
    });

    assert.equal(result.error, null);
    assert.equal(result.data.status, 'submitted');
    assert.equal(mock.calls.rpc[0].name, 'submit_patient_check_in');
    assert.deepEqual(mock.calls.rpc[0].args, {
      p_appointment_id: APPOINTMENT_ID,
      p_field_config_version: 1,
      p_blood_pressure: '120/80',
      p_heart_rate: 72,
      p_temperature: 36.8,
      p_respiratory_rate: 14,
      p_weight: 76.5,
      p_height: 178,
      p_allergies: 'None',
      p_current_medications: 'None',
      p_symptoms: 'Mild cough',
      p_is_urgent: false,
      p_custom_answers: {
        'custom.arrival_note': 'Prefers quiet waiting area',
      },
    });
  });
});
