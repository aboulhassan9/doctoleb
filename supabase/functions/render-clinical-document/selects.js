/**
 * selects.js — Renderer-narrow PostgREST SELECT strings.
 *
 * This is a *deliberate mirror* of the canonical select constants in
 * `packages/core/lib/selects.js`. Supabase Edge Functions deploy from the
 * function directory only, so we cannot import from `packages/core` at
 * runtime; the contract test at `tests/unit/edge/renderSelectsDrift.test.mjs`
 * statically asserts that every column referenced here also appears in the
 * canonical constants (or in USER_CONTACT_FIELDS for joined columns).
 *
 * Add a column here? Add it to the canonical constant first, then mirror it.
 * Otherwise the drift test will fail.
 *
 * The strings here are intentionally narrower than the canonical ones — the
 * renderer only needs identity, branding, and a few clinical attributes, not
 * (e.g.) blood_type or allergies. Carrying the full selects would waste
 * payload and leak data the renderer has no use for.
 */

// Joined user columns (id is required by PostgREST to fulfill the FK).
const USER_RENDER_FIELDS = 'id, first_name, last_name, phone, email';

export const CLINICAL_DOCUMENT_RENDER_FIELDS = [
  'id',
  'title',
  'document_type',
  'status',
  'content',
  'client_request_id',
  'created_at',
  'encounter_id',
  'patient_id',
  'doctor_id',
  'template_id',
].join(', ');

export const DOCUMENT_TEMPLATE_RENDER_FIELDS = [
  'id',
  'name',
  'template_type',
  'sections',
].join(', ');

export const PATIENT_RENDER_FIELDS = [
  'id',
  'date_of_birth',
  'sex',
  `users!patients_user_id_fkey(${USER_RENDER_FIELDS})`,
].join(', ');

export const DOCTOR_RENDER_FIELDS = [
  'id',
  'specialization',
  'license_number',
  `users!doctors_user_id_fkey(${USER_RENDER_FIELDS})`,
].join(', ');

export const ENCOUNTER_RENDER_FIELDS = [
  'id',
  'chief_complaint',
  'summary',
  'started_at',
  'clinic_id',
].join(', ');

export const CLINIC_RENDER_FIELDS = [
  'id',
  'name',
  'address',
  'phone',
].join(', ');

export const TENANT_PROFILE_RENDER_FIELDS = [
  'id',
  'tenant_slug',
  'display_name',
  'timezone',
  'default_locale',
].join(', ');

export const TENANT_APP_CONFIG_RENDER_FIELDS = [
  'profile_id',
  'primary_color',
  'secondary_color',
  'splash_logo_url',
  'icon_url',
  'support_phone',
  'support_email',
].join(', ');

// Exposed for the drift contract test.
export const _RENDER_SELECTS_FOR_TEST = {
  CLINICAL_DOCUMENT_RENDER_FIELDS,
  DOCUMENT_TEMPLATE_RENDER_FIELDS,
  PATIENT_RENDER_FIELDS,
  DOCTOR_RENDER_FIELDS,
  ENCOUNTER_RENDER_FIELDS,
  CLINIC_RENDER_FIELDS,
  TENANT_PROFILE_RENDER_FIELDS,
  TENANT_APP_CONFIG_RENDER_FIELDS,
  USER_RENDER_FIELDS,
};
