import { supabase } from '@/lib/supabase';
import { CLINICAL_DOCUMENT_SELECT_FIELDS } from '@/lib/selects';
import { apiCall, apiPaged } from './api';
import { clinicalService } from './clinical';

const DOCUMENT_TYPE_LABELS = {
  report: 'Medical Report',
  certificate: 'Medical Certificate',
  referral: 'Referral Letter',
  lab_request: 'Lab Request',
  insurance_form: 'Insurance Form',
  prescription: 'Prescription',
  lab_result: 'Lab Result',
  imaging_result: 'Imaging Result',
  insurance_claim: 'Insurance Claim',
  other: 'Clinical Document',
};

function toDocumentContent(sections = []) {
  return sections
    .filter((section) => section?.title || section?.body)
    .map(({ title, body }) => [title, body || 'Not provided.'].filter(Boolean).join('\n'))
    .join('\n\n');
}

function normalizeCreatePayload(payload, documentType) {
  return {
    patient_id: payload.patient_id,
    encounter_id: payload.encounter_id ?? null,
    doctor_id: payload.doctor_id ?? null,
    document_type: documentType,
    title: payload.title || DOCUMENT_TYPE_LABELS[documentType] || 'Clinical Document',
    content: payload.content ?? null,
    file_url: payload.file_url ?? null,
    status: 'draft',
    created_by: payload.created_by,
    client_request_id: payload.client_request_id ?? null,
  };
}

export const documentService = {
  labels: DOCUMENT_TYPE_LABELS,

  async getAll({
    documentType = null,
    patientId = null,
    doctorId = null,
    status = null,
    includeArchived = false,
    page = 1,
    pageSize = 25,
  } = {}) {
    let query = supabase
      .from('clinical_documents')
      .select(CLINICAL_DOCUMENT_SELECT_FIELDS, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (documentType) query = query.eq('document_type', documentType);
    if (patientId) query = query.eq('patient_id', patientId);
    if (doctorId) query = query.eq('doctor_id', doctorId);
    if (status) query = query.eq('status', status);
    if (!includeArchived) query = query.eq('is_archived', false);

    return apiPaged(query, { page, pageSize });
  },

  async getById(id) {
    return apiCall(
      supabase
        .from('clinical_documents')
        .select(CLINICAL_DOCUMENT_SELECT_FIELDS)
        .eq('id', id)
        .single()
    );
  },

  async getByPatientId(patientId, options = {}) {
    return this.getAll({ ...options, patientId });
  },

  async getByDoctorId(doctorId, options = {}) {
    return this.getAll({ ...options, doctorId });
  },

  async create(payload) {
    return clinicalService.createClinicalDocument(payload);
  },

  async createReport(payload) {
    return this.create(normalizeCreatePayload(payload, 'report'));
  },

  async createCertificate(payload) {
    const content = payload.content ?? toDocumentContent([
      { title: 'Diagnosis', body: payload.diagnosis },
      { title: 'Treatment', body: payload.treatment },
      { title: 'Recommendations', body: payload.recommendations },
      { title: 'Validity', body: [payload.start_date, payload.end_date].filter(Boolean).join(' to ') },
      { title: 'Issuer', body: payload.issuer },
    ]);

    return this.create(normalizeCreatePayload({ ...payload, content }, 'certificate'));
  },

  async createReferral(payload) {
    const content = payload.content ?? toDocumentContent([
      { title: 'Referral Target', body: payload.referring_to },
      { title: 'Reason for Referral', body: payload.reason },
      { title: 'Patient Status', body: payload.patient_status },
      { title: 'Clinical Findings', body: payload.clinical_findings },
      { title: 'Treatment Plan / Medications', body: payload.treatment_plan },
    ]);

    return this.create(normalizeCreatePayload({ ...payload, content }, 'referral'));
  },

  async createLabRequest(payload) {
    return this.create(normalizeCreatePayload(payload, 'lab_request'));
  },

  async createInsuranceForm(payload) {
    return this.create(normalizeCreatePayload(payload, 'insurance_form'));
  },

  async finalize(id) {
    return clinicalService.finalizeClinicalDocument(id);
  },

  async void(id, options = {}) {
    return clinicalService.voidClinicalDocument(id, options);
  },

  async getDownloadUrl(id, options = {}) {
    return clinicalService.getDocumentSignedUrl(id, options);
  },
};
