import {
  auditEvent,
  corsHeaders,
  errorResponse,
  jsonResponse,
  preflight,
  readJsonBody,
  requireSuperAdmin,
} from '../_shared/admin.ts'
import postgres from 'npm:postgres@3.4.3'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PROJECT_REF = /^[a-z0-9]{20}$/
const SECRET_KINDS = new Set(['service_role_key', 'database_url'])
const SECRET_STORAGES = new Set(['supabase_vault', 'edge_function_secret', 'external_secret_manager'])
const DATABASE_URL_PROTOCOLS = new Set(['postgres:', 'postgresql:'])

function normalizeUuid(value: unknown) {
  const id = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return UUID.test(id) ? id : ''
}

function normalizeProjectRef(value: unknown) {
  const ref = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return PROJECT_REF.test(ref) ? ref : ''
}

function normalizeEnum(value: unknown, allowed: Set<string>, fallback = '') {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return allowed.has(text) ? text : fallback
}

function normalizeSecretInput(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeDatabaseUrlSecret(value: string, projectRef: string) {
  try {
    const parsed = new URL(value)
    if (!DATABASE_URL_PROTOCOLS.has(parsed.protocol)) return ''
    const hostname = parsed.hostname.toLowerCase()
    const username = decodeURIComponent(parsed.username || '').toLowerCase()
    if (!hostname.includes(projectRef) && !username.includes(projectRef)) return ''
    return parsed.href
  } catch (_error) {
    return ''
  }
}

function safeDatabaseErrorSummary(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || '')
  return raw
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, '[redacted-database-url]')
    .replace(/\b(password|secret|token|key)=?[^\s,;]*/gi, '$1=[redacted]')
    .slice(0, 500) || 'Tenant database connection failed.'
}

function classifyDatabaseConnectionError(error: unknown) {
  const summary = safeDatabaseErrorSummary(error)
  const normalized = summary.toLowerCase()

  if (/authentication failed|password=.*failed|invalid password|28p01/.test(normalized)) {
    return {
      code: 'TENANT_DATABASE_AUTH_FAILED',
      status: 400,
      summary: 'Tenant database rejected this Postgres password.',
      errorSummary: summary,
    }
  }

  if (/timeout|timed out|econnrefused|enotfound|getaddrinfo|connection refused|network/.test(normalized)) {
    return {
      code: 'TENANT_DATABASE_CONNECTION_FAILED',
      status: 409,
      summary: 'The server could not connect to this tenant database URL.',
      errorSummary: summary,
    }
  }

  return {
    code: 'TENANT_DATABASE_CONNECTION_FAILED',
    status: 409,
    summary: 'The tenant database URL could not be verified.',
    errorSummary: summary,
  }
}

async function verifyDatabaseUrlSecret(databaseUrl: string) {
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 5,
    onnotice: () => {},
  })

  try {
    await sql`select 1 as ok`
    return { error: null }
  } catch (error) {
    return { error: classifyDatabaseConnectionError(error) }
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {})
  }
}

function statusForStoreError(message = '') {
  if (message.includes('TENANT_NOT_FOUND')) return 404
  if (
    message.includes('INVALID_')
    || message.includes('SECRET_VALUE_REQUIRED')
    || message.includes('SECRET_REF_INVALID')
  ) {
    return 400
  }
  return 500
}

function codeForStoreError(message = '') {
  for (const code of [
    'TENANT_NOT_FOUND',
    'INVALID_PROJECT_REF',
    'INVALID_SECRET_KIND',
    'INVALID_SECRET_STORAGE',
    'SECRET_VALUE_REQUIRED',
    'SECRET_REF_INVALID',
  ]) {
    if (message.includes(code)) return code
  }
  return 'TENANT_SECRET_STORE_FAILED'
}

function summaryForStoreError(code: string) {
  if (code === 'TENANT_NOT_FOUND') return 'The selected tenant no longer exists.'
  if (code === 'INVALID_PROJECT_REF') return 'Save a valid Supabase project ref before storing this secret.'
  if (code === 'INVALID_SECRET_KIND') return 'This tenant secret type is not supported.'
  if (code === 'INVALID_SECRET_STORAGE') return 'This tenant secret storage mode is not supported.'
  if (code === 'SECRET_VALUE_REQUIRED') return 'Paste the required server-only value before continuing.'
  if (code === 'SECRET_REF_INVALID') return 'Secret references must be names only, not raw keys or database URLs.'
  return 'Secret was not saved. Check the value and try again.'
}

function sanitizeTenantSecret(row: Record<string, unknown> | null) {
  if (!row) return null
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    project_ref: row.project_ref,
    secret_kind: row.secret_kind,
    secret_storage: row.secret_storage,
    status: row.status,
    has_secret_ref: typeof row.secret_ref === 'string' && row.secret_ref.trim() !== '',
    secret_last_rotated_at: row.secret_last_rotated_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
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
  const secretKind = normalizeEnum(body.secretKind ?? body.secret_kind, SECRET_KINDS, 'service_role_key')
  const secretStorage = normalizeEnum(body.secretStorage ?? body.secret_storage, SECRET_STORAGES, 'supabase_vault')
  let secretValue = normalizeSecretInput(body.secretValue ?? body.secret_value)
  const secretRef = normalizeSecretInput(body.secretRef ?? body.secret_ref)

  if (!tenantId) return errorResponse('INVALID_REQUEST', 400, cors, { summary: 'tenantId is required.' })

  const { data: tenant, error: tenantError } = await context.client
    .from('tenants')
    .select('id, slug, supabase_project_ref')
    .eq('id', tenantId)
    .maybeSingle()

  if (tenantError) return errorResponse('TENANT_LOOKUP_FAILED', 500, cors)
  if (!tenant) return errorResponse('TENANT_NOT_FOUND', 404, cors)

  const projectRef = normalizeProjectRef(body.projectRef ?? body.project_ref ?? tenant.supabase_project_ref)
  if (!projectRef) return errorResponse('INVALID_PROJECT_REF', 400, cors)

  if (secretKind === 'database_url' && secretStorage === 'supabase_vault') {
    const normalizedDatabaseUrl = normalizeDatabaseUrlSecret(secretValue, projectRef)
    if (!normalizedDatabaseUrl) {
      return errorResponse('INVALID_DATABASE_URL', 400, cors, {
        summary: 'Use the tenant project Postgres connection string.',
      })
    }
    secretValue = normalizedDatabaseUrl

    const verification = await verifyDatabaseUrlSecret(secretValue)
    if (verification.error) {
      return errorResponse(verification.error.code, verification.error.status, cors, {
        summary: verification.error.summary,
        errorSummary: verification.error.errorSummary,
      })
    }
  }

  const { data, error } = await context.client.rpc('admin_store_tenant_secret_ref', {
    p_tenant_id: tenantId,
    p_project_ref: projectRef,
    p_secret_kind: secretKind,
    p_secret_storage: secretStorage,
    p_secret_value: secretStorage === 'supabase_vault' ? secretValue : null,
    p_secret_ref: secretStorage === 'supabase_vault' ? null : secretRef,
    p_actor_id: context.admin.id,
  })

  if (error) {
    const message = error.message || ''
    const code = codeForStoreError(message)
    return errorResponse(code, statusForStoreError(message), cors, { summary: summaryForStoreError(code) })
  }

  const row = Array.isArray(data) ? data[0] : data
  await auditEvent(context.client, {
    tenantId,
    eventType: 'tenant_secret_ref.stored',
    actorId: context.admin.id,
    metadata: {
      projectRef,
      secretKind,
      secretStorage,
      rawSecretStored: false,
    },
  })

  return jsonResponse({ data: sanitizeTenantSecret(row as Record<string, unknown> | null), error: null }, 200, cors)
})
