import { z } from 'zod';
import { nullableNumber, nullableTrimmedString, optionalClientRequestId } from './helpers.js';

export const encounterCreateSchema = z.object({
  appointment_id: z.string().uuid(),
  chief_complaint: nullableTrimmedString(4000).optional(),
  summary: nullableTrimmedString(8000).optional(),
  status: z.enum(['planned', 'in_progress']).optional().default('planned'),
});

export const encounterUpdateSchema = z.object({
  status: z.enum(['planned', 'in_progress', 'completed', 'cancelled', 'entered_in_error']).optional(),
  started_at: z.string().datetime().optional().nullable(),
  ended_at: z.string().datetime().optional().nullable(),
  chief_complaint: nullableTrimmedString(4000).optional(),
  summary: nullableTrimmedString(8000).optional(),
});

export const clinicalNoteSchema = z.object({
  encounter_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  doctor_id: z.string().uuid(),
  author_user_id: z.string().uuid(),
  note_type: z.enum(['subjective', 'objective', 'assessment', 'plan', 'general', 'private']).optional().default('general'),
  content: z.string().trim().min(1).max(12000),
  visibility: z.enum(['clinical', 'doctor_private']).optional().default('clinical'),
});

export const clinicalNoteDraftSaveSchema = z.object({
  encounter_id: z.string().uuid(),
  note_type: z.enum(['subjective', 'objective', 'assessment', 'plan', 'general', 'private']).optional().default('general'),
  content: z.string().max(12000).default(''),
}).refine(
  ({ note_type: noteType, content }) => Boolean(content.trim()) || noteType !== 'general',
  { message: 'Draft must include note text or a non-general note type.' }
);

export const clinicalNoteDraftGetSchema = z.object({
  encounter_id: z.string().uuid(),
});

export const clinicalNoteDraftDiscardSchema = z.object({
  encounter_id: z.string().uuid(),
  status: z.enum(['discarded', 'converted']).optional().default('discarded'),
  converted_note_id: z.string().uuid().optional().nullable(),
}).refine(
  ({ status, converted_note_id: convertedNoteId }) => status !== 'converted' || Boolean(convertedNoteId),
  { message: 'Converted drafts must include the saved clinical note id.' }
);

export const diagnosisSchema = z.object({
  encounter_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  doctor_id: z.string().uuid(),
  disease_id: z.string().uuid().optional().nullable(),
  icd10_code: nullableTrimmedString(40).optional(),
  diagnosis_text: nullableTrimmedString(500).optional(),
  diagnosis_type: z.enum(['primary', 'secondary', 'differential']).optional().default('primary'),
  status: z.enum(['active', 'resolved', 'ruled_out', 'suspected']).optional().default('active'),
  onset_date: z.string().optional().nullable(),
  resolved_at: z.string().datetime().optional().nullable(),
  notes: nullableTrimmedString(4000).optional(),
  recorded_by: z.string().uuid(),
}).refine(
  ({ disease_id: diseaseId, diagnosis_text: diagnosisText }) => Boolean(diseaseId || diagnosisText),
  { message: 'Diagnosis must include a catalog disease or a diagnosis description.' }
);

export const prescriptionSchema = z.object({
  encounter_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  doctor_id: z.string().uuid(),
  medication_name: z.string().trim().min(1).max(240),
  dosage: nullableTrimmedString(240).optional(),
  route: nullableTrimmedString(120).optional(),
  frequency: nullableTrimmedString(240).optional(),
  duration: nullableTrimmedString(240).optional(),
  instructions: nullableTrimmedString(4000).optional(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  status: z.enum(['draft', 'active', 'stopped', 'completed', 'cancelled']).optional().default('active'),
  prescribed_by: z.string().uuid(),
});

export const clinicalOrderSchema = z.object({
  encounter_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  doctor_id: z.string().uuid(),
  title: z.string().trim().min(1).max(240).optional(),
  imaging_type: z.string().trim().min(1).max(240).optional(),
  body_area: nullableTrimmedString(240).optional(),
  instructions: nullableTrimmedString(4000).optional(),
  status: z.enum(['draft', 'ordered', 'in_progress', 'resulted', 'cancelled']).optional().default('draft'),
  ordered_at: z.string().datetime().optional().nullable(),
  resulted_at: z.string().datetime().optional().nullable(),
  result_summary: nullableTrimmedString(8000).optional(),
  result_document_id: z.string().uuid().optional().nullable(),
  ordered_by: z.string().uuid(),
});

export const clinicalDocumentSchema = z.object({
  patient_id: z.string().uuid(),
  encounter_id: z.string().uuid().optional().nullable(),
  doctor_id: z.string().uuid().optional().nullable(),
  document_type: z.enum([
    'report',
    'certificate',
    'referral',
    'prescription',
    'insurance_claim',
    'insurance_form',
    'lab_request',
    'lab_result',
    'imaging_result',
    'other',
  ]),
  title: z.string().trim().min(1).max(240),
  content: nullableTrimmedString(20000).optional(),
  file_url: nullableTrimmedString(2000).optional(),
  status: z.enum(['draft', 'final', 'superseded', 'void']).optional().default('draft'),
  created_by: z.string().uuid(),
  finalized_at: z.string().datetime().optional().nullable(),
  client_request_id: optionalClientRequestId,
});

export const documentAttachmentSchema = z.object({
  document_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  uploaded_by: z.string().uuid().optional().nullable(),
  file_url: z.string().trim().min(1).max(2000),
  file_name: z.string().trim().min(1).max(240),
  mime_type: nullableTrimmedString(120).optional(),
  file_size_bytes: nullableNumber({ integer: true, min: 0 }).optional(),
  storage_bucket: nullableTrimmedString(120).optional(),
  storage_path: nullableTrimmedString(2000).optional(),
});

export const careTaskSchema = z.object({
  patient_id: z.string().uuid().optional().nullable(),
  encounter_id: z.string().uuid().optional().nullable(),
  appointment_id: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  created_by: z.string().uuid(),
  task_type: z.enum(['follow_up', 'call_patient', 'review_result', 'insurance', 'admin', 'other']).optional().default('other'),
  title: z.string().trim().min(1).max(240),
  description: nullableTrimmedString(4000).optional(),
  due_at: z.string().datetime().optional().nullable(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
  status: z.enum(['open', 'in_progress', 'done', 'cancelled']).optional().default('open'),
  client_request_id: optionalClientRequestId,
});

export const careTaskUpdateSchema = z.object({
  patient_id: z.string().uuid().optional().nullable(),
  encounter_id: z.string().uuid().optional().nullable(),
  appointment_id: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  task_type: z.enum(['follow_up', 'call_patient', 'review_result', 'insurance', 'admin', 'other']).optional(),
  title: z.string().trim().min(1).max(240).optional(),
  description: nullableTrimmedString(4000).optional(),
  due_at: z.string().datetime().optional().nullable(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  status: z.enum(['open', 'in_progress', 'done', 'cancelled']).optional(),
  completed_at: z.string().datetime().optional().nullable(),
  is_archived: z.boolean().optional(),
});
