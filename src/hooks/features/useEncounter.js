import { useState, useEffect, useCallback, useRef } from 'react';
import { clinicalService } from '@/services/clinical';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { logError } from '@/lib/logger';

/**
 * useEncounter — Feature hook for the Doctor Encounter page.
 *
 * Loads an encounter by appointmentId (primary) or encounterId (direct resume).
 * Exposes lifecycle methods that call server RPCs — never raw status updates.
 *
 * @param {{ appointmentId?: string, encounterId?: string }} options
 * @returns {{
 *   encounter: object|null,
 *   patient: object|null,
 *   appointment: object|null,
 *   loading: boolean,
 *   error: string|null,
 *   isStarting: boolean,
 *   isCompleting: boolean,
 *   isCancelling: boolean,
 *   startEncounter: (chiefComplaint?: string) => Promise<boolean>,
 *   completeEncounter: (summary?: string) => Promise<boolean>,
 *   cancelEncounter: (reason?: string) => Promise<boolean>,
 *   refresh: () => Promise<void>,
 * }}
 */
export function useEncounter({ appointmentId, encounterId } = {}) {
  const [encounter, setEncounter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const { user } = useAuth();
  const { showToast } = useToast();
  const mountedRef = useRef(true);
  const encounterIdRef = useRef(null);
  const appointmentIdRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Keep refs in sync so lifecycle callbacks don't need the full encounter in deps.
  useEffect(() => {
    encounterIdRef.current = encounter?.id ?? null;
    appointmentIdRef.current = appointmentId || encounter?.appointment_id || encounter?.appointments?.id || null;
  }, [appointmentId, encounter?.id, encounter?.appointment_id, encounter?.appointments?.id]);

  const fetch = useCallback(async () => {
    if (!appointmentId && !encounterId) {
      setLoading(false);
      setError('No appointment or encounter ID provided.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let result;
      if (encounterId) {
        result = await clinicalService.getEncounterById(encounterId);
      } else {
        result = await clinicalService.getEncounterByAppointmentId(appointmentId);
      }

      if (result.error) throw new Error(result.error);
      if (mountedRef.current) {
        setEncounter(result.data || null);
      }
    } catch (err) {
      const msg = err?.message || 'Failed to load encounter';
      logError('useEncounter.fetch', err);
      if (mountedRef.current) {
        setError(msg);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [appointmentId, encounterId]);

  useEffect(() => { fetch(); }, [fetch]);

  const startEncounter = useCallback(async (chiefComplaint = null) => {
    const activeAppointmentId = appointmentIdRef.current;

    if (!activeAppointmentId) {
      showToast('Cannot start encounter without an appointment.', 'error');
      return false;
    }

    try {
      setIsStarting(true);
      const { data, error: err } = await clinicalService.startEncounter(activeAppointmentId, { chiefComplaint });
      if (err) throw new Error(err);

      showToast('Encounter started.', 'success');

      // The RPC returns the encounter row. Reload by ID so joined relations stay consistent.
      const encounterIdToReload = data?.id || data;
      if (encounterIdToReload) {
        const reload = await clinicalService.getEncounterById(encounterIdToReload);
        if (!reload.error && mountedRef.current) {
          setEncounter(reload.data);
        }
      } else {
        await fetch();
      }
      return true;
    } catch (err) {
      const msg = err?.message || 'Failed to start encounter';
      logError('useEncounter.startEncounter', err);
      showToast(msg, 'error');
      return false;
    } finally {
      if (mountedRef.current) setIsStarting(false);
    }
  }, [fetch, showToast]);

  const completeEncounter = useCallback(async (summary = null) => {
    const eid = encounterIdRef.current;
    if (!eid) {
      showToast('No active encounter to complete.', 'error');
      return false;
    }

    try {
      setIsCompleting(true);
      const { error: err } = await clinicalService.completeEncounter(eid, { summary });
      if (err) throw new Error(err);

      showToast('Encounter completed.', 'success');
      await fetch();
      return true;
    } catch (err) {
      const msg = err?.message || 'Failed to complete encounter';
      logError('useEncounter.completeEncounter', err);
      showToast(msg, 'error');
      return false;
    } finally {
      if (mountedRef.current) setIsCompleting(false);
    }
  }, [fetch, showToast]);

  const cancelEncounter = useCallback(async (reason = null) => {
    const eid = encounterIdRef.current;
    if (!eid) {
      showToast('No active encounter to cancel.', 'error');
      return false;
    }

    try {
      setIsCancelling(true);
      const { error: err } = await clinicalService.cancelEncounter(eid, { reason });
      if (err) throw new Error(err);

      showToast('Encounter cancelled.', 'success');
      await fetch();
      return true;
    } catch (err) {
      const msg = err?.message || 'Failed to cancel encounter';
      logError('useEncounter.cancelEncounter', err);
      showToast(msg, 'error');
      return false;
    } finally {
      if (mountedRef.current) setIsCancelling(false);
    }
  }, [fetch, showToast]);

  // Derived data from the encounter's joined relations
  const patient = encounter?.patients || null;
  const appointment = encounter?.appointments || null;

  return {
    encounter,
    patient,
    appointment,
    loading,
    error,
    isStarting,
    isCompleting,
    isCancelling,
    startEncounter,
    completeEncounter,
    cancelEncounter,
    refresh: fetch,
    user,
  };
}
