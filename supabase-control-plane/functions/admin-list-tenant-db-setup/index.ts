import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  preflight,
  readJsonBody,
  requireSuperAdmin,
} from '../_shared/admin.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeUuid(value: unknown) {
  const id = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return UUID.test(id) ? id : ''
}

function sanitizeSecret(row: Record<string, unknown>) {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    project_ref: row.project_ref,
    secret_kind: row.secret_kind,
    secret_storage: row.secret_storage,
    status: row.status,
    has_secret_ref: typeof row.secret_ref === 'string' && row.secret_ref.trim() !== '',
    secret_last_rotated_at: row.secret_last_rotated_at,
    last_verified_at: row.last_verified_at,
    last_error_code: row.last_error_code,
    last_error_summary: row.last_error_summary,
    revoked_at: row.revoked_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

Deno.serve(async (req) => {
  const preflightResponse = preflight(req)
  if (preflightResponse) return preflightResponse

  const cors = corsHeaders(req.headers.get('origin'))
  if (req.method !== 'GET' && req.method !== 'POST') return errorResponse('INVALID_METHOD', 405, cors)

  const { data: context, response } = await requireSuperAdmin(req)
  if (response) return response

  const body = await readJsonBody(req)
  const url = new URL(req.url)
  const tenantId = normalizeUuid(body.tenantId ?? body.tenant_id ?? url.searchParams.get('tenantId'))
  if (!tenantId) return errorResponse('INVALID_REQUEST', 400, cors, { summary: 'tenantId is required.' })

  const [{ data: secrets, error: secretsError }, { data: runs, error: runsError }] = await Promise.all([
    context.client
      .from('tenant_secret_refs')
      .select('id, tenant_id, project_ref, secret_kind, secret_storage, secret_ref, status, secret_last_rotated_at, last_verified_at, last_error_code, last_error_summary, revoked_at, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    context.client
      .from('tenant_migration_runs')
      .select(`
        id,
        tenant_id,
        provisioning_step_id,
        project_ref,
        runner_mode,
        status,
        migration_source,
        source_checksum,
        expected_migrations_count,
        applied_migrations_count,
        failed_migration_version,
        failed_migration_name,
        last_error_code,
        last_error_summary,
        started_at,
        completed_at,
        created_at,
        updated_at,
        tenant_migration_items (
          id,
          sequence_no,
          version,
          name,
          checksum,
          status,
          error_code,
          error_summary,
          started_at,
          completed_at
        )
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  if (secretsError) return errorResponse('TENANT_SECRET_LIST_FAILED', 500, cors)
  if (runsError) return errorResponse('TENANT_MIGRATION_RUN_LIST_FAILED', 500, cors)

  return jsonResponse({
    data: {
      secrets: (secrets ?? []).map((row) => sanitizeSecret(row as Record<string, unknown>)),
      migrationRuns: runs ?? [],
    },
    error: null,
  }, 200, cors)
})
