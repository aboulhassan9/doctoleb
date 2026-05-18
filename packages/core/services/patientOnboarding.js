import { supabase } from '../lib/supabase.js';
import { MEDICAL_INTAKE_SELECT_FIELDS } from '../lib/selects.js';
import {
  DEFAULT_PATIENT_ONBOARDING_DEFINITION,
  buildPatientOnboardingStatus,
  resolvePatientOnboardingDefinition,
} from '../lib/patientOnboarding.js';
import { patientSelfIntakeSchema, parseWithSchema } from '../schemas/index.js';
import { patientService } from './patients.js';

function getServiceErrorMessage(error, fallback = 'Request failed') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  return error.message || fallback;
}

export const patientOnboardingService = {
  async getDefinition({ patientId = null, doctorId = null } = {}) {
    if (!patientId && !doctorId) {
      return { data: DEFAULT_PATIENT_ONBOARDING_DEFINITION, error: null };
    }

    const { data, error } = await supabase.rpc('get_patient_onboarding_definition', {
      p_patient_id: patientId,
      p_doctor_id: doctorId,
    });

    if (error) {
      return {
        data: DEFAULT_PATIENT_ONBOARDING_DEFINITION,
        error: null,
        configError: getServiceErrorMessage(error, 'Unable to load patient onboarding configuration.'),
      };
    }

    return {
      data: resolvePatientOnboardingDefinition({ config: data }),
      error: null,
    };
  },

  async getReadiness({ userId = null, patientId = null } = {}) {
    if (!userId && !patientId) {
      return { data: null, error: 'Patient identity is required.' };
    }

    const patientResult = patientId
      ? await patientService.getById(patientId)
      : await patientService.getByUserId(userId);

    if (patientResult.error || !patientResult.data) {
      return {
        data: null,
        error: getServiceErrorMessage(patientResult.error, 'Unable to load patient profile.'),
      };
    }

    const patient = patientResult.data;
    const definitionResult = await this.getDefinition({ patientId: patient.id });
    const definition = definitionResult.data || DEFAULT_PATIENT_ONBOARDING_DEFINITION;
    const { data: intake, error: intakeError } = await supabase
      .from('medical_intake')
      .select(MEDICAL_INTAKE_SELECT_FIELDS)
      .eq('patient_id', patient.id)
      .maybeSingle();

    if (intakeError) {
      return {
        data: null,
        error: getServiceErrorMessage(intakeError, 'Unable to load patient intake status.'),
      };
    }

    return {
      data: {
        patient,
        intake: intake || null,
        definition,
        status: buildPatientOnboardingStatus({ patient, intake, definition }),
        configWarning: definitionResult.configError || null,
      },
      error: null,
    };
  },

  async submitSelfIntake(payload) {
    const { data, error: validationError } = parseWithSchema(patientSelfIntakeSchema, payload);
    if (validationError) return { data: null, error: validationError };

    const { data: intake, error } = await supabase.rpc('submit_patient_self_intake', {
      p_patient_id: data.patient_id,
      p_allergies_text: data.allergies_text,
      p_current_medications_text: data.current_medications_text,
      p_notes: data.notes,
      p_field_config_version: data.field_config_version,
      p_custom_answers: data.custom_answers,
    });

    if (error) {
      return {
        data: null,
        error: getServiceErrorMessage(error, 'Unable to save patient intake.'),
      };
    }

    return { data: intake, error: null };
  },

  async saveGuidedIntake({ userId, patientId, profile, intake }) {
    if (!userId || !patientId) {
      return { data: null, error: 'Patient identity is required.' };
    }

    const profileResult = await patientService.updateOwnProfile({
      userId,
      patientId,
      profile,
    });

    if (profileResult.error) {
      return {
        data: null,
        error: getServiceErrorMessage(profileResult.error, 'Unable to save patient profile.'),
      };
    }

    const intakeResult = await this.submitSelfIntake({
      patient_id: patientId,
      ...intake,
    });

    if (intakeResult.error) {
      const patient = profileResult.data || null;
      return {
        data: {
          patient,
          intake: null,
          status: buildPatientOnboardingStatus({ patient, intake: null }),
          partialSuccess: {
            profileSaved: Boolean(patient),
            intakeSaved: false,
          },
        },
        error: getServiceErrorMessage(intakeResult.error, 'Unable to save patient intake.'),
      };
    }

    return this.getReadiness({ userId, patientId });
  },
};
