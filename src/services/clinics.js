import { supabase } from '../lib/supabase';
import { apiCall } from './api';
import { APPOINTMENT_SELECT_FIELDS, DOCTOR_SELECT_FIELDS } from '../lib/selects';

// Unified clinic service — handles both CRUD (multi-clinic) and single-clinic operations
export const clinicService = {
  // ─── Multi-clinic CRUD ───────────────────────────────────────────────────────

  async getAll() {
    return apiCall(
      supabase.from('clinics').select('*').order('name', { ascending: true })
    );
  },

  async getById(id) {
    return apiCall(
      supabase.from('clinics').select('*').eq('id', id).single()
    );
  },

  async create(data) {
    return apiCall(
      supabase.from('clinics').insert([data]).select().single()
    );
  },

  async update(id, data) {
    return apiCall(
      supabase.from('clinics').update(data).eq('id', id).select().single()
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
      supabase.from('clinic_settings').select('*').single()
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
        supabase.from('clinic_settings').insert([data]).select().single()
      );
    }

    return apiCall(
      supabase.from('clinic_settings').update(data).eq('id', existing.id).select().single()
    );
  },

  // Get dashboard overview (uses DB view)
  async getDashboardSummary() {
    return apiCall(
      supabase.from('doctor_dashboard_summary').select('*').single()
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

  // Get available time slots (hours 8–16) for a doctor on a given date
  async getAvailableTimeSlots(date, doctorId) {
    const { data: appointments } = await supabase
      .from('appointments')
      .select('scheduled_at, duration_minutes')
      .eq('doctor_id', doctorId)
      .gte('scheduled_at', new Date(date).toISOString())
      .lt('scheduled_at', new Date(new Date(date).getTime() + 86_400_000).toISOString())
      .eq('status', 'scheduled');

    const allSlots   = Array.from({ length: 9 }, (_, i) => i + 8); // 8,9,...,16
    const bookedHrs  = appointments?.map(a => new Date(a.scheduled_at).getHours()) ?? [];

    return {
      data:  allSlots.filter(h => !bookedHrs.includes(h)),
      error: null,
    };
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
        .select()
    );
  },
};
