import { supabase } from '../lib/supabase';
import { apiCall } from './api';

export const notificationService = {
  async getAll(userId) {
    return apiCall(
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    );
  },

  async getUnread(userId) {
    return apiCall(
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
    );
  },

  async getById(id) {
    return apiCall(
      supabase
        .from('notifications')
        .select('*')
        .eq('id', id)
        .single()
    );
  },

  async create(data) {
    return apiCall(
      supabase
        .from('notifications')
        .insert([{ ...data, is_read: false }])
        .select()
    );
  },

  async markAsRead(id) {
    return apiCall(
      supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .select()
    );
  },

  async markAllAsRead(userId) {
    return apiCall(
      supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)
    );
  },

  async markAllRead(userId) {
    return this.markAllAsRead(userId);
  },

  async delete(id) {
    return apiCall(
      supabase
        .from('notifications')
        .delete()
        .eq('id', id)
    );
  },

  subscribeToUserNotifications(userId, callback) {
    return supabase
      .channel(`notifications:user_id=eq.${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, payload => {
        callback(payload);
      })
      .subscribe();
  },

  subscribeToNotifications(callback) {
    return supabase
      .channel('notifications_all')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => callback(payload))
      .subscribe();
  },

  async sendAppointmentNotification(userId, appointmentData) {
    return this.create({
      user_id: userId,
      title: 'Appointment Scheduled',
      message: `Appointment scheduled for ${appointmentData.scheduled_at}`,
      type: 'appointment',
      related_id: appointmentData.id,
    });
  },

  async sendConsultationNotification(userId, consultationData) {
    return this.create({
      user_id: userId,
      title: 'Consultation Started',
      message: 'A new consultation has been started',
      type: 'consultation',
      related_id: consultationData.id,
    });
  },

  async notifyRole(role, { title, message, type, related_id = null }) {
    try {
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('role', role)
        .eq('is_active', true);
      if (userError) {
        return { data: null, error: userError.message };
      }
      if (!users?.length) return { data: [], error: null };

      const rows = users.map(u => ({
        user_id: u.id,
        title,
        message,
        type,
        related_id,
        is_read: false,
      }));

      const { data, error } = await supabase.from('notifications').insert(rows).select();
      return { data, error: error?.message || null };
    } catch (err) {
      console.error('notifyRole error:', err);
      return { data: null, error: err.message || 'Failed to notify role' };
    }
  },

  async sendReferralNotification(userId, referralData) {
    return this.create({
      user_id: userId,
      title: 'New Referral',
      message: 'You have received a new patient referral',
      type: 'referral',
      related_id: referralData.id,
    });
  },
};
