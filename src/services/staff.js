import { supabase } from '@/lib/supabase';
import { STAFF_MEMBER_SELECT_FIELDS } from '@/lib/selects';
import { parseWithSchema, staffMemberSchema } from '@/schemas';
import { apiCall, apiPaged } from './api';

function validationError(error) {
  return { data: null, error };
}

function parse(schema, payload) {
  const result = parseWithSchema(schema, payload);
  if (result.error) return { error: result.error };
  return { data: result.data };
}

export const staffService = {
  async getAll({ activeOnly = true, page = 1, pageSize = 100 } = {}) {
    let query = supabase
      .from('staff_members')
      .select(STAFF_MEMBER_SELECT_FIELDS, { count: 'exact' })
      .order('display_name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    return apiPaged(query, { page, pageSize });
  },

  async getByDoctorId(doctorId, { activeOnly = true, page = 1, pageSize = 100 } = {}) {
    let query = supabase
      .from('staff_members')
      .select(STAFF_MEMBER_SELECT_FIELDS, { count: 'exact' })
      .eq('doctor_id', doctorId)
      .order('display_name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    return apiPaged(query, { page, pageSize });
  },

  async getById(id) {
    return apiCall(
      supabase
        .from('staff_members')
        .select(STAFF_MEMBER_SELECT_FIELDS)
        .eq('id', id)
        .single()
    );
  },

  async create(payload) {
    const parsed = parse(staffMemberSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('staff_members')
        .insert([parsed.data])
        .select(STAFF_MEMBER_SELECT_FIELDS)
        .single()
    );
  },

  async update(id, payload) {
    const parsed = parse(staffMemberSchema.partial(), payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('staff_members')
        .update(parsed.data)
        .eq('id', id)
        .select(STAFF_MEMBER_SELECT_FIELDS)
        .single()
    );
  },

  async deactivate(id) {
    return this.update(id, {
      is_active: false,
      invite_status: 'disabled',
    });
  },
};
