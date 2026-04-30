import { supabase } from '../lib/supabase';
import { apiCall } from './api';

export const appointmentService = {
  async getAll() {
    return apiCall(
      supabase
        .from('appointments')
        .select('*, doctors(id, user_id), patients(id, user_id, users(first_name, last_name, initials))')
        .order('scheduled_at', { ascending: true })
    );
  },

  async getById(id) {
    return apiCall(
      supabase
        .from('appointments')
        .select('*, doctors(id, user_id), patients(id, user_id, date_of_birth, sex, blood_type, allergies, medical_history, users(first_name, last_name, initials))')
        .eq('id', id)
        .single()
    );
  },

  async getByDoctorId(doctorId) {
    return apiCall(
      supabase
        .from('appointments')
        .select('*, doctors(id, user_id), patients(id, user_id, users(first_name, last_name, phone, initials))')
        .eq('doctor_id', doctorId)
        .order('scheduled_at', { ascending: true })
    );
  },

  async getByPatientId(patientId) {
    return apiCall(
      supabase
        .from('appointments')
        .select('*, doctors(id, user_id, users(first_name, last_name, department)), patients(id, user_id)')
        .eq('patient_id', patientId)
        .order('scheduled_at', { ascending: true })
    );
  },

  async getByStatus(status) {
    return apiCall(
      supabase
        .from('appointments')
        .select('*, doctors(*), patients(*)')
        .eq('status', status)
        .order('scheduled_at', { ascending: true })
    );
  },

  async getUpcoming() {
    return apiCall(
      supabase
        .from('appointments')
        .select('*, doctors(id, user_id, users(first_name, last_name, department)), patients(id, user_id, users(first_name, last_name))')
        .eq('status', 'scheduled')
        .gt('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
    );
  },

  async create(data) {
    return apiCall(
      supabase
        .from('appointments')
        .insert([{ ...data, status: 'scheduled' }])
        .select()
    );
  },

  async delete(id) {
    return apiCall(
      supabase
        .from('appointments')
        .delete()
        .eq('id', id)
    );
  },

  async checkAvailability(doctorId, date) {
    // date should be an ISO string or a Date object representing the day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('appointments')
      .select('scheduled_at')
      .eq('doctor_id', doctorId)
      .not('status', 'eq', 'cancelled')
      .gte('scheduled_at', startOfDay.toISOString())
      .lte('scheduled_at', endOfDay.toISOString());

    if (error) {
      console.error('Error checking availability:', error);
      return { data: null, error };
    }

    return { data, error: null };
  },

  async update(id, data) {
    return apiCall(
      supabase
        .from('appointments')
        .update(data)
        .eq('id', id)
        .select()
    );
  },

  async cancel(id, reason = null) {
    return apiCall(
      supabase
        .from('appointments')
        .update({ status: 'cancelled', notes: reason })
        .eq('id', id)
        .select()
    );
  },

  async markCompleted(id) {
    return apiCall(
      supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', id)
        .select()
    );
  },

  subscribeToAppointments(doctorId, callback) {
    if (doctorId) {
      return supabase
        .channel(`appointments:doctor_id=eq.${doctorId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `doctor_id=eq.${doctorId}` }, payload => callback(payload))
        .subscribe();
    } else {
      return supabase
        .channel('appointments_all')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, payload => callback(payload))
        .subscribe();
    }
  },
};
