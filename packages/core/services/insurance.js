import { supabase } from '../lib/supabase.js';
import {
  CLAIM_FORM_TEMPLATE_SELECT_FIELDS,
  DOCTOR_INSURANCE_CONTRACT_SELECT_FIELDS,
  INSURANCE_CLAIM_SELECT_FIELDS,
  INSURANCE_PROVIDER_SELECT_FIELDS,
  PATIENT_INSURANCE_POLICY_SELECT_FIELDS,
} from '../lib/selects.js';
import {
  doctorInsuranceContractSchema,
  insuranceClaimSchema,
  patientInsurancePolicySchema,
} from '../schemas/index.js';
import { apiCall, apiPaged } from './api.js';

import { validationError, parse } from '../lib/serviceHelpers.js';

export const insuranceService = {
  async getProviders({ activeOnly = true, page = 1, pageSize = 100 } = {}) {
    let query = supabase
      .from('insurance_providers')
      .select(INSURANCE_PROVIDER_SELECT_FIELDS, { count: 'exact' })
      .order('name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    return apiPaged(query, { page, pageSize });
  },

  async getDoctorContracts(doctorId, { activeOnly = true, page = 1, pageSize = 100 } = {}) {
    let query = supabase
      .from('doctor_insurance_contracts')
      .select(DOCTOR_INSURANCE_CONTRACT_SELECT_FIELDS, { count: 'exact' })
      .eq('doctor_id', doctorId)
      .order('created_at', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    return apiPaged(query, { page, pageSize });
  },

  async saveDoctorContract(payload) {
    const parsed = parse(doctorInsuranceContractSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('doctor_insurance_contracts')
        .upsert(parsed.data, { onConflict: 'doctor_id,provider_id' })
        .select(DOCTOR_INSURANCE_CONTRACT_SELECT_FIELDS)
        .single()
    );
  },

  async getPatientPolicies(patientId, { page = 1, pageSize = 25 } = {}) {
    const query = supabase
      .from('patient_insurance_policies')
      .select(PATIENT_INSURANCE_POLICY_SELECT_FIELDS, { count: 'exact' })
      .eq('patient_id', patientId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false });

    return apiPaged(query, { page, pageSize });
  },

  async savePatientPolicy(payload) {
    const parsed = parse(patientInsurancePolicySchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('patient_insurance_policies')
        .insert([parsed.data])
        .select(PATIENT_INSURANCE_POLICY_SELECT_FIELDS)
        .single()
    );
  },

  async updatePatientPolicy(id, payload) {
    const parsed = parse(patientInsurancePolicySchema.partial(), payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('patient_insurance_policies')
        .update(parsed.data)
        .eq('id', id)
        .select(PATIENT_INSURANCE_POLICY_SELECT_FIELDS)
        .single()
    );
  },

  async getClaimTemplates({ activeOnly = true, page = 1, pageSize = 100 } = {}) {
    let query = supabase
      .from('claim_form_templates')
      .select(CLAIM_FORM_TEMPLATE_SELECT_FIELDS, { count: 'exact' })
      .order('provider_id', { ascending: true, nullsFirst: true })
      .order('name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    return apiPaged(query, { page, pageSize });
  },

  async getClaimsByPatient(patientId, { page = 1, pageSize = 25 } = {}) {
    const query = supabase
      .from('insurance_claims')
      .select(INSURANCE_CLAIM_SELECT_FIELDS, { count: 'exact' })
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    return apiPaged(query, { page, pageSize });
  },

  async getClaimsByStatus(status, { page = 1, pageSize = 25 } = {}) {
    const query = supabase
      .from('insurance_claims')
      .select(INSURANCE_CLAIM_SELECT_FIELDS, { count: 'exact' })
      .eq('status', status)
      .order('created_at', { ascending: false });

    return apiPaged(query, { page, pageSize });
  },

  async createClaim(payload) {
    const parsed = parse(insuranceClaimSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('insurance_claims')
        .insert([parsed.data])
        .select(INSURANCE_CLAIM_SELECT_FIELDS)
        .single()
    );
  },

  async updateClaim(id, payload) {
    const parsed = parse(insuranceClaimSchema.partial(), payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('insurance_claims')
        .update(parsed.data)
        .eq('id', id)
        .select(INSURANCE_CLAIM_SELECT_FIELDS)
        .single()
    );
  },

  // ── Claim Form Template CRUD ──

  async saveClaimTemplate(payload) {
    return apiCall(
      supabase
        .from('claim_form_templates')
        .insert([{
          name: payload.name,
          provider_id: payload.provider_id || null,
          template_body: payload.template_body || '',
          is_active: payload.is_active ?? true,
        }])
        .select(CLAIM_FORM_TEMPLATE_SELECT_FIELDS)
        .single()
    );
  },

  async updateClaimTemplate(id, payload) {
    return apiCall(
      supabase
        .from('claim_form_templates')
        .update({
          name: payload.name,
          provider_id: payload.provider_id || null,
          template_body: payload.template_body,
          is_active: payload.is_active,
        })
        .eq('id', id)
        .select(CLAIM_FORM_TEMPLATE_SELECT_FIELDS)
        .single()
    );
  },
};
