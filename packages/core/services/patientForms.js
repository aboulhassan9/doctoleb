import { supabase } from '../lib/supabase.js';
import {
  PATIENT_FORM_CONTEXTS,
  collectPatientFormCustomAnswers,
  resolvePatientFormDefinition,
} from '../schemas/index.js';

function getErrorMessage(error, fallback = 'Request failed') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  return error.message || fallback;
}

export const patientFormsService = {
  async getDefinition({
    context = PATIENT_FORM_CONTEXTS.appointmentBooking,
    patientId = null,
    doctorId = null,
    visitTypeId = null,
  } = {}) {
    const { data, error } = await supabase.rpc('get_patient_form_definition', {
      p_form_context: context,
      p_patient_id: patientId,
      p_doctor_id: doctorId,
      p_visit_type_id: visitTypeId,
    });

    if (error) {
      return {
        data: resolvePatientFormDefinition({ context }),
        error: null,
        configError: getErrorMessage(error, 'Unable to load patient form configuration.'),
      };
    }

    return {
      data: resolvePatientFormDefinition({ context, config: data }),
      error: null,
    };
  },

  async submitAppointmentAnswers({ appointmentId, definition, form }) {
    if (!appointmentId) {
      return { data: null, error: 'Appointment identity is required.' };
    }

    const { data, error } = await supabase.rpc('submit_patient_appointment_answers', {
      p_appointment_id: appointmentId,
      p_field_config_version: definition?.version || 1,
      p_custom_answers: collectPatientFormCustomAnswers({ definition, form }),
    });

    if (error) {
      return {
        data: null,
        error: getErrorMessage(error, 'Unable to save booking questions.'),
      };
    }

    return { data, error: null };
  },
};
