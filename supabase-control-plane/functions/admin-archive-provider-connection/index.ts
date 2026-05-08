import {
  auditEvent,
  corsHeaders,
  errorResponse,
  jsonResponse,
  preflight,
  readJsonBody,
  requireSuperAdmin,
} from '../_shared/admin.ts'
import { CONTROL_PLANE_PROVIDER_CONNECTION_SELECT } from '../_shared/selects.ts'
import {
  isUuid,
  normalizeString,
  providerConnectionErrorStatus,
  sanitizeProviderConnection,
} from '../_shared/providerConnections.ts'
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ACTIVE_JOB_STATUSES = new Set([
  'draft',
  'ready_for_manual_provisioning',
  'provisioning',
  'blocked',
  'failed',
])

function activeJobs(rows: unknown[]) {
  return rows.filter((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return false
    return ACTIVE_JOB_STATUSES.has(String((row as Record<string, unknown>).status ?? ''))
  })
}

async function readReferencedJobs(client: SupabaseClient, connectionId: string) {
  const [supabaseJobs, vercelJobs] = await Promise.all([
    client
      .from('tenant_provisioning_jobs')
      .select('id, tenant_id, requested_slug, status, automation_status')
      .eq('supabase_connection_id', connectionId)
      .limit(25),
    client
      .from('tenant_provisioning_jobs')
      .select('id, tenant_id, requested_slug, status, automation_status')
      .eq('vercel_connection_id', connectionId)
      .limit(25),
  ])

  if (supabaseJobs.error || vercelJobs.error) {
    return { data: null, error: 'PROVIDER_CONNECTION_JOB_LOOKUP_FAILED' }
  }

  const rows = [...(supabaseJobs.data ?? []), ...(vercelJobs.data ?? [])] as Array<Record<string, unknown>>
  const uniqueRows = Array.from(new Map(rows.map((row) => [String(row.id), row])).values())
  return { data: activeJobs(uniqueRows), error: null }
}

Deno.serve(async (req) => {
  const preflightResponse = preflight(req)
  if (preflightResponse) return preflightResponse

  const cors = corsHeaders(req.headers.get('origin'))
  if (req.method !== 'POST' && req.method !== 'PATCH') {
    return errorResponse('INVALID_METHOD', 405, cors)
  }

  const { data: context, response } = await requireSuperAdmin(req, ['operator'])
  if (response) return response

  const body = await readJsonBody(req)
  const connectionIdInput = body.connectionId ?? body.connection_id
  const connectionId = isUuid(connectionIdInput) ? connectionIdInput as string : ''
  if (!connectionId) return errorResponse('INVALID_REQUEST', 400, cors)

  const { data: existing, error: lookupError } = await context.client
    .from('provisioning_provider_connections')
    .select(CONTROL_PLANE_PROVIDER_CONNECTION_SELECT)
    .eq('id', connectionId)
    .maybeSingle()

  if (lookupError) return errorResponse('PROVIDER_CONNECTION_LOOKUP_FAILED', 500, cors)
  if (!existing) return errorResponse('CONNECTION_NOT_FOUND', 404, cors)

  if (existing.status === 'archived') {
    return jsonResponse({
      data: sanitizeProviderConnection(existing as Record<string, unknown>),
      error: null,
    }, 200, cors)
  }

  const referencedJobs = await readReferencedJobs(context.client, connectionId)
  if (referencedJobs.error) return errorResponse(referencedJobs.error, 500, cors)
  if ((referencedJobs.data ?? []).length > 0) {
    return errorResponse('CONNECTION_IN_USE', providerConnectionErrorStatus('CONNECTION_IN_USE'), cors, {
      activeJobCount: referencedJobs.data?.length ?? 0,
    })
  }

  const reason = normalizeString(body.reason, 300)
  const { data, error } = await context.client
    .from('provisioning_provider_connections')
    .update({
      status: 'archived',
      is_automation_enabled: false,
      archived_at: new Date().toISOString(),
      updated_by: context.admin.id,
    })
    .eq('id', connectionId)
    .select(CONTROL_PLANE_PROVIDER_CONNECTION_SELECT)
    .single()

  if (error) return errorResponse('PROVIDER_CONNECTION_ARCHIVE_FAILED', 500, cors)

  await auditEvent(context.client, {
    eventType: 'provider_connection.archived',
    actorId: context.admin.id,
    metadata: {
      connectionId,
      provider: data.provider,
      ownerScope: data.owner_scope,
      reason: reason || null,
      automationDisabled: true,
      phi: false,
    },
  })

  return jsonResponse({
    data: sanitizeProviderConnection(data as Record<string, unknown>),
    error: null,
  }, 200, cors)
})
