import { supabase } from '../lib/supabase';
import { apiCall } from './api';
import { REPORT_SELECT_FIELDS, DOCTOR_SELECT_FIELDS, PATIENT_SELECT_FIELDS, USER_CONTACT_FIELDS } from '../lib/selects';
import { paginateQuery } from '../lib/pagination';
import { parseWithSchema, reportCreateSchema, reportUpdateSchema } from '../schemas';

export const reportService = {
  async getAll(options = {}) {
    return apiCall(
      paginateQuery(
        supabase
          .from('medical_reports')
          .select(`${REPORT_SELECT_FIELDS}, doctors(${DOCTOR_SELECT_FIELDS}), patients(${PATIENT_SELECT_FIELDS})`, { count: 'exact' })
          .order('created_at', { ascending: false }),
        options
      )
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

  async getByPatientId(patientId, options = {}) {
    return apiCall(
      paginateQuery(
        supabase
          .from('medical_reports')
          .select(`${REPORT_SELECT_FIELDS}, doctors(id, user_id, users!doctors_user_id_fkey(${USER_CONTACT_FIELDS}))`, { count: 'exact' })
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false }),
        options
      )
    );
  },

  async getByDoctorId(doctorId, options = {}) {
    return apiCall(
      paginateQuery(
        supabase
          .from('medical_reports')
          .select(`${REPORT_SELECT_FIELDS}, patients(id, user_id, users!patients_user_id_fkey(${USER_CONTACT_FIELDS}))`, { count: 'exact' })
          .eq('doctor_id', doctorId)
          .order('created_at', { ascending: false }),
        options
      )
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

  async create(rawData) {
    const { data, error: validationError } = parseWithSchema(reportCreateSchema, rawData);
    if (validationError) return { data: null, count: null, error: validationError };

    return apiCall(
      supabase
        .from('medical_reports')
        .insert([data])
        .select(REPORT_SELECT_FIELDS)
    );
  },

  async update(id, rawData) {
    const { data, error: validationError } = parseWithSchema(reportUpdateSchema, rawData);
    if (validationError) return { data: null, count: null, error: validationError };

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
