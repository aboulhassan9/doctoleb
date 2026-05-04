import { supabase } from '../lib/supabase';
import { apiCall } from './api';
import { REFERRAL_SELECT_FIELDS, USER_CONTACT_FIELDS } from '../lib/selects';

export const referralService = {
  async getAll() {
    return apiCall(
      supabase
        .from('referrals')
        .select(REFERRAL_SELECT_FIELDS)
        .order('created_at', { ascending: false })
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
        .select(`${REFERRAL_SELECT_FIELDS}, to_doctor:to_doctor_id(id, user_id, users(${USER_CONTACT_FIELDS})), patient:patient_id(id, user_id, users(${USER_CONTACT_FIELDS}))`)
        .eq('from_doctor_id', doctorId)
        .order('created_at', { ascending: false })
    );
  },

  async getReceived(doctorId) {
    return apiCall(
      supabase
        .from('referrals')
        .select(`${REFERRAL_SELECT_FIELDS}, from_doctor:from_doctor_id(id, user_id, users(${USER_CONTACT_FIELDS})), patient:patient_id(id, user_id, users(${USER_CONTACT_FIELDS}))`)
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

  async create(data) {
    return apiCall(
      supabase
        .from('referrals')
        .insert([{ ...data, status: 'pending' }])
        .select(REFERRAL_SELECT_FIELDS)
    );
  },

  async update(id, data) {
    return apiCall(
      supabase
        .from('referrals')
        .update(data)
        .eq('id', id)
        .select(REFERRAL_SELECT_FIELDS)
    );
  },

  async accept(id) {
    return apiCall(
      supabase
        .from('referrals')
        .update({ status: 'accepted' })
        .eq('id', id)
        .select(REFERRAL_SELECT_FIELDS)
    );
  },

  async reject(id) {
    return apiCall(
      supabase
        .from('referrals')
        .update({ status: 'rejected' })
        .eq('id', id)
        .select(REFERRAL_SELECT_FIELDS)
    );
  },

  async complete(id) {
    return apiCall(
      supabase
        .from('referrals')
        .update({ status: 'completed' })
        .eq('id', id)
        .select(REFERRAL_SELECT_FIELDS)
    );
  },
};
