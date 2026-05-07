import { useState, useEffect, useCallback } from 'react';
import { documentService } from '@/services/documents';
import { useToast } from '@/contexts/ToastContext';
import { logError } from '@/lib/logger';

/**
 * useReferrals — Fetch and manage referrals.
 *
 * @param {{ doctorId?: string }} options
 * @returns {{ referrals: Array, loading: boolean, error: string|null, refresh: () => Promise, updateStatus: (id, status) => Promise }}
 */
export function useReferrals({ doctorId } = {}) {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showToast } = useToast();

  const fetch = useCallback(async () => {
    if (!doctorId) return;
    try {
      setLoading(true);
      setError(null);
      const { data, error: err } = await documentService.getByDoctorId(doctorId, { documentType: 'referral' });
      if (err) throw new Error(err.message || 'Failed to load referrals');
      setReferrals(data || []);
    } catch (err) {
      const msg = err?.message || 'Failed to load referrals';
      logError('useReferrals.fetch', err);
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [doctorId, showToast]);

  useEffect(() => { fetch(); }, [fetch]);

  const updateStatus = useCallback(async (id, newStatus) => {
    try {
      const { error: err } = newStatus === 'void'
        ? await documentService.void(id, { reason: 'Referral voided from UI.' })
        : await documentService.finalize(id);
      if (err) throw new Error(err.message || 'Failed to update referral');
      setReferrals(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
      showToast('Referral updated', 'success');
    } catch (err) {
      logError('useReferrals.updateStatus', err);
      showToast(err?.message || 'Failed to update', 'error');
    }
  }, [showToast]);

  return { referrals, loading, error, refresh: fetch, updateStatus };
}
