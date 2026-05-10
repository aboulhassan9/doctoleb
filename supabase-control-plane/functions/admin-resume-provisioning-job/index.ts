import {
  auditEvent,
  corsHeaders,
  errorResponse,
  jsonResponse,
  preflight,
  readJsonBody,
  requireSuperAdmin,
} from '../_shared/admin.ts'
import {
  CONTROL_PLANE_DOMAIN_SELECT,
  CONTROL_PLANE_PROVISIONING_JOB_SELECT,
  CONTROL_PLANE_PROVISIONING_STEP_SELECT,
} from '../_shared/selects.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i
const TENANT_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const ACTIVE_JOB_STATUSES = new Set(['draft', 'ready_for_manual_provisioning', 'provisioning'])
const RESUMABLE_JOB_STATUSES = new Set(['blocked', 'failed', 'cancelled'])
const TENANT_RESUMABLE_STATUSES = new Set(['draft', 'provisioning', 'inactive'])
const RPC_ERROR_STATUS: Record<string, number> = {
  INVALID_REQUEST: 400,
  TENANT_NOT_FOUND: 404,
  TENANT_ALREADY_ACTIVE: 409,
  TENANT_NOT_RESUMABLE: 409,
  PREVIOUS_JOB_NOT_LATEST: 409,
  PROVISIONING_JOB_ACTIVE: 409,
  PROVISIONING_JOB_NOT_RESUMABLE: 409,
  PROVISIONING_STEP_SEED_FAILED: 500,
  PROVISIONING_STEP_CARRY_FORWARD_FAILED: 500,
  PROVISIONING_RESUME_FAILED: 500,
  TENANT_RESUME_STATUS_FAILED: 500,
}

type Context = NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>

type Tenant = {
  id: string
  slug: string
  display_name: string
  status: string
  plan: string | null
  supabase_project_ref: string | null
  supabase_url: string | null
  supabase_anon_key: string | null
  schema_version?: string | null
}

type ProvisioningJob = {
  id: string
  tenant_id: string | null
  supabase_connection_id: string | null
  vercel_connection_id: string | null
  requested_domains: unknown
  initial_branding: unknown
  first_doctor_email: string | null
  first_doctor_display_name: string | null
  first_doctor_phone: string | null
  automation_mode: string
  status: string
  checklist: unknown
}

type TenantDomain = {
  hostname: string
  surface: 'patient' | 'ops'
  status: string
  dns_status: string | null
  ssl_status: string | null
}

function normalizeUuid(value: unknown) {
  if (typeof value !== 'string') return ''
  const id = value.trim().toLowerCase()
  return UUID.test(id) ? id : ''
}

function normalizeTenantSlug(value: unknown) {
  if (typeof value !== 'string') return ''
  const slug = value.trim().toLowerCase()
  return TENANT_SLUG.test(slug) ? slug : ''
}

function normalizeReason(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 1000) : ''
}

function normalizeAutomationMode(value: unknown) {
  const mode = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return ['manual', 'assisted', 'automatic'].includes(mode) ? mode : 'manual'
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function normalizeJsonArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function buildRequestedDomains(domains: TenantDomain[]) {
  return domains.map((domain) => ({
    hostname: domain.hostname,
    surface: domain.surface,
    status: domain.status,
    dns_status: domain.dns_status,
    ssl_status: domain.ssl_status,
  }))
}

function normalizeRuntimeConfig(tenant: Tenant) {
  const projectRef = tenant.supabase_project_ref?.trim().toLowerCase() ?? ''
  const supabaseUrl = tenant.supabase_url?.trim().replace(/\/+$/, '').toLowerCase() ?? ''
  const anonKey = tenant.supabase_anon_key?.trim() ?? ''

  if (!/^[a-z0-9]{20}$/.test(projectRef)) return null
  if (supabaseUrl !== `https://${projectRef}.supabase.co`) return null
  if (anonKey.length < 20 || /\s/.test(anonKey)) return null

  return {
    projectRef,
    supabaseUrl,
    supabaseUrlHost: `${projectRef}.supabase.co`,
  }
}

function publicTenant(tenant: Tenant) {
  return {
    id: tenant.id,
    slug: tenant.slug,
    display_name: tenant.display_name,
    status: tenant.status,
    plan: tenant.plan,
    supabase_project_ref: tenant.supabase_project_ref,
    supabase_url: tenant.supabase_url,
    schema_version: tenant.schema_version ?? null,
  }
}

function statusForError(code: string) {
  return RPC_ERROR_STATUS[code] ?? 500
}

async function markJobBlocked(context: Context, jobId: string, summary: string) {
  await context.client
    .from('tenant_provisioning_jobs')
    .update({
      status: 'blocked',
      automation_status: 'blocked',
      last_error: summary,
    })
    .eq('id', jobId)
}

async function markProviderSelectionCheckpoint(
  context: Context,
  job: ProvisioningJob,
  jobId: string,
) {
  const hasConnections = Boolean(job.supabase_connection_id || job.vercel_connection_id)
  const automationMode = normalizeAutomationMode(job.automation_mode)
  if (hasConnections || automationMode !== 'manual') return { error: null }

  const { error } = await context.client
    .from('tenant_provisioning_steps')
    .update({
      status: 'skipped',
      postconditions: {
        automationMode,
        connectionsSelected: false,
        supabaseConnectionVerified: false,
        vercelConnectionVerified: false,
      },
      completed_at: new Date().toISOString(),
      last_error_code: null,
      last_error_summary: null,
    })
    .eq('provisioning_job_id', jobId)
    .eq('step_code', 'provider_connections_selected')

  return { error }
}

async function markSupabaseProjectCheckpoint(
  context: Context,
  tenant: Tenant,
  jobId: string,
) {
  const runtimeConfig = normalizeRuntimeConfig(tenant)
  if (!runtimeConfig) return { error: null }

  const { error } = await context.client
    .from('tenant_provisioning_steps')
    .update({
      status: 'succeeded',
      postconditions: {
        projectRefStoredInRuntimeConfig: true,
        provisioningMode: 'operator_supplied_project_ref',
        supabaseProjectRef: runtimeConfig.projectRef,
        supabaseUrlHost: runtimeConfig.supabaseUrlHost,
      },
      external_resource_kind: 'supabase_project',
      external_resource_id: runtimeConfig.projectRef,
      external_resource_url: runtimeConfig.supabaseUrl,
      completed_at: new Date().toISOString(),
      last_error_code: null,
      last_error_summary: null,
    })
    .eq('provisioning_job_id', jobId)
    .eq('step_code', 'create_supabase_project')

  return { error }
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
  const tenantIdInput = normalizeUuid(body.tenantId ?? body.tenant_id)
  const tenantSlugInput = normalizeTenantSlug(body.tenantSlug ?? body.tenant_slug ?? body.slug)
  const previousJobIdInput = body.previousJobId
    ?? body.previous_job_id
    ?? body.jobId
    ?? body.provisioningJobId
    ?? body.provisioning_job_id
  const previousJobId = normalizeUuid(previousJobIdInput)
  const reason = normalizeReason(body.reason)

  if (!tenantIdInput && !previousJobId && !tenantSlugInput) {
    return errorResponse('INVALID_REQUEST', 400, cors, {
      summary: 'Resume requires a tenant id, tenant slug, or provisioning job id.',
      acceptedFields: ['tenantId', 'tenant_id', 'tenantSlug', 'tenant_slug', 'slug', 'previousJobId', 'previous_job_id', 'jobId', 'provisioningJobId', 'provisioning_job_id'],
    })
  }

  if (previousJobIdInput && !previousJobId) {
    return errorResponse('INVALID_REQUEST', 400, cors, {
      summary: 'Provisioning job id must be a valid UUID.',
      acceptedFields: ['previousJobId', 'previous_job_id', 'jobId', 'provisioningJobId', 'provisioning_job_id'],
    })
  }

  let tenantId = tenantIdInput
  if (!tenantId && previousJobId) {
    const { data: previousJob, error: previousJobError } = await context.client
      .from('tenant_provisioning_jobs')
      .select('id, tenant_id')
      .eq('id', previousJobId)
      .maybeSingle()

    if (previousJobError) return errorResponse('PROVISIONING_RESUME_FAILED', 500, cors)
    const previousTenantId = normalizeUuid((previousJob as { tenant_id?: unknown } | null)?.tenant_id)
    if (!previousTenantId) return errorResponse('PROVISIONING_JOB_NOT_RESUMABLE', 409, cors)
    tenantId = previousTenantId
  }

  let tenantQuery = context.client
    .from('tenants')
    .select('id, slug, display_name, status, plan, supabase_project_ref, supabase_url, supabase_anon_key, schema_version')
  tenantQuery = tenantId ? tenantQuery.eq('id', tenantId) : tenantQuery.eq('slug', tenantSlugInput)

  const { data: tenant, error: tenantError } = await tenantQuery.maybeSingle()

  if (tenantError) return errorResponse('PROVISIONING_RESUME_FAILED', 500, cors)
  if (!tenant) return errorResponse('TENANT_NOT_FOUND', 404, cors)

  const typedTenant = tenant as Tenant
  tenantId = typedTenant.id
  if (typedTenant.status === 'active') return errorResponse('TENANT_ALREADY_ACTIVE', 409, cors)
  if (!TENANT_RESUMABLE_STATUSES.has(typedTenant.status)) {
    return errorResponse('TENANT_NOT_RESUMABLE', 409, cors, { status: typedTenant.status })
  }

  const { data: latestJob, error: latestJobError } = await context.client
    .from('tenant_provisioning_jobs')
    .select(CONTROL_PLANE_PROVISIONING_JOB_SELECT)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestJobError) return errorResponse('PROVISIONING_RESUME_FAILED', 500, cors)
  if (!latestJob) return errorResponse('PROVISIONING_JOB_NOT_RESUMABLE', 409, cors)

  const typedLatestJob = latestJob as ProvisioningJob
  if (previousJobId && typedLatestJob.id !== previousJobId) {
    return errorResponse('PREVIOUS_JOB_NOT_LATEST', 409, cors)
  }

  if (ACTIVE_JOB_STATUSES.has(typedLatestJob.status)) {
    return errorResponse('PROVISIONING_JOB_ACTIVE', 409, cors, { status: typedLatestJob.status })
  }

  if (!RESUMABLE_JOB_STATUSES.has(typedLatestJob.status)) {
    return errorResponse('PROVISIONING_JOB_NOT_RESUMABLE', 409, cors, { status: typedLatestJob.status })
  }

  const { data: domains, error: domainsError } = await context.client
    .from('tenant_domains')
    .select(CONTROL_PLANE_DOMAIN_SELECT)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  if (domainsError) return errorResponse('PROVISIONING_RESUME_FAILED', 500, cors)

  const requestedDomains = normalizeJsonArray(typedLatestJob.requested_domains).length > 0
    ? normalizeJsonArray(typedLatestJob.requested_domains)
    : buildRequestedDomains((domains ?? []) as TenantDomain[])
  const initialBranding = isPlainObject(typedLatestJob.initial_branding)
    ? typedLatestJob.initial_branding
    : { display_name: typedTenant.display_name, app_name: typedTenant.display_name }
  const automationMode = normalizeAutomationMode(typedLatestJob.automation_mode)
  const runtimeConfig = normalizeRuntimeConfig(typedTenant)

  const { data: newJob, error: createJobError } = await context.client
    .from('tenant_provisioning_jobs')
    .insert({
      client_request_id: crypto.randomUUID(),
      tenant_id: tenantId,
      supabase_connection_id: typedLatestJob.supabase_connection_id,
      vercel_connection_id: typedLatestJob.vercel_connection_id,
      requested_slug: typedTenant.slug,
      requested_display_name: typedTenant.display_name,
      requested_plan: typedTenant.plan || 'starter',
      requested_domains: requestedDomains,
      initial_branding: initialBranding,
      first_doctor_email: typedLatestJob.first_doctor_email,
      first_doctor_display_name: typedLatestJob.first_doctor_display_name,
      first_doctor_phone: typedLatestJob.first_doctor_phone,
      status: 'ready_for_manual_provisioning',
      automation_mode: automationMode,
      automation_status: automationMode === 'manual' ? 'not_started' : 'ready',
      provider_state: {
        resumedFromJobId: typedLatestJob.id,
        resumedFromStatus: typedLatestJob.status,
        reason: reason || null,
        runtimeConfigAlreadyPresent: Boolean(runtimeConfig),
        phi: false,
      },
      checklist: {
        ...(isPlainObject(typedLatestJob.checklist) ? typedLatestJob.checklist : {}),
        resumedProvisioningJob: true,
        createControlPlaneTenantDraft: true,
        createSupabaseProject: Boolean(runtimeConfig),
        applyTenantMigrations: false,
        seedTenantProfile: false,
        seedFirstDoctorAdmin: false,
        configureVercelRouting: false,
        storeTenantRuntimeConfig: Boolean(runtimeConfig),
        smokeTestResolver: false,
        activateTenant: false,
      },
      assigned_admin_id: context.admin.id,
    })
    .select(CONTROL_PLANE_PROVISIONING_JOB_SELECT)
    .single()

  if (createJobError || !newJob) return errorResponse('PROVISIONING_RESUME_FAILED', 500, cors)

  const typedNewJob = newJob as ProvisioningJob
  const { error: seedError } = await context.client.rpc('admin_seed_tenant_provisioning_steps', {
    p_provisioning_job_id: typedNewJob.id,
    p_tenant_id: tenantId,
    p_automation_mode: automationMode,
    p_supabase_connection_id: typedLatestJob.supabase_connection_id,
    p_vercel_connection_id: typedLatestJob.vercel_connection_id,
  })

  if (seedError) {
    await markJobBlocked(context, typedNewJob.id, 'Could not seed the resumed provisioning step ledger.')
    return errorResponse('PROVISIONING_STEP_SEED_FAILED', 500, cors)
  }

  const providerCheckpoint = await markProviderSelectionCheckpoint(context, typedLatestJob, typedNewJob.id)
  const projectCheckpoint = await markSupabaseProjectCheckpoint(context, typedTenant, typedNewJob.id)
  if (providerCheckpoint.error || projectCheckpoint.error) {
    await markJobBlocked(context, typedNewJob.id, 'Could not carry forward completed provisioning checkpoints.')
    return errorResponse('PROVISIONING_STEP_CARRY_FORWARD_FAILED', 500, cors)
  }

  let finalTenant = typedTenant
  if (typedTenant.status !== 'provisioning') {
    const { data: updatedTenant, error: statusError } = await context.client
      .from('tenants')
      .update({
        status: 'provisioning',
        notes: 'Provisioning resumed from a cancelled or blocked readiness job.',
      })
      .eq('id', tenantId)
      .select('id, slug, display_name, status, plan, supabase_project_ref, supabase_url, supabase_anon_key, schema_version')
      .single()

    if (statusError || !updatedTenant) {
      await markJobBlocked(context, typedNewJob.id, 'Tenant lifecycle could not move back to provisioning.')
      return errorResponse('TENANT_RESUME_STATUS_FAILED', 500, cors)
    }
    finalTenant = updatedTenant as Tenant
  }

  const { data: steps, error: stepsError } = await context.client
    .from('tenant_provisioning_steps')
    .select(CONTROL_PLANE_PROVISIONING_STEP_SELECT)
    .eq('provisioning_job_id', typedNewJob.id)
    .order('created_at', { ascending: true })

  if (stepsError) return errorResponse('PROVISIONING_RESUME_FAILED', 500, cors)

  await auditEvent(context.client, {
    tenantId,
    actorId: context.admin.id,
    eventType: 'tenant.provisioning_job_resumed',
    metadata: {
      previousJobId: typedLatestJob.id,
      newJobId: typedNewJob.id,
      previousStatus: typedLatestJob.status,
      carriedProviderSelection: automationMode === 'manual' && !typedLatestJob.supabase_connection_id && !typedLatestJob.vercel_connection_id,
      carriedSupabaseProject: Boolean(runtimeConfig),
      phi: false,
    },
  })

  return jsonResponse({
    data: {
      tenant: publicTenant(finalTenant),
      provisioningJob: typedNewJob,
      provisioningSteps: steps ?? [],
      resumedFromJobId: typedLatestJob.id,
    },
    error: null,
  }, 201, cors)
})
