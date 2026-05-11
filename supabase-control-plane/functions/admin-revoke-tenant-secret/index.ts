import {
  auditEvent,
  corsHeaders,
  errorResponse,
  jsonResponse,
  preflight,
  readJsonBody,
  requireSuperAdmin,
} from '../_shared/admin.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SECRET_KINDS = new Set(['service_role_key', 'database_url'])

function normalizeUuid(value: unknown) {
  const id = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return UUID.test(id) ? id : ''
}

function normalizeSecretKind(value: unknown) {
  const kind = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return SECRET_KINDS.has(kind) ? kind : ''
}

Deno.serve(async (req) => {
  const preflightResponse = preflight(req)
  if (preflightResponse) return preflightResponse

  const cors = corsHeaders(req.headers.get('origin'))
  if (req.method !== 'POST') return errorResponse('INVALID_METHOD', 405, cors)

  const { data: context, response } = await requireSuperAdmin(req, ['operator'])
  if (response) return response

  const body = await readJsonBody(req)
  const tenantId = normalizeUuid(body.tenantId ?? body.tenant_id)
  const secretKind = normalizeSecretKind(body.secretKind ?? body.secret_kind)
  if (!tenantId || !secretKind) return errorResponse('INVALID_REQUEST', 400, cors)

  const { data, error } = await context.client.rpc('admin_revoke_tenant_secret_ref', {
    p_tenant_id: tenantId,
    p_secret_kind: secretKind,
    p_actor_id: context.admin.id,
  })

  if (error) return errorResponse('TENANT_SECRET_REVOKE_FAILED', 500, cors)

  await auditEvent(context.client, {
    tenantId,
    eventType: 'tenant_secret_ref.revoked',
    actorId: context.admin.id,
    metadata: {
      secretKind,
      revokedCount: typeof data === 'number' ? data : 0,
      rawSecretStored: false,
    },
  })

  return jsonResponse({
    data: {
      tenantId,
      secretKind,
      revokedCount: typeof data === 'number' ? data : 0,
    },
    error: null,
  }, 200, cors)
})
