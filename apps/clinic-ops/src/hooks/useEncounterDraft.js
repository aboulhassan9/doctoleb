import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_PREFIX = 'doctoleb:encounter-note-draft:';
const EMPTY_DRAFT = Object.freeze({ noteType: 'general', content: '' });
const AUTOSAVE_INTERVAL_MS = 30_000;

function hasMeaningfulDraft(draft) {
  return Boolean(draft?.content?.trim()) || draft?.noteType !== EMPTY_DRAFT.noteType;
}

function readDraft(storageKey) {
  if (!storageKey || typeof window === 'undefined') return { ...EMPTY_DRAFT };

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return { ...EMPTY_DRAFT };

    const parsed = JSON.parse(raw);
    return {
      ...EMPTY_DRAFT,
      noteType: typeof parsed.noteType === 'string' ? parsed.noteType : EMPTY_DRAFT.noteType,
      content: typeof parsed.content === 'string' ? parsed.content : EMPTY_DRAFT.content,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : null,
    };
  } catch {
    return { ...EMPTY_DRAFT };
  }
}

function writeDraft(storageKey, draft) {
  if (!storageKey || typeof window === 'undefined') return null;

  try {
    if (!hasMeaningfulDraft(draft)) {
      window.localStorage.removeItem(storageKey);
      return null;
    }

    const savedAt = new Date().toISOString();
    window.localStorage.setItem(storageKey, JSON.stringify({ ...draft, savedAt }));
    return savedAt;
  } catch {
    return null;
  }
}

/**
 * Persists a local clinical-note draft per encounter.
 *
 * This is intentionally client-local. It prevents accidental text loss while
 * the canonical medical record remains `clinical_notes` after explicit save.
 */
export function useEncounterDraft(encounterId) {
  const storageKey = encounterId ? `${STORAGE_PREFIX}${encounterId}` : null;
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT });
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const draftRef = useRef(draft);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    const storedDraft = readDraft(storageKey);
    setDraft({ noteType: storedDraft.noteType, content: storedDraft.content });
    setLastSavedAt(storedDraft.savedAt || null);
  }, [storageKey]);

  const updateDraft = useCallback((patch) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const persistDraft = useCallback(() => {
    setLastSavedAt(writeDraft(storageKey, draftRef.current));
  }, [storageKey]);

  const persistDraftSilently = useCallback(() => {
    writeDraft(storageKey, draftRef.current);
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    if (storageKey && typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey);
    }
    setDraft({ ...EMPTY_DRAFT });
    setLastSavedAt(null);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return undefined;

    const intervalId = window.setInterval(persistDraft, AUTOSAVE_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
      persistDraftSilently();
    };
  }, [persistDraft, persistDraftSilently, storageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return undefined;

    window.addEventListener('pagehide', persistDraftSilently);
    return () => window.removeEventListener('pagehide', persistDraftSilently);
  }, [persistDraftSilently, storageKey]);

  return {
    draft,
    updateDraft,
    persistDraft,
    clearDraft,
    hasDraft: hasMeaningfulDraft(draft),
    lastSavedAt,
  };
}
