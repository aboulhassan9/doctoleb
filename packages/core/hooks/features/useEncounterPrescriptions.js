import { useState, useEffect, useCallback } from 'react';
import { clinicalService } from '@/services/clinical';
import { medicationCatalogService } from '@core/services/medicationCatalog';
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
      const { data: created, error: err } = await clinicalService.addPrescription(payload);
      if (err) throw new Error(err);

      showToast('Prescription added.', 'success');

      // Background catalog grow-on-use. The primary save is already
      // persisted; any failure here must NEVER bubble up to the doctor.
      //
      // Two-stage flow:
      //   1. Mint (or look up) the medication_catalog row for the typed
      //      name via the SECURITY DEFINER upsert RPC.
      //   2. Back-link the just-saved prescription to that catalog row id
      //      so the next renderer pass / report query can resolve through
      //      the FK instead of a fuzzy name match.
      //
      // Both stages are best-effort. The envelope is read explicitly (not
      // .catch-swallowed) so silent failures are observable in the frontend
      // log buffer.
      void (async () => {
        if (!payload.medication_name || payload.medication_catalog_id || !created?.id) return;
        try {
          const { data: catalogId, error: upErr } =
            await medicationCatalogService.upsertIfMissing(payload.medication_name);
          if (upErr) {
            logError('useEncounterPrescriptions.catalogGrow', new Error(upErr));
            return;
          }
          if (!catalogId) return;

          const { error: linkErr } = await clinicalService.updatePrescription(
            created.id,
            { medication_catalog_id: catalogId },
          );
          if (linkErr) {
            logError('useEncounterPrescriptions.backLink', new Error(linkErr));
          }
        } catch (innerErr) {
          logError('useEncounterPrescriptions.catalogGrow', innerErr);
        }
      })();

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
