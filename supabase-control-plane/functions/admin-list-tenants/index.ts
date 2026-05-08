import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  preflight,
  requireSuperAdmin,
} from '../_shared/admin.ts'

Deno.serve(async (req) => {
  const preflightResponse = preflight(req)
  if (preflightResponse) return preflightResponse

  const cors = corsHeaders(req.headers.get('origin'))
  if (req.method !== 'GET' && req.method !== 'POST') {
    return errorResponse('INVALID_METHOD', 405, cors)
  }

  const { data: context, response } = await requireSuperAdmin(req)
  if (response) return response

  const { data, error } = await context.client
    .from('tenants')
    .select(`
      id,
      slug,
      display_name,
      status,
      plan,
      release_channel,
      supabase_project_ref,
      supabase_url,
      schema_version,
      notes,
      created_at,
      updated_at,
      tenant_domains (
        id,
        hostname,
        surface,
        status,
        dns_status,
        ssl_status,
        verified_at
      ),
      tenant_entitlements (
        id,
        feature_code,
        source,
        is_enabled,
        limits,
        expires_at
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return errorResponse('TENANT_LIST_FAILED', 500, cors)
  }

  return jsonResponse({ data: data ?? [], error: null }, 200, cors)
})
