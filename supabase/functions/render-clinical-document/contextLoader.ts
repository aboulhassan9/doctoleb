/**
 * contextLoader.ts — Loads all data the PDF renderer needs in a single module.
 *
 * This module is responsible for fetching:
 *   1. The clinical document row
 *   2. The document template (sections/fields)
 *   3. The encounter + patient + doctor + clinic context
 *   4. The tenant profile + app config (brand)
 *
 * PHI safety: this module never logs patient names, medication names,
 * encounter content, or any clinical data. Only IDs and error codes.
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

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
  gender: string | null;
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
  content: Record<string, unknown> | null;
  clientRequestId: string | null;
  createdAt: string;
}

export interface EncounterContext {
  id: string;
  chiefComplaint: string | null;
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

const DEFAULT_PRIMARY = '#0f172a';  // slate-900
const DEFAULT_SECONDARY = '#38bdf8'; // sky-400
const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

// ── Helpers ──────────────────────────────────────────────────────

function validHex(value: unknown): string | null {
  if (typeof value === 'string' && HEX_REGEX.test(value)) return value;
  return null;
}

function fullName(first: string | null, last: string | null): string {
  return [first, last].filter(Boolean).join(' ') || 'Unknown';
}

// ── Loader ───────────────────────────────────────────────────────

export async function loadRenderContext(
  admin: SupabaseClient,
  documentId: string,
): Promise<{ data: RenderContext | null; error: string | null }> {
  // 1. Load the clinical document
  const { data: doc, error: docErr } = await admin
    .from('clinical_documents')
    .select('id, title, document_type, status, content, client_request_id, created_at, encounter_id, patient_id, doctor_id')
    .eq('id', documentId)
    .maybeSingle();

  if (docErr) {
    console.error('[render] document lookup failed', { code: docErr.code });
    return { data: null, error: 'DOCUMENT_LOOKUP_FAILED' };
  }
  if (!doc) return { data: null, error: 'DOCUMENT_NOT_FOUND' };

  // 2. Load template — try to find matching template by document_type
  const { data: template, error: tplErr } = await admin
    .from('document_templates')
    .select('id, name, template_type, sections')
    .eq('template_type', doc.document_type === 'other' ? 'custom' : doc.document_type)
    .eq('is_archived', false)
    .eq('is_default', true)
    .maybeSingle();

  // If no default template, try ANY active template of this type
  let resolvedTemplate = template;
  if (!resolvedTemplate && !tplErr) {
    const { data: fallback } = await admin
      .from('document_templates')
      .select('id, name, template_type, sections')
      .eq('template_type', doc.document_type === 'other' ? 'custom' : doc.document_type)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    resolvedTemplate = fallback;
  }

  if (tplErr) {
    console.error('[render] template lookup failed', { code: tplErr.code });
    return { data: null, error: 'TEMPLATE_LOOKUP_FAILED' };
  }

  // If still no template, provide a minimal one so the render doesn't crash
  const templateContext: TemplateContext = resolvedTemplate
    ? {
        id: resolvedTemplate.id,
        name: resolvedTemplate.name,
        templateType: resolvedTemplate.template_type,
        sections: resolvedTemplate.sections ?? [],
      }
    : {
        id: 'no-template',
        name: doc.document_type,
        templateType: doc.document_type,
        sections: [],
      };

  // 3. Load patient
  const { data: patient, error: patErr } = await admin
    .from('patients')
    .select('id, first_name, last_name, date_of_birth, gender, phone, email')
    .eq('id', doc.patient_id)
    .maybeSingle();

  if (patErr || !patient) {
    console.error('[render] patient lookup failed', { id: doc.patient_id });
    return { data: null, error: 'PATIENT_NOT_FOUND' };
  }

  // 4. Load doctor + user
  const { data: doctor, error: docDocErr } = await admin
    .from('doctors')
    .select('id, specialization, license_number, user_id, users!doctors_user_id_fkey(first_name, last_name)')
    .eq('id', doc.doctor_id)
    .maybeSingle();

  if (docDocErr || !doctor) {
    console.error('[render] doctor lookup failed', { id: doc.doctor_id });
    return { data: null, error: 'DOCTOR_NOT_FOUND' };
  }

  const doctorUser = doctor.users as { first_name: string | null; last_name: string | null } | null;

  // 5. Load encounter (if applicable)
  let encounterContext: EncounterContext | null = null;
  if (doc.encounter_id) {
    const { data: encounter } = await admin
      .from('encounters')
      .select('id, chief_complaint, started_at, clinic_id')
      .eq('id', doc.encounter_id)
      .maybeSingle();
    if (encounter) {
      encounterContext = {
        id: encounter.id,
        chiefComplaint: encounter.chief_complaint,
        startedAt: encounter.started_at,
      };
    }
  }

  // 6. Load clinic — from encounter or doctor's primary clinic
  let clinicContext: ClinicContext = { id: '', name: 'Clinic', address: null, phone: null };
  const clinicId = doc.encounter_id
    ? (await admin.from('encounters').select('clinic_id').eq('id', doc.encounter_id).maybeSingle()).data?.clinic_id
    : null;

  if (clinicId) {
    const { data: clinic } = await admin
      .from('clinics')
      .select('id, name, address, phone')
      .eq('id', clinicId)
      .maybeSingle();
    if (clinic) {
      clinicContext = { id: clinic.id, name: clinic.name, address: clinic.address, phone: clinic.phone };
    }
  } else {
    // Fallback: doctor's primary clinic
    const { data: primaryClinic } = await admin
      .from('clinics')
      .select('id, name, address, phone')
      .eq('is_primary', true)
      .eq('is_archived', false)
      .limit(1)
      .maybeSingle();
    if (primaryClinic) {
      clinicContext = { id: primaryClinic.id, name: primaryClinic.name, address: primaryClinic.address, phone: primaryClinic.phone };
    }
  }

  // 7. Load tenant profile + app config
  const { data: tenantProfile } = await admin
    .from('tenant_profiles')
    .select('id, tenant_slug, display_name, timezone, default_locale')
    .limit(1)
    .maybeSingle();

  const tenant: TenantContext = tenantProfile
    ? {
        slug: tenantProfile.tenant_slug || 'default',
        displayName: tenantProfile.display_name || clinicContext.name,
        timezone: tenantProfile.timezone || 'Asia/Beirut',
        defaultLocale: tenantProfile.default_locale || 'en',
      }
    : {
        slug: 'default',
        displayName: clinicContext.name,
        timezone: 'Asia/Beirut',
        defaultLocale: 'en',
      };

  let brand: TenantBrand = {
    primaryColor: DEFAULT_PRIMARY,
    secondaryColor: DEFAULT_SECONDARY,
    logoUrl: null,
    supportPhone: clinicContext.phone,
    supportEmail: null,
  };

  if (tenantProfile) {
    const { data: appConfig } = await admin
      .from('tenant_app_configs')
      .select('primary_color, secondary_color, splash_logo_url, support_phone, support_email')
      .eq('profile_id', tenantProfile.id)
      .maybeSingle();

    if (appConfig) {
      brand = {
        primaryColor: validHex(appConfig.primary_color) || DEFAULT_PRIMARY,
        secondaryColor: validHex(appConfig.secondary_color) || DEFAULT_SECONDARY,
        logoUrl: appConfig.splash_logo_url || null,
        supportPhone: appConfig.support_phone || clinicContext.phone,
        supportEmail: appConfig.support_email || null,
      };
    }
  }

  return {
    data: {
      document: {
        id: doc.id,
        title: doc.title,
        documentType: doc.document_type,
        status: doc.status,
        content: typeof doc.content === 'object' ? doc.content : null,
        clientRequestId: doc.client_request_id,
        createdAt: doc.created_at,
      },
      template: templateContext,
      encounter: encounterContext,
      patient: {
        id: patient.id,
        fullName: fullName(patient.first_name, patient.last_name),
        dateOfBirth: patient.date_of_birth,
        gender: patient.gender,
        phone: patient.phone,
        email: patient.email,
      },
      doctor: {
        id: doctor.id,
        fullName: fullName(doctorUser?.first_name ?? null, doctorUser?.last_name ?? null),
        specialization: doctor.specialization,
        licenseNumber: doctor.license_number,
      },
      clinic: clinicContext,
      tenant,
      brand,
    },
    error: null,
  };
}
