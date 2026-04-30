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
        .insert([{ ...data, is_read: false, created_at: new Date().toISOString() }])
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

  async notifyRole(role, { title, message, type, related_id = null, related_type = null }) {
    try {
      const { data: users } = await supabase.from('users').select('id').eq('role', role).eq('is_active', true);
      if (!users?.length) return;
      const rows = users.map(u => ({
        user_id: u.id, title, message, type,
        related_id, related_type,
        is_read: false,
        created_at: new Date().toISOString(),
      }));
      await supabase.from('notifications').insert(rows);
    } catch (err) {
      console.error('notifyRole error:', err);
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
