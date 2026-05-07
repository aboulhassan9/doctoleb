import { supabase } from '@/lib/supabase';
import { apiCall, apiPaged } from './api';
import {
  APPOINTMENT_SELECT_FIELDS,
  CLINIC_SELECT_FIELDS,
} from '@/lib/selects';
import { clinicSchema, parseWithSchema } from '@/schemas';

// Unified practice-location service. Branding/config belongs to tenantConfigService.
export const clinicService = {
  // ─── Multi-clinic CRUD ───────────────────────────────────────────────────────

  async getAll({ page = 1, pageSize = 100 } = {}) {
    const query = supabase
      .from('clinics')
      .select(CLINIC_SELECT_FIELDS, { count: 'exact' })
      .order('name', { ascending: true });

    return apiPaged(query, { page, pageSize });
  },

  async getById(id) {
    return apiCall(
      supabase.from('clinics').select(CLINIC_SELECT_FIELDS).eq('id', id).single()
    );
  },

  async create(data) {
    const { data: clinic, error: validationError } = parseWithSchema(clinicSchema, data);
    if (validationError) return { data: null, error: validationError };

    return apiCall(
      supabase.from('clinics').insert([clinic]).select(CLINIC_SELECT_FIELDS).single()
    );
  },

  async update(id, data) {
    const { data: updates, error: validationError } = parseWithSchema(clinicSchema.partial(), data);
    if (validationError) return { data: null, error: validationError };

    return apiCall(
      supabase.from('clinics').update(updates).eq('id', id).select(CLINIC_SELECT_FIELDS).single()
    );
  },

  async delete(id) {
    return apiCall(
      supabase.from('clinics').delete().eq('id', id)
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

};
