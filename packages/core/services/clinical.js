import { supabase } from '../lib/supabase.js';
import { validationError, parse } from '../lib/serviceHelpers.js';
import {
  CARE_TASK_SELECT_FIELDS,
  CLINICAL_DOCUMENT_SELECT_FIELDS,
  CLINICAL_NOTE_DRAFT_SELECT_FIELDS,
  CLINICAL_NOTE_SELECT_FIELDS,
  DIAGNOSIS_SELECT_FIELDS,
  DOCUMENT_ATTACHMENT_SELECT_FIELDS,
  ENCOUNTER_SELECT_FIELDS,
  IMAGING_ORDER_SELECT_FIELDS,
  LAB_ORDER_SELECT_FIELDS,
  PRESCRIPTION_SELECT_FIELDS,
} from '../lib/selects.js';
import {
  careTaskSchema,
  careTaskUpdateSchema,
  clinicalDocumentSchema,
  clinicalNoteDraftDiscardSchema,
  clinicalNoteDraftGetSchema,
  clinicalNoteDraftSaveSchema,
  clinicalNoteSchema,
  clinicalOrderSchema,
  diagnosisSchema,
  documentAttachmentSchema,
  encounterCreateSchema,
  encounterUpdateSchema,
  prescriptionSchema,
} from '../schemas/index.js';
import { assertTransition } from '../lib/stateMachines.js';
import { apiCall, apiPaged } from './api.js';
import { STORAGE_BUCKETS, storageService } from './storage.js';

const ORDER_TABLES = {
  lab: {
    table: 'lab_orders',
    fields: LAB_ORDER_SELECT_FIELDS,
    requiredField: 'title',
    columns: [
      'encounter_id',
      'patient_id',
      'doctor_id',
      'title',
      'instructions',
      'status',
      'ordered_at',
      'resulted_at',
      'result_summary',
      'result_document_id',
      'ordered_by',
    ],
  },
  imaging: {
    table: 'imaging_orders',
    fields: IMAGING_ORDER_SELECT_FIELDS,
    requiredField: 'imaging_type',
    columns: [
      'encounter_id',
      'patient_id',
      'doctor_id',
      'imaging_type',
      'body_area',
      'instructions',
      'status',
      'ordered_at',
      'resulted_at',
      'result_summary',
      'result_document_id',
      'ordered_by',
    ],
  },
};

function getOrderConfig(kind) {
  const config = ORDER_TABLES[kind];
  if (!config) {
    throw new Error(`Unsupported clinical order kind: ${kind}`);
  }
  return config;
}

function pickColumns(payload, columns) {
  return columns.reduce((result, column) => {
    if (Object.prototype.hasOwnProperty.call(payload, column)) {
      result[column] = payload[column];
    }
    return result;
  }, {});
}

export const clinicalService = {
  async getEncounterById(id) {
    return apiCall(
      supabase
        .from('encounters')
        .select(ENCOUNTER_SELECT_FIELDS)
        .eq('id', id)
        .maybeSingle()
    );
  },

  async getEncounterByAppointmentId(appointmentId) {
    return apiCall(
      supabase
        .from('encounters')
        .select(ENCOUNTER_SELECT_FIELDS)
        .eq('appointment_id', appointmentId)
        .maybeSingle()
    );
  },

  async getEncountersByPatient(patientId, { includeArchived = false, limit = null, page = 1, pageSize = 25 } = {}) {
    let query = supabase
      .from('encounters')
      .select(ENCOUNTER_SELECT_FIELDS, { count: 'exact' })
      .eq('patient_id', patientId)
      .order('started_at', { ascending: false, nullsFirst: false });

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    return apiPaged(query, { page, pageSize: limit ?? pageSize });
  },

  async startEncounter(appointmentId, { chiefComplaint = null } = {}) {
    return apiCall(
      supabase
        .rpc('start_encounter', {
          p_appointment: appointmentId,
          p_chief_complaint: chiefComplaint,
        })
    );
  },

  async completeEncounter(encounterId, { summary = null } = {}) {
    return apiCall(
      supabase
        .rpc('complete_encounter', {
          p_encounter: encounterId,
          p_summary: summary,
        })
    );
  },

  async cancelEncounter(encounterId, { reason = null } = {}) {
    return apiCall(
      supabase
        .rpc('cancel_encounter', {
          p_encounter: encounterId,
          p_reason: reason,
        })
    );
  },

  async createEncounter(payload) {
    const parsed = parse(encounterCreateSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .rpc('start_encounter', {
          p_appointment: parsed.data.appointment_id,
          p_chief_complaint: parsed.data.chief_complaint,
        })
    );
  },

  async updateEncounter(id, payload) {
    const parsed = parse(encounterUpdateSchema, payload);
    if (parsed.error) return validationError(parsed.error);
    if (Object.prototype.hasOwnProperty.call(parsed.data, 'status')) {
      return validationError('Use encounter lifecycle methods to change encounter status.');
    }

    return apiCall(
      supabase
        .from('encounters')
        .update(parsed.data)
        .eq('id', id)
        .select(ENCOUNTER_SELECT_FIELDS)
        .single()
    );
  },

  async addNote(payload) {
    const parsed = parse(clinicalNoteSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('clinical_notes')
        .insert([parsed.data])
        .select(CLINICAL_NOTE_SELECT_FIELDS)
        .single()
    );
  },

  async getNotes(encounterId, { includeArchived = false, page = 1, pageSize = 50 } = {}) {
    let query = supabase
      .from('clinical_notes')
      .select(CLINICAL_NOTE_SELECT_FIELDS, { count: 'exact' })
      .eq('encounter_id', encounterId)
      .order('created_at', { ascending: true });

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    return apiPaged(query, { page, pageSize });
  },

  async getNoteDraft(encounterId) {
    const parsed = parse(clinicalNoteDraftGetSchema, { encounter_id: encounterId });
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('clinical_note_drafts')
        .select(CLINICAL_NOTE_DRAFT_SELECT_FIELDS)
        .eq('encounter_id', parsed.data.encounter_id)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()
    );
  },

  async saveNoteDraft(payload) {
    const parsed = parse(clinicalNoteDraftSaveSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .rpc('save_clinical_note_draft', {
          p_encounter: parsed.data.encounter_id,
          p_note_type: parsed.data.note_type,
          p_content: parsed.data.content,
        })
    );
  },

  async discardNoteDraft(payload) {
    const parsed = parse(clinicalNoteDraftDiscardSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .rpc('discard_clinical_note_draft', {
          p_encounter: parsed.data.encounter_id,
          p_status: parsed.data.status,
          p_converted_note: parsed.data.converted_note_id ?? null,
        })
    );
  },

  async addDiagnosis(payload) {
    const parsed = parse(diagnosisSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('diagnoses')
        .insert([parsed.data])
        .select(DIAGNOSIS_SELECT_FIELDS)
        .single()
    );
  },

  async getDiagnoses(patientId, { includeArchived = false, page = 1, pageSize = 25 } = {}) {
    let query = supabase
      .from('diagnoses')
      .select(DIAGNOSIS_SELECT_FIELDS, { count: 'exact' })
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    return apiPaged(query, { page, pageSize });
  },

  async getDiagnosesByEncounter(encounterId, { includeArchived = false, page = 1, pageSize = 25 } = {}) {
    let query = supabase
      .from('diagnoses')
      .select(DIAGNOSIS_SELECT_FIELDS, { count: 'exact' })
      .eq('encounter_id', encounterId)
      .order('created_at', { ascending: false });

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    return apiPaged(query, { page, pageSize });
  },

  async addPrescription(payload) {
    const parsed = parse(prescriptionSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('prescriptions')
        .insert([parsed.data])
        .select(PRESCRIPTION_SELECT_FIELDS)
        .single()
    );
  },

  async getPrescriptions(patientId, { status = null, includeArchived = false, page = 1, pageSize = 25 } = {}) {
    let query = supabase
      .from('prescriptions')
      .select(PRESCRIPTION_SELECT_FIELDS, { count: 'exact' })
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (!includeArchived) query = query.eq('is_archived', false);

    return apiPaged(query, { page, pageSize });
  },

  async getPrescriptionsByEncounter(encounterId, { status = null, includeArchived = false, page = 1, pageSize = 25 } = {}) {
    let query = supabase
      .from('prescriptions')
      .select(PRESCRIPTION_SELECT_FIELDS, { count: 'exact' })
      .eq('encounter_id', encounterId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (!includeArchived) query = query.eq('is_archived', false);

    return apiPaged(query, { page, pageSize });
  },

  /**
   * Update a single prescription row. Used (today) by the
   * useEncounterPrescriptions back-link path that connects a just-saved
   * free-text prescription to the medication_catalog row the auto-grow
   * RPC minted. The patch is narrow on purpose — we never want this to
   * become a write-anywhere hatch.
   */
  async updatePrescription(id, patch) {
    if (!id) return validationError('Prescription id is required.');
    if (!patch || typeof patch !== 'object') return validationError('Patch object is required.');

    // Closed-set of fields callers may patch through this method. Status
    // transitions, dosage edits, etc. should go through dedicated state-
    // machine methods — not this generic update.
    const ALLOWED = ['medication_catalog_id'];
    const filtered = {};
    for (const key of ALLOWED) {
      if (key in patch) filtered[key] = patch[key];
    }
    if (Object.keys(filtered).length === 0) {
      return validationError('No allowed fields in patch.');
    }

    return apiCall(
      supabase
        .from('prescriptions')
        .update(filtered)
        .eq('id', id)
        .select(PRESCRIPTION_SELECT_FIELDS)
        .single()
    );
  },

  async createOrder(kind, payload) {
    const config = getOrderConfig(kind);
    if (!payload?.[config.requiredField]) {
      return validationError(`${config.requiredField} is required.`);
    }

    const parsed = parse(clinicalOrderSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from(config.table)
        .insert([pickColumns(parsed.data, config.columns)])
        .select(config.fields)
        .single()
    );
  },

  async getOrders(kind, patientId, { status = null, includeArchived = false, page = 1, pageSize = 25 } = {}) {
    const config = getOrderConfig(kind);
    let query = supabase
      .from(config.table)
      .select(config.fields, { count: 'exact' })
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (!includeArchived) query = query.eq('is_archived', false);

    return apiPaged(query, { page, pageSize });
  },

  async getOrdersByEncounter(kind, encounterId, { status = null, includeArchived = false, page = 1, pageSize = 25 } = {}) {
    const config = getOrderConfig(kind);
    let query = supabase
      .from(config.table)
      .select(config.fields, { count: 'exact' })
      .eq('encounter_id', encounterId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (!includeArchived) query = query.eq('is_archived', false);

    return apiPaged(query, { page, pageSize });
  },

  async createDocument(payload) {
    const parsed = parse(clinicalDocumentSchema, payload);
    if (parsed.error) return validationError(parsed.error);
    if (parsed.data.status && parsed.data.status !== 'draft') {
      return validationError('Clinical documents must be created as draft and finalized through the lifecycle RPC.');
    }

    return apiCall(
      supabase
        .from('clinical_documents')
        .insert([parsed.data])
        .select(CLINICAL_DOCUMENT_SELECT_FIELDS)
        .single()
    );
  },

  async createClinicalDocument(payload) {
    return this.createDocument(payload);
  },

  async updateClinicalDocumentDraft(id, payload) {
    if (!id) return validationError('Clinical document id is required.');
    if (!payload || typeof payload !== 'object') return validationError('Clinical document update payload is required.');

    const allowed = ['title', 'content', 'encounter_id', 'doctor_id', 'file_url', 'client_request_id'];
    const updates = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        updates[key] = payload[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return validationError('No allowed clinical document draft fields were provided.');
    }

    const parsed = parse(clinicalDocumentSchema.partial(), updates);
    if (parsed.error) return validationError(parsed.error);

    const parsedUpdates = {};
    for (const key of Object.keys(updates)) {
      if (Object.prototype.hasOwnProperty.call(parsed.data, key)) {
        parsedUpdates[key] = parsed.data[key];
      }
    }

    return apiCall(
      supabase
        .from('clinical_documents')
        .update(parsedUpdates)
        .eq('id', id)
        .eq('status', 'draft')
        .select(CLINICAL_DOCUMENT_SELECT_FIELDS)
        .single()
    );
  },

  async getDocuments(patientId, { documentType = null, includeArchived = false, page = 1, pageSize = 25 } = {}) {
    let query = supabase
      .from('clinical_documents')
      .select(CLINICAL_DOCUMENT_SELECT_FIELDS, { count: 'exact' })
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (documentType) query = query.eq('document_type', documentType);
    if (!includeArchived) query = query.eq('is_archived', false);

    return apiPaged(query, { page, pageSize });
  },

  async getDocumentsByEncounter(encounterId, { documentType = null, includeArchived = false, page = 1, pageSize = 25 } = {}) {
    let query = supabase
      .from('clinical_documents')
      .select(CLINICAL_DOCUMENT_SELECT_FIELDS, { count: 'exact' })
      .eq('encounter_id', encounterId)
      .order('created_at', { ascending: false });

    if (documentType) query = query.eq('document_type', documentType);
    if (!includeArchived) query = query.eq('is_archived', false);

    return apiPaged(query, { page, pageSize });
  },

  async addDocumentAttachment(payload) {
    const parsed = parse(documentAttachmentSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('document_attachments')
        .insert([parsed.data])
        .select(DOCUMENT_ATTACHMENT_SELECT_FIELDS)
        .single()
    );
  },

  async getDocumentAttachmentSignedUrl(attachmentId, { expiresIn = 300 } = {}) {
    const { data: attachment, error } = await apiCall(
      supabase
        .from('document_attachments')
        .select(DOCUMENT_ATTACHMENT_SELECT_FIELDS)
        .eq('id', attachmentId)
        .maybeSingle()
    );

    if (error) return validationError(error);
    if (!attachment) return validationError('Document attachment not found.');

    return storageService.createSignedUrl(
      attachment.storage_bucket || STORAGE_BUCKETS.CLINICAL_DOCUMENTS,
      attachment.storage_path,
      { expiresIn }
    );
  },

  async getDocumentSignedUrl(documentId, { expiresIn = 300 } = {}) {
    const { data: attachment, error } = await apiCall(
      supabase
        .from('document_attachments')
        .select(DOCUMENT_ATTACHMENT_SELECT_FIELDS)
        .eq('document_id', documentId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    );

    if (error) return validationError(error);
    if (!attachment) return validationError('Document attachment not found.');

    return storageService.createSignedUrl(
      attachment.storage_bucket || STORAGE_BUCKETS.CLINICAL_DOCUMENTS,
      attachment.storage_path,
      { expiresIn }
    );
  },

  async finalizeClinicalDocument(documentId) {
    return apiCall(
      supabase
        .rpc('finalize_clinical_document', {
          p_document: documentId,
        })
    );
  },

  async voidClinicalDocument(documentId, { reason = null } = {}) {
    return apiCall(
      supabase
        .rpc('void_clinical_document', {
          p_document: documentId,
          p_reason: reason,
        })
    );
  },

  async createCareTask(payload) {
    const parsed = parse(careTaskSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('care_tasks')
        .insert([parsed.data])
        .select(CARE_TASK_SELECT_FIELDS)
        .single()
    );
  },

  async updateCareTask(id, payload) {
    const parsed = parse(careTaskUpdateSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('care_tasks')
        .update(parsed.data)
        .eq('id', id)
        .select(CARE_TASK_SELECT_FIELDS)
        .single()
    );
  },

  async getCareTaskById(id) {
    return apiCall(
      supabase
        .from('care_tasks')
        .select(CARE_TASK_SELECT_FIELDS)
        .eq('id', id)
        .single()
    );
  },

  async transitionCareTask(id, targetStatus, payload = {}) {
    const { data: current, error } = await this.getCareTaskById(id);
    if (error || !current) {
      return { data: null, error: error || 'Care task not found' };
    }

    try {
      assertTransition('careTask', current.status, targetStatus);
    } catch (transitionError) {
      return { data: null, error: transitionError.message };
    }

    return this.updateCareTask(id, {
      ...payload,
      status: targetStatus,
      completed_at: targetStatus === 'done' ? (payload.completed_at || new Date().toISOString()) : payload.completed_at,
    });
  },

  async getCareTasks({ patientId = null, assignedTo = null, status = null, page = 1, pageSize = 25 } = {}) {
    let query = supabase
      .from('care_tasks')
      .select(CARE_TASK_SELECT_FIELDS, { count: 'exact' })
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (patientId) query = query.eq('patient_id', patientId);
    if (assignedTo) query = query.eq('assigned_to', assignedTo);
    if (status) query = query.eq('status', status);

    return apiPaged(query, { page, pageSize });
  },

  async getCareTasksByEncounter(encounterId, { assignedTo = null, status = null, page = 1, pageSize = 25 } = {}) {
    let query = supabase
      .from('care_tasks')
      .select(CARE_TASK_SELECT_FIELDS, { count: 'exact' })
      .eq('encounter_id', encounterId)
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (assignedTo) query = query.eq('assigned_to', assignedTo);
    if (status) query = query.eq('status', status);

    return apiPaged(query, { page, pageSize });
  },
};
