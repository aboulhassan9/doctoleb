import { useState, useEffect, useCallback } from 'react';
import { clinicalService } from '@/services/clinical';
import { useToast } from '@/contexts/ToastContext';
import { logError } from '@/lib/logger';

/**
 * useEncounterDocuments — Manages clinical documents for a single encounter.
 *
 * Documents are encounter-scoped inside the encounter workspace. Patient-wide
 * document history belongs in patient history/document pages.
 */
export function useEncounterDocuments(encounterId) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const fetch = useCallback(async () => {
    if (!encounterId) {
      setLoading(false);
      setDocuments([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await clinicalService.getDocumentsByEncounter(encounterId);
      if (result.error) throw new Error(result.error);

      setDocuments(result.data || []);
    } catch (err) {
      const msg = err?.message || 'Failed to load documents';
      logError('useEncounterDocuments.fetch', err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [encounterId]);

  useEffect(() => { fetch(); }, [fetch]);

  const createDocument = useCallback(async (payload) => {
    try {
      setIsSaving(true);
      const { error: err } = await clinicalService.createDocument(payload);
      if (err) throw new Error(err);

      showToast('Document created.', 'success');
      await fetch();
      return true;
    } catch (err) {
      const msg = err?.message || 'Failed to create document';
      logError('useEncounterDocuments.createDocument', err);
      showToast(msg, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [fetch, showToast]);

  const finalizeDocument = useCallback(async (documentId) => {
    try {
      setIsSaving(true);
      const { error: err } = await clinicalService.finalizeClinicalDocument(documentId);
      if (err) throw new Error(err);

      showToast('Document finalized.', 'success');
      await fetch();
      return true;
    } catch (err) {
      const msg = err?.message || 'Failed to finalize document';
      logError('useEncounterDocuments.finalizeDocument', err);
      showToast(msg, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [fetch, showToast]);

  return {
    documents,
    loading,
    error,
    isSaving,
    createDocument,
    finalizeDocument,
    refresh: fetch,
  };
}
