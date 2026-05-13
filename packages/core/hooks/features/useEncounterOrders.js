import { useState, useEffect, useCallback } from 'react';
import { clinicalService } from '@/services/clinical';
import { useToast } from '@/contexts/ToastContext';
import { logError } from '@/lib/logger';
import { normalizeEncounterScope } from './encounterScope';

/**
 * useEncounterOrders — Manages lab and imaging orders for a patient within encounter context.
 *
 * @param {string|{encounterId?: string|null, patientId?: string|null}|null} scope
 * @returns {{
 *   labOrders: Array,
 *   imagingOrders: Array,
 *   loading: boolean,
 *   error: string|null,
 *   isSaving: boolean,
 *   createOrder: (kind: 'lab'|'imaging', payload: object) => Promise<boolean>,
 *   refresh: () => Promise<void>,
 * }}
 */
export function useEncounterOrders(scope) {
  const { encounterId, patientId } = normalizeEncounterScope(scope);
  const [labOrders, setLabOrders] = useState([]);
  const [imagingOrders, setImagingOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const fetch = useCallback(async () => {
    if (!encounterId && !patientId) {
      setLoading(false);
      setLabOrders([]);
      setImagingOrders([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [labResult, imagingResult] = await Promise.all([
        encounterId
          ? clinicalService.getOrdersByEncounter('lab', encounterId)
          : clinicalService.getOrders('lab', patientId),
        encounterId
          ? clinicalService.getOrdersByEncounter('imaging', encounterId)
          : clinicalService.getOrders('imaging', patientId),
      ]);

      if (labResult.error) throw new Error(labResult.error);
      if (imagingResult.error) throw new Error(imagingResult.error);

      setLabOrders(labResult.data || []);
      setImagingOrders(imagingResult.data || []);
    } catch (err) {
      const msg = err?.message || 'Failed to load orders';
      logError('useEncounterOrders.fetch', err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [encounterId, patientId]);

  useEffect(() => { fetch(); }, [fetch]);

  const createOrder = useCallback(async (kind, payload) => {
    try {
      setIsSaving(true);
      const { data, error: err } = await clinicalService.createOrder(kind, payload);
      if (err) throw new Error(err);

      const label = kind === 'lab' ? 'Lab order' : 'Imaging order';
      showToast(`${label} created.`, 'success');
      await fetch();
      return true;
    } catch (err) {
      const msg = err?.message || 'Failed to create order';
      logError('useEncounterOrders.createOrder', err);
      showToast(msg, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [fetch, showToast]);

  return { labOrders, imagingOrders, loading, error, isSaving, createOrder, refresh: fetch };
}
