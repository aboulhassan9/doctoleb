import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  preflight,
  createTenantServiceClient,
  getTenantServiceRoleKey,
  readJsonBody,
  requireSuperAdmin,
} from '../_shared/admin.ts'
import {
  CONTROL_PLANE_DOMAIN_SELECT,
  CONTROL_PLANE_PROVISIONING_JOB_SELECT,
  CONTROL_PLANE_PROVISIONING_STEP_SELECT,
} from '../_shared/selects.ts'
import { normalizeTenantBranding } from '../_shared/tenantBranding.ts'
import { verifyProviderCredential } from '../_shared/providerExecution.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TENANT_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const DEFAULT_PATIENT_WEB_URL = 'https://doctoleb-patient-web.vercel.app'
const DEFAULT_CLINIC_OPS_URL = 'https://doctoleb-clinic-ops.vercel.app'
const TERMINAL_STEP_STATUSES = new Set(['succeeded', 'skipped', 'cancelled', 'rolled_back'])
const SAFE_RUNNER_STEPS = new Set([
  'provider_connections_selected',
  'create_supabase_project',
  'apply_tenant_migrations',
  'seed_tenant_profile',
  'seed_first_doctor_admin',
  'configure_vercel_project',
  'store_runtime_config',
  'smoke_test_resolver',
  'activate_tenant',
])
const RPC_ERROR_STATUS: Record<string, number> = {
  INVALID_REQUEST: 400,
  STEP_NOT_FOUND: 404,
  PROVISIONING_JOB_NOT_FOUND: 404,
  JOB_NOT_RUNNABLE: 409,
  STEP_ALREADY_RUNNING: 409,
  STEP_NOT_RUNNING: 409,
  STEP_NOT_AUTOMATED: 409,
  STEP_PRECONDITION_FAILED: 409,
  PROVIDER_CONNECTION_REQUIRED: 422,
  PROVIDER_CONNECTION_NOT_READY: 409,
  PROVIDER_SECRET_STORAGE_UNSUPPORTED: 409,
  PROVIDER_SECRET_REF_INVALID: 409,
  PROVIDER_SECRET_NOT_CONFIGURED: 409,
  PROVIDER_AUTH_FAILED: 409,
  PROVIDER_RATE_LIMITED: 429,
  PROVIDER_VERIFICATION_FAILED: 502,
  SUPABASE_PROJECT_RUNTIME_CONFIG_REQUIRED: 409,
  TENANT_SERVICE_ROLE_SECRET_REQUIRED: 409,
  TENANT_MIGRATIONS_NOT_READY: 409,
  TENANT_PROFILE_SEED_RPC_NOT_READY: 409,
  TENANT_PROFILE_SEED_FAILED: 500,
  FIRST_DOCTOR_ADMIN_INPUT_REQUIRED: 422,
  FIRST_DOCTOR_ADMIN_INVITE_FAILED: 409,
  FIRST_DOCTOR_ADMIN_SEED_RPC_NOT_READY: 409,
  FIRST_DOCTOR_ADMIN_SEED_FAILED: 500,
  FIRST_DOCTOR_ADMIN_COMPENSATION_FAILED: 500,
  VERCEL_ROUTING_DOMAIN_REQUIRED: 409,
  RESOLVER_SMOKE_FAILED: 502,
  TENANT_ACTIVE_DOMAIN_REQUIRED: 409,
  TENANT_ACTIVATION_FAILED: 409,
  TENANT_ACTIVATION_BLOCKED: 409,
  RUNTIME_CONFIG_REQUIRED: 409,
  STEP_RUN_START_FAILED: 500,
  STEP_RESULT_RECORD_FAILED: 500,
}

type ProvisioningStep = {
  id: string
  provisioning_job_id: string
  tenant_id: string | null
  step_code: string
  provider: string | null
  status: string
  created_at: string
}

type ProvisioningJob = {
  id: string
  client_request_id: string | null
  tenant_id: string | null
  supabase_connection_id: string | null
  vercel_connection_id: string | null
  requested_slug: string
  requested_display_name: string
  initial_branding: Record<string, unknown> | null
  first_doctor_email: string | null
  first_doctor_display_name: string | null
  first_doctor_phone: string | null
  automation_mode: string
  status: string
  automation_status: string
}

type TenantDomain = {
  id: string
  tenant_id: string
  hostname: string
  surface: 'patient' | 'ops'
  status: string
  dns_status: string | null
  ssl_status: string | null
  verified_at: string | null
}

type StepExecution =
  | {
      data: {
        status: 'succeeded' | 'skipped'
        postconditions: Record<string, unknown>
        summary: string
        externalResourceKind?: string | null
        externalResourceId?: string | null
        externalResourceUrl?: string | null
      }
      error: null
    }
  | { data: null; error: string; summary: string }

function normalizeUuid(value: unknown) {
  if (typeof value !== 'string') return ''
  const id = value.trim().toLowerCase()
  return UUID.test(id) ? id : ''
}

function statusForError(code: string) {
  return RPC_ERROR_STATUS[code] ?? 500
}

function readPayloadError(payload: unknown) {
  return payload && typeof payload === 'object' && 'error' in payload
    ? String((payload as { error?: unknown }).error || '')
    : ''
}

async function fetchStep(context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>, {
  tenantId,
  stepId,
  stepCode,
}: {
  tenantId: string
  stepId: string
  stepCode: string
}) {
  let query = context.client
    .from('tenant_provisioning_steps')
    .select(CONTROL_PLANE_PROVISIONING_STEP_SELECT)
    .eq('tenant_id', tenantId)

  query = stepId ? query.eq('id', stepId) : query.eq('step_code', stepCode)

  const { data, error } = await query.maybeSingle()
  return { data: data as ProvisioningStep | null, error }
}

async function fetchJob(context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>, jobId: string) {
  const { data, error } = await context.client
    .from('tenant_provisioning_jobs')
    .select(CONTROL_PLANE_PROVISIONING_JOB_SELECT)
    .eq('id', jobId)
    .maybeSingle()

  return { data: data as ProvisioningJob | null, error }
}

async function assertPreviousStepsComplete(
  context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>,
  currentStep: ProvisioningStep,
) {
  const { data, error } = await context.client
    .from('tenant_provisioning_steps')
    .select('id, step_code, status, created_at')
    .eq('provisioning_job_id', currentStep.provisioning_job_id)
    .order('created_at', { ascending: true })

  if (error) return { error: 'STEP_PRECONDITION_FAILED' }

  for (const step of data ?? []) {
    if (step.id === currentStep.id) return { error: null }
    if (!TERMINAL_STEP_STATUSES.has(step.status)) return { error: 'STEP_PRECONDITION_FAILED' }
  }

  return { error: 'STEP_PRECONDITION_FAILED' }
}

function connectionIsAutomationReady(connection: Record<string, unknown> | null, provider: 'supabase' | 'vercel') {
  return Boolean(
    connection
      && connection.provider === provider
      && connection.status === 'active'
      && connection.is_automation_enabled === true
      && connection.secret_storage !== 'none'
      && typeof connection.secret_ref === 'string'
      && connection.secret_ref.trim(),
  )
}

async function loadProviderConnection(
  context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>,
  id: string | null,
) {
  if (!id) return null
  const { data, error } = await context.client
    .from('provisioning_provider_connections')
    .select('id, provider, status, is_automation_enabled, secret_storage, secret_ref')
    .eq('id', id)
    .maybeSingle()

  if (error) return null
  return data as Record<string, unknown> | null
}

async function runProviderConnectionsSelected(
  context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>,
  job: ProvisioningJob,
): Promise<StepExecution> {
  const mode = job.automation_mode || 'manual'
  const requiresAutomation = mode === 'assisted' || mode === 'automatic'
  const supabaseConnection = await loadProviderConnection(context, job.supabase_connection_id)
  const vercelConnection = await loadProviderConnection(context, job.vercel_connection_id)
  const supabaseReady = connectionIsAutomationReady(supabaseConnection, 'supabase')
  const vercelReady = connectionIsAutomationReady(vercelConnection, 'vercel')
  const hasAnyConnection = Boolean(job.supabase_connection_id || job.vercel_connection_id)

  if (requiresAutomation && (!job.supabase_connection_id || !job.vercel_connection_id)) {
    return {
      data: null,
      error: 'PROVIDER_CONNECTION_REQUIRED',
      summary: 'Assisted or automatic provisioning requires both Supabase and Vercel provider connections.',
    }
  }

  if ((job.supabase_connection_id && !supabaseReady) || (job.vercel_connection_id && !vercelReady)) {
    return {
      data: null,
      error: 'PROVIDER_CONNECTION_NOT_READY',
      summary: 'Selected provider connection is not active, automation-enabled, and backed by a server-side secret reference.',
    }
  }

  if (requiresAutomation && (!supabaseReady || !vercelReady)) {
    return {
      data: null,
      error: 'PROVIDER_CONNECTION_NOT_READY',
      summary: 'Both provider connections must be ready before automation can continue.',
    }
  }

  const supabaseVerification = supabaseReady ? await verifyProviderCredential(supabaseConnection) : null
  if (supabaseVerification?.error) {
    return { data: null, error: supabaseVerification.error, summary: supabaseVerification.summary }
  }

  const vercelVerification = vercelReady ? await verifyProviderCredential(vercelConnection) : null
  if (vercelVerification?.error) {
    return { data: null, error: vercelVerification.error, summary: vercelVerification.summary }
  }

  return {
    data: {
      status: hasAnyConnection ? 'succeeded' : 'skipped',
      postconditions: {
        automationMode: mode,
        connectionsSelected: hasAnyConnection,
        supabaseConnectionVerified: supabaseReady,
        vercelConnectionVerified: vercelReady,
        supabaseCredentialVerified: supabaseVerification?.data?.verified === true,
        vercelCredentialVerified: vercelVerification?.data?.verified === true,
      },
      summary: hasAnyConnection
        ? 'Provider connection metadata was verified.'
        : 'Manual provisioning does not require provider connections.',
    },
    error: null,
  }
}

async function runStoreRuntimeConfig(
  context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>,
  tenantId: string,
): Promise<StepExecution> {
  const { data: tenant, error } = await context.client
    .from('tenants')
    .select('id, supabase_project_ref, supabase_url, supabase_anon_key')
    .eq('id', tenantId)
    .maybeSingle()

  if (error || !tenant) {
    return { data: null, error: 'RUNTIME_CONFIG_REQUIRED', summary: 'Tenant runtime config could not be loaded.' }
  }

  if (!tenant.supabase_project_ref || !tenant.supabase_url || !tenant.supabase_anon_key) {
    return {
      data: null,
      error: 'RUNTIME_CONFIG_REQUIRED',
      summary: 'Set tenant runtime config before marking this step complete.',
    }
  }

  return {
    data: {
      status: 'succeeded',
      postconditions: {
        resolverRuntimeConfigStored: true,
        supabaseProjectRef: tenant.supabase_project_ref,
        supabaseUrlHost: new URL(tenant.supabase_url).hostname,
        hasAnonKey: true,
      },
      summary: 'Runtime resolver metadata is present.',
    },
    error: null,
  }
}

function normalizeSupabaseRuntimeConfig(tenant: {
  slug?: string | null
  supabase_project_ref?: string | null
  supabase_url?: string | null
  supabase_anon_key?: string | null
}) {
  const projectRef = typeof tenant.supabase_project_ref === 'string'
    ? tenant.supabase_project_ref.trim().toLowerCase()
    : ''
  const supabaseUrl = typeof tenant.supabase_url === 'string'
    ? tenant.supabase_url.trim().replace(/\/+$/, '').toLowerCase()
    : ''
  const anonKey = typeof tenant.supabase_anon_key === 'string'
    ? tenant.supabase_anon_key.trim()
    : ''

  if (!/^[a-z0-9]{20}$/.test(projectRef)) return null
  if (supabaseUrl !== `https://${projectRef}.supabase.co`) return null
  if (anonKey.length < 20 || /\s/.test(anonKey)) return null

  return {
    projectRef,
    supabaseUrl,
    supabaseUrlHost: `${projectRef}.supabase.co`,
  }
}

function appBaseUrl(envName: string, fallback: string) {
  return (Deno.env.get(envName)?.trim() || fallback).replace(/\/+$/, '')
}

function noDomainPathRoutingForTenant(tenant: {
  slug?: string | null
  supabase_project_ref?: string | null
  supabase_url?: string | null
  supabase_anon_key?: string | null
}) {
  const slug = String(tenant.slug || '').trim().toLowerCase()
  if (!TENANT_SLUG.test(slug) || !normalizeSupabaseRuntimeConfig(tenant)) return null

  const patientBaseUrl = appBaseUrl('PATIENT_WEB_APP_URL', DEFAULT_PATIENT_WEB_URL)
  const opsBaseUrl = appBaseUrl('CLINIC_OPS_APP_URL', DEFAULT_CLINIC_OPS_URL)

  return {
    slug,
    patientUrl: `${patientBaseUrl}/t/${slug}`,
    opsUrl: `${opsBaseUrl}/t/${slug}`,
    patientHost: new URL(patientBaseUrl).hostname,
    opsHost: new URL(opsBaseUrl).hostname,
  }
}

function isLocalDomain(hostname: string) {
  return hostname.startsWith('localhost:') || hostname.startsWith('127.0.0.1:')
}

function isVercelDomain(hostname: string) {
  return hostname.endsWith('.vercel.app')
}

function isVerifiedCustomDomain(domain: TenantDomain) {
  return domain.dns_status === 'verified' && domain.ssl_status === 'issued'
}

function isActiveRoutableDomain(domain: TenantDomain) {
  const hostname = String(domain.hostname || '').trim().toLowerCase()
  return (
    domain.status === 'active'
    && (isLocalDomain(hostname) || isVercelDomain(hostname) || isVerifiedCustomDomain(domain))
  )
}

async function loadTenantDomains(
  context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>,
  tenantId: string,
) {
  const { data, error } = await context.client
    .from('tenant_domains')
    .select(CONTROL_PLANE_DOMAIN_SELECT)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  return { data: (data ?? []) as TenantDomain[], error }
}

function activeDomainsBySurface(domains: TenantDomain[]) {
  const active = domains.filter(isActiveRoutableDomain)
  return {
    patient: active.filter((domain) => domain.surface === 'patient'),
    ops: active.filter((domain) => domain.surface === 'ops'),
  }
}

function requireActivePatientAndOpsDomains(domains: TenantDomain[]) {
  const bySurface = activeDomainsBySurface(domains)
  if (bySurface.patient.length === 0 || bySurface.ops.length === 0) {
    return { data: null, error: 'TENANT_ACTIVE_DOMAIN_REQUIRED' }
  }

  return { data: bySurface, error: null }
}

async function runConfigureVercelProject(
  context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>,
  tenantId: string,
): Promise<StepExecution> {
  const { data: tenant, error: tenantError } = await context.client
    .from('tenants')
    .select('id, slug, supabase_project_ref, supabase_url, supabase_anon_key')
    .eq('id', tenantId)
    .maybeSingle()

  if (tenantError || !tenant) {
    return {
      data: null,
      error: 'RUNTIME_CONFIG_REQUIRED',
      summary: 'Tenant runtime config could not be loaded for routing verification.',
    }
  }

  const { data: domains, error } = await loadTenantDomains(context, tenantId)
  if (error) {
    return {
      data: null,
      error: 'VERCEL_ROUTING_DOMAIN_REQUIRED',
      summary: 'Tenant domain rows could not be loaded for Vercel routing verification.',
    }
  }

  const required = requireActivePatientAndOpsDomains(domains)
  const noDomainRouting = noDomainPathRoutingForTenant(tenant)

  if (required.error || !required.data) {
    if (noDomainRouting) {
      return {
        data: {
          status: 'succeeded',
          postconditions: {
            routingConfigured: true,
            noDomainPathRoutingConfigured: true,
            patientPathUrl: noDomainRouting.patientUrl,
            opsPathUrl: noDomainRouting.opsUrl,
            realDoctolebDomainsCanRemainPending: true,
          },
          externalResourceKind: 'vercel_path_routing',
          externalResourceId: `${noDomainRouting.patientUrl},${noDomainRouting.opsUrl}`,
          externalResourceUrl: noDomainRouting.patientUrl,
          summary: 'Shared Vercel /t/<tenant-slug> path routing is ready; no purchased domain is required.',
        },
        error: null,
      }
    }

    return {
      data: null,
      error: 'VERCEL_ROUTING_DOMAIN_REQUIRED',
      summary: 'Add tenant runtime config for /t/<tenant-slug> path routing, or add active patient and ops domain rows.',
    }
  }

  return {
    data: {
      status: 'succeeded',
      postconditions: {
        routingConfigured: true,
        activePatientHosts: required.data.patient.map((domain) => domain.hostname),
        activeOpsHosts: required.data.ops.map((domain) => domain.hostname),
        pendingDomainRows: domains.filter((domain) => domain.status === 'pending').length,
        noDomainPathRoutingAvailable: Boolean(noDomainRouting),
        realDoctolebDomainsCanRemainPending: true,
      },
      externalResourceKind: 'vercel_routing',
      externalResourceId: [...required.data.patient, ...required.data.ops].map((domain) => domain.hostname).join(','),
      summary: 'Vercel/local routing rows are present for both patient and ops surfaces.',
    },
    error: null,
  }
}

function normalizeRpcResolverPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return { data: null, error: 'TENANT_RESOLVER_DOWN' }
  const envelope = payload as { data?: unknown; error?: unknown }
  return {
    data: envelope.data ?? null,
    error: typeof envelope.error === 'string' ? envelope.error : null,
  }
}

async function runSmokeTestResolver(
  context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>,
  tenantId: string,
): Promise<StepExecution> {
  const { data: tenant, error: tenantError } = await context.client
    .from('tenants')
    .select('id, slug, supabase_project_ref, supabase_url, supabase_anon_key')
    .eq('id', tenantId)
    .maybeSingle()

  if (tenantError || !tenant) {
    return { data: null, error: 'RUNTIME_CONFIG_REQUIRED', summary: 'Tenant runtime config could not be loaded for resolver smoke.' }
  }

  const { data: domains, error } = await loadTenantDomains(context, tenantId)
  if (error) {
    return { data: null, error: 'RESOLVER_SMOKE_FAILED', summary: 'Tenant domains could not be loaded for resolver smoke.' }
  }

  const required = requireActivePatientAndOpsDomains(domains)
  if (required.error || !required.data) {
    const noDomainRouting = noDomainPathRoutingForTenant(tenant)
    if (noDomainRouting) {
      const results: Record<string, string | null> = {}
      for (const surface of ['patient', 'ops'] as const) {
        const { data, error: rpcError } = await context.client.rpc('resolve_tenant_by_slug', {
          p_slug: noDomainRouting.slug,
          p_surface: surface,
        })
        if (rpcError) {
          return { data: null, error: 'RESOLVER_SMOKE_FAILED', summary: 'Control-plane slug resolver RPC failed during smoke test.' }
        }

        const payload = normalizeRpcResolverPayload(data)
        if (payload.error && payload.error !== 'TENANT_INACTIVE') {
          return {
            data: null,
            error: 'RESOLVER_SMOKE_FAILED',
            summary: `No-domain resolver smoke for ${surface} returned ${payload.error}.`,
          }
        }
        results[surface] = payload.error
      }

      return {
        data: {
          status: 'succeeded',
          postconditions: {
            resolverSmokePassed: true,
            noDomainPathSmokePassed: true,
            preActivationSmoke: true,
            patientPathResult: results.patient,
            opsPathResult: results.ops,
          },
          summary: 'No-domain slug resolver recognizes both tenant app surfaces before activation.',
        },
        error: null,
      }
    }

    return {
      data: null,
      error: 'TENANT_ACTIVE_DOMAIN_REQUIRED',
      summary: 'Resolver smoke requires /t/<tenant-slug> runtime config or active patient and ops domains.',
    }
  }

  const checks = [
    { surface: 'patient' as const, host: required.data.patient[0].hostname },
    { surface: 'ops' as const, host: required.data.ops[0].hostname },
  ]
  const results: Record<string, string | null> = {}

  for (const check of checks) {
    const { data, error: rpcError } = await context.client.rpc('resolve_tenant', {
      p_host: check.host,
      p_surface: check.surface,
    })
    if (rpcError) {
      return { data: null, error: 'RESOLVER_SMOKE_FAILED', summary: 'Control-plane resolver RPC failed during smoke test.' }
    }

    const payload = normalizeRpcResolverPayload(data)
    if (payload.error && payload.error !== 'TENANT_INACTIVE') {
      return {
        data: null,
        error: 'RESOLVER_SMOKE_FAILED',
        summary: `Resolver smoke for ${check.surface} returned ${payload.error}.`,
      }
    }
    results[check.surface] = payload.error
  }

  return {
    data: {
      status: 'succeeded',
      postconditions: {
        resolverSmokePassed: true,
        preActivationSmoke: true,
        patientResult: results.patient,
        opsResult: results.ops,
      },
      summary: 'Resolver RPC recognizes both tenant app surfaces before activation.',
    },
    error: null,
  }
}

function tenantResolverUrl() {
  const configured = Deno.env.get('TENANT_RESOLVER_URL')?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim().replace(/\/+$/, '')
  return supabaseUrl ? `${supabaseUrl}/functions/v1/tenant-resolve` : ''
}

async function smokePublicResolver(host: string, surface: 'patient' | 'ops', tenantId: string, slug?: string) {
  const resolverUrl = tenantResolverUrl()
  if (!resolverUrl) return { error: 'RESOLVER_SMOKE_FAILED', summary: 'TENANT_RESOLVER_URL is not configured.' }

  try {
    const url = new URL(resolverUrl)
    url.searchParams.set('host', host)
    url.searchParams.set('surface', surface)
    if (slug) url.searchParams.set('slug', slug)

    const response = await fetch(url)
    const body = await response.json().catch(() => null)
    const data = body && typeof body === 'object' ? (body as { data?: Record<string, unknown>; error?: unknown }) : null
    if (!response.ok || data?.error || data?.data?.tenantId !== tenantId || data?.data?.surface !== surface) {
      return { error: 'RESOLVER_SMOKE_FAILED', summary: `Public resolver smoke failed for ${surface}.` }
    }
    return { error: null, summary: null }
  } catch (_error) {
    return { error: 'RESOLVER_SMOKE_FAILED', summary: `Public resolver smoke request failed for ${surface}.` }
  }
}

async function runActivateTenant(
  context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>,
  tenantId: string,
): Promise<StepExecution> {
  const { data: tenant, error: tenantError } = await context.client
    .from('tenants')
    .select('id, slug, status, supabase_project_ref, supabase_url, supabase_anon_key')
    .eq('id', tenantId)
    .maybeSingle()

  const runtimeConfig = tenant ? normalizeSupabaseRuntimeConfig(tenant) : null
  if (tenantError || !tenant || !runtimeConfig) {
    return {
      data: null,
      error: 'RUNTIME_CONFIG_REQUIRED',
      summary: 'Tenant runtime config must be valid before activation.',
    }
  }

  const { data: domains, error: domainsError } = await loadTenantDomains(context, tenantId)
  if (domainsError) {
    return { data: null, error: 'TENANT_ACTIVE_DOMAIN_REQUIRED', summary: 'Tenant domains could not be loaded before activation.' }
  }

  const required = requireActivePatientAndOpsDomains(domains)
  const noDomainRouting = noDomainPathRoutingForTenant(tenant)

  if ((required.error || !required.data) && !noDomainRouting) {
    return {
      data: null,
      error: 'TENANT_ACTIVE_DOMAIN_REQUIRED',
      summary: 'Activation requires /t/<tenant-slug> path routing or active patient and ops domains. Real doctoleb.com rows can remain pending.',
    }
  }

  if (tenant.status !== 'active') {
    const { data: updated, error: updateError } = await context.client.rpc('admin_update_tenant_atomic', {
      p_actor_id: context.admin.id,
      p_tenant_id: tenantId,
      p_patch: { status: 'active' },
      p_domains: [],
    })
    const payloadError = readPayloadError(updated)
    if (updateError || payloadError) {
      return {
        data: null,
        error: payloadError || 'TENANT_ACTIVATION_FAILED',
        summary: 'Tenant activation was rejected by the control-plane lifecycle.',
      }
    }
  }

  const patientHost = required.data?.patient[0]?.hostname ?? noDomainRouting?.patientHost
  const opsHost = required.data?.ops[0]?.hostname ?? noDomainRouting?.opsHost
  const pathSlug = required.data ? undefined : noDomainRouting?.slug

  if (!patientHost || !opsHost) {
    return {
      data: null,
      error: 'TENANT_ACTIVE_DOMAIN_REQUIRED',
      summary: 'Activation could not determine patient and ops routing hosts.',
    }
  }

  const patientSmoke = await smokePublicResolver(patientHost, 'patient', tenantId, pathSlug)
  if (patientSmoke.error) {
    return { data: null, error: patientSmoke.error, summary: patientSmoke.summary ?? 'Patient resolver smoke failed.' }
  }

  const opsSmoke = await smokePublicResolver(opsHost, 'ops', tenantId, pathSlug)
  if (opsSmoke.error) {
    return { data: null, error: opsSmoke.error, summary: opsSmoke.summary ?? 'Ops resolver smoke failed.' }
  }

  return {
    data: {
      status: 'succeeded',
      postconditions: {
        tenantActivated: true,
        postActivationResolverSmokePassed: true,
        noDomainPathActivated: Boolean(pathSlug),
        activePatientHost: patientHost,
        activeOpsHost: opsHost,
        patientPathUrl: noDomainRouting?.patientUrl ?? null,
        opsPathUrl: noDomainRouting?.opsUrl ?? null,
      },
      externalResourceKind: 'control_plane_tenant_status',
      externalResourceId: tenantId,
      summary: 'Tenant is active and public resolver smoke passed for patient and ops hosts.',
    },
    error: null,
  }
}

function flattenSeedBranding(branding: ReturnType<typeof normalizeTenantBranding>) {
  return {
    display_name: branding.profile.display_name,
    default_locale: branding.profile.default_locale,
    ...branding.app,
  }
}

function normalizeEmail(value: unknown) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && email.length <= 320 ? email : ''
}

function normalizeText(value: unknown, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

async function runCreateSupabaseProject(
  context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>,
  tenantId: string,
): Promise<StepExecution> {
  const { data: tenant, error } = await context.client
    .from('tenants')
    .select('id, supabase_project_ref, supabase_url, supabase_anon_key')
    .eq('id', tenantId)
    .maybeSingle()

  const runtimeConfig = tenant ? normalizeSupabaseRuntimeConfig(tenant) : null

  if (error || !runtimeConfig) {
    return {
      data: null,
      error: 'SUPABASE_PROJECT_RUNTIME_CONFIG_REQUIRED',
      summary: 'Link an existing tenant Supabase project through runtime config before completing this step.',
    }
  }

  return {
    data: {
      status: 'succeeded',
      postconditions: {
        projectRefStoredInRuntimeConfig: true,
        provisioningMode: 'operator_supplied_project_ref',
        supabaseProjectRef: runtimeConfig.projectRef,
        supabaseUrlHost: runtimeConfig.supabaseUrlHost,
      },
      externalResourceKind: 'supabase_project',
      externalResourceId: tenant.supabase_project_ref,
      externalResourceUrl: runtimeConfig.supabaseUrl,
      summary: 'Existing tenant Supabase project is linked and recorded for provisioning.',
    },
    error: null,
  }
}

async function runApplyTenantMigrations(
  context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>,
  tenantId: string,
): Promise<StepExecution> {
  const { data: tenant, error } = await context.client
    .from('tenants')
    .select('id, supabase_project_ref, supabase_url, supabase_anon_key')
    .eq('id', tenantId)
    .maybeSingle()

  const runtimeConfig = tenant ? normalizeSupabaseRuntimeConfig(tenant) : null
  if (error || !runtimeConfig) {
    return {
      data: null,
      error: 'SUPABASE_PROJECT_RUNTIME_CONFIG_REQUIRED',
      summary: 'Link tenant Supabase runtime config before checking tenant migrations.',
    }
  }

  const tenantSecret = getTenantServiceRoleKey(runtimeConfig.projectRef)
  if (!tenantSecret.key) {
    return {
      data: null,
      error: 'TENANT_SERVICE_ROLE_SECRET_REQUIRED',
      summary: `Configure ${tenantSecret.secretName} before checking tenant migrations.`,
    }
  }

  const tenantClient = createTenantServiceClient(runtimeConfig.supabaseUrl, tenantSecret.key)
  const [{ error: profileError }, { error: appConfigError }] = await Promise.all([
    tenantClient.from('tenant_profile').select('id, schema_version, status').limit(1),
    tenantClient.from('tenant_app_config').select('id, app_name').limit(1),
  ])

  if (profileError || appConfigError) {
    return {
      data: null,
      error: 'TENANT_MIGRATIONS_NOT_READY',
      summary: 'Tenant database migrations are not ready or expected runtime tables are missing.',
    }
  }

  return {
    data: {
      status: 'succeeded',
      postconditions: {
        tenantMigrationsApplied: true,
        tenantProfileTableReady: true,
        tenantAppConfigTableReady: true,
        checkedWithServiceRoleSecret: tenantSecret.secretName,
      },
      summary: 'Tenant database migration shape is ready.',
    },
    error: null,
  }
}

async function runSeedTenantProfile(
  context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>,
  tenantId: string,
  job: ProvisioningJob,
): Promise<StepExecution> {
  const { data: tenant, error } = await context.client
    .from('tenants')
    .select('id, slug, display_name, supabase_project_ref, supabase_url, supabase_anon_key')
    .eq('id', tenantId)
    .maybeSingle()

  const runtimeConfig = tenant ? normalizeSupabaseRuntimeConfig(tenant) : null
  if (error || !tenant || !runtimeConfig) {
    return {
      data: null,
      error: 'SUPABASE_PROJECT_RUNTIME_CONFIG_REQUIRED',
      summary: 'Link tenant Supabase runtime config before seeding tenant profile.',
    }
  }

  const tenantSecret = getTenantServiceRoleKey(runtimeConfig.projectRef)
  if (!tenantSecret.key) {
    return {
      data: null,
      error: 'TENANT_SERVICE_ROLE_SECRET_REQUIRED',
      summary: `Configure ${tenantSecret.secretName} before seeding tenant profile.`,
    }
  }

  const tenantClient = createTenantServiceClient(runtimeConfig.supabaseUrl, tenantSecret.key)
  const [{ data: previousProfile, error: profileLookupError }, { data: previousAppConfig, error: appLookupError }] = await Promise.all([
    tenantClient.from('tenant_profile').select('id, tenant_slug, display_name, status, schema_version').limit(1).maybeSingle(),
    tenantClient.from('tenant_app_config').select('id, profile_id, app_name').limit(1).maybeSingle(),
  ])

  if (profileLookupError || appLookupError) {
    return {
      data: null,
      error: 'TENANT_PROFILE_SEED_RPC_NOT_READY',
      summary: 'Tenant profile seed tables are not ready. Apply tenant migrations first.',
    }
  }

  const branding = normalizeTenantBranding(job.initial_branding, {
    profileDisplayNameFallback: tenant.display_name,
    appNameFallback: tenant.display_name,
  })
  const { data: rpcPayload, error: rpcError } = await tenantClient.rpc('service_seed_tenant_profile', {
    p_tenant_slug: tenant.slug,
    p_display_name: branding.profile.display_name,
    p_branding: flattenSeedBranding(branding),
  })

  if (rpcError) {
    return {
      data: null,
      error: 'TENANT_PROFILE_SEED_RPC_NOT_READY',
      summary: 'Tenant profile seed RPC is not installed or cannot be executed by the service role.',
    }
  }

  const payload = rpcPayload && typeof rpcPayload === 'object'
    ? rpcPayload as { data?: Record<string, unknown>; error?: unknown }
    : null

  if (typeof payload?.error === 'string' || !payload?.data) {
    return {
      data: null,
      error: 'TENANT_PROFILE_SEED_FAILED',
      summary: 'Tenant profile seed RPC rejected the normalized seed payload.',
    }
  }

  return {
    data: {
      status: 'succeeded',
      postconditions: {
        tenantProfileSeeded: true,
        tenantAppConfigSeeded: true,
        tenantSlug: tenant.slug,
        profileId: payload.data.profileId,
        appConfigId: payload.data.appConfigId,
        hadExistingTenantProfile: Boolean(previousProfile?.id),
        hadExistingTenantAppConfig: Boolean(previousAppConfig?.id),
        checkedWithServiceRoleSecret: tenantSecret.secretName,
      },
      summary: 'Tenant profile and tenant app config are seeded through the tenant DB service RPC.',
    },
    error: null,
  }
}

async function runSeedFirstDoctorAdmin(
  context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>,
  tenantId: string,
  job: ProvisioningJob,
): Promise<StepExecution> {
  const firstDoctorEmail = normalizeEmail(job.first_doctor_email)
  const firstDoctorDisplayName = normalizeText(job.first_doctor_display_name, 160)
  const firstDoctorPhone = normalizeText(job.first_doctor_phone, 40) || null
  if (!firstDoctorEmail || !firstDoctorDisplayName) {
    return {
      data: null,
      error: 'FIRST_DOCTOR_ADMIN_INPUT_REQUIRED',
      summary: 'Capture the first doctor/admin name and email before running this step.',
    }
  }

  const { data: tenant, error } = await context.client
    .from('tenants')
    .select('id, slug, supabase_project_ref, supabase_url, supabase_anon_key')
    .eq('id', tenantId)
    .maybeSingle()

  const runtimeConfig = tenant ? normalizeSupabaseRuntimeConfig(tenant) : null
  if (error || !tenant || !runtimeConfig) {
    return {
      data: null,
      error: 'SUPABASE_PROJECT_RUNTIME_CONFIG_REQUIRED',
      summary: 'Link tenant Supabase runtime config before creating the first doctor/admin invite.',
    }
  }

  const tenantSecret = getTenantServiceRoleKey(runtimeConfig.projectRef)
  if (!tenantSecret.key) {
    return {
      data: null,
      error: 'TENANT_SERVICE_ROLE_SECRET_REQUIRED',
      summary: `Configure ${tenantSecret.secretName} before creating the first doctor/admin invite.`,
    }
  }

  const tenantClient = createTenantServiceClient(runtimeConfig.supabaseUrl, tenantSecret.key)
  const redirectTo = Deno.env.get('TENANT_FIRST_DOCTOR_INVITE_REDIRECT_URL') || undefined
  const { data: invited, error: inviteError } = await tenantClient.auth.admin.inviteUserByEmail(
    firstDoctorEmail,
    {
      data: {
        role: 'doctor',
        full_name: firstDoctorDisplayName,
      },
      redirectTo,
    },
  )

  const invitedAuthUserId = invited?.user?.id
  if (inviteError || !invitedAuthUserId) {
    return {
      data: null,
      error: 'FIRST_DOCTOR_ADMIN_INVITE_FAILED',
      summary: 'Tenant Auth could not create the first doctor/admin invitation.',
    }
  }

  const clientRequestId = normalizeUuid(job.client_request_id)
  const { data: rpcPayload, error: rpcError } = await tenantClient.rpc('service_seed_first_doctor_admin', {
    p_invited_auth_user_id: invitedAuthUserId,
    p_email: firstDoctorEmail,
    p_display_name: firstDoctorDisplayName,
    p_phone: firstDoctorPhone,
    p_client_request_id: clientRequestId || null,
  })

  const payload = rpcPayload && typeof rpcPayload === 'object'
    ? rpcPayload as { data?: Record<string, unknown>; error?: unknown }
    : null

  if (rpcError || typeof payload?.error === 'string' || !payload?.data) {
    const { error: deleteError } = await tenantClient.auth.admin.deleteUser(invitedAuthUserId, true)
    if (deleteError) {
      return {
        data: null,
        error: 'FIRST_DOCTOR_ADMIN_COMPENSATION_FAILED',
        summary: 'First doctor/admin invite was created but domain seeding failed and Auth compensation failed.',
      }
    }

    return {
      data: null,
      error: rpcError ? 'FIRST_DOCTOR_ADMIN_SEED_RPC_NOT_READY' : 'FIRST_DOCTOR_ADMIN_SEED_FAILED',
      summary: 'First doctor/admin domain seed failed; the Auth invite was compensated.',
    }
  }

  return {
    data: {
      status: 'succeeded',
      postconditions: {
        firstDoctorAdminInviteCreated: true,
        tenantDoctorSeeded: true,
        tenantSlug: tenant.slug,
        domainUserId: payload.data.domainUserId,
        doctorId: payload.data.doctorId,
        tenantProfileId: payload.data.tenantProfileId,
        checkedWithServiceRoleSecret: tenantSecret.secretName,
      },
      summary: 'First doctor/admin invitation and tenant doctor record were created.',
    },
    error: null,
  }
}

async function markRunning(
  context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>,
  actorId: string,
  stepId: string,
) {
  const { data, error } = await context.client.rpc('admin_mark_provisioning_step_running', {
    p_actor_id: actorId,
    p_step_id: stepId,
  })

  return { data, error }
}

async function recordResult(
  context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>,
  actorId: string,
  stepId: string,
  result: StepExecution['data'],
) {
  const { data, error } = await context.client.rpc('admin_record_provisioning_step_result_atomic', {
    p_actor_id: actorId,
    p_step_id: stepId,
    p_status: result?.status ?? 'failed',
    p_postconditions: result?.postconditions ?? {},
    p_error_code: null,
    p_error_summary: null,
    p_external_resource_kind: result?.externalResourceKind ?? null,
    p_external_resource_id: result?.externalResourceId ?? null,
    p_external_resource_url: result?.externalResourceUrl ?? null,
  })

  return { data, error }
}

async function recordFailure(
  context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>,
  actorId: string,
  stepId: string,
  errorCode: string,
  errorSummary: string,
) {
  const { data, error } = await context.client.rpc('admin_record_provisioning_step_result_atomic', {
    p_actor_id: actorId,
    p_step_id: stepId,
    p_status: 'failed',
    p_postconditions: {},
    p_error_code: errorCode,
    p_error_summary: errorSummary,
    p_external_resource_kind: null,
    p_external_resource_id: null,
    p_external_resource_url: null,
  })

  return { data, error }
}

Deno.serve(async (req) => {
  const preflightResponse = preflight(req)
  if (preflightResponse) return preflightResponse

  const cors = corsHeaders(req.headers.get('origin'))
  if (req.method !== 'POST') {
    return errorResponse('INVALID_METHOD', 405, cors)
  }

  const { data: context, response } = await requireSuperAdmin(req, ['operator'])
  if (response) return response

  const body = await readJsonBody(req)
  const tenantId = normalizeUuid(body.tenantId ?? body.tenant_id)
  const stepId = normalizeUuid(body.stepId ?? body.step_id)
  const stepCode = typeof body.stepCode === 'string' ? body.stepCode.trim().toLowerCase() : ''

  if (!tenantId || (!stepId && !stepCode)) {
    return errorResponse('INVALID_REQUEST', 400, cors)
  }

  const { data: step, error: stepError } = await fetchStep(context, { tenantId, stepId, stepCode })
  if (stepError) return errorResponse('STEP_LOOKUP_FAILED', 500, cors)
  if (!step) return errorResponse('STEP_NOT_FOUND', 404, cors)

  const { data: job, error: jobError } = await fetchJob(context, step.provisioning_job_id)
  if (jobError) return errorResponse('PROVISIONING_JOB_LOOKUP_FAILED', 500, cors)
  if (!job) return errorResponse('PROVISIONING_JOB_NOT_FOUND', 404, cors)

  if (TERMINAL_STEP_STATUSES.has(step.status)) {
    return jsonResponse({ data: { step, job, alreadyFinal: true }, error: null }, 200, cors)
  }

  if (!SAFE_RUNNER_STEPS.has(step.step_code)) {
    return errorResponse('STEP_NOT_AUTOMATED', 409, cors, {
      stepCode: step.step_code,
      summary: 'This step requires the external provider runner and cannot be marked complete by placeholder logic.',
    })
  }

  const previousSteps = await assertPreviousStepsComplete(context, step)
  if (previousSteps.error) return errorResponse(previousSteps.error, 409, cors)

  const started = await markRunning(context, context.admin.id, step.id)
  const startError = started.error ? 'STEP_RUN_START_FAILED' : readPayloadError(started.data)
  if (startError) return errorResponse(startError, statusForError(startError), cors)

  let execution: StepExecution
  if (step.step_code === 'provider_connections_selected') {
    execution = await runProviderConnectionsSelected(context, job)
  } else if (step.step_code === 'create_supabase_project') {
    execution = await runCreateSupabaseProject(context, tenantId)
  } else if (step.step_code === 'apply_tenant_migrations') {
    execution = await runApplyTenantMigrations(context, tenantId)
  } else if (step.step_code === 'seed_tenant_profile') {
    execution = await runSeedTenantProfile(context, tenantId, job)
  } else if (step.step_code === 'seed_first_doctor_admin') {
    execution = await runSeedFirstDoctorAdmin(context, tenantId, job)
  } else if (step.step_code === 'configure_vercel_project') {
    execution = await runConfigureVercelProject(context, tenantId)
  } else if (step.step_code === 'store_runtime_config') {
    execution = await runStoreRuntimeConfig(context, tenantId)
  } else if (step.step_code === 'smoke_test_resolver') {
    execution = await runSmokeTestResolver(context, tenantId)
  } else {
    execution = await runActivateTenant(context, tenantId)
  }

  if (execution.error) {
    const failed = await recordFailure(context, context.admin.id, step.id, execution.error, execution.summary)
    const failureRecordError = failed.error ? 'STEP_RESULT_RECORD_FAILED' : readPayloadError(failed.data)
    if (failureRecordError) return errorResponse(failureRecordError, statusForError(failureRecordError), cors)
    return errorResponse(execution.error, statusForError(execution.error), cors, { summary: execution.summary })
  }

  const recorded = await recordResult(context, context.admin.id, step.id, execution.data)
  const recordError = recorded.error ? 'STEP_RESULT_RECORD_FAILED' : readPayloadError(recorded.data)
  if (recordError) return errorResponse(recordError, statusForError(recordError), cors)

  const payload = recorded.data && typeof recorded.data === 'object'
    ? recorded.data as { data?: unknown }
    : { data: null }

  return jsonResponse({
    data: {
      ...(payload.data && typeof payload.data === 'object' ? payload.data as Record<string, unknown> : {}),
      result: {
        stepCode: step.step_code,
        status: execution.data.status,
        summary: execution.data.summary,
      },
    },
    error: null,
  }, 200, cors)
})
