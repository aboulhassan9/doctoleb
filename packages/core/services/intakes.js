import { supabase } from '@/lib/supabase';
import { apiCall, apiPaged } from './api';
import {
  MEDICAL_INTAKE_SELECT_FIELDS,
  PATIENT_DISEASE_SELECT_FIELDS,
  PATIENT_FAMILY_HISTORY_SELECT_FIELDS,
  PATIENT_SURGERY_SELECT_FIELDS,
  PATIENT_VACCINATION_SELECT_FIELDS,
} from '@/lib/selects';
import {
  archiveMutationSchema,
  medicalIntakeCompletionSchema,
  medicalIntakeDraftSchema,
  medicalIntakeReopenSchema,
  patientHistorySchemas,
} from '@/schemas';
import { validationError, parse } from '@/lib/serviceHelpers';

const HISTORY_TABLES = {
  vaccinations: {
    table: 'patient_vaccinations',
    fields: PATIENT_VACCINATION_SELECT_FIELDS,
    orderColumn: 'given_at',
  },
  surgeries: {
    table: 'patient_surgeries',
    fields: PATIENT_SURGERY_SELECT_FIELDS,
    orderColumn: 'performed_at',
  },
  diseases: {
    table: 'patient_diseases',
    fields: PATIENT_DISEASE_SELECT_FIELDS,
    orderColumn: 'diagnosed_at',
  },
  family_history: {
    table: 'patient_family_history',
    fields: PATIENT_FAMILY_HISTORY_SELECT_FIELDS,
    orderColumn: 'created_at',
  },
};

function getHistoryConfig(kind) {
  const config = HISTORY_TABLES[kind];
  if (!config) {
    throw new Error(`Unsupported intake history kind: ${kind}`);
  }
  return config;
}

function getHistorySchema(kind, { partial = false } = {}) {
  const schema = patientHistorySchemas[kind];
  if (!schema) {
    throw new Error(`Unsupported intake history kind: ${kind}`);
  }
  return partial ? schema.partial() : schema;
}

export const intakeService = {
  async getByPatientId(patientId) {
    return apiCall(
      supabase
        .from('medical_intake')
        .select(MEDICAL_INTAKE_SELECT_FIELDS)
        .eq('patient_id', patientId)
        .maybeSingle()
    );
  },

  async saveDraft(payload) {
    const parsed = parse(medicalIntakeDraftSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('medical_intake')
        .upsert({ ...parsed.data, status: parsed.data.status || 'draft' }, { onConflict: 'patient_id' })
        .select(MEDICAL_INTAKE_SELECT_FIELDS)
        .single()
    );
  },

  async markCompleted(patientId, completedBy) {
    const parsed = parse(medicalIntakeCompletionSchema, { patientId, completedBy });
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('medical_intake')
        .update({
          status: 'completed',
          completed_by: parsed.data.completedBy,
          completed_at: new Date().toISOString(),
        })
        .eq('patient_id', parsed.data.patientId)
        .select(MEDICAL_INTAKE_SELECT_FIELDS)
        .single()
    );
  },

  async reopen(patientId, reopenedBy, reason) {
    const parsed = parse(medicalIntakeReopenSchema, { patientId, reopenedBy, reason });
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('medical_intake')
        .update({
          status: 'reopened',
          reopened_by: parsed.data.reopenedBy,
          reopened_at: new Date().toISOString(),
          reopen_reason: parsed.data.reason || null,
        })
        .eq('patient_id', parsed.data.patientId)
        .select(MEDICAL_INTAKE_SELECT_FIELDS)
        .single()
    );
  },

  async getHistory(patientId, kind, { includeArchived = false, page = 1, pageSize = 25 } = {}) {
    const { table, fields, orderColumn } = getHistoryConfig(kind);
    let query = supabase
      .from(table)
      .select(fields, { count: 'exact' })
      .eq('patient_id', patientId)
      .order(orderColumn, { ascending: false, nullsFirst: false });

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    return apiPaged(query, { page, pageSize });
  },

  async addHistory(kind, payload) {
    const { table, fields } = getHistoryConfig(kind);
    const parsed = parse(getHistorySchema(kind), payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from(table)
        .insert([parsed.data])
        .select(fields)
        .single()
    );
  },

  async updateHistory(kind, id, payload) {
    const { table, fields } = getHistoryConfig(kind);
    const parsed = parse(getHistorySchema(kind, { partial: true }), payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from(table)
        .update(parsed.data)
        .eq('id', id)
        .select(fields)
        .single()
    );
  },

  async archiveHistory(kind, id, archivedBy) {
    const { table, fields } = getHistoryConfig(kind);
    const parsed = parse(archiveMutationSchema, { archivedBy });
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from(table)
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: parsed.data.archivedBy,
        })
        .eq('id', id)
        .select(fields)
        .single()
    );
  },
};
