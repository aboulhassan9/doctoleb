import { supabase } from '../lib/supabase.js';
import { validationError, parse } from '../lib/serviceHelpers.js';
import {
  MEDICATION_CATALOG_SELECT_FIELDS,
} from '../lib/selects.js';
import {
  medicationCatalogCreateSchema,
  medicationCatalogUpdateSchema,
} from '../schemas/documentTemplates.js';
import { apiCall, apiPaged } from './api.js';

/** Minimum query length to issue a DB search. */
const MIN_SEARCH_LENGTH = 2;

export const medicationCatalogService = {
  /**
   * Search the medication catalog by name prefix (ilike).
   * Returns [] without a DB call if query is empty or too short.
   * @param {string} query — the search term
   * @param {{ limit?: number, includeArchived?: boolean }} [options]
   * @returns {Promise<{ data: object[], error: string|null }>}
   */
  async search(query, { limit = 8, includeArchived = false } = {}) {
    const trimmed = (query || '').trim();
    if (trimmed.length < MIN_SEARCH_LENGTH) {
      return { data: [], error: null };
    }

    let dbQuery = supabase
      .from('medication_catalog')
      .select(MEDICATION_CATALOG_SELECT_FIELDS)
      .ilike('name', `${trimmed}%`)
      .order('name', { ascending: true })
      .limit(limit);

    if (!includeArchived) {
      dbQuery = dbQuery.eq('is_archived', false);
    }

    return apiCall(dbQuery);
  },

  /**
   * Get a single catalog entry by ID.
   */
  async getById(id) {
    if (!id) return validationError('Medication catalog entry ID is required.');

    return apiCall(
      supabase
        .from('medication_catalog')
        .select(MEDICATION_CATALOG_SELECT_FIELDS)
        .eq('id', id)
        .single()
    );
  },

  /**
   * List catalog entries with optional pagination.
   */
  async getAll({
    includeArchived = false,
    page = 1,
    pageSize = 25,
  } = {}) {
    let query = supabase
      .from('medication_catalog')
      .select(MEDICATION_CATALOG_SELECT_FIELDS, { count: 'exact' })
      .order('name', { ascending: true });

    if (!includeArchived) query = query.eq('is_archived', false);

    return apiPaged(query, { page, pageSize });
  },

  /**
   * Create a new catalog entry directly.
   */
  async create(payload) {
    const parsed = parse(medicationCatalogCreateSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('medication_catalog')
        .insert([parsed.data])
        .select(MEDICATION_CATALOG_SELECT_FIELDS)
        .single()
    );
  },

  /**
   * Fire-and-forget upsert: calls the `upsert_medication_catalog_entry` RPC.
   * Returns the canonical row ID (existing or newly inserted).
   * Rejects whitespace-only names without hitting the RPC.
   * @param {string} name
   * @returns {Promise<{ data: string|null, error: string|null }>}
   */
  async upsertIfMissing(name) {
    const trimmed = (name || '').trim();
    if (!trimmed) {
      return validationError('Medication name is required.');
    }

    return apiCall(
      supabase.rpc('upsert_medication_catalog_entry', { p_name: trimmed })
    );
  },

  /**
   * Update an existing catalog entry.
   */
  async update(id, payload) {
    if (!id) return validationError('Medication catalog entry ID is required.');

    const parsed = parse(medicationCatalogUpdateSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('medication_catalog')
        .update(parsed.data)
        .eq('id', id)
        .select(MEDICATION_CATALOG_SELECT_FIELDS)
        .single()
    );
  },

  /**
   * Archive a catalog entry by ID.
   */
  async archive(id, archivedBy) {
    if (!id) return validationError('Medication catalog entry ID is required.');
    if (!archivedBy) return validationError('archivedBy is required.');

    return apiCall(
      supabase
        .from('medication_catalog')
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: archivedBy,
        })
        .eq('id', id)
        .select(MEDICATION_CATALOG_SELECT_FIELDS)
        .single()
    );
  },
};
