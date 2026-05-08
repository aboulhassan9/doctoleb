import {
  auditEvent,
  corsHeaders,
  createTenantServiceClient,
  errorResponse,
  getTenantServiceRoleKey,
  jsonResponse,
  preflight,
  readJsonBody,
  requireSuperAdmin,
} from '../_shared/admin.ts'
import {
  TENANT_APP_CONFIG_SELECT,
  TENANT_PROFILE_SELECT,
} from '../_shared/selects.ts'

const HEX = /^#[0-9A-Fa-f]{6}$/
const TENANT_SECRET_PREFIX = 'TENANT_SERVICE_ROLE_KEY_'

function nullableText(value: unknown, max = 2000) {
  if (value === null || value === undefined || value === '') return null
  return typeof value === 'string' ? value.trim().slice(0, max) : null
}

function normalizeLocales(value: unknown) {
  if (!Array.isArray(value)) return ['en']
  const locales = value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => /^[a-z]{2}(?:-[a-z]{2})?$/.test(item))
  return locales.length > 0 ? Array.from(new Set(locales)) : ['en']
}

function normalizeBranding(value: unknown) {
  const input = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

  const primary = nullableText(input.primary_color, 20)
  const secondary = nullableText(input.secondary_color, 20)

  return {
    profile: {
      display_name: nullableText(input.display_name, 160),
      default_locale: normalizeLocales(input.enabled_locales)[0],
    },
    app: {
      app_name: nullableText(input.app_name ?? input.display_name, 160) ?? 'DoctoLeb Clinic',
      app_tagline: nullableText(input.app_tagline, 240),
      splash_logo_url: nullableText(input.splash_logo_url, 2000),
      icon_url: nullableText(input.icon_url, 2000),
      primary_color: primary && HEX.test(primary) ? primary : null,
      secondary_color: secondary && HEX.test(secondary) ? secondary : null,
      support_phone: nullableText(input.support_phone, 80),
      support_email: nullableText(input.support_email, 240),
      enabled_locales: normalizeLocales(input.enabled_locales),
      maintenance_message: nullableText(input.maintenance_message, 1000),
    },
  }
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
  const tenantId = typeof body.tenantId === 'string' ? body.tenantId : ''
  if (!tenantId) return errorResponse('INVALID_REQUEST', 400, cors)

  const { data: tenant, error: tenantError } = await context.client
    .from('tenants')
    .select('id, slug, display_name, supabase_project_ref, supabase_url')
    .eq('id', tenantId)
    .single()

  if (tenantError || !tenant) return errorResponse('TENANT_NOT_FOUND', 404, cors)

  if (!tenant.supabase_project_ref || !tenant.supabase_url) {
    await auditEvent(context.client, {
      tenantId,
      eventType: 'tenant_config.sync_blocked',
      actorId: context.admin.id,
      metadata: {
        reason: 'tenant_runtime_not_configured',
        requestedKeys: Object.keys(body.branding && typeof body.branding === 'object' ? body.branding : {}),
      },
    })
    return errorResponse('TENANT_RUNTIME_NOT_CONFIGURED', 409, cors)
  }

  const { key, secretName } = getTenantServiceRoleKey(tenant.supabase_project_ref)
  const branding = normalizeBranding(body.branding)

  if (!key) {
    await auditEvent(context.client, {
      tenantId,
      eventType: 'tenant_config.sync_blocked',
      actorId: context.admin.id,
      metadata: {
        reason: 'missing_tenant_service_secret',
        secretPrefix: TENANT_SECRET_PREFIX,
        secretName,
        requestedKeys: Object.keys(body.branding && typeof body.branding === 'object' ? body.branding : {}),
      },
    })
    return errorResponse('TENANT_SERVICE_ROLE_NOT_CONFIGURED', 409, cors, { secretName })
  }

  const tenantClient = createTenantServiceClient(tenant.supabase_url, key)
  const { data: profile, error: profileError } = await tenantClient
    .from('tenant_profile')
    .select(TENANT_PROFILE_SELECT)
    .maybeSingle()

  if (profileError || !profile?.id) {
    await auditEvent(context.client, {
      tenantId,
      eventType: 'tenant_config.sync_failed',
      actorId: context.admin.id,
      metadata: { reason: 'tenant_profile_missing' },
    })
    return errorResponse('TENANT_PROFILE_NOT_FOUND', 409, cors)
  }

  const { data: previousAppConfig, error: previousAppError } = await tenantClient
    .from('tenant_app_config')
    .select(TENANT_APP_CONFIG_SELECT)
    .eq('profile_id', profile.id)
    .maybeSingle()

  if (previousAppError) {
    await auditEvent(context.client, {
      tenantId,
      eventType: 'tenant_config.sync_failed',
      actorId: context.admin.id,
      metadata: { reason: 'tenant_app_config_lookup_failed' },
    })
    return errorResponse('TENANT_CONFIG_LOOKUP_FAILED', 500, cors)
  }

  const profilePatch = Object.fromEntries(
    Object.entries(branding.profile).filter(([, value]) => value !== null),
  )
  const previousSnapshot = {
    profile,
    appConfig: previousAppConfig ?? null,
  }

  await auditEvent(context.client, {
    tenantId,
    eventType: 'tenant_config.sync_started',
    actorId: context.admin.id,
    metadata: {
      previousSnapshot,
      requestedKeys: Object.keys(body.branding && typeof body.branding === 'object' ? body.branding : {}),
      profilePatchKeys: Object.keys(profilePatch),
      appConfigKeys: Object.keys(branding.app),
    },
  })

  if (Object.keys(profilePatch).length > 0) {
    const { error } = await tenantClient
      .from('tenant_profile')
      .update(profilePatch)
      .eq('id', profile.id)

    if (error) {
      await auditEvent(context.client, {
        tenantId,
        eventType: 'tenant_config.sync_failed',
        actorId: context.admin.id,
        metadata: {
          reason: 'tenant_profile_update_failed',
          previousSnapshot,
        },
      })
      return errorResponse('TENANT_PROFILE_SYNC_FAILED', 500, cors)
    }
  }

  const { data: appConfig, error: appError } = await tenantClient
    .from('tenant_app_config')
    .upsert({ profile_id: profile.id, ...branding.app }, { onConflict: 'profile_id' })
    .select(TENANT_APP_CONFIG_SELECT)
    .single()

  if (appError) {
    await auditEvent(context.client, {
      tenantId,
      eventType: 'tenant_config.sync_failed',
      actorId: context.admin.id,
      metadata: {
        reason: 'tenant_app_config_upsert_failed',
        previousSnapshot,
      },
    })
    return errorResponse('TENANT_CONFIG_SYNC_FAILED', 500, cors)
  }

  const currentSnapshot = {
    profile: {
      ...profile,
      ...profilePatch,
    },
    appConfig,
  }

  await auditEvent(context.client, {
    tenantId,
    eventType: 'tenant_config.sync_completed',
    actorId: context.admin.id,
    metadata: {
      appConfigId: appConfig.id,
      brandingKeys: Object.keys(branding.app),
      previousSnapshot,
      currentSnapshot,
    },
  })

  return jsonResponse({ data: { profileId: profile.id, appConfig }, error: null }, 200, cors)
})
