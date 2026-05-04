import { supabase } from '../lib/supabase';
import { apiCall } from './api';
import { REPORT_SELECT_FIELDS, DOCTOR_SELECT_FIELDS, PATIENT_SELECT_FIELDS, USER_CONTACT_FIELDS } from '../lib/selects';

export const reportService = {
  async getAll() {
    return apiCall(
      supabase
        .from('medical_reports')
        .select(`${REPORT_SELECT_FIELDS}, doctors(${DOCTOR_SELECT_FIELDS}), patients(${PATIENT_SELECT_FIELDS})`)
        .order('created_at', { ascending: false })
    );
  },

  async getById(id) {
    return apiCall(
      supabase
        .from('medical_reports')
        .select(`${REPORT_SELECT_FIELDS}, doctors(${DOCTOR_SELECT_FIELDS}), patients(${PATIENT_SELECT_FIELDS})`)
        .eq('id', id)
        .single()
    );
  },

  async getByPatientId(patientId) {
    return apiCall(
      supabase
        .from('medical_reports')
        .select(`${REPORT_SELECT_FIELDS}, doctors(id, user_id, users(${USER_CONTACT_FIELDS}))`)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
    );
  },

  async getByDoctorId(doctorId) {
    return apiCall(
      supabase
        .from('medical_reports')
        .select(`${REPORT_SELECT_FIELDS}, patients(id, user_id, users(${USER_CONTACT_FIELDS}))`)
        .eq('doctor_id', doctorId)
        .order('created_at', { ascending: false })
    );
  },

  async getByType(reportType) {
    return apiCall(
      supabase
        .from('medical_reports')
        .select(REPORT_SELECT_FIELDS)
        .eq('report_type', reportType)
        .order('created_at', { ascending: false })
    );
  },

  async create(data) {
    return apiCall(
      supabase
        .from('medical_reports')
        .insert([data])
        .select(REPORT_SELECT_FIELDS)
    );
  },

  async update(id, data) {
    return apiCall(
      supabase
        .from('medical_reports')
        .update(data)
        .eq('id', id)
        .select(REPORT_SELECT_FIELDS)
    );
  },

  // RULE 1: Medical data is sacred — use soft-delete
  async archive(id, archivedBy) {
    return apiCall(
      supabase
        .from('medical_reports')
        .update({ is_archived: true, archived_at: new Date().toISOString(), archived_by: archivedBy })
        .eq('id', id)
        .select(REPORT_SELECT_FIELDS)
    );
  },

  async getReportTypes() {
    return ['Lab Test', 'Imaging', 'EKG', 'Blood Work', 'X-Ray', 'MRI', 'Ultrasound', 'Other'];
  },
};
