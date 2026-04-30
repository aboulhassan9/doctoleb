import { supabase } from '../lib/supabase';
import { apiCall } from './api';

export const referralService = {
  async getAll() {
    return apiCall(
      supabase
        .from('referrals')
        .select('*')
        .order('created_at', { ascending: false })
    );
  },

  async getById(id) {
    return apiCall(
      supabase
        .from('referrals')
        .select('*')
        .eq('id', id)
        .single()
    );
  },

  async getSent(doctorId) {
    return apiCall(
      supabase
        .from('referrals')
        .select('*, to_doctor:to_doctor_id(id, user_id, users(first_name, last_name)), patient:patient_id(id, user_id, users(first_name, last_name))')
        .eq('from_doctor_id', doctorId)
        .order('created_at', { ascending: false })
    );
  },

  async getReceived(doctorId) {
    return apiCall(
      supabase
        .from('referrals')
        .select('*, from_doctor:from_doctor_id(id, user_id, users(first_name, last_name)), patient:patient_id(id, user_id, users(first_name, last_name))')
        .eq('to_doctor_id', doctorId)
        .order('created_at', { ascending: false })
    );
  },

  async getByStatus(status) {
    return apiCall(
      supabase
        .from('referrals')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false })
    );
  },

  async create(data) {
    return apiCall(
      supabase
        .from('referrals')
        .insert([{ ...data, status: 'pending' }])
        .select()
    );
  },

  async update(id, data) {
    return apiCall(
      supabase
        .from('referrals')
        .update(data)
        .eq('id', id)
        .select()
    );
  },

  async accept(id) {
    return apiCall(
      supabase
        .from('referrals')
        .update({ status: 'accepted' })
        .eq('id', id)
        .select()
    );
  },

  async reject(id) {
    return apiCall(
      supabase
        .from('referrals')
        .update({ status: 'rejected' })
        .eq('id', id)
        .select()
    );
  },

  async complete(id) {
    return apiCall(
      supabase
        .from('referrals')
        .update({ status: 'completed' })
        .eq('id', id)
        .select()
    );
  },
};
