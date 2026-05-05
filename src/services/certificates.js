import { supabase } from '../lib/supabase';
import { apiCall } from './api';
import { CERTIFICATE_SELECT_FIELDS, DOCTOR_SELECT_FIELDS } from '../lib/selects';
import { paginateQuery } from '../lib/pagination';
import { certificateCreateSchema, parseWithSchema } from '../schemas';

function compactPayload(payload) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function buildCertificatePayload(data = {}, options = {}) {
  const { withDefaults = false } = options;
  return compactPayload({
    doctor_id: data.doctor_id,
    certificate_type: data.certificate_type || (withDefaults ? 'Medical Certificate' : undefined),
    title: data.title || (withDefaults ? 'Medical Certificate' : undefined),
    issuer: data.issuer,
    issue_date: data.issue_date || (withDefaults ? new Date().toISOString().slice(0, 10) : undefined),
    expiry_date: data.expiry_date,
    file_url: data.file_url,
  });
}

export const certificateService = {
  async getAll(options = {}) {
    return apiCall(
      paginateQuery(
        supabase
          .from('certificates')
          .select(`${CERTIFICATE_SELECT_FIELDS}, doctors(${DOCTOR_SELECT_FIELDS})`, { count: 'exact' })
          .order('created_at', { ascending: false }),
        options
      )
    );
  },

  async getById(id) {
    return apiCall(
      supabase
        .from('certificates')
        .select(`${CERTIFICATE_SELECT_FIELDS}, doctors(${DOCTOR_SELECT_FIELDS})`)
        .eq('id', id)
        .single()
    );
  },

  async getByPatientId(patientId) {
    void patientId;
    // Current live schema has no patient_id on certificates.
    // Patient-facing certificates require a later schema/product decision.
    return { data: [], count: null, error: null };
  },

  async getByDoctorId(doctorId, options = {}) {
    return apiCall(
      paginateQuery(
        supabase
          .from('certificates')
          .select(CERTIFICATE_SELECT_FIELDS, { count: 'exact' })
          .eq('doctor_id', doctorId)
          .order('created_at', { ascending: false }),
        options
      )
    );
  },

  async create(rawData) {
    const { data, error: validationError } = parseWithSchema(certificateCreateSchema, rawData);
    if (validationError) return { data: null, count: null, error: validationError };

    return apiCall(
      supabase
        .from('certificates')
        .insert([buildCertificatePayload(data, { withDefaults: true })])
        .select(CERTIFICATE_SELECT_FIELDS)
    );
  },

  async update(id, data) {
    return apiCall(
      supabase
        .from('certificates')
        .update(buildCertificatePayload(data))
        .eq('id', id)
        .select(CERTIFICATE_SELECT_FIELDS)
    );
  },

  // RULE 1: Medical data is sacred — use soft-delete
  async archive(id, archivedBy) {
    return apiCall(
      supabase
        .from('certificates')
        .update({ is_archived: true, archived_at: new Date().toISOString(), archived_by: archivedBy })
        .eq('id', id)
        .select(CERTIFICATE_SELECT_FIELDS)
    );
  },
};
