import { useState, useEffect, useCallback } from 'react';
import { clinicalService } from '@/services/clinical';
import { useToast } from '@/contexts/ToastContext';
import { logError } from '@/lib/logger';
import { normalizeEncounterScope } from './encounterScope';

/**
 * useEncounterCareTasks — Manages care tasks for a patient within encounter context.
 *
 * @param {string|{encounterId?: string|null, patientId?: string|null}|null} scope
 * @returns {{
 *   tasks: Array,
 *   loading: boolean,
 *   error: string|null,
 *   isSaving: boolean,
 *   createTask: (payload: object) => Promise<boolean>,
 *   updateTask: (id: string, payload: object) => Promise<boolean>,
 *   refresh: () => Promise<void>,
 * }}
 */
export function useEncounterCareTasks(scope) {
  const { encounterId, patientId } = normalizeEncounterScope(scope);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const fetch = useCallback(async () => {
    if (!encounterId && !patientId) {
      setLoading(false);
      setTasks([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = encounterId
        ? await clinicalService.getCareTasksByEncounter(encounterId)
        : await clinicalService.getCareTasks({ patientId });
      if (result.error) throw new Error(result.error);

      setTasks(result.data || []);
    } catch (err) {
      const msg = err?.message || 'Failed to load care tasks';
      logError('useEncounterCareTasks.fetch', err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [encounterId, patientId]);

  useEffect(() => { fetch(); }, [fetch]);

  const createTask = useCallback(async (payload) => {
    try {
      setIsSaving(true);
      const { data, error: err } = await clinicalService.createCareTask(payload);
      if (err) throw new Error(err);

      showToast('Care task created.', 'success');
      await fetch();
      return true;
    } catch (err) {
      const msg = err?.message || 'Failed to create care task';
      logError('useEncounterCareTasks.createTask', err);
      showToast(msg, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [fetch, showToast]);

  const updateTask = useCallback(async (id, payload) => {
    try {
      setIsSaving(true);
      const { status, ...rest } = payload || {};
      const { error: err } = status
        ? await clinicalService.transitionCareTask(id, status, rest)
        : await clinicalService.updateCareTask(id, payload);
      if (err) throw new Error(err);

      showToast('Care task updated.', 'success');
      await fetch();
      return true;
    } catch (err) {
      const msg = err?.message || 'Failed to update care task';
      logError('useEncounterCareTasks.updateTask', err);
      showToast(msg, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [fetch, showToast]);

  return { tasks, loading, error, isSaving, createTask, updateTask, refresh: fetch };
}
