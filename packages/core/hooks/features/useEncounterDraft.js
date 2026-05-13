import { useCallback, useEffect, useRef, useState } from 'react';
import { clinicalService } from '@/services/clinical';
import { logError } from '@/lib/logger';

const EMPTY_DRAFT = Object.freeze({ noteType: 'general', content: '' });
const AUTOSAVE_INTERVAL_MS = 30_000;

function normalizeHookInput(input) {
  if (typeof input === 'string' || input === null || input === undefined) {
    return { encounterId: input ?? null, enabled: true };
  }

  return {
    encounterId: input.encounterId ?? null,
    enabled: input.enabled !== false,
  };
}

function normalizeDraft(row) {
  return {
    noteType: typeof row?.note_type === 'string' ? row.note_type : EMPTY_DRAFT.noteType,
    content: typeof row?.content === 'string' ? row.content : EMPTY_DRAFT.content,
  };
}

function hasMeaningfulDraft(draft) {
  return Boolean(draft?.content?.trim()) || draft?.noteType !== EMPTY_DRAFT.noteType;
}

/**
 * Persists one active clinical-note draft per encounter and author in the
 * tenant database. PHI never falls back to browser storage.
 */
export function useEncounterDraft(input) {
  const { encounterId, enabled } = normalizeHookInput(input);
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT });
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const draftRef = useRef(draft);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    let isMounted = true;

    async function loadDraft() {
      if (!encounterId || !enabled) {
        setDraft({ ...EMPTY_DRAFT });
        setLastSavedAt(null);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const result = await clinicalService.getNoteDraft(encounterId);
      if (!isMounted) return;

      if (result.error) {
        logError('useEncounterDraft.loadDraft', result.error);
        setDraft({ ...EMPTY_DRAFT });
        setLastSavedAt(null);
        setError(result.error);
        setLoading(false);
        return;
      }

      setDraft(normalizeDraft(result.data));
      setLastSavedAt(result.data?.updated_at ?? null);
      setLoading(false);
    }

    loadDraft();

    return () => {
      isMounted = false;
    };
  }, [enabled, encounterId]);

  const updateDraft = useCallback((patch) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const discardDraft = useCallback(async ({ status = 'discarded', convertedNoteId = null } = {}) => {
    if (!encounterId) {
      setDraft({ ...EMPTY_DRAFT });
      setLastSavedAt(null);
      return true;
    }

    const result = await clinicalService.discardNoteDraft({
      encounter_id: encounterId,
      status,
      converted_note_id: convertedNoteId,
    });

    if (result.error) {
      logError('useEncounterDraft.discardDraft', result.error);
      setError(result.error);
      return false;
    }

    setDraft({ ...EMPTY_DRAFT });
    setLastSavedAt(null);
    setError(null);
    return true;
  }, [encounterId]);

  const persistDraft = useCallback(async () => {
    if (!encounterId || !enabled) return false;

    const currentDraft = draftRef.current;
    if (!hasMeaningfulDraft(currentDraft)) {
      return discardDraft();
    }

    setSaving(true);
    const result = await clinicalService.saveNoteDraft({
      encounter_id: encounterId,
      note_type: currentDraft.noteType,
      content: currentDraft.content,
    });
    setSaving(false);

    if (result.error) {
      logError('useEncounterDraft.persistDraft', result.error);
      setError(result.error);
      return false;
    }

    setLastSavedAt(result.data?.updated_at ?? new Date().toISOString());
    setError(null);
    return true;
  }, [discardDraft, enabled, encounterId]);

  useEffect(() => {
    if (!encounterId || !enabled) return undefined;

    const intervalId = window.setInterval(() => {
      void persistDraft();
    }, AUTOSAVE_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [enabled, encounterId, persistDraft]);

  useEffect(() => {
    if (!encounterId || !enabled) return undefined;

    const persistOnHide = () => {
      void persistDraft();
    };

    window.addEventListener('pagehide', persistOnHide);
    return () => window.removeEventListener('pagehide', persistOnHide);
  }, [enabled, encounterId, persistDraft]);

  return {
    draft,
    updateDraft,
    persistDraft,
    clearDraft: discardDraft,
    hasDraft: hasMeaningfulDraft(draft),
    lastSavedAt,
    loading,
    saving,
    error,
  };
}
