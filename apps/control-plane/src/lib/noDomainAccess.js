import { isValidTenantSlug } from '../../../../packages/core/lib/hostnameSurface.js';

export const DEFAULT_PATIENT_WEB_URL = 'https://doctoleb-patient-web.vercel.app';
export const DEFAULT_CLINIC_OPS_URL = 'https://doctoleb-clinic-ops.vercel.app';

function runtimeEnv() {
  return typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
}

function normalizeBaseUrl(value, fallback) {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  return raw || fallback;
}

export function buildNoDomainTenantAccess(tenant = {}, options = {}) {
  const slug = String(tenant?.slug || '').trim().toLowerCase();
  if (!isValidTenantSlug(slug)) {
    return {
      available: false,
      slug: '',
      patientUrl: '',
      opsUrl: '',
    };
  }

  const env = runtimeEnv();
  const patientBaseUrl = normalizeBaseUrl(
    options.patientWebUrl || env.VITE_PATIENT_WEB_URL,
    DEFAULT_PATIENT_WEB_URL,
  );
  const opsBaseUrl = normalizeBaseUrl(
    options.clinicOpsUrl || env.VITE_CLINIC_OPS_URL,
    DEFAULT_CLINIC_OPS_URL,
  );

  return {
    available: true,
    slug,
    patientUrl: `${patientBaseUrl}/t/${slug}`,
    opsUrl: `${opsBaseUrl}/t/${slug}`,
  };
}
