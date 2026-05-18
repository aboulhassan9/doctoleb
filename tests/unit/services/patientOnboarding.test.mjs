import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseMock } from './__helpers__/supabaseMock.mjs';
import { __setSupabaseClientForTest } from '../../../packages/core/lib/supabase.js';
import { patientOnboardingService } from '../../../packages/core/services/patientOnboarding.js';

const PATIENT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const INTAKE_ID = '33333333-3333-4333-8333-333333333333';

let mock;
let previousClient;

beforeEach(() => {
  mock = createSupabaseMock();
  previousClient = __setSupabaseClientForTest(mock.client);
});

afterEach(() => {
  __setSupabaseClientForTest(previousClient);
});

function profilePayload(overrides = {}) {
  return {
    first_name: 'Maya',
    last_name: 'Haddad',
    phone: '+96170000000',
    date_of_birth: '1990-05-13',
    sex: 'female',
    blood_type: 'O+',
    allergies: 'Penicillin',
    insurance_id: 'INS-123',
    emergency_contact: 'Karim Haddad',
    emergency_phone: '+96171111111',
    medical_history: 'Asthma history',
    ...overrides,
  };
}

function completedPatient(overrides = {}) {
  return {
    id: PATIENT_ID,
    user_id: USER_ID,
    date_of_birth: '1990-05-13',
    sex: 'female',
    intake_completed_at: '2026-05-18T08:00:00Z',
    ...overrides,
  };
}

function completedIntake(overrides = {}) {
  return {
    id: INTAKE_ID,
    patient_id: PATIENT_ID,
    status: 'completed',
    completed_at: '2026-05-18T08:00:00Z',
    ...overrides,
  };
}

describe('patientOnboardingService.submitSelfIntake', () => {
  it('rejects invalid payloads before calling the RPC', async () => {
    const result = await patientOnboardingService.submitSelfIntake({
      patient_id: 'not-a-uuid',
      allergies_text: 'Penicillin',
    });

    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.rpc.length, 0);
  });

  it('calls the allowlisted patient self-intake RPC', async () => {
    mock.onRpc('submit_patient_self_intake', () => ({
      data: completedIntake(),
      error: null,
    }));

    const result = await patientOnboardingService.submitSelfIntake({
      patient_id: PATIENT_ID,
      allergies_text: 'Penicillin',
      current_medications_text: 'Metformin',
      notes: 'Asthma history',
      field_config_version: 4,
      custom_answers: {
        'custom.preferred_language': 'arabic',
      },
    });

    assert.equal(result.error, null);
    assert.equal(result.data.patient_id, PATIENT_ID);
    assert.equal(mock.calls.rpc.length, 1);
    assert.equal(mock.calls.rpc[0].name, 'submit_patient_self_intake');
    assert.deepEqual(mock.calls.rpc[0].args, {
      p_patient_id: PATIENT_ID,
      p_allergies_text: 'Penicillin',
      p_current_medications_text: 'Metformin',
      p_notes: 'Asthma history',
      p_field_config_version: 4,
      p_custom_answers: {
        'custom.preferred_language': 'arabic',
      },
    });
  });
});

describe('patientOnboardingService.getDefinition', () => {
  it('normalizes the doctor or tenant scoped field definition from the RPC', async () => {
    mock.onRpc('get_patient_onboarding_definition', () => ({
      data: {
        version: 8,
        source: 'doctor',
        fieldOverrides: [
          { key: 'current_medications', required: true },
        ],
        customFields: [
          {
            key: 'custom.visit_goal',
            section: 'safety',
            label: 'Visit goal',
            type: 'textarea',
            required: true,
          },
        ],
      },
      error: null,
    }));

    const result = await patientOnboardingService.getDefinition({ patientId: PATIENT_ID });

    assert.equal(result.error, null);
    assert.equal(result.data.version, 8);
    assert.ok(result.data.requiredKeys.includes('current_medications'));
    assert.ok(result.data.requiredKeys.includes('custom.visit_goal'));
    assert.equal(mock.calls.rpc[0].name, 'get_patient_onboarding_definition');
    assert.deepEqual(mock.calls.rpc[0].args, {
      p_patient_id: PATIENT_ID,
      p_doctor_id: null,
    });
  });

  it('falls back to the safe default definition when config loading fails', async () => {
    mock.onRpc('get_patient_onboarding_definition', () => ({
      data: null,
      error: { message: 'RPC unavailable' },
    }));

    const result = await patientOnboardingService.getDefinition({ patientId: PATIENT_ID });

    assert.equal(result.error, null);
    assert.equal(result.data.source, 'default');
    assert.equal(result.configError, 'RPC unavailable');
  });
});

describe('patientOnboardingService.getReadiness', () => {
  it('loads the patient and medical intake status into one view model', async () => {
    mock.onFrom('patients', () => ({
      data: completedPatient(),
      error: null,
    }));
    mock.onRpc('get_patient_onboarding_definition', () => ({
      data: {
        version: 5,
        customFields: [
          {
            key: 'custom.visit_goal',
            section: 'safety',
            label: 'Visit goal',
            type: 'text',
            required: true,
          },
        ],
      },
      error: null,
    }));
    mock.onFrom('medical_intake', () => ({
      data: completedIntake({
        custom_answers: {
          'custom.visit_goal': 'Headache follow-up',
        },
      }),
      error: null,
    }));

    const result = await patientOnboardingService.getReadiness({ userId: USER_ID });

    assert.equal(result.error, null);
    assert.equal(result.data.patient.id, PATIENT_ID);
    assert.equal(result.data.definition.version, 5);
    assert.equal(result.data.status.isComplete, true);
  });
});

describe('patientOnboardingService.saveGuidedIntake', () => {
  it('fails before mutation when patient identity is missing', async () => {
    const result = await patientOnboardingService.saveGuidedIntake({
      userId: USER_ID,
      patientId: null,
      profile: profilePayload(),
      intake: profilePayload(),
    });

    assert.equal(result.data, null);
    assert.equal(result.error, 'Patient identity is required.');
    assert.equal(mock.calls.rpc.length, 0);
  });

  it('returns the profile failure and does not submit intake', async () => {
    mock.onRpc('update_patient_profile', () => ({
      data: null,
      error: { message: 'Profile update denied' },
    }));

    const result = await patientOnboardingService.saveGuidedIntake({
      userId: USER_ID,
      patientId: PATIENT_ID,
      profile: profilePayload(),
      intake: profilePayload(),
    });

    assert.equal(result.data, null);
    assert.equal(result.error, 'Profile update denied');
    assert.equal(mock.calls.rpc.length, 1);
    assert.equal(mock.calls.rpc[0].name, 'update_patient_profile');
  });

  it('returns partial success when profile saves but self-intake RPC fails', async () => {
    mock.onRpc('update_patient_profile', () => ({
      data: completedPatient({ intake_completed_at: null }),
      error: null,
    }));
    mock.onRpc('submit_patient_self_intake', () => ({
      data: null,
      error: { message: 'INTAKE_WRITE_DENIED' },
    }));

    const result = await patientOnboardingService.saveGuidedIntake({
      userId: USER_ID,
      patientId: PATIENT_ID,
      profile: profilePayload(),
      intake: profilePayload(),
    });

    assert.equal(result.error, 'INTAKE_WRITE_DENIED');
    assert.equal(result.data.patient.id, PATIENT_ID);
    assert.deepEqual(result.data.partialSuccess, {
      profileSaved: true,
      intakeSaved: false,
    });
    assert.equal(result.data.status.isComplete, false);
  });

  it('returns canonical readiness after profile and intake save', async () => {
    mock.onRpc('update_patient_profile', () => ({
      data: completedPatient({ intake_completed_at: null }),
      error: null,
    }));
    mock.onRpc('submit_patient_self_intake', () => ({
      data: completedIntake(),
      error: null,
    }));
    mock.onFrom('patients', () => ({
      data: completedPatient(),
      error: null,
    }));
    mock.onFrom('medical_intake', () => ({
      data: completedIntake(),
      error: null,
    }));

    const result = await patientOnboardingService.saveGuidedIntake({
      userId: USER_ID,
      patientId: PATIENT_ID,
      profile: profilePayload(),
      intake: profilePayload(),
    });

    assert.equal(result.error, null);
    assert.equal(result.data.patient.id, PATIENT_ID);
    assert.equal(result.data.intake.id, INTAKE_ID);
    assert.equal(result.data.status.isComplete, true);
  });
});
