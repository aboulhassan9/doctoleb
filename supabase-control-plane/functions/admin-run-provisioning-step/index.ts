import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  preflight,
  createTenantServiceClient,
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
import {
  createProject,
  getProject,
  listProjectApiKeys,
  patchTenantAuthConfig,
} from '../_shared/supabaseManagementApi.ts'
import { resolveTenantServiceRoleKey } from '../_shared/tenantSecrets.ts'
import { runTenantDatabaseMigrations } from '../_shared/tenantMigrationRunner.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TENANT_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const DEFAULT_PATIENT_WEB_URL = 'https://doctoleb-patient-web.vercel.app'
const DEFAULT_CLINIC_OPS_URL = 'https://doctoleb-clinic-ops.vercel.app'
const TENANT_EMAIL_OTP_LENGTH = 8
const TERMINAL_STEP_STATUSES = new Set(['succeeded', 'skipped', 'cancelled', 'rolled_back'])
const SAFE_RUNNER_STEPS = new Set([
  'provider_connections_selected',
  'create_supabase_project',
  'apply_tenant_migrations',
  'seed_tenant_profile',
  'normalize_tenant_auth_settings',
  'seed_first_doctor_admin',
  'configure_vercel_project',
  'store_runtime_config',
  'smoke_test_resolver',
  'activate_tenant',
])
const PROVISIONING_STEP_ORDER = [
  'tenant_draft_created',
  'provider_connections_selected',
  'create_supabase_project',
  'apply_tenant_migrations',
  'seed_tenant_profile',
  'normalize_tenant_auth_settings',
  'seed_first_doctor_admin',
  'configure_vercel_project',
  'store_runtime_config',
  'smoke_test_resolver',
  'activate_tenant',
]
const PROVISIONING_STEP_RANK = new Map(PROVISIONING_STEP_ORDER.map((code, index) => [code, index]))
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
  TENANT_DATABASE_URL_SECRET_REQUIRED: 409,
  TENANT_DATABASE_URL_INVALID: 400,
  TENANT_DATABASE_PROJECT_MISMATCH: 409,
  TENANT_DATABASE_NOT_EMPTY: 409,
  TENANT_SERVICE_ROLE_SECRET_REQUIRED: 409,
  TENANT_MIGRATIONS_NOT_READY: 409,
  TENANT_MIGRATION_FAILED: 409,
  TENANT_MIGRATION_RUN_FAILED: 500,
  SUPABASE_PROJECT_INITIALIZING: 503,
  SUPABASE_PROJECT_CREATE_FAILED: 502,
  SUPABASE_PROJECT_KEYS_UNAVAILABLE: 503,
  PROVIDER_ORG_REQUIRED: 409,
  TENANT_PROJECT_REF_PERSIST_FAILED: 500,
  TENANT_MIGRATION_RUN_RECORD_FAILED: 500,
  TENANT_MIGRATION_ITEM_RECORD_FAILED: 500,
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
  | { data: null; error: string; summary: string; details?: Record<string, unknown> }

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

function safeFailureText(value: unknown, maxLength = 180) {
  const text = typeof value === 'string'
    ? value
    : value == null
      ? ''
      : String(value)

  return text
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-db-url]')
    .replace(/\bsb_(?:secret|service_role|publishable)_[A-Za-z0-9_-]+/gi, '[redacted-key]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted-jwt]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')
    .slice(0, maxLength)
}

function safeInviteFailureSummary(inviteError: unknown) {
  const message = safeFailureText((inviteError as { message?: unknown } | null)?.message ?? inviteError)
  const normalized = message.toLowerCase()

  if (/api key|apikey|jwt|token|service|authorization|forbidden|invalid key|not authorized/.test(normalized)) {
    return 'Tenant Auth rejected the saved service-role key.'
  }

  if (/already|registered|exists|duplicate/.test(normalized)) {
    return 'This doctor email already exists in tenant Auth.'
  }

  if (/email|address/.test(normalized)) {
    return 'Tenant Auth rejected the doctor email.'
  }

  return 'Tenant Auth could not create the first doctor/admin invite.'
}

function safeInviteFailureDetails(
  inviteError: unknown,
  tenantSecret: Awaited<ReturnType<typeof resolveTenantServiceRoleKey>>,
) {
  const errorObject = inviteError && typeof inviteError === 'object'
    ? inviteError as { name?: unknown; code?: unknown; status?: unknown; message?: unknown }
    : null

  return {
    authErrorName: safeFailureText(errorObject?.name, 80) || null,
    authErrorCode: safeFailureText(errorObject?.code, 80) || null,
    authErrorStatus: typeof errorObject?.status === 'number' || typeof errorObject?.status === 'string'
      ? errorObject.status
      : null,
    authErrorSummary: safeFailureText(errorObject?.message ?? inviteError) || 'Tenant Auth did not return an invited user id.',
    serviceSecretSource: tenantSecret.source,
    serviceSecretStorage: tenantSecret.secretStorage,
    serviceSecretRef: tenantSecret.secretRef,
  }
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

  if (error) {
    return {
      error: 'STEP_PRECONDITION_FAILED',
      details: {
        summary: 'Could not read the setup checklist order.',
        currentStepCode: currentStep.step_code,
      },
    }
  }

  const orderedSteps = [...(data ?? [])].sort(compareProvisioningStepsForPreconditions)
  for (const step of orderedSteps) {
    if (step.id === currentStep.id) return { error: null }
    if (!TERMINAL_STEP_STATUSES.has(step.status)) {
      return {
        error: 'STEP_PRECONDITION_FAILED',
        details: {
          summary: 'Finish the highlighted setup step first.',
          blockingStepCode: step.step_code,
          blockingStepStatus: step.status,
          currentStepCode: currentStep.step_code,
        },
      }
    }
  }

  return {
    error: 'STEP_PRECONDITION_FAILED',
    details: {
      summary: 'Selected setup step is not part of the active checklist.',
      currentStepCode: currentStep.step_code,
    },
  }
}

function compareProvisioningStepsForPreconditions(
  a: Pick<ProvisioningStep, 'step_code' | 'created_at'>,
  b: Pick<ProvisioningStep, 'step_code' | 'created_at'>,
) {
  const rankDiff = stepRank(a.step_code) - stepRank(b.step_code)
  if (rankDiff !== 0) return rankDiff
  return String(a.created_at || '').localeCompare(String(b.created_at || ''))
}

function stepRank(stepCode: string) {
  return PROVISIONING_STEP_RANK.get(stepCode) ?? Number.MAX_SAFE_INTEGER
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
    .select('id, provider, status, is_automation_enabled, secret_storage, secret_ref, external_org_id')
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

  const supabaseVerification = supabaseReady ? await verifyProviderCredential(supabaseConnection, context.client) : null
  if (supabaseVerification?.error) {
    return { data: null, error: supabaseVerification.error, summary: supabaseVerification.summary }
  }

  const vercelVerification = vercelReady ? await verifyProviderCredential(vercelConnection, context.client) : null
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

const DB_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_'
const DEFAULT_SUPABASE_REGION = 'us-east-2'

function generateStrongDbPassword(): string {
  const bytes = new Uint8Array(40)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const byte of bytes) {
    out += DB_PASSWORD_ALPHABET[byte % DB_PASSWORD_ALPHABET.length]
  }
  return out
}

function projectNameForTenant(tenant: { slug?: string | null; display_name?: string | null }): string {
  const slug = String(tenant.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24)
  const display = String(tenant.display_name || '').trim().slice(0, 24)
  const base = display ? `doctoleb-${slug || display}` : `doctoleb-${slug || 'tenant'}`
  return base.slice(0, 56)
}

async function persistTenantProjectRef(
  context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>,
  tenantId: string,
  fields: { supabase_project_ref: string; supabase_url: string; supabase_anon_key?: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await context.client
    .from('tenants')
    .update(fields)
    .eq('id', tenantId)

  if (error) return { ok: false, error: 'TENANT_PROJECT_REF_PERSIST_FAILED' }
  return { ok: true }
}

async function storeTenantDatabaseUrlSecret(
  context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>,
  tenantId: string,
  projectRef: string,
  dbPassword: string,
): Promise<void> {
  // Store the tenant DB connection string (with the generated password) in
  // Supabase Vault via the existing tenant-secret RPC. Used by
  // apply_tenant_migrations to connect over the database URL runner mode.
  const databaseUrl = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`
  await context.client.rpc('admin_store_tenant_secret_ref', {
    p_tenant_id: tenantId,
    p_project_ref: projectRef,
    p_secret_kind: 'database_url',
    p_secret_storage: 'supabase_vault',
    p_secret_value: databaseUrl,
    p_secret_ref: null,
    p_actor_id: context.admin.id,
  })
}

async function storeTenantServiceRoleSecret(
  context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>,
  tenantId: string,
  projectRef: string,
  serviceRoleKey: string,
): Promise<void> {
  await context.client.rpc('admin_store_tenant_secret_ref', {
    p_tenant_id: tenantId,
    p_project_ref: projectRef,
    p_secret_kind: 'service_role_key',
    p_secret_storage: 'supabase_vault',
    p_secret_value: serviceRoleKey,
    p_secret_ref: null,
    p_actor_id: context.admin.id,
  })
}

async function runCreateSupabaseProject(
  context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>,
  tenantId: string,
  job: ProvisioningJob,
): Promise<StepExecution> {
  const { data: tenant, error: tenantError } = await context.client
    .from('tenants')
    .select('id, slug, display_name, plan, supabase_project_ref, supabase_url, supabase_anon_key')
    .eq('id', tenantId)
    .maybeSingle()

  if (tenantError || !tenant) {
    return {
      data: null,
      error: 'TENANT_NOT_FOUND',
      summary: 'Tenant row could not be loaded for create_supabase_project.',
    }
  }

  const fullyWiredConfig = normalizeSupabaseRuntimeConfig(tenant)
  const supabaseConnection = await loadProviderConnection(context, job.supabase_connection_id)
  const automationMode = job.automation_mode || 'manual'
  const canAutomate = (automationMode === 'assisted' || automationMode === 'automatic')
    && connectionIsAutomationReady(supabaseConnection, 'supabase')

  // Manual mode: keep historical behavior — operator supplied the runtime config
  // out-of-band and this step just verifies it.
  if (!canAutomate) {
    if (!fullyWiredConfig) {
      return {
        data: null,
        error: 'SUPABASE_PROJECT_RUNTIME_CONFIG_REQUIRED',
        summary: 'Link an existing tenant Supabase project through runtime config, or enable automation by attaching a Supabase provider connection.',
      }
    }
    return {
      data: {
        status: 'succeeded',
        postconditions: {
          projectRefStoredInRuntimeConfig: true,
          provisioningMode: 'operator_supplied_project_ref',
          supabaseProjectRef: fullyWiredConfig.projectRef,
          supabaseUrlHost: fullyWiredConfig.supabaseUrlHost,
        },
        externalResourceKind: 'supabase_project',
        externalResourceId: tenant.supabase_project_ref,
        externalResourceUrl: fullyWiredConfig.supabaseUrl,
        summary: 'Existing tenant Supabase project is linked and recorded for provisioning.',
      },
      error: null,
    }
  }

  // Automated path. Idempotent: if tenant has a project_ref already, verify
  // status and finish wiring. Otherwise create a new project.
  if (tenant.supabase_project_ref) {
    const projectResult = await getProject(context.client, supabaseConnection!, tenant.supabase_project_ref)
    if (projectResult.error || !projectResult.data) {
      return {
        data: null,
        error: projectResult.error ?? 'SUPABASE_PROJECT_KEYS_UNAVAILABLE',
        summary: 'Supabase Management API rejected the project lookup.',
        details: { status: projectResult.status, projectRef: tenant.supabase_project_ref },
      }
    }

    if (projectResult.data.status !== 'ACTIVE_HEALTHY') {
      return {
        data: null,
        error: 'SUPABASE_PROJECT_INITIALIZING',
        summary: `Supabase project ${tenant.supabase_project_ref} is still ${projectResult.data.status}. Retry this step in ~60s.`,
        details: { projectRef: tenant.supabase_project_ref, status: projectResult.data.status },
      }
    }

    if (!fullyWiredConfig) {
      const keysResult = await listProjectApiKeys(context.client, supabaseConnection!, tenant.supabase_project_ref)
      if (keysResult.error || !keysResult.data) {
        return {
          data: null,
          error: keysResult.error ?? 'SUPABASE_PROJECT_KEYS_UNAVAILABLE',
          summary: 'Could not fetch tenant project API keys from Supabase Management API.',
        }
      }

      const anonKey = keysResult.data.find((k) => k.name === 'anon')?.apiKey
      const serviceRoleKey = keysResult.data.find((k) => k.name === 'service_role')?.apiKey
      if (!anonKey || !serviceRoleKey) {
        return {
          data: null,
          error: 'SUPABASE_PROJECT_KEYS_UNAVAILABLE',
          summary: 'Supabase Management API response did not include both anon and service_role keys.',
        }
      }

      const persisted = await persistTenantProjectRef(context, tenantId, {
        supabase_project_ref: tenant.supabase_project_ref,
        supabase_url: projectResult.data.supabaseUrl,
        supabase_anon_key: anonKey,
      })
      if (!persisted.ok) {
        return { data: null, error: persisted.error, summary: 'Failed to persist tenant runtime config.' }
      }

      await storeTenantServiceRoleSecret(context, tenantId, tenant.supabase_project_ref, serviceRoleKey)
    }

    return {
      data: {
        status: 'succeeded',
        postconditions: {
          projectRefStoredInRuntimeConfig: true,
          provisioningMode: 'automated_via_management_api',
          supabaseProjectRef: tenant.supabase_project_ref,
          supabaseUrlHost: `${tenant.supabase_project_ref}.supabase.co`,
          projectStatus: projectResult.data.status,
          anonKeyStored: true,
          serviceRoleKeySecretStored: true,
        },
        externalResourceKind: 'supabase_project',
        externalResourceId: tenant.supabase_project_ref,
        externalResourceUrl: projectResult.data.supabaseUrl,
        summary: 'Tenant Supabase project is active and runtime config (anon + service role) is persisted.',
      },
      error: null,
    }
  }

  // No project ref yet — create one.
  const organizationId = typeof supabaseConnection?.external_org_id === 'string'
    ? supabaseConnection.external_org_id.trim()
    : ''
  if (!organizationId) {
    return {
      data: null,
      error: 'PROVIDER_ORG_REQUIRED',
      summary: 'Supabase provider connection is missing external_org_id; cannot pick which org to create the project in.',
    }
  }

  const dbPassword = generateStrongDbPassword()
  const projectName = projectNameForTenant(tenant)
  const planForSupabase: 'free' | 'pro' = (tenant.plan === 'enterprise' || tenant.plan === 'pro') ? 'pro' : 'free'

  const created = await createProject(context.client, supabaseConnection!, {
    name: projectName,
    organizationId,
    region: DEFAULT_SUPABASE_REGION,
    dbPass: dbPassword,
    plan: planForSupabase,
  })

  if (created.error || !created.data) {
    return {
      data: null,
      error: created.error === 'PROVIDER_AUTH_FAILED'
        ? 'PROVIDER_AUTH_FAILED'
        : 'SUPABASE_PROJECT_CREATE_FAILED',
      summary: 'Supabase Management API rejected the project creation request.',
      details: { status: created.status, plan: planForSupabase, region: DEFAULT_SUPABASE_REGION },
    }
  }

  const persisted = await persistTenantProjectRef(context, tenantId, {
    supabase_project_ref: created.data.ref,
    supabase_url: created.data.supabaseUrl,
  })
  if (!persisted.ok) {
    return {
      data: null,
      error: persisted.error,
      summary: 'Supabase project was created but the tenant row update failed. Retry the step.',
      details: { projectRef: created.data.ref },
    }
  }

  await storeTenantDatabaseUrlSecret(context, tenantId, created.data.ref, dbPassword)

  return {
    data: null,
    error: 'SUPABASE_PROJECT_INITIALIZING',
    summary: `Created Supabase project ${created.data.ref}. Retry this step in ~60s to fetch API keys once the project is healthy.`,
    details: { projectRef: created.data.ref, status: created.data.status, plan: planForSupabase },
  }
}

async function runApplyTenantMigrations(
  context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>,
  tenantId: string,
  stepId: string | null,
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

  const migrationResult = await runTenantDatabaseMigrations(context, {
    tenantId,
    stepId,
    projectRef: runtimeConfig.projectRef,
  })
  if (migrationResult.error) {
    return {
      data: null,
      error: migrationResult.error,
      summary: migrationResult.summary,
      details: migrationResult.details,
    }
  }

  return {
    data: {
      status: 'succeeded',
      postconditions: {
        tenantMigrationsApplied: true,
        runnerMode: 'database_url',
        migrationRunId: migrationResult.data.migrationRunId,
        expectedMigrationsCount: migrationResult.data.expectedMigrationsCount,
        appliedMigrationsCount: migrationResult.data.appliedMigrationsCount,
        skippedMigrationsCount: migrationResult.data.skippedMigrationsCount,
        sourceChecksum: migrationResult.data.sourceChecksum,
        tenantProfileTableReady: true,
        tenantAppConfigTableReady: true,
        checkedWithSecretStorage: migrationResult.data.secretStorage,
      },
      summary: 'Tenant database migrations are applied and runtime objects are ready.',
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

  const tenantSecret = await resolveTenantServiceRoleKey(context.client, {
    tenantId,
    projectRef: runtimeConfig.projectRef,
  })
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

async function runNormalizeTenantAuthSettings(
  context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>,
  tenantId: string,
  job: ProvisioningJob,
): Promise<StepExecution> {
  const { data: tenant, error: tenantError } = await context.client
    .from('tenants')
    .select('id, slug, supabase_project_ref, supabase_url, supabase_anon_key')
    .eq('id', tenantId)
    .maybeSingle()

  const runtimeConfig = tenant ? normalizeSupabaseRuntimeConfig(tenant) : null
  if (tenantError || !tenant || !runtimeConfig) {
    return {
      data: null,
      error: 'SUPABASE_PROJECT_RUNTIME_CONFIG_REQUIRED',
      summary: 'Link tenant Supabase runtime config before normalizing tenant Auth settings.',
    }
  }

  const supabaseConnection = await loadProviderConnection(context, job.supabase_connection_id)
  if (!supabaseConnection || !connectionIsAutomationReady(supabaseConnection, 'supabase')) {
    return {
      data: null,
      error: 'PROVIDER_CONNECTION_REQUIRED',
      summary: 'Active Supabase provider connection with a server-side secret reference is required to normalize tenant Auth settings via the Management API.',
    }
  }

  const { data: tenantDomains } = await loadTenantDomains(context, tenantId)
  const activeOpsDomain = (tenantDomains ?? []).find(
    (domain) => domain.surface === 'ops' && isActiveRoutableDomain(domain),
  )
  const activePatientDomain = (tenantDomains ?? []).find(
    (domain) => domain.surface === 'patient' && isActiveRoutableDomain(domain),
  )
  const noDomainRouting = noDomainPathRoutingForTenant(tenant)

  const allowedRedirects = new Set<string>()
  const addRedirectsForHost = (hostname: string) => {
    const host = hostname.trim().toLowerCase()
    if (!host) return
    const scheme = isLocalDomain(host) ? 'http' : 'https'
    allowedRedirects.add(`${scheme}://${host}/login`)
    allowedRedirects.add(`${scheme}://${host}/reset-password`)
  }
  if (activeOpsDomain) addRedirectsForHost(String(activeOpsDomain.hostname || ''))
  if (activePatientDomain) addRedirectsForHost(String(activePatientDomain.hostname || ''))
  if (noDomainRouting) {
    allowedRedirects.add(`${noDomainRouting.opsUrl}/login`)
    allowedRedirects.add(`${noDomainRouting.opsUrl}/reset-password`)
    allowedRedirects.add(`${noDomainRouting.patientUrl}/login`)
    allowedRedirects.add(`${noDomainRouting.patientUrl}/reset-password`)
  }

  if (allowedRedirects.size === 0) {
    return {
      data: null,
      error: 'TENANT_ROUTING_REQUIRED',
      summary: 'Cannot normalize tenant Auth settings: tenant has no active routing. Complete configure_vercel_project or runtime config first.',
    }
  }

  const siteUrlSource = activeOpsDomain
    ? (() => {
      const host = String(activeOpsDomain.hostname || '').trim().toLowerCase()
      const scheme = isLocalDomain(host) ? 'http' : 'https'
      return `${scheme}://${host}`
    })()
    : noDomainRouting?.opsUrl ?? ''

  const result = await patchTenantAuthConfig(
    context.client,
    supabaseConnection,
    runtimeConfig.projectRef,
    {
      mailer_otp_length: TENANT_EMAIL_OTP_LENGTH,
      mailer_otp_exp: 600,
      site_url: siteUrlSource,
      uri_allow_list: Array.from(allowedRedirects).join(','),
    },
  )

  if (result.error) {
    return {
      data: null,
      error: result.error,
      summary: 'Supabase Management API rejected the tenant Auth configuration update.',
      details: { status: result.status, projectRef: runtimeConfig.projectRef },
    }
  }

  return {
    data: {
      status: 'succeeded',
      postconditions: {
        tenantAuthConfigNormalized: true,
        mailerOtpLength: TENANT_EMAIL_OTP_LENGTH,
        mailerOtpExpSeconds: 600,
        allowedRedirectCount: allowedRedirects.size,
        appliedFields: result.data.appliedFields,
      },
      externalResourceKind: 'supabase_auth_config',
      externalResourceId: runtimeConfig.projectRef,
      summary: `Tenant Auth settings normalized: OTP length ${TENANT_EMAIL_OTP_LENGTH}, expiry 10 min, redirect URLs allowlisted from tenant routing.`,
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

  const tenantSecret = await resolveTenantServiceRoleKey(context.client, {
    tenantId,
    projectRef: runtimeConfig.projectRef,
  })
  if (!tenantSecret.key) {
    return {
      data: null,
      error: 'TENANT_SERVICE_ROLE_SECRET_REQUIRED',
      summary: `Configure ${tenantSecret.secretName} before creating the first doctor/admin invite.`,
    }
  }

  const tenantClient = createTenantServiceClient(runtimeConfig.supabaseUrl, tenantSecret.key)

  // Build the invite redirect URL from tenant routing config so the first doctor
  // lands on their tenant's ops login page. Prefer an active custom ops domain;
  // fall back to /t/<slug> path routing. configure_vercel_project runs earlier in
  // the pipeline and guarantees one of these is available — if neither resolves
  // here, fail closed rather than silently using an undefined redirect.
  const { data: tenantDomains } = await loadTenantDomains(context, tenantId)
  const activeOpsDomain = (tenantDomains ?? []).find(
    (domain) => domain.surface === 'ops' && isActiveRoutableDomain(domain),
  )
  const noDomainRouting = noDomainPathRoutingForTenant(tenant)

  let redirectTo: string | undefined
  if (activeOpsDomain) {
    const hostname = String(activeOpsDomain.hostname || '').trim().toLowerCase()
    const scheme = isLocalDomain(hostname) ? 'http' : 'https'
    redirectTo = `${scheme}://${hostname}/login`
  } else if (noDomainRouting) {
    redirectTo = `${noDomainRouting.opsUrl}/login`
  }

  if (!redirectTo) {
    return {
      data: null,
      error: 'FIRST_DOCTOR_INVITE_REDIRECT_UNAVAILABLE',
      summary: 'Cannot build the first doctor invite redirect: tenant has no active ops domain and no /t/<slug> path routing. Complete configure_vercel_project before seeding the first doctor.',
    }
  }

  const { data: invited, error: inviteError } = await tenantClient.auth.admin.generateLink({
    type: 'invite',
    email: firstDoctorEmail,
    options: {
      data: {
        role: 'doctor',
        full_name: firstDoctorDisplayName,
      },
      redirectTo,
    },
  })

  let invitedAuthUserId = invited?.user?.id

  // Idempotency: if the email already exists in tenant Auth (e.g. from a
  // previous attempt or manual creation), look up the existing user instead
  // of failing. This allows safe retries of the seed_first_doctor_admin step.
  if (inviteError && !invitedAuthUserId) {
    const errorMessage = String((inviteError as { message?: unknown }).message ?? '').toLowerCase()
    const isAlreadyRegistered = /already|registered|exists|duplicate/.test(errorMessage)

    if (isAlreadyRegistered) {
      // Look up the existing Auth user by email through a tenant DB RPC
      const { data: existingUser, error: lookupError } = await tenantClient
        .rpc('get_auth_user_id_by_email', { p_email: firstDoctorEmail })
        .maybeSingle()

      // Fallback: try the admin API if the RPC doesn't exist
      if (lookupError || !existingUser) {
        // The user exists per the invite error, but we can't look them up.
        // Return a clear recovery message instead of a generic failure.
        return {
          data: null,
          error: 'FIRST_DOCTOR_ADMIN_ALREADY_EXISTS',
          summary: 'This doctor email already exists in tenant Auth. The domain seed step can be retried after verifying the Auth user.',
          details: safeInviteFailureDetails(inviteError, tenantSecret),
        }
      }

      invitedAuthUserId = typeof existingUser === 'string'
        ? existingUser
        : (existingUser as { id?: string })?.id
    }

    if (!invitedAuthUserId) {
      return {
        data: null,
        error: 'FIRST_DOCTOR_ADMIN_INVITE_FAILED',
        summary: safeInviteFailureSummary(inviteError),
        details: safeInviteFailureDetails(inviteError, tenantSecret),
      }
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
        inviteDeliveryMode: 'manual_link_generated',
        inviteEmailSent: false,
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
  if (previousSteps.error) return errorResponse(previousSteps.error, 409, cors, previousSteps.details)

  const started = await markRunning(context, context.admin.id, step.id)
  const startError = started.error ? 'STEP_RUN_START_FAILED' : readPayloadError(started.data)
  if (startError) return errorResponse(startError, statusForError(startError), cors)

  let execution: StepExecution
  if (step.step_code === 'provider_connections_selected') {
    execution = await runProviderConnectionsSelected(context, job)
  } else if (step.step_code === 'create_supabase_project') {
    execution = await runCreateSupabaseProject(context, tenantId, job)
  } else if (step.step_code === 'apply_tenant_migrations') {
    execution = await runApplyTenantMigrations(context, tenantId, step.id)
  } else if (step.step_code === 'seed_tenant_profile') {
    execution = await runSeedTenantProfile(context, tenantId, job)
  } else if (step.step_code === 'normalize_tenant_auth_settings') {
    execution = await runNormalizeTenantAuthSettings(context, tenantId, job)
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
    return errorResponse(execution.error, statusForError(execution.error), cors, {
      summary: execution.summary,
      ...(execution.details ?? {}),
    })
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
