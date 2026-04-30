import { supabase } from '../lib/supabase';
import { apiCall } from './api';

export const doctorService = {
  async getAll() {
    return apiCall(
      supabase
        .from('doctors')
        .select('id, user_id, department, specialization, license_number, bio, consultation_fee, users(id, email, first_name, last_name, phone, initials)')
        .order('created_at', { ascending: false })
    );
  },

  async getById(id) {
    return apiCall(
      supabase
        .from('doctors')
        .select('*, users(*)')
        .eq('id', id)
        .single()
    );
  },

  async getByUserId(userId) {
    return apiCall(
      supabase
        .from('doctors')
        .select('*, users(*)')
        .eq('user_id', userId)
        .single()
    );
  },

  async getByDepartment(department) {
    return apiCall(
      supabase
        .from('doctors')
        .select('id, user_id, department, specialization, license_number, bio, consultation_fee, users(id, email, first_name, last_name, phone, initials)')
        .eq('department', department)
    );
  },

  async create(data) {
    return apiCall(
      supabase
        .from('doctors')
        .insert([data])
        .select('*, users(*)')
    );
  },

  async update(id, data) {
    return apiCall(
      supabase
        .from('doctors')
        .update(data)
        .eq('id', id)
        .select('*, users(*)')
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
        .select('*')
        .eq('doctor_id', doctorId)
        .order('issue_date', { ascending: false })
    );
  },
};
