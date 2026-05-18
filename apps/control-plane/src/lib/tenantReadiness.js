import { buildNoDomainTenantAccess } from './noDomainAccess.js'

const READY_STATUSES = new Set(['ready', 'prepared'])
const SHARED_VERCEL_HOSTS = new Set([
  'doctoleb-patient-web.vercel.app',
  'doctoleb-clinic-ops.vercel.app',
])

function domainsFor(tenant) {
  return Array.isArray(tenant?.tenant_domains) ? tenant.tenant_domains : []
}

function isLocalHostname(hostname) {
  return /^localhost(?::|$)/i.test(hostname) || /^127\.0\.0\.1(?::|$)/.test(hostname)
}

function isSharedVercelHost(hostname) {
  return SHARED_VERCEL_HOSTS.has(String(hostname || '').trim().toLowerCase())
}

function isVerifiedOnlineDomain(domain, surface) {
  return Boolean(
    domain?.surface === surface
      && domain.status === 'active'
      && domain.dns_status === 'verified'
      && domain.ssl_status === 'issued'
      && !isLocalHostname(String(domain.hostname || ''))
      && !isSharedVercelHost(domain.hostname),
  )
}

function findVerifiedOnlineDomain(domains, surface) {
  return domains.find((domain) => isVerifiedOnlineDomain(domain, surface))
}

function countPendingDoctoLebDomains(domains) {
  return domains.filter((domain) => (
    String(domain.hostname || '').endsWith('.doctoleb.com')
    && domain.status === 'pending'
  )).length
}

export function buildTenantReadinessItems(tenant = {}) {
  const domains = domainsFor(tenant)
  const hasRuntimeConfig = Boolean(tenant.supabase_project_ref && tenant.supabase_url)
  const patientOnlineDomain = findVerifiedOnlineDomain(domains, 'patient')
  const opsOnlineDomain = findVerifiedOnlineDomain(domains, 'ops')
  const pendingDoctoLebDomains = countPendingDoctoLebDomains(domains)
  const noDomainAccess = buildNoDomainTenantAccess(tenant)
  const hasNoDomainAccess = hasRuntimeConfig && noDomainAccess.available

  return [
    {
      id: 'control_plane_status',
      label: 'Control-plane tenant active',
      status: tenant.status === 'active' ? 'ready' : 'needs_work',
      required: true,
      detail: `Current status: ${tenant.status || 'not set'}.`,
    },
    {
      id: 'runtime_config',
      label: 'Tenant database linked',
      status: hasRuntimeConfig ? 'ready' : 'needs_work',
      required: true,
      detail: hasRuntimeConfig
        ? `Tenant project ${tenant.supabase_project_ref} is linked for resolver boot.`
        : 'Runtime project ref and Supabase URL are required before activation.',
    },
    {
      id: 'patient_web',
      label: 'Patient web online',
      status: patientOnlineDomain || hasNoDomainAccess ? 'ready' : 'needs_work',
      required: true,
      detail: patientOnlineDomain
        ? `${patientOnlineDomain.hostname} is active with verified DNS and issued SSL.`
        : hasNoDomainAccess
          ? `${noDomainAccess.patientUrl} can resolve this tenant before domain purchase.`
          : 'Add runtime config or an active patient web host before marking the tenant ready.',
    },
    {
      id: 'ops_web',
      label: 'Doctor/staff web online',
      status: opsOnlineDomain || hasNoDomainAccess ? 'ready' : 'needs_work',
      required: true,
      detail: opsOnlineDomain
        ? `${opsOnlineDomain.hostname} is active with verified DNS and issued SSL.`
        : hasNoDomainAccess
          ? `${noDomainAccess.opsUrl} can resolve this tenant before domain purchase.`
          : 'Add runtime config or an active ops web host before marking the tenant ready.',
    },
    {
      id: 'future_domain',
      label: 'DoctoLeb domain later',
      status: pendingDoctoLebDomains > 0 ? 'pending' : 'ready',
      required: false,
      detail: pendingDoctoLebDomains > 0
        ? `${pendingDoctoLebDomains} real-domain row(s) stay pending until domain purchase, DNS, and SSL verification.`
        : 'No pending DoctoLeb domain rows are blocking current Vercel/free-host use.',
    },
    {
      id: 'flutter_path',
      label: 'Flutter app path prepared',
      status: hasRuntimeConfig && (patientOnlineDomain || hasNoDomainAccess) ? 'prepared' : 'needs_work',
      required: false,
      detail: 'The future Flutter app should use the same tenant resolver and runtime config as patient web.',
    },
  ]
}

export function summarizeTenantReadiness(tenant = {}) {
  const items = buildTenantReadinessItems(tenant)
  const blockers = items.filter((item) => item.required && !READY_STATUSES.has(item.status))

  return {
    status: blockers.length === 0 ? 'ready' : 'needs_work',
    label: blockers.length === 0 ? 'Ready now' : 'Needs attention',
    blockers,
    items,
  }
}
