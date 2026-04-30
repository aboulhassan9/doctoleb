import { supabase } from '../lib/supabase';
import { apiCall } from './api';

export const reportService = {
  async getAll() {
    return apiCall(
      supabase
        .from('medical_reports')
        .select('*, doctors(*), patients(*)')
        .order('created_at', { ascending: false })
    );
  },

  async getById(id) {
    return apiCall(
      supabase
        .from('medical_reports')
        .select('*, doctors(*), patients(*)')
        .eq('id', id)
        .single()
    );
  },

  async getByPatientId(patientId) {
    return apiCall(
      supabase
        .from('medical_reports')
        .select('*, doctors(id, user_id, users(first_name, last_name))')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
    );
  },

  async getByDoctorId(doctorId) {
    return apiCall(
      supabase
        .from('medical_reports')
        .select('*, patients(id, user_id, users(first_name, last_name))')
        .eq('doctor_id', doctorId)
        .order('created_at', { ascending: false })
    );
  },

  async getByType(reportType) {
    return apiCall(
      supabase
        .from('medical_reports')
        .select('*')
        .eq('report_type', reportType)
        .order('created_at', { ascending: false })
    );
  },

  async create(data) {
    return apiCall(
      supabase
        .from('medical_reports')
        .insert([data])
        .select()
    );
  },

  async update(id, data) {
    return apiCall(
      supabase
        .from('medical_reports')
        .update(data)
        .eq('id', id)
        .select()
    );
  },

  async delete(id) {
    return apiCall(
      supabase
        .from('medical_reports')
        .delete()
        .eq('id', id)
    );
  },

  async getReportTypes() {
    return ['Lab Test', 'Imaging', 'EKG', 'Blood Work', 'X-Ray', 'MRI', 'Ultrasound', 'Other'];
  },
};
