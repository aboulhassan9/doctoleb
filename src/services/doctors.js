import { supabase } from '../lib/supabase';
import { apiCall } from './api';
import { DOCTOR_SELECT_FIELDS } from '../lib/selects';

export const doctorService = {
  async getAll() {
    return apiCall(
      supabase
        .from('doctors')
        .select(DOCTOR_SELECT_FIELDS)
        .order('created_at', { ascending: false })
    );
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

  /** Get the first doctor in the system (v1: single-doctor clinic) */
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

  async getByDepartment(department) {
    return apiCall(
      supabase
        .from('doctors')
        .select(DOCTOR_SELECT_FIELDS)
        .eq('department', department)
    );
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
    const { data } = await apiCall(
      supabase
        .from('appointments')
        .select('patient_id', { count: 'exact' })
        .eq('doctor_id', doctorId)
        .eq('status', 'completed')
    );
    return { data, error: null };
  },

  async getUpcomingAppointmentCount(doctorId) {
    const { data } = await apiCall(
      supabase
        .from('appointments')
        .select('id', { count: 'exact' })
        .eq('doctor_id', doctorId)
        .eq('status', 'scheduled')
        .gt('scheduled_at', new Date().toISOString())
    );
    return { data, error: null };
  },

  async getCertificates(doctorId) {
    return apiCall(
      supabase
        .from('certificates')
        .select('id, doctor_id, patient_id, certificate_type, title, content, issue_date, created_at')
        .eq('doctor_id', doctorId)
        .order('issue_date', { ascending: false })
    );
  },
};
