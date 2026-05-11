import {
  auditEvent,
  corsHeaders,
  errorResponse,
  jsonResponse,
  preflight,
  readJsonBody,
  requireSuperAdmin,
} from '../_shared/admin.ts'
import { sanitizeProviderConnection } from '../_shared/providerConnections.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeUuid(value: unknown) {
  const id = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return UUID.test(id) ? id : ''
}

function normalizeSecretValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function statusForStoreError(message = '') {
  if (message.includes('PROVIDER_CONNECTION_NOT_FOUND')) return 404
  if (message.includes('SECRET_VALUE_REQUIRED')) return 400
  return 500
}

function codeForStoreError(message = '') {
  if (message.includes('PROVIDER_CONNECTION_NOT_FOUND')) return 'PROVIDER_CONNECTION_NOT_FOUND'
  if (message.includes('SECRET_VALUE_REQUIRED')) return 'SECRET_VALUE_REQUIRED'
  return 'PROVIDER_SECRET_STORE_FAILED'
}

Deno.serve(async (req) => {
  const preflightResponse = preflight(req)
  if (preflightResponse) return preflightResponse

  const cors = corsHeaders(req.headers.get('origin'))
  if (req.method !== 'POST') return errorResponse('INVALID_METHOD', 405, cors)

  const { data: context, response } = await requireSuperAdmin(req, ['operator'])
  if (response) return response

  const body = await readJsonBody(req)
  const connectionId = normalizeUuid(body.connectionId ?? body.connection_id)
  const secretValue = normalizeSecretValue(body.secretValue ?? body.secret_value)
  if (!connectionId) return errorResponse('INVALID_REQUEST', 400, cors, { summary: 'connectionId is required.' })

  const { data, error } = await context.client.rpc('admin_store_provider_secret_ref', {
    p_connection_id: connectionId,
    p_secret_value: secretValue,
    p_actor_id: context.admin.id,
  })

  if (error) {
    const message = error.message || ''
    return errorResponse(codeForStoreError(message), statusForStoreError(message), cors)
  }

  const row = data && typeof data === 'object' && !Array.isArray(data)
    ? data as Record<string, unknown>
    : null

  await auditEvent(context.client, {
    tenantId: null,
    eventType: 'provider_connection.secret_stored',
    actorId: context.admin.id,
    metadata: {
      connectionId,
      provider: row?.provider ?? null,
      secretStorage: 'supabase_vault',
      rawSecretStored: false,
    },
  })

  return jsonResponse({ data: sanitizeProviderConnection(row), error: null }, 200, cors)
})
