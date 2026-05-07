import { supabase } from '@/lib/supabase';
import {
  CONSENT_DOCUMENT_SELECT_FIELDS,
  CONTENT_PAGE_SELECT_FIELDS,
  FEATURE_FLAG_SELECT_FIELDS,
  PATIENT_CONSENT_SELECT_FIELDS,
  TENANT_APP_CONFIG_SELECT_FIELDS,
  TENANT_PROFILE_SELECT_FIELDS,
} from '@/lib/selects';
import {
  patientConsentSchema,
  parseWithSchema,
  tenantAppConfigUpdateSchema,
  tenantProfileUpdateSchema,
} from '@/schemas';
import { apiCall, apiPaged } from './api';

function validationError(error) {
  return { data: null, error };
}

function parse(schema, payload) {
  const result = parseWithSchema(schema, payload);
  if (result.error) {
    return { error: result.error };
  }
  return { data: result.data };
}

export const tenantConfigService = {
  async getPublicConfig() {
    return apiCall(
      supabase
        .rpc('get_public_tenant_app_config')
        .maybeSingle()
    );
  },

  async getTenantProfile() {
    return apiCall(
      supabase
        .from('tenant_profile')
        .select(TENANT_PROFILE_SELECT_FIELDS)
        .maybeSingle()
    );
  },

  async updateTenantProfile(id, payload) {
    const parsed = parse(tenantProfileUpdateSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('tenant_profile')
        .update(parsed.data)
        .eq('id', id)
        .select(TENANT_PROFILE_SELECT_FIELDS)
        .single()
    );
  },

  async getAppConfig() {
    return apiCall(
      supabase
        .from('tenant_app_config')
        .select(TENANT_APP_CONFIG_SELECT_FIELDS)
        .maybeSingle()
    );
  },

  async updateAppConfig(id, payload) {
    const parsed = parse(tenantAppConfigUpdateSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('tenant_app_config')
        .update(parsed.data)
        .eq('id', id)
        .select(TENANT_APP_CONFIG_SELECT_FIELDS)
        .single()
    );
  },

  async getFeatureFlags({ enabledOnly = false, audience = null, page = 1, pageSize = 50 } = {}) {
    let query = supabase
      .from('feature_flags')
      .select(FEATURE_FLAG_SELECT_FIELDS, { count: 'exact' })
      .order('code', { ascending: true });

    if (enabledOnly) query = query.eq('is_enabled', true);
    if (audience) query = query.eq('audience', audience);

    return apiPaged(query, { page, pageSize });
  },

  async getContentPages({ audience = null, publishedOnly = true, page = 1, pageSize = 25 } = {}) {
    let query = supabase
      .from('content_pages')
      .select(CONTENT_PAGE_SELECT_FIELDS, { count: 'exact' })
      .order('published_at', { ascending: false, nullsFirst: false });

    if (audience) query = query.eq('audience', audience);
    if (publishedOnly) query = query.eq('status', 'published');

    return apiPaged(query, { page, pageSize });
  },

  async getContentPage(slug) {
    return apiCall(
      supabase
        .from('content_pages')
        .select(CONTENT_PAGE_SELECT_FIELDS)
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle()
    );
  },

  async getConsentDocuments({ activeOnly = true, audience = 'patient', page = 1, pageSize = 25 } = {}) {
    let query = supabase
      .from('consent_documents')
      .select(CONSENT_DOCUMENT_SELECT_FIELDS, { count: 'exact' })
      .eq('audience', audience)
      .order('code', { ascending: true })
      .order('version', { ascending: false });

    if (activeOnly) query = query.eq('is_active', true);

    return apiPaged(query, { page, pageSize });
  },

  async acceptConsent(payload) {
    const parsed = parse(patientConsentSchema, {
      accepted_at: new Date().toISOString(),
      ...payload,
    });
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('patient_consents')
        .upsert(parsed.data, { onConflict: 'patient_id,consent_document_id' })
        .select(PATIENT_CONSENT_SELECT_FIELDS)
        .single()
    );
  },

  async getPatientConsents(patientId, { page = 1, pageSize = 25 } = {}) {
    const query = supabase
      .from('patient_consents')
      .select(PATIENT_CONSENT_SELECT_FIELDS, { count: 'exact' })
      .eq('patient_id', patientId)
      .order('accepted_at', { ascending: false });

    return apiPaged(query, { page, pageSize });
  },
};
