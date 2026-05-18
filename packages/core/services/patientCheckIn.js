import { supabase } from '../lib/supabase.js';
import { parseOptionalPrecheckNumber } from '../lib/precheckPayload.js';
import {
  PATIENT_FORM_CONTEXTS,
  collectPatientFormCustomAnswers,
  resolvePatientFormDefinition,
} from '../schemas/index.js';
import { patientFormsService } from './patientForms.js';

function getErrorMessage(error, fallback = 'Request failed') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  return error.message || fallback;
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getFieldLabel(definition, key) {
  return definition?.fields?.find((field) => field.key === key)?.label || key.replace(/_/g, ' ');
}

function validateRequired({ definition, form }) {
  for (const key of definition?.requiredKeys || []) {
    const value = form?.[key];
    if (value === null || value === undefined || String(value).trim() === '') {
      return `${getFieldLabel(definition, key)} is required.`;
    }
  }
  return null;
}

function parseOptionalInteger(value, label, { min = 1, max = 999 } = {}) {
  const parsed = parseOptionalPrecheckNumber(value, label);
  if (parsed === null) return null;
  if (!Number.isInteger(parsed)) throw new Error(`${label} must be a whole number.`);
  if (parsed < min || parsed > max) throw new Error(`${label} is outside the expected range.`);
  return parsed;
}

function parseOptionalDecimal(value, label, { min = 1, max = 1000 } = {}) {
  const parsed = parseOptionalPrecheckNumber(value, label);
  if (parsed === null) return null;
  if (parsed < min || parsed > max) throw new Error(`${label} is outside the expected range.`);
  return parsed;
}

function buildCheckInRpcArgs({ appointmentId, definition, form }) {
  const requiredError = validateRequired({ definition, form });
  if (requiredError) return { data: null, error: requiredError };

  try {
    return {
      data: {
        p_appointment_id: appointmentId,
        p_field_config_version: definition?.version || 1,
        p_blood_pressure: cleanString(form.blood_pressure) || null,
        p_heart_rate: parseOptionalInteger(form.heart_rate, 'Heart rate', { min: 1, max: 300 }),
        p_temperature: parseOptionalDecimal(form.temperature, 'Temperature', { min: 20, max: 50 }),
        p_respiratory_rate: parseOptionalInteger(form.respiratory_rate, 'Respiratory rate', { min: 1, max: 80 }),
        p_weight: parseOptionalDecimal(form.weight, 'Weight', { min: 1, max: 1000 }),
        p_height: parseOptionalDecimal(form.height, 'Height', { min: 1, max: 300 }),
        p_allergies: cleanString(form.allergies) || null,
        p_current_medications: cleanString(form.current_medications) || null,
        p_symptoms: cleanString(form.symptoms) || null,
        p_is_urgent: Boolean(form.is_urgent),
        p_custom_answers: collectPatientFormCustomAnswers({ definition, form }),
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: getErrorMessage(error, 'Check-in form is invalid.') };
  }
}

export const patientCheckInService = {
  async getDefinition({ patientId = null, doctorId = null, visitTypeId = null } = {}) {
    return patientFormsService.getDefinition({
      context: PATIENT_FORM_CONTEXTS.checkIn,
      patientId,
      doctorId,
      visitTypeId,
    });
  },

  getInitialForm(definition) {
    const resolvedDefinition = definition || resolvePatientFormDefinition({ context: PATIENT_FORM_CONTEXTS.checkIn });
    return Object.fromEntries((resolvedDefinition.fields || []).map((field) => [field.key, '']));
  },

  async submit({ appointmentId, definition, form }) {
    if (!appointmentId) {
      return { data: null, error: 'Choose an appointment before check-in.' };
    }

    const args = buildCheckInRpcArgs({ appointmentId, definition, form });
    if (args.error) return args;

    const { data, error } = await supabase.rpc('submit_patient_check_in', args.data);
    if (error) {
      return {
        data: null,
        error: getErrorMessage(error, 'Unable to submit check-in.'),
      };
    }

    return { data, error: null };
  },
};
