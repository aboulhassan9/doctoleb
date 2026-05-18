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
import { SUPABASE_PROJECT_REF } from './constants.ts'
import { buildPlan, readConfig } from './seedConfig.ts'
import { safeErrorMessage } from './seedUtils.ts'
import { createAuthenticatedClient } from './tenantSessions.ts'
import { executeSeed } from './seedWriter.ts'
import { preflightTenant, readCatalog, readTenant } from './tenantReadiness.ts'
import type { SeedContext } from './types.ts'

export async function handleSeedTenantOperationalData(req: Request): Promise<Response> {
  const preflightResponse = preflight(req)
  if (preflightResponse) return preflightResponse

  const cors = corsHeaders(req.headers.get('origin'))
  if (req.method !== 'POST') return errorResponse('INVALID_METHOD', 405, cors)

  const { data: adminContext, response } = await requireSuperAdmin(req, ['operator'])
  if (response) return response

  const body = await readJsonBody(req)
  const config = readConfig(body)
  if (!config) return errorResponse('INVALID_REQUEST', 400, cors)

  const tenant = await readTenant(adminContext.client, config.tenantId)
  if (!tenant) return errorResponse('TENANT_NOT_FOUND', 404, cors)
  if (!SUPABASE_PROJECT_REF.test(String(tenant.supabase_project_ref || '')) || !tenant.supabase_url || !tenant.supabase_anon_key) {
    return errorResponse('TENANT_RUNTIME_NOT_CONFIGURED', 409, cors)
  }
  if (tenant.status !== 'active') {
    return errorResponse('TENANT_SEED_BLOCKED', 409, cors, {
      summary: 'Tenant must be active before synthetic operational data is seeded.',
      tenantStatus: tenant.status,
    })
  }

  const { key, secretName, secretStorage } = await resolveTenantServiceRoleKey(adminContext.client, {
    tenantId: config.tenantId,
    projectRef: tenant.supabase_project_ref,
  })
  if (!key) {
    return errorResponse('TENANT_SERVICE_ROLE_NOT_CONFIGURED', 409, cors, {
      summary: 'Store the tenant service-role key before running tenant seed data.',
      secretName,
      secretStorage,
    })
  }

  const serviceClient = createTenantServiceClient(tenant.supabase_url, key)
  const plan = buildPlan(config)
  const readiness = await preflightTenant({ tenant, serviceClient, config, plan })
  if (readiness.blockers.length) {
    await auditEvent(adminContext.client, {
      tenantId: config.tenantId,
      eventType: 'tenant_seed.preflight_blocked',
      actorId: adminContext.admin.id,
      metadata: {
        mode: config.mode,
        volume: config.volume,
        seedTag: config.seedTag,
        blockers: readiness.blockers.slice(0, 10),
      },
    })
    return errorResponse('TENANT_SEED_PREFLIGHT_FAILED', 409, cors, {
      summary: 'Tenant seed preflight failed. Fix these before writing synthetic data.',
      blockers: readiness.blockers,
      bootstrapActions: readiness.bootstrapActions,
      plan,
      duplicateCounts: readiness.duplicateCounts,
      requiredTables: readiness.requiredTables,
      analyticsTables: readiness.analyticsTables,
    })
  }

  if (config.mode === 'dry_run') {
    await auditEvent(adminContext.client, {
      tenantId: config.tenantId,
      eventType: 'tenant_seed.preflight_succeeded',
      actorId: adminContext.admin.id,
      metadata: { volume: config.volume, seedTag: config.seedTag, planRows: plan.rows },
    })
    return jsonResponse({
      data: {
        mode: config.mode,
        plan,
        bootstrapActions: readiness.bootstrapActions,
        duplicateCounts: readiness.duplicateCounts,
        requiredTables: readiness.requiredTables,
        analyticsTables: readiness.analyticsTables,
      },
      error: null,
    }, 200, cors)
  }

  try {
    const operatorClient = await createAuthenticatedClient(tenant, serviceClient, readiness.operator, 'seed operator')
    const doctorUser = (readiness.doctor as Record<string, unknown>).users as Record<string, unknown>
    const doctorClient = await createAuthenticatedClient(tenant, serviceClient, {
      id: readiness.doctor?.user_id,
      email: doctorUser?.email,
    }, 'target doctor')
    const context: SeedContext = {
      tenant,
      serviceClient,
      operatorClient,
      doctorClient,
      seedTag: config.seedTag,
      doctor: readiness.doctor as Record<string, unknown>,
      operator: readiness.operator as Record<string, unknown>,
      visitTypes: await readCatalog(operatorClient, 'visit_types', 'id, code, name, default_duration_minutes'),
      diseases: await readCatalog(operatorClient, 'diseases', 'id, code, name, icd10_code'),
      familyRelations: await readCatalog(operatorClient, 'family_relations', 'id, code, name'),
      counts: {},
    }

    const result = await executeSeed(context, plan)
    await auditEvent(adminContext.client, {
      tenantId: config.tenantId,
      eventType: 'tenant_seed.completed',
      actorId: adminContext.admin.id,
      metadata: {
        volume: config.volume,
        seedTag: config.seedTag,
        counts: result.counts,
      },
    })
    return jsonResponse({ data: { mode: config.mode, plan, bootstrapActions: readiness.bootstrapActions, ...result }, error: null }, 200, cors)
  } catch (error) {
    await auditEvent(adminContext.client, {
      tenantId: config.tenantId,
      eventType: 'tenant_seed.failed',
      actorId: adminContext.admin.id,
      metadata: {
        volume: config.volume,
        seedTag: config.seedTag,
        error: safeErrorMessage(error),
      },
    })
    return errorResponse('TENANT_SEED_FAILED', 500, cors, {
      summary: 'Tenant seed failed before all synthetic data could be created.',
      error: safeErrorMessage(error),
    })
  }
}
