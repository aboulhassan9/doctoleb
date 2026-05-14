import { supabase } from '../lib/supabase.js';
import { validationError, parse } from '../lib/serviceHelpers.js';
import {
  NOTIFICATION_DELIVERY_SELECT_FIELDS,
  NOTIFICATION_EVENT_SELECT_FIELDS,
  PATIENT_DEVICE_SELECT_FIELDS,
  REMINDER_RULE_SELECT_FIELDS,
} from '../lib/selects.js';
import {
  notificationDeliverySchema,
  notificationDeliveryUpdateSchema,
  notificationEventSchema,
  patientDeviceSchema,
} from '../schemas/index.js';
import { apiCall, apiPaged } from './api.js';

const INBOX_DELIVERY_SELECT_FIELDS = [
  NOTIFICATION_DELIVERY_SELECT_FIELDS,
  `notification_events(${NOTIFICATION_EVENT_SELECT_FIELDS})`,
].join(', ');

function toInboxNotification(delivery) {
  const event = delivery?.notification_events || delivery || {};

  return {
    id: delivery.id,
    delivery_id: delivery.id,
    event_id: event.id,
    user_id: delivery.user_id ?? event.user_id,
    patient_id: event.patient_id,
    title: event.title,
    message: event.body,
    body: event.body,
    type: event.event_type,
    event_type: event.event_type,
    severity: event.severity,
    related_type: event.related_type,
    related_id: event.related_id,
    is_read: delivery.status === 'read',
    status: delivery.status,
    created_at: event.created_at ?? delivery.created_at,
    updated_at: delivery.updated_at,
  };
}

export const notificationCoreService = {
  async registerDevice(payload) {
    const parsed = parse(patientDeviceSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('patient_devices')
        .upsert(parsed.data, { onConflict: 'push_token' })
        .select(PATIENT_DEVICE_SELECT_FIELDS)
        .single()
    );
  },

  async deactivateDevice(pushToken) {
    return apiCall(
      supabase
        .from('patient_devices')
        .update({ is_active: false })
        .eq('push_token', pushToken)
        .select(PATIENT_DEVICE_SELECT_FIELDS)
        .single()
    );
  },

  async getDevices(patientId, { page = 1, pageSize = 25 } = {}) {
    const query = supabase
      .from('patient_devices')
      .select(PATIENT_DEVICE_SELECT_FIELDS, { count: 'exact' })
      .eq('patient_id', patientId)
      .order('last_seen_at', { ascending: false, nullsFirst: false });

    return apiPaged(query, { page, pageSize });
  },

  async createEvent(payload) {
    const parsed = parse(notificationEventSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('notification_events')
        .insert([parsed.data])
        .select(NOTIFICATION_EVENT_SELECT_FIELDS)
        .single()
    );
  },

  async getEvents({ userId = null, patientId = null, status = null, limit = null, page = 1, pageSize = 50 } = {}) {
    let query = supabase
      .from('notification_events')
      .select(NOTIFICATION_EVENT_SELECT_FIELDS, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (userId) query = query.eq('user_id', userId);
    if (patientId) query = query.eq('patient_id', patientId);
    if (status) query = query.eq('status', status);

    return apiPaged(query, { page, pageSize: limit ?? pageSize });
  },

  async getInbox(userId, { unreadOnly = false, page = 1, pageSize = 50 } = {}) {
    let query = supabase
      .from('notification_deliveries')
      .select(INBOX_DELIVERY_SELECT_FIELDS, { count: 'exact' })
      .eq('user_id', userId)
      .eq('channel', 'in_app')
      .order('created_at', { ascending: false });

    if (unreadOnly) {
      query = query.neq('status', 'read');
    }

    const result = await apiPaged(query, { page, pageSize });
    return {
      ...result,
      data: result.data.map(toInboxNotification),
    };
  },

  async getAll(userId, options = {}) {
    return this.getInbox(userId, options);
  },

  async getByUserId(userId, options = {}) {
    return this.getInbox(userId, options);
  },

  async getUnread(userId, options = {}) {
    return this.getInbox(userId, { ...options, unreadOnly: true });
  },

  async createDelivery(payload) {
    const parsed = parse(notificationDeliverySchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('notification_deliveries')
        .insert([parsed.data])
        .select(NOTIFICATION_DELIVERY_SELECT_FIELDS)
        .single()
    );
  },

  async updateDelivery(id, payload) {
    const parsed = parse(notificationDeliveryUpdateSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('notification_deliveries')
        .update(parsed.data)
        .eq('id', id)
        .select(NOTIFICATION_DELIVERY_SELECT_FIELDS)
        .single()
    );
  },

  async markAsRead(deliveryId) {
    return this.updateDelivery(deliveryId, {
      status: 'read',
      read_at: new Date().toISOString(),
    });
  },

  async markAllAsRead(userId) {
    return apiCall(
      supabase
        .from('notification_deliveries')
        .update({ status: 'read', read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('channel', 'in_app')
        .neq('status', 'read')
    );
  },

  async notifyRole(role, { title, message, body, type = 'system', related_id = null, related_type = null, severity = 'info' }) {
    return apiCall(
      supabase.rpc('notify_role_event', {
        p_role: role,
        p_title: title,
        p_body: body || message,
        p_event_type: type,
        p_related_type: related_type,
        p_related_id: related_id,
        p_severity: severity,
      })
    );
  },

  async getDeliveries(eventId, { page = 1, pageSize = 50 } = {}) {
    const query = supabase
      .from('notification_deliveries')
      .select(NOTIFICATION_DELIVERY_SELECT_FIELDS, { count: 'exact' })
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    return apiPaged(query, { page, pageSize });
  },

  async getReminderRules({ activeOnly = true } = {}) {
    let query = supabase
      .from('reminder_rules')
      .select(REMINDER_RULE_SELECT_FIELDS)
      .order('related_type', { ascending: true })
      .order('offset_minutes', { ascending: true });

    if (activeOnly) query = query.eq('is_active', true);

    return apiCall(query);
  },

  subscribeToEvents(userId, callback) {
    return supabase
      .channel(`notification-events:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_events',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();
  },

  subscribeToUserNotifications(userId, callback) {
    return this.subscribeToDeliveries(userId, callback);
  },

  subscribeToNotifications(callback) {
    return supabase
      .channel('notification-events-all')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_events',
        },
        callback
      )
      .subscribe();
  },

  subscribeToDeliveries(userId, callback) {
    return supabase
      .channel(`notification-deliveries:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_deliveries',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();
  },
};
