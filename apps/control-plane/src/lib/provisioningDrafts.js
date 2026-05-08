const SLUG_MAX_LENGTH = 63;

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

export function createClientRequestId(cryptoSource = globalThis.crypto) {
  if (cryptoSource?.randomUUID) return cryptoSource.randomUUID();
  if (!cryptoSource?.getRandomValues) return null;

  const bytes = new Uint8Array(16);
  cryptoSource.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

export function validateProvisioningDraft({ requestedSlug, requestedDisplayName, clientRequestId }) {
  if (!clientRequestId) return 'Your browser could not create an idempotency key. Refresh and try again.';
  if (!normalizeTenantSlug(requestedSlug)) return 'Tenant slug is required.';
  if (!String(requestedDisplayName || '').trim()) return 'Clinic name is required.';
  return '';
}
