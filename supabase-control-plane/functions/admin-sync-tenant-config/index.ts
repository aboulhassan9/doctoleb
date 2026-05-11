import {
  auditEvent,
  corsHeaders,
  createTenantServiceClient,
  errorResponse,
  jsonResponse,
  preflight,
  readJsonBody,
  requireSuperAdmin,
} from '../_shared/admin.ts'
import { resolveTenantServiceRoleKey } from '../_shared/tenantSecrets.ts'
import {
  TENANT_APP_CONFIG_SELECT,
  TENANT_PROFILE_SELECT,
} from '../_shared/selects.ts'
import {
  normalizeTenantBranding,
  tenantBrandingRequestedKeys,
} from '../_shared/tenantBranding.ts'

const TENANT_SECRET_PREFIX = 'TENANT_SERVICE_ROLE_KEY_'

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
        requestedKeys: tenantBrandingRequestedKeys(body.branding),
      },
    })
    return errorResponse('TENANT_RUNTIME_NOT_CONFIGURED', 409, cors)
  }

  const { key, secretName, secretStorage } = await resolveTenantServiceRoleKey(context.client, {
    tenantId,
    projectRef: tenant.supabase_project_ref,
  })
  const branding = normalizeTenantBranding(body.branding)

  if (!key) {
    await auditEvent(context.client, {
      tenantId,
      eventType: 'tenant_config.sync_blocked',
      actorId: context.admin.id,
      metadata: {
        reason: 'missing_tenant_service_secret',
        secretPrefix: TENANT_SECRET_PREFIX,
        secretName,
        secretStorage,
        requestedKeys: tenantBrandingRequestedKeys(body.branding),
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
      requestedKeys: tenantBrandingRequestedKeys(body.branding),
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
  const nextTenantDisplayName = currentSnapshot.profile.display_name || appConfig.app_name || tenant.display_name
  let syncedTenant = tenant

  if (nextTenantDisplayName && nextTenantDisplayName !== tenant.display_name) {
    const { data: updatedTenant, error: tenantUpdateError } = await context.client
      .from('tenants')
      .update({ display_name: nextTenantDisplayName })
      .eq('id', tenantId)
      .select('id, slug, display_name, updated_at')
      .single()

    if (tenantUpdateError) {
      await auditEvent(context.client, {
        tenantId,
        eventType: 'tenant_config.sync_partial',
        actorId: context.admin.id,
        metadata: {
          reason: 'control_plane_display_name_update_failed',
          appConfigId: appConfig.id,
          previousSnapshot,
          currentSnapshot,
        },
      })
      return errorResponse('TENANT_CONTROL_PLANE_SYNC_FAILED', 500, cors)
    }

    syncedTenant = updatedTenant
  }

  await auditEvent(context.client, {
    tenantId,
    eventType: 'tenant_config.sync_completed',
    actorId: context.admin.id,
    metadata: {
      appConfigId: appConfig.id,
      tenantDisplayName: syncedTenant.display_name,
      brandingKeys: Object.keys(branding.app),
      previousSnapshot,
      currentSnapshot,
    },
  })

  return jsonResponse({ data: { profileId: profile.id, appConfig, tenant: syncedTenant }, error: null }, 200, cors)
})
