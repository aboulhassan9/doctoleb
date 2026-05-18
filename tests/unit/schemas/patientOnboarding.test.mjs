import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PATIENT_ONBOARDING_CONFIG_CONTRACT,
  PATIENT_ONBOARDING_FIELD_REGISTRY,
  buildPatientGuidedIntakePayload,
  buildPatientOnboardingStatus,
  getPatientOnboardingSectionProgress,
  parseWithSchema,
  patientSelfIntakeSchema,
  resolvePatientOnboardingDefinition,
} from '../../../packages/core/schemas/index.js';

const PATIENT_ID = '11111111-1111-4111-8111-111111111111';

describe('patientSelfIntakeSchema', () => {
  it('accepts the patient self-intake fields allowed in V1', () => {
    const { data, error } = parseWithSchema(patientSelfIntakeSchema, {
      patient_id: PATIENT_ID,
      allergies_text: 'Penicillin',
      current_medications_text: 'Metformin 500mg daily',
      notes: 'Asthma as a child',
      field_config_version: 3,
      custom_answers: {
        'custom.preferred_language': 'Arabic',
      },
    });

    assert.equal(error, null);
    assert.equal(data.patient_id, PATIENT_ID);
    assert.equal(data.allergies_text, 'Penicillin');
    assert.equal(data.field_config_version, 3);
    assert.equal(data.custom_answers['custom.preferred_language'], 'Arabic');
  });

  it('normalizes blank optional values to null', () => {
    const { data, error } = parseWithSchema(patientSelfIntakeSchema, {
      patient_id: PATIENT_ID,
      allergies_text: '',
      current_medications_text: '',
      notes: '',
    });

    assert.equal(error, null);
    assert.equal(data.allergies_text, null);
    assert.equal(data.current_medications_text, null);
    assert.equal(data.notes, null);
    assert.deepEqual(data.custom_answers, {});
    assert.equal(data.field_config_version, 1);
  });

  it('rejects custom answers outside the custom field namespace', () => {
    const { data, error } = parseWithSchema(patientSelfIntakeSchema, {
      patient_id: PATIENT_ID,
      custom_answers: {
        allergies: 'Not allowed through generic JSON',
      },
    });

    assert.equal(data, null);
    assert.match(error, /Invalid key|custom/i);
  });
});

describe('PATIENT_ONBOARDING_FIELD_REGISTRY', () => {
  it('keeps the V1 fields declarative and config-ready', () => {
    const keys = PATIENT_ONBOARDING_FIELD_REGISTRY.map((field) => field.key);

    assert.ok(keys.includes('date_of_birth'));
    assert.ok(keys.includes('sex'));
    assert.ok(keys.includes('allergies'));
    assert.ok(keys.includes('current_medications'));
    assert.ok(keys.includes('medical_history'));
    assert.ok(PATIENT_ONBOARDING_FIELD_REGISTRY.every((field) => field.configGroup));
    assert.equal(PATIENT_ONBOARDING_CONFIG_CONTRACT.mode, 'scoped_allowlist');
    assert.ok(PATIENT_ONBOARDING_CONFIG_CONTRACT.formContexts.includes('appointment_booking'));
  });
});

describe('resolvePatientOnboardingDefinition', () => {
  it('applies safe base overrides without allowing locked required fields to disappear', () => {
    const definition = resolvePatientOnboardingDefinition({
      config: {
        version: 7,
        fieldOverrides: [
          { key: 'insurance_id', visible: false },
          { key: 'date_of_birth', visible: false, required: false, label: 'DOB for safety' },
          { key: 'current_medications', required: true, order: 5 },
        ],
      },
    });

    const keys = definition.fields.map((field) => field.key);
    const dob = definition.fields.find((field) => field.key === 'date_of_birth');
    const medications = definition.fields.find((field) => field.key === 'current_medications');

    assert.equal(definition.version, 7);
    assert.equal(keys.includes('insurance_id'), false);
    assert.equal(dob.required, true);
    assert.equal(dob.label, 'DOB for safety');
    assert.equal(medications.required, true);
  });

  it('accepts allowlisted custom fields and ignores unsafe custom config', () => {
    const definition = resolvePatientOnboardingDefinition({
      config: {
        customFields: [
          {
            key: 'custom.preferred_language',
            section: 'support',
            label: 'Preferred language',
            type: 'select',
            required: true,
            options: [
              { value: 'arabic', label: 'Arabic' },
              { value: 'english', label: 'English' },
            ],
          },
          {
            key: 'allergies',
            section: 'safety',
            label: 'Unsafe collision',
            type: 'text',
          },
          {
            key: 'custom.bad-key',
            section: 'safety',
            label: 'Bad key',
            type: 'text',
          },
        ],
      },
    });

    const customField = definition.fields.find((field) => field.key === 'custom.preferred_language');

    assert.equal(customField.target, 'intake_custom');
    assert.equal(customField.required, true);
    assert.deepEqual(definition.customFieldKeys, ['custom.preferred_language']);
    assert.equal(definition.fields.some((field) => field.key === 'custom.bad-key'), false);
  });

  it('collects custom answers only from the resolved definition', () => {
    const definition = resolvePatientOnboardingDefinition({
      config: {
        customFields: [
          {
            key: 'custom.preferred_language',
            section: 'support',
            label: 'Preferred language',
            type: 'text',
          },
        ],
      },
    });

    const payload = buildPatientGuidedIntakePayload({
      userId: '22222222-2222-4222-8222-222222222222',
      patientId: PATIENT_ID,
      definition,
      form: {
        first_name: 'Maya',
        last_name: 'Haddad',
        date_of_birth: '1990-05-13',
        sex: 'female',
        'custom.preferred_language': 'Arabic',
        'custom.not_configured': 'Should not be submitted',
      },
    });

    assert.equal(payload.intake.field_config_version, definition.version);
    assert.deepEqual(payload.intake.custom_answers, {
      'custom.preferred_language': 'Arabic',
    });
  });
});

describe('buildPatientOnboardingStatus', () => {
  it('marks onboarding complete when profile safety fields and intake are complete', () => {
    const status = buildPatientOnboardingStatus({
      patient: {
        date_of_birth: '1990-05-13',
        sex: 'female',
        intake_completed_at: '2026-05-18T08:00:00Z',
      },
      intake: {
        status: 'completed',
        completed_at: '2026-05-18T08:00:00Z',
      },
    });

    assert.equal(status.isComplete, true);
    assert.deepEqual(status.missingRequiredFields, []);
    assert.equal(status.completionPercent, 100);
    assert.equal(status.completedRequiredCount, 3);
  });

  it('identifies missing clinical identity fields before booking', () => {
    const status = buildPatientOnboardingStatus({
      patient: { date_of_birth: null, sex: null },
      intake: null,
    });

    assert.equal(status.isComplete, false);
    assert.deepEqual(status.missingRequiredFields, ['date_of_birth', 'sex', 'intake']);
    assert.equal(status.completionPercent, 0);
    assert.equal(status.readinessItems.length, 3);
  });
});

describe('getPatientOnboardingSectionProgress', () => {
  it('reports required and visible field progress for the active section', () => {
    const progress = getPatientOnboardingSectionProgress({
      sectionId: 'identity',
      form: {
        first_name: 'Maya',
        last_name: 'Haddad',
        phone: '',
        date_of_birth: '1990-05-13',
        sex: '',
      },
    });

    assert.equal(progress.requiredCount, 4);
    assert.equal(progress.completedRequiredCount, 3);
    assert.equal(progress.isRequiredComplete, false);
  });

  it('includes required custom fields from the resolved definition', () => {
    const definition = resolvePatientOnboardingDefinition({
      config: {
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
    });

    const progress = getPatientOnboardingSectionProgress({
      definition,
      sectionId: 'safety',
      form: {
        allergies: '',
        current_medications: '',
        medical_history: '',
        'custom.visit_goal': '',
      },
    });

    assert.equal(progress.requiredCount, 1);
    assert.equal(progress.completedRequiredCount, 0);
    assert.equal(progress.isRequiredComplete, false);
  });
});
