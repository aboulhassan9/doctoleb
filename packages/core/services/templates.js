import { supabase } from '../lib/supabase.js';
import { validationError, parse } from '../lib/serviceHelpers.js';
import {
  DOCUMENT_TEMPLATE_SELECT_FIELDS,
} from '../lib/selects.js';
import {
  documentTemplateCreateSchema,
  documentTemplateUpdateSchema,
} from '../schemas/documentTemplates.js';
import { apiCall, apiPaged } from './api.js';

/**
 * Map template_type → clinical_documents.document_type.
 * OQ-3 resolved: 'custom' coerces to 'other'.
 */
const TEMPLATE_TO_DOCUMENT_TYPE = {
  referral: 'referral',
  report: 'report',
  certificate: 'certificate',
  lab_request: 'lab_request',
  prescription: 'prescription',
  custom: 'other',
};

export const templateService = {
  /**
   * Coerce template_type to the matching document_type enum value.
   * @param {string} templateType
   * @returns {string}
   */
  coerceDocumentType(templateType) {
    return TEMPLATE_TO_DOCUMENT_TYPE[templateType] || 'other';
  },

  /**
   * List templates with optional filters.
   */
  async getAll({
    templateType = null,
    includeArchived = false,
    page = 1,
    pageSize = 25,
  } = {}) {
    let query = supabase
      .from('document_templates')
      .select(DOCUMENT_TEMPLATE_SELECT_FIELDS, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (templateType) query = query.eq('template_type', templateType);
    if (!includeArchived) query = query.eq('is_archived', false);

    return apiPaged(query, { page, pageSize });
  },

  /**
   * Get a single template by ID.
   */
  async getById(id) {
    if (!id) return validationError('Template ID is required.');

    return apiCall(
      supabase
        .from('document_templates')
        .select(DOCUMENT_TEMPLATE_SELECT_FIELDS)
        .eq('id', id)
        .single()
    );
  },

  /**
   * Create a new template.
   */
  async create(payload) {
    const parsed = parse(documentTemplateCreateSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('document_templates')
        .insert([parsed.data])
        .select(DOCUMENT_TEMPLATE_SELECT_FIELDS)
        .single()
    );
  },

  /**
   * Update an existing template.
   */
  async update(id, payload) {
    if (!id) return validationError('Template ID is required.');

    const parsed = parse(documentTemplateUpdateSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('document_templates')
        .update(parsed.data)
        .eq('id', id)
        .select(DOCUMENT_TEMPLATE_SELECT_FIELDS)
        .single()
    );
  },

  /**
   * Archive a template by ID. Default templates are protected by the
   * DB trigger and will return a Postgres error.
   */
  async archive(id, archivedBy) {
    if (!id) return validationError('Template ID is required.');
    if (!archivedBy) return validationError('archivedBy is required.');

    return apiCall(
      supabase
        .from('document_templates')
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: archivedBy,
        })
        .eq('id', id)
        .select(DOCUMENT_TEMPLATE_SELECT_FIELDS)
        .single()
    );
  },
};
