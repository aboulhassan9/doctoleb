import { useState, useEffect, useCallback } from 'react';
import { clinicalService } from '@/services/clinical';
import { useToast } from '@/contexts/ToastContext';
import { logError } from '@/lib/logger';
import { normalizeEncounterScope } from './encounterScope';

/**
 * useEncounterPrescriptions — Manages prescriptions for a patient within encounter context.
 *
 * @param {string|{encounterId?: string|null, patientId?: string|null}|null} scope
 * @returns {{
 *   prescriptions: Array,
 *   loading: boolean,
 *   error: string|null,
 *   isSaving: boolean,
 *   addPrescription: (payload: object) => Promise<boolean>,
 *   refresh: () => Promise<void>,
 * }}
 */
export function useEncounterPrescriptions(scope) {
  const { encounterId, patientId } = normalizeEncounterScope(scope);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const fetch = useCallback(async () => {
    if (!encounterId && !patientId) {
      setLoading(false);
      setPrescriptions([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = encounterId
        ? await clinicalService.getPrescriptionsByEncounter(encounterId)
        : await clinicalService.getPrescriptions(patientId);
      if (result.error) throw new Error(result.error);

      setPrescriptions(result.data || []);
    } catch (err) {
      const msg = err?.message || 'Failed to load prescriptions';
      logError('useEncounterPrescriptions.fetch', err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [encounterId, patientId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addPrescription = useCallback(async (payload) => {
    try {
      setIsSaving(true);
      const { data, error: err } = await clinicalService.addPrescription(payload);
      if (err) throw new Error(err);

      showToast('Prescription added.', 'success');
      await fetch();
      return true;
    } catch (err) {
      const msg = err?.message || 'Failed to add prescription';
      logError('useEncounterPrescriptions.addPrescription', err);
      showToast(msg, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [fetch, showToast]);

  return { prescriptions, loading, error, isSaving, addPrescription, refresh: fetch };
}
