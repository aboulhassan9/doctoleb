import { useState, useEffect, useCallback } from 'react';
import { documentService } from '@/services/documents';
import { useToast } from '@/contexts/ToastContext';
import { logError } from '@/lib/logger';

/**
 * useCertificates — Fetch and manage medical certificates.
 *
 * @returns {{ certificates: Array, loading: boolean, error: string|null, refresh: () => Promise }}
 */
export function useCertificates() {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showToast } = useToast();

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: err } = await documentService.getAll({ documentType: 'certificate' });
      if (err) throw new Error(err.message || 'Failed to load certificates');
      setCertificates(data || []);
    } catch (err) {
      const msg = err?.message || 'Failed to load certificates';
      logError('useCertificates.fetch', err);
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetch(); }, [fetch]);

  return { certificates, loading, error, refresh: fetch };
}
