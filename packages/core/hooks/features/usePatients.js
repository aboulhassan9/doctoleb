import { useState, useEffect, useCallback } from 'react';
import { patientService } from '@/services/patients';
import { useToast } from '@/contexts/ToastContext';
import { logError } from '@/lib/logger';

/**
 * usePatients — Fetch and search patients.
 *
 * Extracted from DoctorPatientsPage, PatientsPage, PreDoctorPatientsPage.
 *
 * @returns {{ patients: Array, loading: boolean, error: string|null, refresh: () => Promise<void> }}
 */
export function usePatients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showToast } = useToast();

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: err } = await patientService.getAll();
      if (err) {
        const msg = err.message || 'Failed to load patients';
        setError(msg);
        showToast(msg, 'error');
      } else {
        setPatients(data || []);
      }
    } catch (err) {
      const msg = err?.message || 'An error occurred loading patients';
      logError('usePatients.fetch', err);
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetch(); }, [fetch]);

  return { patients, loading, error, refresh: fetch };
}
