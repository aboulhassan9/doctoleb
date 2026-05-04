import { supabase } from '../lib/supabase';
import { apiCall } from './api';
import {
  CONSULTATION_SELECT_FIELDS,
  CONSULTATION_WITH_RELATIONS,
  DOCTOR_SELECT_FIELDS,
  PATIENT_SELECT_FIELDS,
  APPOINTMENT_BASE_FIELDS,
} from '../lib/selects';

export const consultationService = {
  async getAll() {
    return apiCall(
      supabase
        .from('consultations')
        .select(CONSULTATION_WITH_RELATIONS)
        .order('created_at', { ascending: false })
    );
  },

  async getById(id) {
    return apiCall(
      supabase
        .from('consultations')
        .select(CONSULTATION_WITH_RELATIONS)
        .eq('id', id)
        .single()
    );
  },

  async getByDoctorId(doctorId) {
    return apiCall(
      supabase
        .from('consultations')
        .select(`${CONSULTATION_SELECT_FIELDS}, doctors(id, user_id), patients(${PATIENT_SELECT_FIELDS})`)
        .eq('doctor_id', doctorId)
        .order('created_at', { ascending: false })
    );
  },

  async getByPatientId(patientId) {
    return apiCall(
      supabase
        .from('consultations')
        .select(`${CONSULTATION_SELECT_FIELDS}, doctors(${DOCTOR_SELECT_FIELDS}), patients(id, user_id)`)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
    );
  },

  async getByAppointmentId(appointmentId) {
    return apiCall(
      supabase
        .from('consultations')
        .select(CONSULTATION_SELECT_FIELDS)
        .eq('appointment_id', appointmentId)
        .single()
    );
  },

  async getByStatus(status) {
    return apiCall(
      supabase
        .from('consultations')
        .select(CONSULTATION_WITH_RELATIONS)
        .eq('status', status)
        .order('created_at', { ascending: false })
    );
  },

  async create(data) {
    return apiCall(
      supabase
        .from('consultations')
        .insert([{ ...data, status: 'in_progress', session_start: new Date().toISOString() }])
        .select(CONSULTATION_SELECT_FIELDS)
    );
  },

  async update(id, data) {
    return apiCall(
      supabase
        .from('consultations')
        .update(data)
        .eq('id', id)
        .select(CONSULTATION_SELECT_FIELDS)
    );
  },

  async complete(id, data) {
    return apiCall(
      supabase
        .from('consultations')
        .update({ ...data, status: 'completed', session_end: new Date().toISOString() })
        .eq('id', id)
        .select(CONSULTATION_SELECT_FIELDS)
    );
  },

  async addMedications(consultationId, medications) {
    return apiCall(
      supabase
        .from('consultations')
        .update({ medications })
        .eq('id', consultationId)
        .select(CONSULTATION_SELECT_FIELDS)
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
