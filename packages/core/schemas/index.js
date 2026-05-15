/**
 * Schema barrel — re-exports from domain-specific modules.
 *
 * All schema definitions live in their respective domain files.
 * This barrel preserves the existing public API so that every consumer
 * (`import { ... } from '@/schemas'`) continues to work unchanged.
 */

/* ── Shared helpers & parse utility ─────────────────────────────── */
export { parseWithSchema } from './helpers.js';

/* ── Auth ────────────────────────────────────────────────────────── */
export {
  EMAIL_OTP_CODE_LENGTH,
  authSignInSchema,
  authOtpRequestSchema,
  authOtpVerifySchema,
  authSignUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.js';

/* ── Appointments ────────────────────────────────────────────────── */
export {
  appointmentBookingSchema,
  appointmentCancelSchema,
} from './appointments.js';

/* ── Patients ────────────────────────────────────────────────────── */
export {
  patientProfileUpdateSchema,
  patientCreateSchema,
  walkInPatientSchema,
  patientConsentSchema,
  patientDeviceSchema,
} from './patients.js';

/* ── Clinical ────────────────────────────────────────────────────── */
export {
  encounterCreateSchema,
  encounterUpdateSchema,
  clinicalNoteSchema,
  clinicalNoteDraftSaveSchema,
  clinicalNoteDraftGetSchema,
  clinicalNoteDraftDiscardSchema,
  diagnosisSchema,
  prescriptionSchema,
  clinicalOrderSchema,
  clinicalDocumentSchema,
  documentAttachmentSchema,
  careTaskSchema,
  careTaskUpdateSchema,
} from './clinical.js';

/* ── Messaging ───────────────────────────────────────────────────── */
export {
  conversationCreateSchema,
  messageCreateSchema,
  conversationParticipantSchema,
  messageAttachmentSchema,
} from './messaging.js';

/* ── Notifications ───────────────────────────────────────────────── */
export {
  notificationEventSchema,
  notificationDeliverySchema,
  notificationDeliveryUpdateSchema,
} from './notifications.js';

/* ── Staff ────────────────────────────────────────────────────────── */
export {
  staffMemberSchema,
  staffInviteSchema,
  staffMemberUpdateSchema,
  staffMemberDisableSchema,
  staffInviteResendSchema,
  staffInviteReissueSchema,
  staffMemberReactivateSchema,
} from './staff.js';

/* ── Insurance ───────────────────────────────────────────────────── */
export {
  doctorInsuranceContractSchema,
  patientInsurancePolicySchema,
  insuranceClaimSchema,
} from './insurance.js';

/* ── Scheduling ──────────────────────────────────────────────────── */
export {
  doctorScheduleTemplateSchema,
  manualSlotSchema,
  recurringSlotsSchema,
} from './scheduling.js';

/* ── Tenant ──────────────────────────────────────────────────────── */
export {
  tenantProfileUpdateSchema,
  tenantAppConfigUpdateSchema,
} from './tenant.js';

/* ── Medical Intakes ─────────────────────────────────────────────── */
export {
  medicalIntakeDraftSchema,
  medicalIntakeCompletionSchema,
  medicalIntakeReopenSchema,
  patientVaccinationSchema,
  patientSurgerySchema,
  patientDiseaseSchema,
  patientFamilyHistorySchema,
  patientHistorySchemas,
} from './intake.js';

/* ── Catalogs & Clinics ──────────────────────────────────────────── */
export {
  catalogEntrySchema,
  clinicSchema,
  archiveMutationSchema,
} from './catalogs.js';

/* ── Prechecks ───────────────────────────────────────────────────── */
export {
  precheckDraftSchema,
  precheckSubmitSchema,
} from './prechecks.js';

/* ── Payments ────────────────────────────────────────────────────── */
export {
  paymentCreateSchema,
  paymentUpdateSchema,
} from './payments.js';

/* ── Service response shapes (F3) ────────────────────────────────── */
export {
  appointmentBookFromSlotResponseSchema,
  walkInPatientCreateResponseSchema,
  sessionUserResponseSchema,
} from './responses.js';
