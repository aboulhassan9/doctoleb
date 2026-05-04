import { supabase } from '../lib/supabase';
import { apiCall } from './api';
import { CERTIFICATE_SELECT_FIELDS, DOCTOR_SELECT_FIELDS, PATIENT_SELECT_FIELDS, USER_CONTACT_FIELDS } from '../lib/selects';

export const certificateService = {
  async getAll() {
    return apiCall(
      supabase
        .from('certificates')
        .select(`${CERTIFICATE_SELECT_FIELDS}, doctors(${DOCTOR_SELECT_FIELDS}), patients(${PATIENT_SELECT_FIELDS})`)
        .order('created_at', { ascending: false })
    );
  },

  async getById(id) {
    return apiCall(
      supabase
        .from('certificates')
        .select(`${CERTIFICATE_SELECT_FIELDS}, doctors(${DOCTOR_SELECT_FIELDS}), patients(${PATIENT_SELECT_FIELDS})`)
        .eq('id', id)
        .single()
    );
  },

  async getByPatientId(patientId) {
    return apiCall(
      supabase
        .from('certificates')
        .select(`${CERTIFICATE_SELECT_FIELDS}, doctors(id, user_id, users(${USER_CONTACT_FIELDS}))`)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
    );
  },

  async getByDoctorId(doctorId) {
    return apiCall(
      supabase
        .from('certificates')
        .select(`${CERTIFICATE_SELECT_FIELDS}, patients(id, user_id, users(${USER_CONTACT_FIELDS}))`)
        .eq('doctor_id', doctorId)
        .order('created_at', { ascending: false })
    );
  },

  async create(data) {
    return apiCall(
      supabase
        .from('certificates')
        .insert([data])
        .select(CERTIFICATE_SELECT_FIELDS)
    );
  },

  async update(id, data) {
    return apiCall(
      supabase
        .from('certificates')
        .update(data)
        .eq('id', id)
        .select(CERTIFICATE_SELECT_FIELDS)
    );
  },

  // RULE 1: Medical data is sacred — use soft-delete
  async archive(id, archivedBy) {
    return apiCall(
      supabase
        .from('certificates')
        .update({ is_archived: true, archived_at: new Date().toISOString(), archived_by: archivedBy })
        .eq('id', id)
        .select(CERTIFICATE_SELECT_FIELDS)
    );
  },
};
