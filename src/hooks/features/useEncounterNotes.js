import { useState, useEffect, useCallback } from 'react';
import { clinicalService } from '@/services/clinical';
import { useToast } from '@/contexts/ToastContext';
import { logError } from '@/lib/logger';

/**
 * useEncounterNotes — Manages clinical notes for a single encounter.
 *
 * @param {string|null} encounterId
 * @returns {{
 *   notes: Array,
 *   loading: boolean,
 *   error: string|null,
 *   isSaving: boolean,
 *   addNote: (payload: object) => Promise<boolean>,
 *   refresh: () => Promise<void>,
 * }}
 */
export function useEncounterNotes(encounterId) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const fetch = useCallback(async () => {
    if (!encounterId) {
      setLoading(false);
      setNotes([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await clinicalService.getNotes(encounterId, { pageSize: 100 });
      if (result.error) throw new Error(result.error);

      setNotes(result.data || []);
    } catch (err) {
      const msg = err?.message || 'Failed to load clinical notes';
      logError('useEncounterNotes.fetch', err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [encounterId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addNote = useCallback(async (payload) => {
    try {
      setIsSaving(true);
      const { data, error: err } = await clinicalService.addNote(payload);
      if (err) throw new Error(err);

      showToast('Note added.', 'success');
      await fetch();
      return true;
    } catch (err) {
      const msg = err?.message || 'Failed to add note';
      logError('useEncounterNotes.addNote', err);
      showToast(msg, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [fetch, showToast]);

  return { notes, loading, error, isSaving, addNote, refresh: fetch };
}
