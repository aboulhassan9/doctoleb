import { supabase } from '../lib/supabase';
import { apiCall } from './api';
import {
  APPOINTMENT_SELECT_FIELDS,
  CLINIC_SELECT_FIELDS,
  CLINIC_SETTINGS_SELECT_FIELDS,
  DOCTOR_DASHBOARD_SUMMARY_FIELDS,
  DOCTOR_SELECT_FIELDS,
  REPORT_SELECT_FIELDS,
} from '../lib/selects';

// Unified clinic service — handles both CRUD (multi-clinic) and single-clinic operations
export const clinicService = {
  // ─── Multi-clinic CRUD ───────────────────────────────────────────────────────

  async getAll() {
    return apiCall(
      supabase.from('clinics').select(CLINIC_SELECT_FIELDS).order('name', { ascending: true })
    );
  },

  async getById(id) {
    return apiCall(
      supabase.from('clinics').select(CLINIC_SELECT_FIELDS).eq('id', id).single()
    );
  },

  async create(data) {
    return apiCall(
      supabase.from('clinics').insert([data]).select(CLINIC_SELECT_FIELDS).single()
    );
  },

  async update(id, data) {
    return apiCall(
      supabase.from('clinics').update(data).eq('id', id).select(CLINIC_SELECT_FIELDS).single()
    );
  },

  async delete(id) {
    return apiCall(
      supabase.from('clinics').delete().eq('id', id)
    );
  },

  // ─── Single-clinic operations ─────────────────────────────────────────────────

  // Get the main doctor (clinic owner — first created doctor)
  async getMainDoctor() {
    return apiCall(
      supabase
        .from('doctors')
        .select(DOCTOR_SELECT_FIELDS)
        .order('created_at', { ascending: true })
        .limit(1)
        .single()
    );
  },

  // Get clinic settings
  async getClinicSettings() {
    return apiCall(
      supabase.from('clinic_settings').select(CLINIC_SETTINGS_SELECT_FIELDS).single()
    );
  },

  // Update clinic settings
  async updateClinicSettings(data) {
    const { data: existing, error } = await supabase
      .from('clinic_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message || 'Failed to load clinic settings' };
    }

    if (!existing?.id) {
      return apiCall(
        supabase.from('clinic_settings').insert([data]).select(CLINIC_SETTINGS_SELECT_FIELDS).single()
      );
    }

    return apiCall(
      supabase.from('clinic_settings').update(data).eq('id', existing.id).select(CLINIC_SETTINGS_SELECT_FIELDS).single()
    );
  },

  // Get dashboard overview (uses DB view)
  async getDashboardSummary() {
    return apiCall(
      supabase.from('doctor_dashboard_summary').select(DOCTOR_DASHBOARD_SUMMARY_FIELDS).single()
    );
  },

  // Get today's scheduled appointments
  async getTodaysAppointments() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    return apiCall(
      supabase
        .from('appointments')
        .select(APPOINTMENT_SELECT_FIELDS)
        .gte('scheduled_at', startOfDay)
        .lt('scheduled_at', endOfDay)
        .in('status', ['scheduled', 'confirmed', 'pre_check', 'in_consultation'])
        .order('scheduled_at', { ascending: true })
    );
  },

  // Request a lab test (creates a medical_report record)
  async requestLabTest(patientId, testType, reason, doctorId) {
    return apiCall(
      supabase
        .from('medical_reports')
        .insert([{
          patient_id:  patientId,
          doctor_id:   doctorId,
          report_type: 'Lab Request',
          title:       testType,
          content:     reason,
        }])
        .select(REPORT_SELECT_FIELDS)
    );
  },
};
