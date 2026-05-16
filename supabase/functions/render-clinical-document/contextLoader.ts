/**
 * contextLoader.ts — Loads everything the PDF renderer needs from the DB.
 *
 * Loading strategy:
 *   1. clinical_documents row (the render target)
 *   2. document_templates row (layout) — looked up by template_type, falling
 *      back to any active template of that type
 *   3. patients row + joined users (identity, contact)
 *   4. doctors row + joined users (signing identity)
 *   5. encounters row (optional — non-encounter docs skip)
 *   6. clinics row (from encounter; falls back to the primary clinic)
 *   7. tenant_profile + tenant_app_config (singular tables — confirmed live)
 *
 * PHI safety: the only data this module logs is short hashes of identifiers
 * and structural error codes — never names, phones, content, or raw ids.
 *
 * SELECT discipline: every column list comes from `./selects.js`, which is
 * checked against the canonical `packages/core/lib/selects.js` by the drift
 * contract test at `tests/unit/edge/renderSelectsDrift.test.mjs`.
 */

import { type SupabaseClient } from 'npm:@supabase/supabase-js@2';

import {
  CLINIC_RENDER_FIELDS,
  CLINICAL_DOCUMENT_RENDER_FIELDS,
  DOCTOR_RENDER_FIELDS,
  DOCUMENT_TEMPLATE_RENDER_FIELDS,
  ENCOUNTER_RENDER_FIELDS,
  PATIENT_RENDER_FIELDS,
  TENANT_APP_CONFIG_RENDER_FIELDS,
  TENANT_PROFILE_RENDER_FIELDS,
} from './selects.js';

// ── Types ────────────────────────────────────────────────────────

export interface TenantContext {
  slug: string;
  displayName: string;
  timezone: string;
  defaultLocale: string;
}

export interface TenantBrand {
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  supportPhone: string | null;
  supportEmail: string | null;
}

export interface DoctorContext {
  id: string;
  fullName: string;
  specialization: string | null;
  licenseNumber: string | null;
}

export interface PatientContext {
  id: string;
  fullName: string;
  dateOfBirth: string | null;
  /** Renamed from `gender` to match the live `patients.sex` column. */
  sex: string | null;
  phone: string | null;
  email: string | null;
}

export interface ClinicContext {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
}

export interface TemplateField {
  key: string;
  label: string;
  type: string;
  autofill?: string | null;
  required?: boolean;
  options?: string[] | null;
  groups?: Array<{ label: string; items: string[] }> | null;
  content?: string | null;
  /** Used only by `composite_text` fields — `{{binding}}` placeholders are
   *  substituted from the closed autofill set at render time. */
  template?: string | null;
  hint?: string | null;
  /**
   * Optional conditional-display predicate. The renderer skips the field
   * when the resolved binding value does not equal `equals` (case- and
   * whitespace-insensitive).
   */
  show_if?: { binding: string; equals: string } | null;
  derivation?: {
    fn: string;
    args: Array<{ binding?: string; literal?: string }>;
  } | null;
}

export interface TemplateSection {
  key: string;
  title: string;
  fields: TemplateField[];
}

export interface TemplateContext {
  id: string;
  name: string;
  templateType: string;
  sections: TemplateSection[];
}

export interface DocumentContext {
  id: string;
  title: string;
  documentType: string;
  status: string;
  /**
   * v1: `clinical_documents.content` is TEXT. If a doctor stored structured
   * overrides as JSON-encoded text, we expose them here as a parsed object;
   * otherwise this is null and field values come purely from autofill.
   * Per-field override storage as a first-class feature is an R1 concern.
   */
  contentOverrides: Record<string, unknown> | null;
  clientRequestId: string | null;
  createdAt: string;
}

export interface EncounterContext {
  id: string;
  chiefComplaint: string | null;
  summary: string | null;
  startedAt: string | null;
}

export interface RenderContext {
  document: DocumentContext;
  template: TemplateContext;
  encounter: EncounterContext | null;
  patient: PatientContext;
  doctor: DoctorContext;
  clinic: ClinicContext;
  tenant: TenantContext;
  brand: TenantBrand;
}

// ── Constants ────────────────────────────────────────────────────

const DEFAULT_PRIMARY = '#0f172a';
const DEFAULT_SECONDARY = '#38bdf8';
const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_TENANT_DISPLAY = 'Clinic';
const DEFAULT_TIMEZONE = 'Asia/Beirut';
const DEFAULT_LOCALE = 'en';

// ── Helpers ──────────────────────────────────────────────────────

function validHex(value: unknown): string | null {
  return typeof value === 'string' && HEX_REGEX.test(value) ? value : null;
}

function joinName(first: string | null | undefined, last: string | null | undefined): string {
  const trimmed = [first, last].map((p) => (p ?? '').trim()).filter(Boolean).join(' ');
  return trimmed || '';
}

/**
 * Short identifier hash for log breadcrumbs. UUIDs leak nothing on their own
 * but reduce their footprint in shared log streams to a non-identifying token.
 */
function shortIdHash(id: string | null | undefined): string {
  if (!id) return '∅';
  return id.replace(/-/g, '').slice(0, 6);
}

/**
 * `clinical_documents.content` is TEXT in the live DB. Some flows persist
 * JSON-encoded structured content there; we accept that defensively and
 * never throw on parse failure — the renderer just falls back to autofill.
 */
function parseDocumentContent(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed[0] !== '{') return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

// ── Loader ───────────────────────────────────────────────────────

export async function loadRenderContext(
  admin: SupabaseClient,
  documentId: string,
): Promise<{ data: RenderContext | null; error: string | null }> {
  // 1. clinical_documents — also filter out archived rows.
  const { data: doc, error: docErr } = await admin
    .from('clinical_documents')
    .select(CLINICAL_DOCUMENT_RENDER_FIELDS)
    .eq('id', documentId)
    .eq('is_archived', false)
    .maybeSingle();

  if (docErr) {
    console.error('[render] document lookup failed', { code: docErr.code });
    return { data: null, error: 'DOCUMENT_LOOKUP_FAILED' };
  }
  if (!doc) return { data: null, error: 'DOCUMENT_NOT_FOUND' };
  if (!doc.doctor_id) {
    // Without a signing doctor we cannot legitimately render — this is a
    // structural issue with the document row, not a transient error.
    return { data: null, error: 'DOCUMENT_HAS_NO_DOCTOR' };
  }

  // 2. Template lookup.
  //
  //    Resolution strategy (most specific → most general):
  //      (a) clinical_documents.template_id → direct FK read.
  //      (b) Default template for the document's type (legacy path).
  //      (c) Most-recent active template of the document's type.
  //
  //    The inverse mapping of clinical_documents.document_type → template_type
  //    (`other` ← `custom`) is only used on the legacy paths (b)+(c).
  let resolvedTemplate: {
    id: string;
    name: string;
    template_type: string;
    sections: TemplateSection[] | null;
  } | null = null;

  if (doc.template_id) {
    const { data: directTemplate, error: directErr } = await admin
      .from('document_templates')
      .select(DOCUMENT_TEMPLATE_RENDER_FIELDS)
      .eq('id', doc.template_id)
      .eq('is_archived', false)
      .maybeSingle();
    if (directErr) {
      console.error('[render] template direct lookup failed', { code: directErr.code });
      return { data: null, error: 'TEMPLATE_LOOKUP_FAILED' };
    }
    resolvedTemplate = directTemplate ?? null;
  }

  if (!resolvedTemplate) {
    const templateType = doc.document_type === 'other' ? 'custom' : doc.document_type;

    const { data: defaultTemplate, error: defaultTplErr } = await admin
      .from('document_templates')
      .select(DOCUMENT_TEMPLATE_RENDER_FIELDS)
      .eq('template_type', templateType)
      .eq('is_archived', false)
      .eq('is_default', true)
      .maybeSingle();

    if (defaultTplErr) {
      console.error('[render] template default lookup failed', { code: defaultTplErr.code });
      return { data: null, error: 'TEMPLATE_LOOKUP_FAILED' };
    }
    resolvedTemplate = defaultTemplate ?? null;

    if (!resolvedTemplate) {
      const { data: fallback, error: fallbackErr } = await admin
        .from('document_templates')
        .select(DOCUMENT_TEMPLATE_RENDER_FIELDS)
        .eq('template_type', templateType)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fallbackErr) {
        console.error('[render] template fallback lookup failed', { code: fallbackErr.code });
        return { data: null, error: 'TEMPLATE_LOOKUP_FAILED' };
      }
      resolvedTemplate = fallback ?? null;
    }
  }

  const templateContext: TemplateContext = resolvedTemplate
    ? {
        id: resolvedTemplate.id,
        name: resolvedTemplate.name,
        templateType: resolvedTemplate.template_type,
        sections: Array.isArray(resolvedTemplate.sections) ? resolvedTemplate.sections : [],
      }
    : {
        id: 'no-template',
        name: doc.document_type,
        templateType: doc.document_type,
        sections: [],
      };

  // 3. Patient — joined users for identity. Note: `patients.sex`, not `gender`.
  const { data: patient, error: patErr } = await admin
    .from('patients')
    .select(PATIENT_RENDER_FIELDS)
    .eq('id', doc.patient_id)
    .maybeSingle();

  if (patErr) {
    console.error('[render] patient lookup failed', {
      code: patErr.code,
      patient: shortIdHash(doc.patient_id),
    });
    return { data: null, error: 'PATIENT_LOOKUP_FAILED' };
  }
  if (!patient) return { data: null, error: 'PATIENT_NOT_FOUND' };

  const patientUser = (patient as { users: { first_name?: string; last_name?: string; phone?: string; email?: string } | null }).users ?? null;

  // 4. Doctor — joined users.
  const { data: doctor, error: docDocErr } = await admin
    .from('doctors')
    .select(DOCTOR_RENDER_FIELDS)
    .eq('id', doc.doctor_id)
    .maybeSingle();

  if (docDocErr) {
    console.error('[render] doctor lookup failed', {
      code: docDocErr.code,
      doctor: shortIdHash(doc.doctor_id),
    });
    return { data: null, error: 'DOCTOR_LOOKUP_FAILED' };
  }
  if (!doctor) return { data: null, error: 'DOCTOR_NOT_FOUND' };

  const doctorUser = (doctor as { users: { first_name?: string; last_name?: string } | null }).users ?? null;

  // 5. Encounter (optional).
  let encounterContext: EncounterContext | null = null;
  let encounterClinicId: string | null = null;
  if (doc.encounter_id) {
    const { data: encounter, error: encErr } = await admin
      .from('encounters')
      .select(ENCOUNTER_RENDER_FIELDS)
      .eq('id', doc.encounter_id)
      .maybeSingle();
    if (encErr) {
      console.error('[render] encounter lookup failed', { code: encErr.code });
      // Non-fatal — render proceeds without encounter context.
    } else if (encounter) {
      encounterContext = {
        id: encounter.id,
        chiefComplaint: encounter.chief_complaint ?? null,
        summary: encounter.summary ?? null,
        startedAt: encounter.started_at ?? null,
      };
      encounterClinicId = encounter.clinic_id ?? null;
    }
  }

  // 6. Clinic — from the encounter if present, otherwise the primary clinic.
  let clinicContext: ClinicContext = {
    id: '',
    name: DEFAULT_TENANT_DISPLAY,
    address: null,
    phone: null,
  };

  if (encounterClinicId) {
    const { data: clinic } = await admin
      .from('clinics')
      .select(CLINIC_RENDER_FIELDS)
      .eq('id', encounterClinicId)
      .eq('is_archived', false)
      .maybeSingle();
    if (clinic) {
      clinicContext = {
        id: clinic.id,
        name: clinic.name,
        address: clinic.address ?? null,
        phone: clinic.phone ?? null,
      };
    }
  }

  if (!clinicContext.id) {
    const { data: primaryClinic } = await admin
      .from('clinics')
      .select(CLINIC_RENDER_FIELDS)
      .eq('is_primary', true)
      .eq('is_archived', false)
      .limit(1)
      .maybeSingle();
    if (primaryClinic) {
      clinicContext = {
        id: primaryClinic.id,
        name: primaryClinic.name,
        address: primaryClinic.address ?? null,
        phone: primaryClinic.phone ?? null,
      };
    }
  }

  // 7. Tenant profile + app config (singular table names — confirmed live).
  const { data: tenantProfile } = await admin
    .from('tenant_profile')
    .select(TENANT_PROFILE_RENDER_FIELDS)
    .limit(1)
    .maybeSingle();

  const tenant: TenantContext = tenantProfile
    ? {
        slug: tenantProfile.tenant_slug || 'default',
        displayName: tenantProfile.display_name || clinicContext.name,
        timezone: tenantProfile.timezone || DEFAULT_TIMEZONE,
        defaultLocale: tenantProfile.default_locale || DEFAULT_LOCALE,
      }
    : {
        slug: 'default',
        displayName: clinicContext.name,
        timezone: DEFAULT_TIMEZONE,
        defaultLocale: DEFAULT_LOCALE,
      };

  let brand: TenantBrand = {
    primaryColor: DEFAULT_PRIMARY,
    secondaryColor: DEFAULT_SECONDARY,
    logoUrl: null,
    supportPhone: clinicContext.phone,
    supportEmail: null,
  };

  if (tenantProfile?.id) {
    const { data: appConfig } = await admin
      .from('tenant_app_config')
      .select(TENANT_APP_CONFIG_RENDER_FIELDS)
      .eq('profile_id', tenantProfile.id)
      .maybeSingle();

    if (appConfig) {
      brand = {
        primaryColor: validHex(appConfig.primary_color) || DEFAULT_PRIMARY,
        secondaryColor: validHex(appConfig.secondary_color) || DEFAULT_SECONDARY,
        // Prefer splash_logo_url; fall back to icon_url for tenants that only
        // uploaded the small icon. SVGs are rejected by the embed step later.
        logoUrl: appConfig.splash_logo_url || appConfig.icon_url || null,
        supportPhone: appConfig.support_phone || clinicContext.phone,
        supportEmail: appConfig.support_email || null,
      };
    }
  }

  // ── Identity fallbacks (never throw, never invent names) ──
  const patientFullName = joinName(patientUser?.first_name, patientUser?.last_name) || '[Patient]';
  const doctorFullName = joinName(doctorUser?.first_name, doctorUser?.last_name) || '[Doctor]';

  return {
    data: {
      document: {
        id: doc.id,
        title: doc.title,
        documentType: doc.document_type,
        status: doc.status,
        contentOverrides: parseDocumentContent(doc.content),
        clientRequestId: doc.client_request_id ?? null,
        createdAt: doc.created_at,
      },
      template: templateContext,
      encounter: encounterContext,
      patient: {
        id: patient.id,
        fullName: patientFullName,
        dateOfBirth: patient.date_of_birth ?? null,
        sex: patient.sex ?? null,
        phone: patientUser?.phone ?? null,
        email: patientUser?.email ?? null,
      },
      doctor: {
        id: doctor.id,
        fullName: doctorFullName,
        specialization: doctor.specialization ?? null,
        licenseNumber: doctor.license_number ?? null,
      },
      clinic: clinicContext,
      tenant,
      brand,
    },
    error: null,
  };
}
