import { supabase } from '../lib/supabase';
import { apiCall } from './api';

export const consultationService = {
  async getAll() {
    return apiCall(
      supabase
        .from('consultations')
        .select('*, appointments(*), doctors(*), patients(*)')
        .order('created_at', { ascending: false })
    );
  },

  async getById(id) {
    return apiCall(
      supabase
        .from('consultations')
        .select('*, appointments(*), doctors(*), patients(*)')
        .eq('id', id)
        .single()
    );
  },

  async getByDoctorId(doctorId) {
    return apiCall(
      supabase
        .from('consultations')
        .select('*, appointments(*), doctors(id, user_id), patients(id, user_id, users(first_name, last_name))')
        .eq('doctor_id', doctorId)
        .order('created_at', { ascending: false })
    );
  },

  async getByPatientId(patientId) {
    return apiCall(
      supabase
        .from('consultations')
        .select('*, appointments(*), doctors(id, user_id, users(first_name, last_name)), patients(id, user_id)')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
    );
  },

  async getByAppointmentId(appointmentId) {
    return apiCall(
      supabase
        .from('consultations')
        .select('*')
        .eq('appointment_id', appointmentId)
        .single()
    );
  },

  async getByStatus(status) {
    return apiCall(
      supabase
        .from('consultations')
        .select('*, appointments(*), doctors(*), patients(*)')
        .eq('status', status)
        .order('created_at', { ascending: false })
    );
  },

  async create(data) {
    return apiCall(
      supabase
        .from('consultations')
        .insert([{ ...data, status: 'in-progress', session_start: new Date().toISOString() }])
        .select()
    );
  },

  async update(id, data) {
    return apiCall(
      supabase
        .from('consultations')
        .update(data)
        .eq('id', id)
        .select()
    );
  },

  async complete(id, data) {
    return apiCall(
      supabase
        .from('consultations')
        .update({ ...data, status: 'completed', session_end: new Date().toISOString() })
        .eq('id', id)
        .select()
    );
  },

  async addMedications(consultationId, medications) {
    return apiCall(
      supabase
        .from('consultations')
        .update({ medications })
        .eq('id', consultationId)
        .select()
    );
  },

  subscribeToConsultation(consultationId, callback) {
    return supabase
      .channel(`consultation:${consultationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'consultations', filter: `id=eq.${consultationId}` },
        payload => callback(payload)
      )
      .subscribe();
  },
};
