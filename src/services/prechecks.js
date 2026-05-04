import { supabase } from '../lib/supabase';
import { apiCall } from './api';
import { parseWithSchema, precheckDraftSchema, precheckSubmitSchema } from '../schemas';

const PRECHECK_SELECT_FIELDS = [
  'id',
  'patient_id',
  'predoctor_id',
  'blood_pressure',
  'heart_rate',
  'temperature',
  'weight',
  'height',
  'current_medications',
  'allergies',
  'symptoms',
  'status',
  'submitted_at',
  'is_urgent',
  'created_at',
  'updated_at',
].join(', ');

function buildPrecheckPayload(data, status) {
  return {
    patient_id: data.patientId,
    predoctor_id: data.predoctorId || null,
    blood_pressure: data.bloodPressure,
    heart_rate: data.heartRate,
    temperature: data.temperature,
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
  async getByPatientId(patientId) {
    return apiCall(
      supabase
        .from('precheck_forms')
        .select(PRECHECK_SELECT_FIELDS)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
    );
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
