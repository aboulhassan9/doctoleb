import { supabase } from '../lib/supabase';
import { apiCall } from './api';

export const certificateService = {
  async getAll() {
    return apiCall(
      supabase
        .from('certificates')
        .select('*, doctors(*), patients(*)')
        .order('created_at', { ascending: false })
    );
  },

  async getById(id) {
    return apiCall(
      supabase
        .from('certificates')
        .select('*, doctors(*), patients(*)')
        .eq('id', id)
        .single()
    );
  },

  async getByPatientId(patientId) {
    return apiCall(
      supabase
        .from('certificates')
        .select('*, doctors(id, user_id, users(first_name, last_name))')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
    );
  },

  async getByDoctorId(doctorId) {
    return apiCall(
      supabase
        .from('certificates')
        .select('*, patients(id, user_id, users(first_name, last_name))')
        .eq('doctor_id', doctorId)
        .order('created_at', { ascending: false })
    );
  },

  async create(data) {
    return apiCall(
      supabase
        .from('certificates')
        .insert([data])
        .select()
    );
  },

  async update(id, data) {
    return apiCall(
      supabase
        .from('certificates')
        .update(data)
        .eq('id', id)
        .select()
    );
  },

  async delete(id) {
    return apiCall(
      supabase
        .from('certificates')
        .delete()
        .eq('id', id)
    );
  },
};
