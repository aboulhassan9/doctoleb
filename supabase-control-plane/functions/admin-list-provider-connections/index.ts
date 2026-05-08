import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  preflight,
  readJsonBody,
  requireSuperAdmin,
} from '../_shared/admin.ts'
import { CONTROL_PLANE_PROVIDER_CONNECTION_SELECT } from '../_shared/selects.ts'
import {
  CONNECTION_STATUSES,
  normalizeBoolean,
  normalizeEnum,
  OWNER_SCOPES,
  PROVIDERS,
  sanitizeProviderConnections,
} from '../_shared/providerConnections.ts'

function readFilters(req: Request, body: Record<string, unknown>) {
  const url = new URL(req.url)
  const includeArchivedInput = body.includeArchived ?? body.include_archived ?? url.searchParams.get('includeArchived')

  return {
    provider: normalizeEnum(body.provider ?? url.searchParams.get('provider'), PROVIDERS),
    status: normalizeEnum(body.status ?? url.searchParams.get('status'), CONNECTION_STATUSES),
    ownerScope: normalizeEnum(body.ownerScope ?? body.owner_scope ?? url.searchParams.get('ownerScope'), OWNER_SCOPES),
    includeArchived: normalizeBoolean(includeArchivedInput, includeArchivedInput === 'true'),
  }
}

Deno.serve(async (req) => {
  const preflightResponse = preflight(req)
  if (preflightResponse) return preflightResponse

  const cors = corsHeaders(req.headers.get('origin'))
  if (req.method !== 'GET' && req.method !== 'POST') {
    return errorResponse('INVALID_METHOD', 405, cors)
  }

  const { data: context, response } = await requireSuperAdmin(req)
  if (response) return response

  const body = await readJsonBody(req)
  const filters = readFilters(req, body)

  let query = context.client
    .from('provisioning_provider_connections')
    .select(CONTROL_PLANE_PROVIDER_CONNECTION_SELECT)
    .order('created_at', { ascending: false })

  if (filters.provider) query = query.eq('provider', filters.provider)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.ownerScope) query = query.eq('owner_scope', filters.ownerScope)
  if (!filters.includeArchived) query = query.neq('status', 'archived')

  const { data, error } = await query
  if (error) return errorResponse('PROVIDER_CONNECTION_LIST_FAILED', 500, cors)

  return jsonResponse({
    data: sanitizeProviderConnections(data ?? []),
    error: null,
  }, 200, cors)
})
