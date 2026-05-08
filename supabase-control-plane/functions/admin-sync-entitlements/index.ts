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
import { TENANT_FEATURE_FLAG_SELECT } from '../_shared/selects.ts'

const FEATURE_META: Record<string, { name: string; description: string; audience: string; targetRoles: string[] }> = {
  messaging: {
    name: 'Messaging',
    description: 'Clinic and patient secure messaging surfaces.',
    audience: 'staff',
    targetRoles: ['doctor', 'secretary', 'predoctor', 'patient'],
  },
  custom_branding: {
    name: 'Custom branding',
    description: 'Tenant logo, color, and public app theming.',
    audience: 'admin',
    targetRoles: ['admin', 'doctor'],
  },
  custom_domain: {
    name: 'Custom domain',
    description: 'Clinic-owned web domain mapping.',
    audience: 'admin',
    targetRoles: ['admin', 'doctor'],
  },
  staff_accounts: {
    name: 'Staff accounts',
    description: 'Additional clinic operations seats.',
    audience: 'admin',
    targetRoles: ['admin', 'doctor'],
  },
  insurance_billing: {
    name: 'Insurance billing',
    description: 'Plan-gated insurance payment and claim workflow access.',
    audience: 'staff',
    targetRoles: ['doctor', 'secretary'],
  },
  ai_clinical_summary: {
    name: 'AI clinical summary',
    description: 'Server-side AI clinical summarization entitlement.',
    audience: 'staff',
    targetRoles: ['doctor'],
  },
  bi_dashboard: {
    name: 'BI dashboard',
    description: 'Business intelligence dashboards for clinic operations.',
    audience: 'staff',
    targetRoles: ['doctor'],
  },
  advanced_reports: {
    name: 'Advanced reports',
    description: 'Saved operational and financial reports.',
    audience: 'staff',
    targetRoles: ['doctor', 'secretary'],
  },
}

const SOURCE_PRIORITY: Record<string, number> = {
  plan: 10,
  addon: 30,
  manual_override: 40,
}
const TENANT_SECRET_PREFIX = 'TENANT_SERVICE_ROLE_KEY_'

function normalizeFeatureCode(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizeLimits(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizeEntitlement(row: unknown, tenantId: string) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null
  const input = row as Record<string, unknown>
  const featureCode = normalizeFeatureCode(input.feature_code)
  if (!FEATURE_META[featureCode]) return null

  const source = input.source === 'addon' || input.source === 'manual_override'
    ? input.source
    : 'manual_override'

  return {
    tenant_id: tenantId,
    feature_code: featureCode,
    source,
    is_enabled: input.is_enabled === true,
    limits: normalizeLimits(input.limits),
    reason: typeof input.reason === 'string' ? input.reason.trim().slice(0, 500) : null,
  }
}

function applyResolved(map: Record<string, Record<string, unknown>>, row: Record<string, unknown>, source: string) {
  const featureCode = normalizeFeatureCode(row.feature_code)
  if (!FEATURE_META[featureCode]) return

  const candidate = {
    feature_code: featureCode,
    is_enabled: row.is_enabled === true,
    limits: normalizeLimits(row.limits),
    source,
  }
  const current = map[featureCode]
  if (!current || (SOURCE_PRIORITY[source] ?? 0) >= (SOURCE_PRIORITY[String(current.source)] ?? 0)) {
    map[featureCode] = candidate
  }
}

Deno.serve(async (req) => {
  const preflightResponse = preflight(req)
  if (preflightResponse) return preflightResponse

  const cors = corsHeaders(req.headers.get('origin'))
  if (req.method !== 'POST') {
    return errorResponse('INVALID_METHOD', 405, cors)
  }

  const { data: context, response } = await requireSuperAdmin(req, ['operator', 'billing_admin'])
  if (response) return response

  const body = await readJsonBody(req)
  const tenantId = typeof body.tenantId === 'string' ? body.tenantId : ''
  if (!tenantId) return errorResponse('INVALID_REQUEST', 400, cors)

  const { data: tenant, error: tenantError } = await context.client
    .from('tenants')
    .select('id, slug, plan, supabase_project_ref, supabase_url')
    .eq('id', tenantId)
    .single()

  if (tenantError || !tenant) return errorResponse('TENANT_NOT_FOUND', 404, cors)

  const entitlementRows = Array.isArray(body.entitlements)
    ? body.entitlements.map((row) => normalizeEntitlement(row, tenantId)).filter(Boolean)
    : []

  if (!tenant.supabase_project_ref || !tenant.supabase_url) {
    await auditEvent(context.client, {
      tenantId,
      eventType: 'tenant_entitlements.sync_blocked',
      actorId: context.admin.id,
      metadata: {
        reason: 'tenant_runtime_not_configured',
        changedCount: entitlementRows.length,
      },
    })
    return errorResponse('TENANT_RUNTIME_NOT_CONFIGURED', 409, cors)
  }

  if (entitlementRows.length > 0) {
    const { error } = await context.client
      .from('tenant_entitlements')
      .upsert(entitlementRows, { onConflict: 'tenant_id,feature_code,source' })

    if (error) return errorResponse('TENANT_ENTITLEMENT_SAVE_FAILED', 500, cors)
  }

  const [{ data: planEntitlements }, { data: tenantEntitlements }] = await Promise.all([
    context.client
      .from('plan_entitlements')
      .select('feature_code, is_enabled, limits')
      .eq('plan_code', tenant.plan),
    context.client
      .from('tenant_entitlements')
      .select('feature_code, source, is_enabled, limits')
      .eq('tenant_id', tenantId),
  ])

  const resolved: Record<string, Record<string, unknown>> = {}
  for (const row of planEntitlements ?? []) applyResolved(resolved, row, 'plan')
  for (const row of tenantEntitlements ?? []) applyResolved(resolved, row, String(row.source))

  const { key, secretName } = getTenantServiceRoleKey(tenant.supabase_project_ref)
  if (!key) {
    await auditEvent(context.client, {
      tenantId,
      eventType: 'tenant_entitlements.sync_blocked',
      actorId: context.admin.id,
      metadata: {
        reason: 'missing_tenant_service_secret',
        secretPrefix: TENANT_SECRET_PREFIX,
        secretName,
        entitlementCount: Object.keys(resolved).length,
      },
    })
    return errorResponse('TENANT_SERVICE_ROLE_NOT_CONFIGURED', 409, cors, { secretName })
  }

  const tenantClient = createTenantServiceClient(tenant.supabase_url, key)
  const featureFlagRows = Object.values(resolved).map((entitlement) => {
    const featureCode = String(entitlement.feature_code)
    const meta = FEATURE_META[featureCode]
    return {
      code: featureCode,
      name: meta.name,
      description: meta.description,
      audience: meta.audience,
      is_enabled: entitlement.is_enabled === true,
      target_roles: meta.targetRoles,
      target_platforms: ['web'],
      config: normalizeLimits(entitlement.limits),
    }
  })

  const { data: featureFlags, error: syncError } = await tenantClient
    .from('feature_flags')
    .upsert(featureFlagRows, { onConflict: 'code' })
    .select(TENANT_FEATURE_FLAG_SELECT)

  if (syncError) {
    await auditEvent(context.client, {
      tenantId,
      eventType: 'tenant_entitlements.sync_failed',
      actorId: context.admin.id,
      metadata: { reason: 'feature_flags_upsert_failed' },
    })
    return errorResponse('TENANT_ENTITLEMENT_SYNC_FAILED', 500, cors)
  }

  await auditEvent(context.client, {
    tenantId,
    eventType: 'tenant_entitlements.sync_completed',
    actorId: context.admin.id,
    metadata: {
      featureCount: featureFlagRows.length,
      changedCount: entitlementRows.length,
    },
  })

  return jsonResponse({ data: { featureFlags: featureFlags ?? [] }, error: null }, 200, cors)
})
