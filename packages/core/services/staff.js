import { supabase } from '@/lib/supabase';
import { STAFF_MEMBER_SELECT_FIELDS } from '@/lib/selects';
import {
  staffInviteReissueSchema,
  staffInviteSchema,
  staffInviteResendSchema,
  staffMemberDisableSchema,
  staffMemberReactivateSchema,
  staffMemberUpdateSchema,
} from '@/schemas';
import { apiCall, apiPaged } from './api';

import { validationError, parse } from '@/lib/serviceHelpers';

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

  async invite(payload) {
    const parsed = parse(staffInviteSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    const { data, error } = await supabase.functions.invoke('staff-invite', {
      body: parsed.data,
    });

    if (error) {
      return { data: null, error: error.message || 'Failed to invite staff member.' };
    }

    if (data?.error) {
      return { data: null, error: data.error };
    }

    return { data: data?.data || null, error: null };
  },

  async update(id, payload) {
    const parsed = parse(staffMemberUpdateSchema, payload);
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
    const parsed = parse(staffMemberDisableSchema, {
      staff_member_id: id,
    });
    if (parsed.error) return validationError(parsed.error);

    const { data, error } = await supabase.functions.invoke('staff-member-disable', {
      body: parsed.data,
    });

    if (error) {
      return { data: null, error: error.message || 'Failed to disable staff member.' };
    }

    if (data?.error) {
      return { data: null, error: data.error };
    }

    return { data: data?.data || null, error: null };
  },

  async resendInvite(id, clientRequestId) {
    const parsed = parse(staffInviteResendSchema, {
      staff_member_id: id,
      client_request_id: clientRequestId,
    });
    if (parsed.error) return validationError(parsed.error);

    const { data, error } = await supabase.functions.invoke('staff-invite-resend', {
      body: parsed.data,
    });

    if (error) {
      return { data: null, error: error.message || 'Failed to resend staff invite.' };
    }

    if (data?.error) {
      return { data: null, error: data.error };
    }

    return { data: data?.data || null, error: null };
  },

  async reissueInvite(id, clientRequestId) {
    const parsed = parse(staffInviteReissueSchema, {
      staff_member_id: id,
      client_request_id: clientRequestId,
    });
    if (parsed.error) return validationError(parsed.error);

    const { data, error } = await supabase.functions.invoke('staff-invite-reissue', {
      body: parsed.data,
    });

    if (error) {
      return { data: null, error: error.message || 'Failed to reissue staff invite.' };
    }

    if (data?.error) {
      return { data: null, error: data.error };
    }

    return { data: data?.data || null, error: null };
  },

  async reactivate(id) {
    const parsed = parse(staffMemberReactivateSchema, {
      staff_member_id: id,
    });
    if (parsed.error) return validationError(parsed.error);

    const { data, error } = await supabase.functions.invoke('staff-member-reactivate', {
      body: parsed.data,
    });

    if (error) {
      return { data: null, error: error.message || 'Failed to reactivate staff member.' };
    }

    if (data?.error) {
      return { data: null, error: data.error };
    }

    return { data: data?.data || null, error: null };
  },
};
