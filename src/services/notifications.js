import { supabase } from '../lib/supabase';
import { apiCall } from './api';
import { NOTIFICATION_SELECT_FIELDS } from '../lib/selects';
import { paginateQuery } from '../lib/pagination';

export const notificationService = {
  async getAll(userId, options = {}) {
    return apiCall(
      paginateQuery(
        supabase
          .from('notifications')
          .select(NOTIFICATION_SELECT_FIELDS, { count: 'exact' })
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        options
      )
    );
  },

  async getUnread(userId, options = {}) {
    return apiCall(
      paginateQuery(
        supabase
          .from('notifications')
          .select(NOTIFICATION_SELECT_FIELDS, { count: 'exact' })
          .eq('user_id', userId)
          .eq('is_read', false)
          .order('created_at', { ascending: false }),
        options
      )
    );
  },

  async getById(id) {
    return apiCall(
      supabase
        .from('notifications')
        .select(NOTIFICATION_SELECT_FIELDS)
        .eq('id', id)
        .single()
    );
  },

  async create(data) {
    return apiCall(
      supabase
        .from('notifications')
        .insert([{ ...data, is_read: false }])
        .select(NOTIFICATION_SELECT_FIELDS)
    );
  },

  async markAsRead(id) {
    return apiCall(
      supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .select(NOTIFICATION_SELECT_FIELDS)
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

  // Notifications are transient UI messages, so dismissal can hard-delete them.
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
    const { data: users, error: userError } = await apiCall(
      supabase
        .from('users')
        .select('id')
        .eq('role', role)
        .eq('is_active', true)
    );

    if (userError) {
      return { data: null, count: null, error: userError };
    }

    if (!users?.length) return { data: [], count: 0, error: null };

    const rows = users.map(u => ({
      user_id: u.id,
      title,
      message,
      type,
      related_id,
      is_read: false,
    }));

    return apiCall(
      supabase.from('notifications').insert(rows).select(NOTIFICATION_SELECT_FIELDS)
    );
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
