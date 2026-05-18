import { supabase } from '../lib/supabase.js';
import { apiCall, apiPaged } from './api.js';
import { CLINICAL_DOCUMENT_SELECT_FIELDS, DOCTOR_SELECT_FIELDS } from '../lib/selects.js';

export const doctorService = {
  async getAll(options = {}) {
    const query = supabase
      .from('doctors')
      .select(DOCTOR_SELECT_FIELDS, { count: 'exact' })
      .order('created_at', { ascending: false });

    return apiPaged(query, options);
  },

  async getById(id) {
    return apiCall(
      supabase
        .from('doctors')
        .select(DOCTOR_SELECT_FIELDS)
        .eq('id', id)
        .single()
    );
  },

  async getByUserId(userId) {
    return apiCall(
      supabase
        .from('doctors')
        .select(DOCTOR_SELECT_FIELDS)
        .eq('user_id', userId)
        .single()
    );
  },

  /** Temporary fallback for legacy screens; V1 supports multiple doctors in one clinic. */
  async getFirst() {
    return apiCall(
      supabase
        .from('doctors')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1)
        .single()
    );
  },

  async getByDepartment(department, options = {}) {
    const query = supabase
      .from('doctors')
      .select(DOCTOR_SELECT_FIELDS, { count: 'exact' })
      .eq('department', department)
      .order('created_at', { ascending: false });

    return apiPaged(query, options);
  },

  async create(data) {
    return apiCall(
      supabase
        .from('doctors')
        .insert([data])
        .select(DOCTOR_SELECT_FIELDS)
    );
  },

  async update(id, data) {
    return apiCall(
      supabase
        .from('doctors')
        .update(data)
        .eq('id', id)
        .select(DOCTOR_SELECT_FIELDS)
    );
  },

  async getPatientCount(doctorId) {
    const { count, error } = await supabase
      .from('appointments')
      .select('patient_id', { count: 'exact', head: true })
      .eq('doctor_id', doctorId)
      .eq('status', 'completed');

    return { data: count ?? 0, error: error?.message || null };
  },

  async getUpcomingAppointmentCount(doctorId) {
    const { count, error } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('doctor_id', doctorId)
      .eq('status', 'scheduled')
      .gt('scheduled_at', new Date().toISOString());

    return { data: count ?? 0, error: error?.message || null };
  },

  async getCertificates(doctorId, options = {}) {
    const query = supabase
      .from('clinical_documents')
      .select(CLINICAL_DOCUMENT_SELECT_FIELDS, { count: 'exact' })
      .eq('doctor_id', doctorId)
      .eq('document_type', 'certificate')
      .order('created_at', { ascending: false });

    return apiPaged(query, options);
  },
};
