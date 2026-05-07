import { useState, useEffect, useCallback } from 'react';
import { clinicalService } from '@/services/clinical';
import { useToast } from '@/contexts/ToastContext';
import { logError } from '@/lib/logger';

/**
 * useDoctorEncounterTimeline — Loads paginated encounter history for a patient.
 *
 * @param {string|null} patientId
 * @param {{ page?: number, pageSize?: number }} options
 * @returns {{
 *   encounters: Array,
 *   loading: boolean,
 *   error: string|null,
 *   meta: object,
 *   refresh: () => Promise<void>,
 * }}
 */
export function useDoctorEncounterTimeline(patientId, { page = 1, pageSize = 10 } = {}) {
  const [encounters, setEncounters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState({ pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } });
  const { showToast } = useToast();

  const fetch = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await clinicalService.getEncountersByPatient(patientId, { page, pageSize });
      if (result.error) throw new Error(result.error);

      setEncounters(result.data || []);
      if (result.meta) setMeta(result.meta);
    } catch (err) {
      const msg = err?.message || 'Failed to load encounter history';
      logError('useDoctorEncounterTimeline.fetch', err);
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [patientId, page, pageSize, showToast]);

  useEffect(() => { fetch(); }, [fetch]);

  return { encounters, loading, error, meta, refresh: fetch };
}
