import { useState, useEffect, useCallback } from 'react';
import { notificationCoreService } from '@/services/notificationCore';
import { useToast } from '@/contexts/ToastContext';
import { logError } from '@/lib/logger';

/**
 * useNotifications — Fetch, count, and manage notifications.
 *
 * Extracted from PreDoctorNotificationsPage.
 *
 * @param {{ userId?: string }} options
 * @returns {{ notifications: Array, unreadCount: number, loading: boolean, error: string|null, markRead: (id) => Promise, markAllRead: () => Promise, refresh: () => Promise }}
 */
export function useNotifications({ userId } = {}) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showToast } = useToast();

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const fetch = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const { data, error: err } = await notificationCoreService.getByUserId(userId);
      if (err) throw new Error(err.message || 'Failed to load notifications');
      setNotifications(data || []);
    } catch (err) {
      const msg = err?.message || 'Failed to load notifications';
      logError('useNotifications.fetch', err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetch(); }, [fetch]);

  const markRead = useCallback(async (id) => {
    try {
      await notificationCoreService.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      logError('useNotifications.markRead', err);
      showToast('Failed to mark as read', 'error');
    }
  }, [showToast]);

  const markAllRead = useCallback(async () => {
    try {
      await notificationCoreService.markAllAsRead(userId);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      showToast('All notifications marked as read', 'success');
    } catch (err) {
      logError('useNotifications.markAllRead', err);
      showToast('Failed to mark all as read', 'error');
    }
  }, [userId, showToast]);

  return { notifications, unreadCount, loading, error, markRead, markAllRead, refresh: fetch };
}
