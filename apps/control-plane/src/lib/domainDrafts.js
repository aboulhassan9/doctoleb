const DOMAIN_STATUSES = new Set(['pending', 'active', 'disabled'])
const DNS_STATUSES = new Set(['verified', 'pending', 'failed'])
const SSL_STATUSES = new Set(['issued', 'pending', 'failed'])
const DOMAIN_SURFACES = new Set(['patient', 'ops'])

export const DOMAIN_STATUS_OPTIONS = Object.freeze([
  { code: 'pending', label: 'Pending' },
  { code: 'active', label: 'Active' },
  { code: 'disabled', label: 'Disabled' },
])

export const DNS_STATUS_OPTIONS = Object.freeze([
  { code: '', label: 'Not set' },
  { code: 'pending', label: 'Pending' },
  { code: 'verified', label: 'Verified' },
  { code: 'failed', label: 'Failed' },
])

export const SSL_STATUS_OPTIONS = Object.freeze([
  { code: '', label: 'Not set' },
  { code: 'pending', label: 'Pending' },
  { code: 'issued', label: 'Issued' },
  { code: 'failed', label: 'Failed' },
])

function normalizeHostname(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizeEnum(value, allowed, fallback = '') {
  return typeof value === 'string' && allowed.has(value) ? value : fallback
}

function isLocalHostname(hostname) {
  return hostname.startsWith('localhost:') || hostname.startsWith('127.0.0.1:')
}

export function canActivateDomainDraft(domain) {
  const hostname = normalizeHostname(domain?.hostname)
  if (!hostname) return false
  if (isLocalHostname(hostname)) return true
  return domain?.dns_status === 'verified' && domain?.ssl_status === 'issued'
}

export function createDomainDrafts(domains = []) {
  return domains.map((domain) => ({
    id: typeof domain.id === 'string' ? domain.id : '',
    hostname: normalizeHostname(domain.hostname),
    surface: normalizeEnum(domain.surface, DOMAIN_SURFACES, 'patient'),
    status: normalizeEnum(domain.status, DOMAIN_STATUSES, 'pending'),
    dns_status: normalizeEnum(domain.dns_status, DNS_STATUSES, ''),
    ssl_status: normalizeEnum(domain.ssl_status, SSL_STATUSES, ''),
  }))
}

export function updateDomainDraft(drafts, domainId, patch) {
  return drafts.map((domain) => (
    domain.id === domainId
      ? { ...domain, ...patch }
      : domain
  ))
}

export function buildDomainUpdatePayload(drafts) {
  return createDomainDrafts(drafts).map((domain) => ({
    ...domain,
    status: domain.status === 'active' && !canActivateDomainDraft(domain)
      ? 'pending'
      : domain.status,
  }))
}

export function hasBlockedDomainActivation(drafts) {
  return createDomainDrafts(drafts)
    .some((domain) => domain.status === 'active' && !canActivateDomainDraft(domain))
}
