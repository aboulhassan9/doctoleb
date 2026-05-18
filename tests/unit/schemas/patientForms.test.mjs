import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PATIENT_FORM_CONTEXTS,
  collectPatientFormCustomAnswers,
  getPatientFormRegistry,
  resolvePatientFormDefinition,
} from '../../../packages/core/schemas/index.js';

describe('resolvePatientFormDefinition', () => {
  it('resolves booking definitions from registry plus safe config', () => {
    const definition = resolvePatientFormDefinition({
      context: PATIENT_FORM_CONTEXTS.appointmentBooking,
      config: {
        version: 4,
        fieldOverrides: [
          { key: 'visit_priority', required: true, label: 'Priority for the clinic' },
          { key: 'not_allowed', required: true },
        ],
        customFields: [
          {
            key: 'custom.preferred_language',
            section: 'booking',
            label: 'Preferred language',
            type: 'select',
            required: true,
            options: [{ value: 'arabic', label: 'Arabic' }],
          },
        ],
      },
    });

    const priority = definition.fields.find((field) => field.key === 'visit_priority');

    assert.equal(definition.version, 4);
    assert.equal(priority.required, true);
    assert.equal(priority.label, 'Priority for the clinic');
    assert.deepEqual(definition.customFieldKeys, ['custom.preferred_language']);
    assert.equal(definition.requiredKeys.includes('custom.preferred_language'), true);
    assert.equal(definition.fields.some((field) => field.key === 'not_allowed'), false);
  });

  it('collects only configured custom answers', () => {
    const definition = resolvePatientFormDefinition({
      context: PATIENT_FORM_CONTEXTS.appointmentBooking,
      config: {
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

    const answers = collectPatientFormCustomAnswers({
      definition,
      form: {
        visit_reason: 'Headache',
        'custom.visit_goal': 'Medication adjustment',
        'custom.not_configured': 'nope',
      },
    });

    assert.deepEqual(answers, {
      'custom.visit_goal': 'Medication adjustment',
    });
  });

  it('collects allowlisted appointment answer fields without collecting appointment reason', () => {
    const definition = resolvePatientFormDefinition({
      context: PATIENT_FORM_CONTEXTS.appointmentBooking,
      config: {
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

    const answers = collectPatientFormCustomAnswers({
      definition,
      form: {
        visit_reason: 'Chest tightness follow-up',
        visit_priority: 'soon',
        visit_modality: 'in_person',
        preferred_contact_method: 'portal',
        'custom.visit_goal': 'Medication adjustment',
      },
    });

    assert.deepEqual(answers, {
      visit_priority: 'soon',
      visit_modality: 'in_person',
      preferred_contact_method: 'portal',
      'custom.visit_goal': 'Medication adjustment',
    });
  });

  it('exposes check-in fields through the shared allowlisted registry', () => {
    const registry = getPatientFormRegistry(PATIENT_FORM_CONTEXTS.checkIn);
    const definition = resolvePatientFormDefinition({ context: PATIENT_FORM_CONTEXTS.checkIn });

    assert.ok(registry.some((field) => field.key === 'blood_pressure'));
    assert.ok(registry.some((field) => field.key === 'symptoms'));
    assert.equal(definition.formContext, PATIENT_FORM_CONTEXTS.checkIn);
    assert.deepEqual(
      definition.requiredKeys.sort(),
      ['blood_pressure', 'heart_rate', 'symptoms', 'temperature'].sort()
    );
  });
});
