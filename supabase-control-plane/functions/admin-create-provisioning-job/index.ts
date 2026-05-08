import {
  auditEvent,
  corsHeaders,
  errorResponse,
  jsonResponse,
  preflight,
  readJsonBody,
  requireSuperAdmin,
} from '../_shared/admin.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CONTROL_PLANE_PROVISIONING_JOB_SELECT } from '../_shared/selects.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeSlug(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizeText(value: unknown, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function normalizeDomains(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return null
      const input = row as Record<string, unknown>
      const hostname = normalizeText(input.hostname, 300).toLowerCase()
      const surface = input.surface === 'ops' ? 'ops' : 'patient'
      if (!hostname) return null
      return {
        hostname,
        surface,
        status: 'pending',
        dns_status: hostname.startsWith('localhost:') ? null : 'pending',
        ssl_status: hostname.startsWith('localhost:') ? null : 'pending',
      }
    })
    .filter(Boolean)
}

function normalizeBranding(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function normalizeClientRequestId(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') return null
  const id = value.trim().toLowerCase()
  return UUID.test(id) ? id : null
}

async function findJobByClientRequestId(
  client: SupabaseClient,
  clientRequestId: string,
) {
  return await client
    .from('tenant_provisioning_jobs')
    .select(CONTROL_PLANE_PROVISIONING_JOB_SELECT)
    .eq('client_request_id', clientRequestId)
    .maybeSingle()
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
  const clientRequestIdInput = body.clientRequestId ?? body.client_request_id
  const clientRequestId = normalizeClientRequestId(clientRequestIdInput)
  if (clientRequestIdInput && !clientRequestId) {
    return errorResponse('INVALID_REQUEST', 400, cors)
  }

  if (clientRequestId) {
    const { data: existingJob, error: lookupError } = await findJobByClientRequestId(context.client, clientRequestId)
    if (lookupError) return errorResponse('PROVISIONING_JOB_LOOKUP_FAILED', 500, cors)
    if (existingJob) {
      return jsonResponse({ data: existingJob, error: null }, 200, cors)
    }
  }

  const requestedSlug = normalizeSlug(body.requestedSlug)
  const requestedDisplayName = normalizeText(body.requestedDisplayName, 160)
  const requestedPlan = normalizeText(body.requestedPlan, 80) || 'starter'

  if (!requestedSlug || !requestedDisplayName) {
    return errorResponse('INVALID_REQUEST', 400, cors)
  }

  const { data: existingTenant } = await context.client
    .from('tenants')
    .select('id')
    .eq('slug', requestedSlug)
    .maybeSingle()

  if (existingTenant) {
    return errorResponse('TENANT_SLUG_TAKEN', 409, cors)
  }

  const requestedDomains = normalizeDomains(body.requestedDomains)
  for (const domain of requestedDomains) {
    const { data: existingDomain } = await context.client
      .from('tenant_domains')
      .select('id')
      .eq('hostname', domain.hostname)
      .maybeSingle()

    if (existingDomain) {
      return errorResponse('DOMAIN_TAKEN', 409, cors, { hostname: domain.hostname })
    }
  }

  const checklist = {
    createSupabaseProject: false,
    applyTenantMigrations: false,
    seedTenantProfile: false,
    seedFirstDoctorAdmin: false,
    configureStorageAndFunctions: false,
    addTenantResolverRows: false,
    smokeTestResolver: false,
    activateTenant: false,
  }

  const { data: job, error } = await context.client
    .from('tenant_provisioning_jobs')
    .insert({
      client_request_id: clientRequestId,
      requested_slug: requestedSlug,
      requested_display_name: requestedDisplayName,
      requested_plan: requestedPlan,
      requested_domains: requestedDomains,
      initial_branding: normalizeBranding(body.initialBranding),
      status: 'ready_for_manual_provisioning',
      checklist,
      assigned_admin_id: context.admin.id,
    })
    .select(CONTROL_PLANE_PROVISIONING_JOB_SELECT)
    .single()

  if (error) {
    if (clientRequestId && error.code === '23505') {
      const { data: existingJob, error: lookupError } = await findJobByClientRequestId(context.client, clientRequestId)
      if (lookupError) return errorResponse('PROVISIONING_JOB_LOOKUP_FAILED', 500, cors)
      if (existingJob) return jsonResponse({ data: existingJob, error: null }, 200, cors)
    }
    return errorResponse('PROVISIONING_JOB_CREATE_FAILED', 500, cors)
  }

  await auditEvent(context.client, {
    tenantId: null,
    eventType: 'tenant_provisioning_job.created',
    actorId: context.admin.id,
    metadata: {
      jobId: job.id,
      clientRequestId,
      requestedSlug,
      requestedPlan,
      domainCount: requestedDomains.length,
    },
  })

  return jsonResponse({ data: job, error: null }, 201, cors)
})
