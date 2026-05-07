import { supabase } from '@/lib/supabase';
import { apiCall } from './api';

export const STORAGE_BUCKETS = Object.freeze({
  CLINICAL_DOCUMENTS: 'clinical-documents',
  MESSAGE_ATTACHMENTS: 'message-attachments',
});

const DEFAULT_SIGNED_URL_TTL_SECONDS = 300;
const MAX_SIGNED_URL_TTL_SECONDS = 900;

function validationError(error) {
  return { data: null, error };
}

function normalizeTtl(expiresIn) {
  const ttl = Number(expiresIn);
  if (!Number.isFinite(ttl)) return DEFAULT_SIGNED_URL_TTL_SECONDS;
  return Math.min(Math.max(Math.trunc(ttl), 30), MAX_SIGNED_URL_TTL_SECONDS);
}

export const storageService = {
  createSignedUrl(bucket, path, { expiresIn = DEFAULT_SIGNED_URL_TTL_SECONDS } = {}) {
    if (!Object.values(STORAGE_BUCKETS).includes(bucket)) {
      return validationError('Unsupported storage bucket.');
    }

    if (!path || typeof path !== 'string') {
      return validationError('A storage path is required.');
    }

    return apiCall(
      supabase
        .storage
        .from(bucket)
        .createSignedUrl(path, normalizeTtl(expiresIn))
    );
  },
};
