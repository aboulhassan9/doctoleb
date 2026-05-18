import { supabase } from '../lib/supabase.js';
import { PATIENT_FORM_FIELD_CONFIG_SELECT_FIELDS } from '../lib/selects.js';
import {
  PATIENT_FORM_CONTEXTS,
  PATIENT_ONBOARDING_CUSTOM_FIELD_KEY_PATTERN,
  getPatientFormRegistry,
} from '../schemas/index.js';
import { apiCall } from './api.js';

const CONTEXTS = new Set(Object.values(PATIENT_FORM_CONTEXTS));
const SCOPES = new Set(['tenant', 'doctor']);
const FIELD_KINDS = new Set(['base', 'custom']);
const CUSTOM_TYPES = new Set(['text', 'textarea', 'select']);

function getErrorMessage(error, fallback = 'Request failed') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  return error.message || fallback;
}

function normalizeContext(context) {
  return CONTEXTS.has(context) ? context : PATIENT_FORM_CONTEXTS.onboarding;
}

function asTrimmedString(value, max = 240) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function normalizeBoolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeInteger(value, fallback, { min = -1000, max = 2000 } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];
  return options
    .map((option) => {
      if (typeof option === 'string') {
        const label = asTrimmedString(option, 120);
        return label ? { value: label, label } : null;
      }
      if (!option || typeof option !== 'object') return null;
      const value = asTrimmedString(option.value, 120);
      const label = asTrimmedString(option.label, 120) || value;
      return value && label ? { value, label } : null;
    })
    .filter(Boolean)
    .slice(0, 24);
}

function getBaseField(context, fieldKey) {
  return getPatientFormRegistry(context).find((field) => field.key === fieldKey) || null;
}

function normalizeConfigPayload(input = {}) {
  const formContext = normalizeContext(input.form_context || input.formContext || input.context);
  const scope = SCOPES.has(input.scope) ? input.scope : 'doctor';
  const doctorId = scope === 'doctor' ? asTrimmedString(input.doctor_id || input.doctorId, 80) : null;
  const fieldKind = FIELD_KINDS.has(input.field_kind || input.fieldKind) ? (input.field_kind || input.fieldKind) : 'base';
  const fieldKey = asTrimmedString(input.field_key || input.fieldKey, 80);

  if (scope === 'doctor' && !doctorId) return { data: null, error: 'Doctor scope requires a doctor id.' };
  if (!fieldKey) return { data: null, error: 'Field key is required.' };

  const baseField = getBaseField(formContext, fieldKey);
  if (fieldKind === 'base' && !baseField) {
    return { data: null, error: 'Base field is not in the allowlisted patient form registry.' };
  }

  if (fieldKind === 'custom' && !PATIENT_ONBOARDING_CUSTOM_FIELD_KEY_PATTERN.test(fieldKey)) {
    return { data: null, error: 'Custom field keys must use the custom.* namespace.' };
  }

  const fieldType = fieldKind === 'base'
    ? baseField.type
    : (CUSTOM_TYPES.has(input.field_type || input.fieldType || input.type) ? (input.field_type || input.fieldType || input.type) : 'text');
  const section = asTrimmedString(input.section, 80) || baseField?.section;
  if (!section) return { data: null, error: 'Section is required.' };

  const label = asTrimmedString(input.label, 120);
  if (fieldKind === 'custom' && !label) return { data: null, error: 'Custom field label is required.' };

  const options = fieldType === 'select' ? normalizeOptions(input.options) : [];
  if (fieldKind === 'custom' && fieldType === 'select' && options.length === 0) {
    return { data: null, error: 'Select custom fields require at least one option.' };
  }

  return {
    data: {
      form_context: formContext,
      scope,
      doctor_id: doctorId,
      field_kind: fieldKind,
      field_key: fieldKey,
      section,
      field_type: fieldType,
      is_visible: normalizeBoolean(input.is_visible ?? input.visible, true),
      is_required: normalizeBoolean(input.is_required ?? input.required, Boolean(baseField?.required)),
      sort_order: normalizeInteger(input.sort_order ?? input.order, baseField?.order ?? 500),
      label,
      placeholder: asTrimmedString(input.placeholder, 240),
      help_text: asTrimmedString(input.help_text || input.helpText, 360),
      options,
      rows: fieldType === 'textarea' ? normalizeInteger(input.rows, baseField?.rows || 3, { min: 2, max: 8 }) : null,
      status: input.status === 'draft' ? 'draft' : 'active',
      config_version: normalizeInteger(input.config_version || input.configVersion, 1, { min: 1, max: 1000 }),
    },
    error: null,
  };
}

export const patientFormConfigService = {
  async list({ context = PATIENT_FORM_CONTEXTS.onboarding, scope = null, doctorId = null, includeArchived = false } = {}) {
    const formContext = normalizeContext(context);
    let query = supabase
      .from('patient_form_field_config')
      .select(PATIENT_FORM_FIELD_CONFIG_SELECT_FIELDS)
      .eq('form_context', formContext)
      .order('sort_order', { ascending: true })
      .order('field_key', { ascending: true });

    if (scope) query = query.eq('scope', scope);
    if (doctorId) query = query.eq('doctor_id', doctorId);
    if (!includeArchived) query = query.neq('status', 'archived');

    const result = await apiCall(query);
    if (result.error) {
      return { data: [], error: getErrorMessage(result.error, 'Unable to load patient form configuration.') };
    }
    return { data: result.data || [], error: null };
  },

  async save(input = {}) {
    const normalized = normalizeConfigPayload(input);
    if (normalized.error) return normalized;

    const id = asTrimmedString(input.id, 80);
    const mutation = id
      ? supabase
        .from('patient_form_field_config')
        .update(normalized.data)
        .eq('id', id)
        .select(PATIENT_FORM_FIELD_CONFIG_SELECT_FIELDS)
        .single()
      : supabase
        .from('patient_form_field_config')
        .insert([{ ...normalized.data, created_by: asTrimmedString(input.created_by || input.createdBy, 80) }])
        .select(PATIENT_FORM_FIELD_CONFIG_SELECT_FIELDS)
        .single();

    const result = await apiCall(mutation);
    if (result.error) {
      return { data: null, error: getErrorMessage(result.error, 'Unable to save patient form configuration.') };
    }
    return { data: result.data, error: null };
  },

  async archive(id) {
    const rowId = asTrimmedString(id, 80);
    if (!rowId) return { data: null, error: 'Configuration id is required.' };

    const result = await apiCall(
      supabase
        .from('patient_form_field_config')
        .update({ status: 'archived' })
        .eq('id', rowId)
        .select(PATIENT_FORM_FIELD_CONFIG_SELECT_FIELDS)
        .single()
    );
    if (result.error) {
      return { data: null, error: getErrorMessage(result.error, 'Unable to archive patient form configuration.') };
    }
    return { data: result.data, error: null };
  },
};
