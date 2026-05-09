export { createClientRequestId } from '../../../../packages/core/lib/idempotency.js';

const SLUG_MAX_LENGTH = 63;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function normalizeTenantSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-$/g, '');
}

export function deriveTenantSlug(displayName) {
  return normalizeTenantSlug(displayName);
}

export function buildPendingTenantDomains(slug, primaryDomain = 'doctoleb.com') {
  const normalizedSlug = normalizeTenantSlug(slug);
  const normalizedDomain = String(primaryDomain || 'doctoleb.com')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');

  if (!normalizedSlug || !normalizedDomain) return [];

  return [
    { hostname: `${normalizedSlug}.${normalizedDomain}`, surface: 'patient' },
    { hostname: `${normalizedSlug}.ops.${normalizedDomain}`, surface: 'ops' },
  ];
}

export function validateProvisioningDraft({ requestedSlug, requestedDisplayName, clientRequestId }) {
  if (!clientRequestId) return 'Your browser could not create an idempotency key. Refresh and try again.';
  if (!normalizeTenantSlug(requestedSlug)) return 'Tenant slug is required.';
  if (!String(requestedDisplayName || '').trim()) return 'Clinic name is required.';
  return '';
}

export function normalizeFirstDoctorAdminDraft(input = {}) {
  return {
    displayName: String(input.displayName || input.display_name || '').trim().slice(0, 160),
    email: String(input.email || '').trim().toLowerCase().slice(0, 320),
    phone: String(input.phone || '').trim().slice(0, 40),
  };
}

export function validateFirstDoctorAdminDraft(input = {}) {
  const draft = normalizeFirstDoctorAdminDraft(input);
  if (!draft.displayName) return 'First doctor name is required.';
  if (!EMAIL.test(draft.email)) return 'A valid first doctor email is required.';
  return '';
}
