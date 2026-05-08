import { supabase } from '@/lib/supabase';
import { apiCall, apiPaged } from './api';
import {
  APPOINTMENT_SELECT_FIELDS,
  CLINIC_SELECT_FIELDS,
} from '@/lib/selects';
import { archiveMutationSchema, clinicSchema, parseWithSchema } from '@/schemas';

const clinicArchiveSchema = archiveMutationSchema.partial();

// Unified practice-location service. Branding/config belongs to tenantConfigService.
export const clinicService = {
  // ─── Multi-clinic CRUD ───────────────────────────────────────────────────────

  async getAll({ page = 1, pageSize = 100, includeArchived = false } = {}) {
    let query = supabase
      .from('clinics')
      .select(CLINIC_SELECT_FIELDS, { count: 'exact' });

    if (!includeArchived) query = query.eq('is_archived', false);
    query = query.order('name', { ascending: true });

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

  async archive(id, archivedBy = null) {
    const { data: archivePayload, error: validationError } = parseWithSchema(
      clinicArchiveSchema,
      archivedBy === null || archivedBy === undefined ? {} : { archivedBy }
    );
    if (validationError) return { data: null, error: validationError };

    const result = await apiCall(
      supabase
        .from('clinics')
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: archivePayload.archivedBy ?? null,
        })
        .eq('id', id)
        .eq('is_archived', false)
        .select(CLINIC_SELECT_FIELDS)
        .maybeSingle()
    );

    if (result.error || result.data) return result;

    return clinicService.getById(id);
  },

  async delete(id, archivedBy = null) {
    return clinicService.archive(id, archivedBy);
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
