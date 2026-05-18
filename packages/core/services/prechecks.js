import { supabase } from '../lib/supabase.js';
import { apiCall, apiPaged } from './api.js';
import { PRECHECK_SELECT_FIELDS } from '../lib/selects.js';
import { assertTransition } from '../lib/stateMachines.js';
import { parseWithSchema, precheckDraftSchema, precheckSubmitSchema } from '../schemas/index.js';

function buildPrecheckPayload(data, status) {
  return {
    patient_id: data.patientId,
    predoctor_id: data.predoctorId || null,
    blood_pressure: data.bloodPressure,
    heart_rate: data.heartRate,
    temperature: data.temperature,
    respiratory_rate: data.respiratoryRate ?? null,
    weight: data.weight,
    height: data.height,
    current_medications: data.currentMedications,
    allergies: data.allergies,
    symptoms: data.symptoms,
    is_urgent: data.isUrgent || false,
    status,
    submitted_at: status === 'submitted' ? new Date().toISOString() : null,
  };
}

export const precheckService = {
  async getByPatientId(patientId, options = {}) {
    const query = supabase
      .from('precheck_forms')
      .select(PRECHECK_SELECT_FIELDS, { count: 'exact' })
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    return apiPaged(query, options);
  },

  async getById(id) {
    return apiCall(
      supabase
        .from('precheck_forms')
        .select(PRECHECK_SELECT_FIELDS)
        .eq('id', id)
        .single()
    );
  },

  async updateDraft(id, payload) {
    const { data, error } = parseWithSchema(precheckDraftSchema, payload);
    if (error) {
      return { data: null, error };
    }

    const { data: current, error: currentError } = await this.getById(id);
    if (currentError || !current) return { data: null, error: currentError || 'Pre-check form not found' };

    try {
      assertTransition('precheck', current.status, 'draft');
    } catch (transitionError) {
      return { data: null, error: transitionError.message };
    }

    return apiCall(
      supabase
        .from('precheck_forms')
        .update(buildPrecheckPayload(data, 'draft'))
        .eq('id', id)
        .select(PRECHECK_SELECT_FIELDS)
        .single()
    );
  },

  async saveDraft(payload) {
    const { data, error } = parseWithSchema(precheckDraftSchema, payload);
    if (error) {
      return { data: null, error };
    }

    return apiCall(
      supabase
        .from('precheck_forms')
        .insert([buildPrecheckPayload(data, 'draft')])
        .select(PRECHECK_SELECT_FIELDS)
        .single()
    );
  },

  async submit(payload) {
    const { data, error } = parseWithSchema(precheckSubmitSchema, payload);
    if (error) {
      return { data: null, error };
    }

    return apiCall(
      supabase
        .from('precheck_forms')
        .insert([buildPrecheckPayload(data, 'submitted')])
        .select(PRECHECK_SELECT_FIELDS)
        .single()
    );
  },
};
