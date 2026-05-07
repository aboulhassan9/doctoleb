import { useState, useEffect, useCallback } from 'react';
import { clinicalService } from '@/services/clinical';
import { useToast } from '@/contexts/ToastContext';
import { logError } from '@/lib/logger';
import { normalizeEncounterScope } from './encounterScope';

/**
 * useEncounterDiagnoses — Manages diagnoses for a patient within encounter context.
 *
 * @param {string|{encounterId?: string|null, patientId?: string|null}|null} scope
 * @returns {{
 *   diagnoses: Array,
 *   loading: boolean,
 *   error: string|null,
 *   isSaving: boolean,
 *   addDiagnosis: (payload: object) => Promise<boolean>,
 *   refresh: () => Promise<void>,
 * }}
 */
export function useEncounterDiagnoses(scope) {
  const { encounterId, patientId } = normalizeEncounterScope(scope);
  const [diagnoses, setDiagnoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const fetch = useCallback(async () => {
    if (!encounterId && !patientId) {
      setLoading(false);
      setDiagnoses([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = encounterId
        ? await clinicalService.getDiagnosesByEncounter(encounterId)
        : await clinicalService.getDiagnoses(patientId);
      if (result.error) throw new Error(result.error);

      setDiagnoses(result.data || []);
    } catch (err) {
      const msg = err?.message || 'Failed to load diagnoses';
      logError('useEncounterDiagnoses.fetch', err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [encounterId, patientId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addDiagnosis = useCallback(async (payload) => {
    try {
      setIsSaving(true);
      const { data, error: err } = await clinicalService.addDiagnosis(payload);
      if (err) throw new Error(err);

      showToast('Diagnosis recorded.', 'success');
      await fetch();
      return true;
    } catch (err) {
      const msg = err?.message || 'Failed to record diagnosis';
      logError('useEncounterDiagnoses.addDiagnosis', err);
      showToast(msg, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [fetch, showToast]);

  return { diagnoses, loading, error, isSaving, addDiagnosis, refresh: fetch };
}
