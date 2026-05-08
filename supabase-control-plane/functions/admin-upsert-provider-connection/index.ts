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
  normalizeProviderConnectionPatch,
  providerConnectionDbErrorCode,
  providerConnectionErrorStatus,
  sanitizeProviderConnection,
} from '../_shared/providerConnections.ts'
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

async function readExistingConnection(client: SupabaseClient, connectionId: string) {
  return await client
    .from('provisioning_provider_connections')
    .select(CONTROL_PLANE_PROVIDER_CONNECTION_SELECT)
    .eq('id', connectionId)
    .maybeSingle()
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
  if (connectionIdInput && !connectionId) return errorResponse('INVALID_REQUEST', 400, cors)

  let existing: Record<string, unknown> | null = null
  if (connectionId) {
    const { data, error } = await readExistingConnection(context.client, connectionId)
    if (error) return errorResponse('PROVIDER_CONNECTION_LOOKUP_FAILED', 500, cors)
    if (!data) return errorResponse('CONNECTION_NOT_FOUND', 404, cors)
    existing = data as Record<string, unknown>
  }

  const patch = normalizeProviderConnectionPatch(body, {
    actorId: context.admin.id,
    existing,
  })

  if (patch.error || !patch.data) {
    return errorResponse(
      patch.error ?? 'INVALID_REQUEST',
      providerConnectionErrorStatus(patch.error ?? 'INVALID_REQUEST'),
      cors,
    )
  }
  if (connectionId && Object.keys(patch.data).length === 1) {
    return errorResponse('INVALID_REQUEST', 400, cors)
  }

  const mutation = connectionId
    ? context.client
      .from('provisioning_provider_connections')
      .update(patch.data)
      .eq('id', connectionId)
      .select(CONTROL_PLANE_PROVIDER_CONNECTION_SELECT)
      .single()
    : context.client
      .from('provisioning_provider_connections')
      .insert(patch.data)
      .select(CONTROL_PLANE_PROVIDER_CONNECTION_SELECT)
      .single()

  const { data, error } = await mutation
  if (error) {
    const code = providerConnectionDbErrorCode(error)
    return errorResponse(code, providerConnectionErrorStatus(code), cors)
  }

  await auditEvent(context.client, {
    eventType: connectionId ? 'provider_connection.updated' : 'provider_connection.created',
    actorId: context.admin.id,
    metadata: {
      connectionId: data.id,
      provider: data.provider,
      ownerScope: data.owner_scope,
      status: data.status,
      automationEnabled: data.is_automation_enabled,
      storesSecretRefOnly: true,
      phi: false,
    },
  })

  return jsonResponse({
    data: sanitizeProviderConnection(data as Record<string, unknown>),
    error: null,
  }, connectionId ? 200 : 201, cors)
})
