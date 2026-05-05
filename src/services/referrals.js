import { supabase } from '../lib/supabase';
import { apiCall } from './api';
import { REFERRAL_SELECT_FIELDS, USER_CONTACT_FIELDS } from '../lib/selects';
import { paginateQuery } from '../lib/pagination';
import { assertTransition } from '../lib/stateMachines';
import { parseWithSchema, referralCreateSchema } from '../schemas';

function compactPayload(payload) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function buildReferralPayload(data = {}, options = {}) {
  const { defaultStatus = null } = options;
  return compactPayload({
    patient_id: data.patient_id,
    from_doctor_id: data.from_doctor_id,
    to_doctor_id: data.to_doctor_id,
    reason: data.reason,
    status: data.status || defaultStatus,
  });
}

export const referralService = {
  async getAll(options = {}) {
    return apiCall(
      paginateQuery(
        supabase
          .from('referrals')
          .select(REFERRAL_SELECT_FIELDS, { count: 'exact' })
          .order('created_at', { ascending: false }),
        options
      )
    );
  },

  async getById(id) {
    return apiCall(
      supabase
        .from('referrals')
        .select(REFERRAL_SELECT_FIELDS)
        .eq('id', id)
        .single()
    );
  },

  async getSent(doctorId) {
    return apiCall(
      supabase
        .from('referrals')
        .select(`${REFERRAL_SELECT_FIELDS}, to_doctor:to_doctor_id(id, user_id, users!doctors_user_id_fkey(${USER_CONTACT_FIELDS})), patient:patient_id(id, user_id, users!patients_user_id_fkey(${USER_CONTACT_FIELDS}))`)
        .eq('from_doctor_id', doctorId)
        .order('created_at', { ascending: false })
    );
  },

  async getReceived(doctorId) {
    return apiCall(
      supabase
        .from('referrals')
        .select(`${REFERRAL_SELECT_FIELDS}, from_doctor:from_doctor_id(id, user_id, users!doctors_user_id_fkey(${USER_CONTACT_FIELDS})), patient:patient_id(id, user_id, users!patients_user_id_fkey(${USER_CONTACT_FIELDS}))`)
        .eq('to_doctor_id', doctorId)
        .order('created_at', { ascending: false })
    );
  },

  async getByStatus(status) {
    return apiCall(
      supabase
        .from('referrals')
        .select(REFERRAL_SELECT_FIELDS)
        .eq('status', status)
        .order('created_at', { ascending: false })
    );
  },

  async create(rawData) {
    const { data, error: validationError } = parseWithSchema(referralCreateSchema, rawData);
    if (validationError) return { data: null, count: null, error: validationError };

    if (!data?.to_doctor_id) {
      return { data: null, error: 'Please select a receiving doctor for this referral.' };
    }

    return apiCall(
      supabase
        .from('referrals')
        .insert([buildReferralPayload(data, { defaultStatus: 'pending' })])
        .select(REFERRAL_SELECT_FIELDS)
    );
  },

  async update(id, data) {
    if (data?.status) {
      const { data: current, error } = await this.getById(id);
      if (error || !current) return { data: null, count: null, error: error || 'Referral not found' };

      try {
        assertTransition('referral', current.status, data.status);
      } catch (transitionError) {
        return { data: null, count: null, error: transitionError.message };
      }
    }

    return apiCall(
      supabase
        .from('referrals')
        .update(buildReferralPayload(data))
        .eq('id', id)
        .select(REFERRAL_SELECT_FIELDS)
    );
  },

  async accept(id) {
    const { data: current, error } = await this.getById(id);
    if (error || !current) return { data: null, count: null, error: error || 'Referral not found' };

    try {
      assertTransition('referral', current.status, 'accepted');
    } catch (transitionError) {
      return { data: null, count: null, error: transitionError.message };
    }

    return apiCall(
      supabase
        .from('referrals')
        .update({ status: 'accepted' })
        .eq('id', id)
        .select(REFERRAL_SELECT_FIELDS)
    );
  },

  async reject(id) {
    const { data: current, error } = await this.getById(id);
    if (error || !current) return { data: null, count: null, error: error || 'Referral not found' };

    try {
      assertTransition('referral', current.status, 'rejected');
    } catch (transitionError) {
      return { data: null, count: null, error: transitionError.message };
    }

    return apiCall(
      supabase
        .from('referrals')
        .update({ status: 'rejected' })
        .eq('id', id)
        .select(REFERRAL_SELECT_FIELDS)
    );
  },

  async complete(id) {
    const { data: current, error } = await this.getById(id);
    if (error || !current) return { data: null, count: null, error: error || 'Referral not found' };

    try {
      assertTransition('referral', current.status, 'completed');
    } catch (transitionError) {
      return { data: null, count: null, error: transitionError.message };
    }

    return apiCall(
      supabase
        .from('referrals')
        .update({ status: 'completed' })
        .eq('id', id)
        .select(REFERRAL_SELECT_FIELDS)
    );
  },
};
