import {
  createTenantServiceClient,
  corsHeaders,
  errorResponse,
  getTenantServiceRoleKey,
  jsonResponse,
  preflight,
  readJsonBody,
  requireSuperAdmin,
} from '../_shared/admin.ts'
import {
  CONTROL_PLANE_PLAN_ENTITLEMENT_SELECT,
  CONTROL_PLANE_PLAN_SELECT,
  CONTROL_PLANE_PROVISIONING_STEP_SELECT,
  TENANT_APP_CONFIG_SELECT,
  TENANT_PROFILE_SELECT,
} from '../_shared/selects.ts'

function readTenantSelector(req: Request, body: Record<string, unknown>) {
  const url = new URL(req.url)
  return {
    tenantId: String(body.tenantId ?? url.searchParams.get('tenantId') ?? ''),
    slug: String(body.slug ?? url.searchParams.get('slug') ?? ''),
  }
}

async function readTenantRuntimeBranding(tenant: Record<string, unknown>) {
  const projectRef = typeof tenant.supabase_project_ref === 'string' ? tenant.supabase_project_ref : ''
  const tenantUrl = typeof tenant.supabase_url === 'string' ? tenant.supabase_url : ''

  if (!projectRef || !tenantUrl) {
    return { data: null, error: 'TENANT_RUNTIME_NOT_CONFIGURED' }
  }

  const { key } = getTenantServiceRoleKey(projectRef)
  if (!key) return { data: null, error: 'TENANT_SERVICE_ROLE_NOT_CONFIGURED' }

  const tenantClient = createTenantServiceClient(tenantUrl, key)
  const { data: profile, error: profileError } = await tenantClient
    .from('tenant_profile')
    .select(TENANT_PROFILE_SELECT)
    .maybeSingle()

  if (profileError) return { data: null, error: 'TENANT_PROFILE_LOOKUP_FAILED' }
  if (!profile?.id) return { data: null, error: 'TENANT_PROFILE_NOT_FOUND' }

  const { data: appConfig, error: appConfigError } = await tenantClient
    .from('tenant_app_config')
    .select(TENANT_APP_CONFIG_SELECT)
    .eq('profile_id', profile?.id ?? '')
    .maybeSingle()

  if (appConfigError) return { data: null, error: 'TENANT_APP_CONFIG_LOOKUP_FAILED' }

  const { data: publicConfig, error: publicConfigError } = await tenantClient
    .rpc('get_public_tenant_app_config')
    .maybeSingle()

  if (publicConfigError) return { data: null, error: 'TENANT_PUBLIC_CONFIG_LOOKUP_FAILED' }

  return {
    data: {
      profile: profile ?? null,
      appConfig: appConfig ?? null,
      publicConfig: publicConfig ?? null,
    },
    error: null,
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
  const { tenantId, slug } = readTenantSelector(req, body)

  if (!tenantId && !slug) {
    return errorResponse('INVALID_REQUEST', 400, cors)
  }

  let query = context.client
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
        verified_at,
        verification_token
      ),
      tenant_entitlements (
        id,
        feature_code,
        source,
        is_enabled,
        limits,
        expires_at,
        reason
      ),
      tenant_provisioning_jobs (
        id,
        requested_slug,
        requested_display_name,
        requested_plan,
        requested_domains,
        initial_branding,
        supabase_connection_id,
        vercel_connection_id,
        automation_mode,
        automation_status,
        provider_state,
        status,
        checklist,
        last_error,
        created_at,
        updated_at,
        completed_at
      )
    `)

  query = tenantId ? query.eq('id', tenantId) : query.eq('slug', slug)

  const { data: tenant, error } = await query.maybeSingle()
  if (error) return errorResponse('TENANT_LOOKUP_FAILED', 500, cors)
  if (!tenant) return errorResponse('TENANT_NOT_FOUND', 404, cors)

  const [{ data: plans }, { data: planEntitlements }, { data: events }, { data: provisioningSteps }] = await Promise.all([
    context.client.from('plans').select(CONTROL_PLANE_PLAN_SELECT).order('sort_order', { ascending: true }),
    context.client.from('plan_entitlements').select(CONTROL_PLANE_PLAN_ENTITLEMENT_SELECT).order('feature_code', { ascending: true }),
    context.client
      .from('tenant_events')
      .select('id, event_type, actor_id, metadata, created_at')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(25),
    context.client
      .from('tenant_provisioning_steps')
      .select(CONTROL_PLANE_PROVISIONING_STEP_SELECT)
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: true }),
  ])

  const runtimeBranding = await readTenantRuntimeBranding(tenant)

  return jsonResponse({
    data: {
      tenant,
      plans: plans ?? [],
      planEntitlements: planEntitlements ?? [],
      events: events ?? [],
      provisioningSteps: provisioningSteps ?? [],
      runtimeBranding: runtimeBranding.data,
      runtimeBrandingError: runtimeBranding.error,
    },
    error: null,
  }, 200, cors)
})
