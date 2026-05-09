import { z } from 'zod';
import {
  SUPPORTED_CONVERSATION_PARTICIPANT_ROLES,
  SUPPORTED_STAFF_MEMBER_ROLES,
} from '../lib/roles.js';

const PHONE_REGEX = /^\+?[\d\s-]{8,20}$/;

const blankToNull = (value) => {
  if (value === '' || value === undefined || value === null) {
    return null;
  }

  return value;
};

const nullableTrimmedString = (maxLength = 2000) => z.preprocess(
  blankToNull,
  z.string().trim().max(maxLength).nullable()
);

const nullablePhone = z.preprocess(
  blankToNull,
  z.string().trim().regex(PHONE_REGEX, 'Please enter a valid phone number.').nullable()
);

const nullableNumber = ({ integer = false, min = null, max = null } = {}) => z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    const normalizedValue = Number(value);
    return Number.isNaN(normalizedValue) ? value : normalizedValue;
  },
  (() => {
    let schema = integer ? z.number().int() : z.number();
    if (typeof min === 'number') schema = schema.min(min);
    if (typeof max === 'number') schema = schema.max(max);
    return schema.nullable();
  })()
);

const optionalClientRequestId = z.string().uuid().optional().nullable();

export const archiveMutationSchema = z.object({
  archivedBy: z.string().uuid(),
});

export const authSignInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const authSignUpSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  confirmPassword: z.string().min(8, 'Password confirmation is required.'),
}).refine(
  ({ password, confirmPassword }) => password === confirmPassword,
  {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  }
);

export const appointmentBookingSchema = z.object({
  slotId: z.string().uuid(),
  patientId: z.string().uuid(),
  bookedBy: z.string().uuid(),
  visitTypeId: z.string().uuid().nullable().optional(),
  reason: z.string().trim().min(1).max(1000),
  durationMinutes: z.number().int().min(5).max(240).default(30),
  status: z.literal('scheduled').optional().default('scheduled'),
});

export const appointmentCancelSchema = z.object({
  appointmentId: z.string().uuid(),
  reason: nullableTrimmedString(1000).optional(),
});

export const patientProfileUpdateSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  phone: nullablePhone,
  date_of_birth: z.preprocess(blankToNull, z.string().trim().nullable()),
  sex: nullableTrimmedString(40),
  blood_type: nullableTrimmedString(10),
  allergies: nullableTrimmedString(4000),
  insurance_id: nullableTrimmedString(120),
  emergency_contact: nullableTrimmedString(120),
  emergency_phone: nullablePhone,
  medical_history: nullableTrimmedString(8000),
});

export const patientCreateSchema = z.object({
  user_id: z.string().uuid(),
  date_of_birth: z.preprocess(blankToNull, z.string().trim().nullable()).optional(),
  sex: nullableTrimmedString(40).optional(),
  blood_type: nullableTrimmedString(10).optional(),
  allergies: nullableTrimmedString(4000).optional(),
  medical_history: nullableTrimmedString(8000).optional(),
  insurance_id: nullableTrimmedString(120).optional(),
  emergency_contact: nullableTrimmedString(120).optional(),
  emergency_phone: nullablePhone.optional(),
});

export const walkInPatientSchema = z.object({
  full_name: z.string().trim().min(1).max(160),
  phone: nullablePhone.optional(),
  email: z.preprocess(blankToNull, z.string().trim().email().nullable()).optional(),
  date_of_birth: z.preprocess(blankToNull, z.string().trim().nullable()).optional(),
});

export const precheckDraftSchema = z.object({
  patientId: z.string().uuid(),
  predoctorId: z.string().uuid().nullable().optional(),
  bloodPressure: nullableTrimmedString(40),
  heartRate: nullableNumber({ integer: true, min: 1, max: 300 }),
  temperature: nullableNumber({ min: 20, max: 50 }),
  weight: nullableNumber({ min: 1, max: 1000 }),
  height: nullableNumber({ min: 1, max: 300 }),
  currentMedications: nullableTrimmedString(4000),
  allergies: nullableTrimmedString(4000),
  symptoms: nullableTrimmedString(4000),
  isUrgent: z.boolean().optional().default(false),
});

export const precheckSubmitSchema = precheckDraftSchema.extend({
  bloodPressure: z.string().trim().min(1, 'Blood pressure is required.').max(40),
  heartRate: z.number().int().min(1).max(300),
  temperature: z.number().min(20).max(50),
});

export const paymentCreateSchema = z.object({
  patient_id: z.string().uuid(),
  doctor_id: z.string().uuid(),
  appointment_id: z.string().uuid().optional().nullable(),
  amount: z.coerce.number().positive('Amount must be greater than zero.'),
  currency: z.string().trim().min(1).max(10).optional().default('USD'),
  status: z.enum(['pending', 'completed', 'failed', 'refunded']).optional().default('pending'),
  payment_method: nullableTrimmedString(120),
  transaction_id: nullableTrimmedString(240),
});

export const paymentUpdateSchema = z.object({
  patient_id: z.string().uuid().optional(),
  doctor_id: z.string().uuid().optional(),
  appointment_id: z.string().uuid().optional().nullable(),
  amount: z.coerce.number().positive('Amount must be greater than zero.').optional(),
  currency: z.string().trim().min(1).max(10).optional(),
  status: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
  payment_method: nullableTrimmedString(120).optional(),
  transaction_id: nullableTrimmedString(240).optional(),
});

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

export const conversationCreateSchema = z.object({
  patient_id: z.string().uuid().optional().nullable(),
  subject: nullableTrimmedString(240).optional(),
  conversation_type: z.enum(['patient_staff', 'internal', 'support']).optional().default('patient_staff'),
  created_by: z.string().uuid().optional().nullable(),
});

export const messageCreateSchema = z.object({
  conversation_id: z.string().uuid(),
  sender_user_id: z.string().uuid().optional().nullable(),
  sender_patient_id: z.string().uuid().optional().nullable(),
  body: z.string().trim().min(1).max(8000),
  message_type: z.enum(['text', 'system']).optional().default('text'),
  is_internal: z.boolean().optional().default(false),
  client_request_id: optionalClientRequestId,
}).refine(
  ({ sender_user_id: senderUserId, sender_patient_id: senderPatientId }) => Boolean(senderUserId || senderPatientId),
  { message: 'Message must include a sender.' }
);

export const conversationParticipantSchema = z.object({
  conversation_id: z.string().uuid(),
  user_id: z.string().uuid().optional().nullable(),
  staff_member_id: z.string().uuid().optional().nullable(),
  patient_id: z.string().uuid().optional().nullable(),
  role: z.enum(SUPPORTED_CONVERSATION_PARTICIPANT_ROLES),
  is_active: z.boolean().optional().default(true),
  last_read_at: z.string().datetime().optional().nullable(),
}).refine(
  ({ user_id: userId, staff_member_id: staffMemberId, patient_id: patientId }) => Boolean(userId || staffMemberId || patientId),
  { message: 'Conversation participant must include a user, staff member, or patient.' }
);

export const messageAttachmentSchema = z.object({
  message_id: z.string().uuid(),
  uploaded_by: z.string().uuid().optional().nullable(),
  file_url: z.string().trim().min(1).max(2000),
  file_name: z.string().trim().min(1).max(240),
  mime_type: nullableTrimmedString(120).optional(),
  file_size_bytes: nullableNumber({ integer: true, min: 0 }).optional(),
  storage_bucket: nullableTrimmedString(120).optional(),
  storage_path: nullableTrimmedString(2000).optional(),
});

export const patientDeviceSchema = z.object({
  patient_id: z.string().uuid(),
  user_id: z.string().uuid(),
  platform: z.enum(['ios', 'android', 'web']),
  push_token: z.string().trim().min(16).max(4096),
  device_label: nullableTrimmedString(240).optional(),
  app_version: nullableTrimmedString(80).optional(),
  locale: nullableTrimmedString(20).optional(),
  timezone: nullableTrimmedString(80).optional(),
  is_active: z.boolean().optional().default(true),
  last_seen_at: z.string().datetime().optional().nullable(),
});

export const notificationEventSchema = z.object({
  user_id: z.string().uuid().optional().nullable(),
  patient_id: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1).max(240),
  body: z.string().trim().min(1).max(2000),
  event_type: z.string().trim().min(1).max(120),
  related_type: nullableTrimmedString(120).optional(),
  related_id: z.string().uuid().optional().nullable(),
  severity: z.enum(['info', 'success', 'warning', 'urgent']).optional().default('info'),
  status: z.enum(['queued', 'sent', 'failed', 'cancelled']).optional().default('queued'),
  scheduled_for: z.string().datetime().optional().nullable(),
  created_by: z.string().uuid().optional().nullable(),
  source: z.enum(['user', 'system']).optional().default('user'),
  client_request_id: optionalClientRequestId,
}).refine(
  ({ user_id: userId, patient_id: patientId }) => Boolean(userId || patientId),
  { message: 'Notification event must target a user or patient.' }
).refine(
  ({ source, created_by: createdBy }) => source === 'system' || Boolean(createdBy),
  { message: 'User-originated notification events must include created_by.' }
);

export const notificationDeliverySchema = z.object({
  event_id: z.string().uuid(),
  user_id: z.string().uuid().optional().nullable(),
  device_id: z.string().uuid().optional().nullable(),
  channel: z.enum(['in_app', 'push', 'email', 'sms']),
  status: z.enum(['queued', 'sent', 'failed', 'read', 'cancelled']).optional().default('queued'),
  provider_message_id: nullableTrimmedString(240).optional(),
  error_message: nullableTrimmedString(2000).optional(),
  sent_at: z.string().datetime().optional().nullable(),
  read_at: z.string().datetime().optional().nullable(),
  client_request_id: optionalClientRequestId,
});

export const notificationDeliveryUpdateSchema = notificationDeliverySchema.partial().omit({
  event_id: true,
});

export const patientConsentSchema = z.object({
  patient_id: z.string().uuid(),
  consent_document_id: z.string().uuid(),
  accepted_by_user_id: z.string().uuid(),
  acceptance_method: z.enum(['patient_self', 'staff_assisted', 'kiosk']).optional().default('patient_self'),
  accepted_at: z.string().datetime().optional(),
  revoked_at: z.string().datetime().optional().nullable(),
});

export const tenantProfileUpdateSchema = z.object({
  tenant_slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  display_name: z.string().trim().min(1).max(160).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  default_locale: z.string().trim().min(2).max(20).optional(),
  status: z.enum(['active', 'maintenance', 'disabled']).optional(),
  schema_version: z.string().trim().min(1).max(80).optional(),
});

export const tenantAppConfigUpdateSchema = z.object({
  app_name: z.string().trim().min(1).max(160).optional(),
  app_tagline: nullableTrimmedString(240).optional(),
  splash_logo_url: nullableTrimmedString(2000).optional(),
  icon_url: nullableTrimmedString(2000).optional(),
  primary_color: nullableTrimmedString(20).optional(),
  secondary_color: nullableTrimmedString(20).optional(),
  maintenance_message: nullableTrimmedString(1000).optional(),
  min_supported_version: nullableTrimmedString(80).optional(),
  force_update_version: nullableTrimmedString(80).optional(),
  enabled_locales: z.array(z.string().trim().min(2).max(20)).optional(),
  support_phone: nullablePhone.optional(),
  support_email: z.preprocess(blankToNull, z.string().trim().email().nullable()).optional(),
});

export const medicalIntakeDraftSchema = z.object({
  patient_id: z.string().uuid(),
  status: z.enum(['draft', 'completed', 'reopened']).optional().default('draft'),
  collected_by: z.string().uuid().optional().nullable(),
  occupation_id: z.string().uuid().optional().nullable(),
  occupation_other: nullableTrimmedString(240).optional(),
  blood_group_id: nullableNumber({ integer: true, min: 1 }).optional(),
  marital_status: z.enum(['single', 'married', 'divorced', 'widowed', 'other']).optional().nullable(),
  living_with: nullableTrimmedString(240).optional(),
  smoking_status: z.enum(['never', 'former', 'current_light', 'current_heavy', 'unknown']).optional().nullable(),
  alcohol_use: z.enum(['none', 'occasional', 'moderate', 'heavy']).optional().nullable(),
  exercise_frequency: z.enum(['none', 'rare', 'weekly', 'daily']).optional().nullable(),
  allergies_text: nullableTrimmedString(4000).optional(),
  current_medications_text: nullableTrimmedString(4000).optional(),
  notes: nullableTrimmedString(8000).optional(),
});

export const medicalIntakeCompletionSchema = z.object({
  patientId: z.string().uuid(),
  completedBy: z.string().uuid(),
});

export const medicalIntakeReopenSchema = z.object({
  patientId: z.string().uuid(),
  reopenedBy: z.string().uuid(),
  reason: nullableTrimmedString(1000).optional(),
});

export const patientVaccinationSchema = z.object({
  patient_id: z.string().uuid(),
  vaccine_id: z.string().uuid(),
  status: z.enum(['received', 'scheduled', 'overdue', 'declined', 'unknown']).optional().default('unknown'),
  given_at: z.string().optional().nullable(),
  due_at: z.string().optional().nullable(),
  dose_number: nullableNumber({ integer: true, min: 1, max: 20 }).optional(),
  lot_number: nullableTrimmedString(120).optional(),
  administered_by: nullableTrimmedString(240).optional(),
  notes: nullableTrimmedString(4000).optional(),
  recorded_by: z.string().uuid().optional().nullable(),
});

export const patientSurgerySchema = z.object({
  patient_id: z.string().uuid(),
  surgery_type_id: z.string().uuid(),
  performed_at: z.string().optional().nullable(),
  hospital_name: nullableTrimmedString(240).optional(),
  surgeon_name: nullableTrimmedString(240).optional(),
  notes: nullableTrimmedString(4000).optional(),
  recorded_by: z.string().uuid().optional().nullable(),
});

export const patientDiseaseSchema = z.object({
  patient_id: z.string().uuid(),
  disease_id: z.string().uuid(),
  status: z.enum(['active', 'resolved', 'chronic', 'in_remission', 'suspected']).optional().default('active'),
  severity: z.enum(['mild', 'moderate', 'severe']).optional().nullable(),
  diagnosed_at: z.string().optional().nullable(),
  notes: nullableTrimmedString(4000).optional(),
  recorded_by: z.string().uuid().optional().nullable(),
});

export const patientFamilyHistorySchema = z.object({
  patient_id: z.string().uuid(),
  relation_id: nullableNumber({ integer: true, min: 1 }).optional(),
  disease_id: z.string().uuid().optional().nullable(),
  condition_text: nullableTrimmedString(240).optional(),
  age_at_onset: nullableNumber({ integer: true, min: 0, max: 130 }).optional(),
  is_deceased: z.boolean().optional().default(false),
  death_cause_disease_id: z.string().uuid().optional().nullable(),
  death_cause_text: nullableTrimmedString(240).optional(),
  notes: nullableTrimmedString(4000).optional(),
  recorded_by: z.string().uuid().optional().nullable(),
}).refine(
  ({ disease_id: diseaseId, condition_text: conditionText }) => Boolean(diseaseId || conditionText),
  { message: 'Family history must include a catalog disease or condition text.' }
);

export const patientHistorySchemas = {
  vaccinations: patientVaccinationSchema,
  surgeries: patientSurgerySchema,
  diseases: patientDiseaseSchema,
  family_history: patientFamilyHistorySchema,
};

export const doctorInsuranceContractSchema = z.object({
  doctor_id: z.string().uuid(),
  provider_id: z.string().uuid(),
  doctor_provider_code: nullableTrimmedString(120).optional(),
  contract_number: nullableTrimmedString(120).optional(),
  valid_from: z.string().optional().nullable(),
  valid_to: z.string().optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

export const patientInsurancePolicySchema = z.object({
  patient_id: z.string().uuid(),
  provider_id: z.string().uuid(),
  policy_number: z.string().trim().min(1).max(160),
  policyholder_name: nullableTrimmedString(240).optional(),
  valid_from: z.string().optional().nullable(),
  valid_to: z.string().optional().nullable(),
  is_primary: z.boolean().optional().default(false),
});

export const insuranceClaimSchema = z.object({
  encounter_id: z.string().uuid().optional().nullable(),
  patient_id: z.string().uuid(),
  doctor_id: z.string().uuid(),
  policy_id: z.string().uuid().optional().nullable(),
  template_id: z.string().uuid().optional().nullable(),
  amount: z.coerce.number().nonnegative(),
  amount_paid_by_insurer: z.coerce.number().nonnegative().optional().default(0),
  amount_paid_by_patient: z.coerce.number().nonnegative().optional().default(0),
  diagnosis_code: nullableTrimmedString(80).optional(),
  claim_form_pdf_url: nullableTrimmedString(2000).optional(),
  status: z.enum(['draft', 'printed', 'submitted', 'paid', 'rejected']).optional().default('draft'),
  printed_at: z.string().datetime().optional().nullable(),
  submitted_at: z.string().datetime().optional().nullable(),
  paid_at: z.string().datetime().optional().nullable(),
  created_by: z.string().uuid().optional().nullable(),
});

export const doctorScheduleTemplateSchema = z.object({
  doctor_id: z.string().uuid(),
  clinic_id: z.string().uuid(),
  weekday: z.coerce.number().int().min(0).max(6),
  start_time: z.string().trim().min(4).max(12),
  end_time: z.string().trim().min(4).max(12),
  slot_duration_minutes: z.coerce.number().int().min(5).max(480).optional().default(30),
  is_active: z.boolean().optional().default(true),
  effective_from: z.string().optional().nullable(),
  effective_to: z.string().optional().nullable(),
}).refine(
  ({ start_time: startTime, end_time: endTime }) => endTime > startTime,
  { message: 'Schedule end time must be after start time.' }
);

export const staffMemberSchema = z.object({
  user_id: z.string().uuid().optional().nullable(),
  doctor_id: z.string().uuid(),
  role: z.enum(SUPPORTED_STAFF_MEMBER_ROLES),
  display_name: z.string().trim().min(1).max(160),
  phone: nullablePhone.optional(),
  email: z.preprocess(blankToNull, z.string().trim().email().nullable()).optional(),
  invite_status: z.enum(['none', 'invited', 'accepted', 'disabled']).optional().default('none'),
  reports_to: z.string().uuid().optional().nullable(),
  hire_date: z.string().optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

export const staffInviteSchema = z.object({
  role: z.enum(SUPPORTED_STAFF_MEMBER_ROLES),
  display_name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  phone: nullablePhone.optional(),
  hire_date: z.string().optional().nullable(),
  client_request_id: optionalClientRequestId,
});

export const staffMemberUpdateSchema = z.object({
  display_name: z.string().trim().min(1).max(160).optional(),
  phone: nullablePhone.optional(),
  hire_date: z.string().optional().nullable(),
});

export const staffMemberDisableSchema = z.object({
  staff_member_id: z.string().uuid(),
});

export const staffInviteResendSchema = z.object({
  staff_member_id: z.string().uuid(),
  client_request_id: z.string().uuid(),
});

export const staffInviteReissueSchema = z.object({
  staff_member_id: z.string().uuid(),
  client_request_id: z.string().uuid(),
});

export const staffMemberReactivateSchema = z.object({
  staff_member_id: z.string().uuid(),
});

export const catalogEntrySchema = z.object({
  code: z.string().trim().min(1).max(120).optional(),
  name: z.string().trim().min(1).max(240),
  description: nullableTrimmedString(2000).optional(),
  is_active: z.boolean().optional().default(true),
  is_system: z.boolean().optional(),
  country: nullableTrimmedString(120).optional(),
  category: nullableTrimmedString(120).optional(),
  icd10_code: nullableTrimmedString(40).optional(),
  body_system: nullableTrimmedString(120).optional(),
  typical_doses: nullableNumber({ integer: true, min: 0, max: 20 }).optional(),
  default_duration_minutes: nullableNumber({ integer: true, min: 5, max: 480 }).optional(),
  default_fee: nullableNumber({ min: 0 }).optional(),
  requires_intake: z.boolean().optional(),
  billable_service_id: z.string().uuid().optional().nullable(),
});

export const clinicSchema = z.object({
  name: z.string().trim().min(1).max(240),
  address: nullableTrimmedString(1000).optional(),
  location_type: z.enum(['hospital', 'medical_group', 'private_clinic', 'other']).optional().default('private_clinic'),
  city_id: z.string().uuid().optional().nullable(),
  phone: nullablePhone.optional(),
  working_hours: z.record(z.string(), z.unknown()).optional().nullable(),
  is_primary: z.boolean().optional().default(false),
  notes: nullableTrimmedString(2000).optional(),
  latitude: nullableNumber().optional(),
  longitude: nullableNumber().optional(),
  map_url: nullableTrimmedString(2000).optional(),
  floor: nullableTrimmedString(80).optional(),
  room: nullableTrimmedString(80).optional(),
});

export const manualSlotSchema = z.object({
  doctor_id: z.string().uuid(),
  clinic_id: z.string().uuid(),
  schedule_template_id: z.string().uuid().optional().nullable(),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}/),
  start_time: z.string().trim().min(4).max(12),
  end_time: z.string().trim().min(4).max(12),
  is_active: z.boolean().optional().default(true),
  created_by: z.string().uuid(),
  recurrence_group_id: z.string().uuid().optional().nullable(),
}).refine(
  ({ start_time: startTime, end_time: endTime }) => endTime > startTime,
  { message: 'Slot end time must be after start time.' }
);

export const recurringSlotsSchema = z.object({
  doctor_id: z.string().uuid(),
  clinic_id: z.string().uuid(),
  start_time: z.string().trim().min(4).max(12),
  end_time: z.string().trim().min(4).max(12),
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1).max(7),
  occurrences: z.coerce.number().int().min(1).max(730),
  created_by: z.string().uuid(),
}).refine(
  ({ start_time: startTime, end_time: endTime }) => endTime > startTime,
  { message: 'Recurring slot end time must be after start time.' }
);

export function parseWithSchema(schema, payload) {
  const result = schema.safeParse(payload);

  if (!result.success) {
    return {
      data: null,
      error: result.error.issues[0]?.message || 'Invalid request payload.',
    };
  }

  return {
    data: result.data,
    error: null,
  };
}
