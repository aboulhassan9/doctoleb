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

/* ── Document Templates ──────────────────────────────────────────── */
export {
  documentTemplateCreateSchema,
  documentTemplateUpdateSchema,
  templateFieldSchema,
  templateSectionSchema,
  TEMPLATE_FIELD_TYPES,
  TEMPLATE_TYPES,
  TEMPLATE_TYPE_LABELS,
  TEMPLATE_AUTOFILL_KEYS,
  MAX_SECTIONS_PER_TEMPLATE,
  MAX_FIELDS_PER_SECTION,
} from './documentTemplates.js';

/* ── Medication Catalog ──────────────────────────────────────────── */
export {
  medicationCatalogCreateSchema,
  medicationCatalogUpdateSchema,
} from './medicationCatalog.js';

/* ── Analytical Reports ──────────────────────────────────────────── */
export {
  analyticalReportDefinitionSchema,
  analyticalReportCreateSchema,
  analyticalReportVersionCreateSchema,
  analyticalReportRunRequestSchema,
  REPORT_DATA_SOURCES,
  REPORT_DATA_SOURCE_COLUMNS,
  REPORT_FILTER_OPERATORS,
  REPORT_AGGREGATION_FUNCTIONS,
  REPORT_TIME_GRANULARITIES,
  REPORT_VISUALIZATIONS,
} from './analyticalReports.js';

/* ── Advanced Report Definitions ────────────────────────────────── */
export {
  REPORT_AUTHORING_MODES,
  REPORT_BINDINGS,
  REPORT_CANVAS_FIELD_TYPES,
  REPORT_DIRECTIONS,
  REPORT_FONT_FAMILIES,
  REPORT_ORIENTATIONS,
  REPORT_PAGE_SIZES,
  REPORT_RENDER_PROFILES,
  REPORT_SCHEMA_VERSION,
  REPORT_SUPPORTED_LOCALES,
  REPORT_TEMPLATE_ASSET_CONTENT_TYPES,
  REPORT_TEMPLATE_ASSET_MAX_BYTES,
  REPORT_TEMPLATE_ASSET_MAX_DIMENSION_PX,
  REPORT_TEMPLATE_ASSET_TYPES,
  localizedTextSchema,
  pdfmeTemplateEnvelopeSchema,
  reportBlockSchema,
  reportDefinitionSchema,
  reportFieldGroupSchema,
  reportFieldSchema,
  reportRenderJobCreateSchema,
  reportTemplateAssetCreateSchema,
  reportTemplateVersionCreateSchema,
} from './reportDefinitions.js';
