import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { OPTIONAL_ANALYTICS_TABLES, REQUIRED_OPERATIONAL_TABLES } from './constants.ts'
import { safeErrorMessage } from './seedUtils.ts'
import type { SeedConfig, SeedPlan } from './types.ts'

const SEED_OPERATOR_EMAIL = 'seed.operator@example.invalid'
const SEED_OPERATOR_PROFILE = {
  first_name: 'Seed',
  last_name: 'Operator',
  role: 'secretary',
  is_active: true,
}

async function tableProbe(client: SupabaseClient, tableName: string) {
  const { error } = await client
    .from(tableName)
    .select('id', { count: 'exact', head: true })
    .limit(1)
  return { tableName, ok: !error, error: error ? safeErrorMessage(error) : null }
}

async function duplicateCount(client: SupabaseClient, tableName: string, column: string, operator: 'eq' | 'ilike', value: string) {
  const base = client.from(tableName).select('id', { count: 'exact', head: true })
  const query = operator === 'eq' ? base.eq(column, value) : base.ilike(column, value)
  const { count, error } = await query
  if (error) throw new Error(`Duplicate probe failed for ${tableName}: ${safeErrorMessage(error)}`)
  return count ?? 0
}

export async function readTenant(contextClient: SupabaseClient, tenantId: string) {
  const { data, error } = await contextClient
    .from('tenants')
    .select('id, slug, display_name, status, supabase_project_ref, supabase_url, supabase_anon_key')
    .eq('id', tenantId)
    .maybeSingle()

  if (error) throw new Error(`Tenant lookup failed: ${safeErrorMessage(error)}`)
  return data
}

async function resolveDoctor(client: SupabaseClient) {
  const { data, error } = await client
    .from('doctors')
    .select('id, user_id, consultation_fee, users!doctors_user_id_fkey(id, email, first_name, last_name, role, is_active)')
    .order('created_at', { ascending: true })
    .limit(1)

  if (error) throw new Error(`Doctor lookup failed: ${safeErrorMessage(error)}`)
  return data?.[0] ?? null
}

async function resolveOperator(client: SupabaseClient) {
  const { data, error } = await client
    .from('users')
    .select('id, email, first_name, last_name, role, is_active, auth_user_id')
    .in('role', ['admin', 'secretary'])
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(20)

  if (error) throw new Error(`Operator lookup failed: ${safeErrorMessage(error)}`)
  return (data ?? []).find((row: Record<string, unknown>) => row.role === 'admin') ?? data?.[0] ?? null
}

async function readSeedOperator(client: SupabaseClient) {
  const { data, error } = await client
    .from('users')
    .select('id, email, first_name, last_name, role, is_active, auth_user_id')
    .eq('email', SEED_OPERATOR_EMAIL)
    .maybeSingle()

  if (error) throw new Error(`Seed operator lookup failed: ${safeErrorMessage(error)}`)
  return data
}

async function waitForSeedOperator(client: SupabaseClient) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const operator = await readSeedOperator(client)
    if (
      operator?.id
      && operator.auth_user_id
      && operator.is_active === true
      && ['admin', 'secretary'].includes(String(operator.role || ''))
    ) {
      return operator
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error('Auth trigger did not create an active seed secretary operator.')
}

async function findAuthUserIdByEmail(client: SupabaseClient, email: string) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw new Error(`Seed operator auth lookup failed: ${safeErrorMessage(error)}`)

    const user = data?.users?.find((row) => row.email?.toLowerCase() === email.toLowerCase())
    if (user?.id) return user.id
    if (!data?.users || data.users.length < 100) return null
  }

  return null
}

async function syncExistingSeedOperator(client: SupabaseClient, authUserId: string | null) {
  const current = await readSeedOperator(client)
  if (!current?.id) return null

  const patch: Record<string, unknown> = { ...SEED_OPERATOR_PROFILE }
  if (authUserId && !current.auth_user_id) patch.auth_user_id = authUserId

  const { data, error } = await client
    .from('users')
    .update(patch)
    .eq('id', current.id)
    .select('id, email, first_name, last_name, role, is_active, auth_user_id')
    .single()

  if (error) throw new Error(`Seed operator profile sync failed: ${safeErrorMessage(error)}`)
  return data
}

async function ensureSeedOperator(client: SupabaseClient) {
  const existingOperator = await resolveOperator(client)
  if (existingOperator?.id) {
    return {
      operator: existingOperator,
      bootstrapActions: [],
    }
  }

  const existingSeedOperator = await readSeedOperator(client)
  let authUserId = existingSeedOperator?.auth_user_id ? String(existingSeedOperator.auth_user_id) : null
  if (!authUserId) {
    authUserId = await findAuthUserIdByEmail(client, SEED_OPERATOR_EMAIL)
  }

  if (!authUserId) {
    const { data, error } = await client.auth.admin.createUser({
      email: SEED_OPERATOR_EMAIL,
      password: `Seed-${crypto.randomUUID()}-DoctoLeb!`,
      email_confirm: true,
      user_metadata: {
        role: 'secretary',
        first_name: SEED_OPERATOR_PROFILE.first_name,
        last_name: SEED_OPERATOR_PROFILE.last_name,
        full_name: `${SEED_OPERATOR_PROFILE.first_name} ${SEED_OPERATOR_PROFILE.last_name}`,
      },
    })

    if (error) throw new Error(`Seed operator auth creation failed: ${safeErrorMessage(error)}`)
    authUserId = data.user?.id ?? null
  }

  const syncedOperator = await syncExistingSeedOperator(client, authUserId)
  const operator = syncedOperator ?? await waitForSeedOperator(client)

  return {
    operator,
    bootstrapActions: ['Created or reactivated a synthetic secretary operator for RLS-safe seed writes.'],
  }
}

export async function readCatalog(client: SupabaseClient, tableName: string, select = 'id, code, name') {
  const { data, error } = await client.from(tableName).select(select).limit(50)
  if (error) return []
  return data ?? []
}

export async function preflightTenant({
  tenant,
  serviceClient,
  config,
  plan,
}: {
  tenant: Record<string, string>
  serviceClient: SupabaseClient
  config: SeedConfig
  plan: SeedPlan
}) {
  const requiredTables = await Promise.all(REQUIRED_OPERATIONAL_TABLES.map((tableName) => tableProbe(serviceClient, tableName)))
  const analyticsTables = await Promise.all(OPTIONAL_ANALYTICS_TABLES.map((tableName) => tableProbe(serviceClient, tableName)))
  const doctor = await resolveDoctor(serviceClient)
  let operator = await resolveOperator(serviceClient)
  const bootstrapActions: string[] = []
  if (!operator?.id && config.mode === 'write') {
    try {
      const bootstrapped = await ensureSeedOperator(serviceClient)
      operator = bootstrapped.operator
      bootstrapActions.push(...bootstrapped.bootstrapActions)
    } catch (error) {
      bootstrapActions.push(`Seed operator bootstrap failed: ${safeErrorMessage(error)}`)
    }
  } else if (!operator?.id) {
    bootstrapActions.push('Seed write will create a synthetic secretary operator before writing operational rows.')
  }
  const seedUsers = await duplicateCount(serviceClient, 'users', 'email', 'ilike', `seed.${config.seedTag}.%@example.invalid`)
  const seedClinic = await duplicateCount(serviceClient, 'clinics', 'name', 'eq', `DoctoLeb Seed Clinic (${config.seedTag})`)
  const seedAppointments = await duplicateCount(serviceClient, 'appointments', 'reason', 'ilike', `%[seed:${config.seedTag}]%`)

  const { error: templateSelectError } = await serviceClient
    .from('clinical_documents')
    .select('id, template_id, finalized_by, client_request_id')
    .limit(1)

  const blockers = [
    ...requiredTables.filter((row) => !row.ok).map((row) => `Missing required table ${row.tableName}: ${row.error}`),
  ]

  if (templateSelectError) blockers.push(`Critical clinical_documents select failed: ${safeErrorMessage(templateSelectError)}`)
  if (!doctor?.id) blockers.push('No doctor exists in this tenant. Run the Doctor admin provisioning step first.')
  if (!operator?.id && config.mode === 'write') blockers.push('No active admin/secretary operator exists in this tenant, and seed operator bootstrap failed.')
  if (!tenant.supabase_anon_key) blockers.push('Tenant anon key is missing from runtime config.')
  if ((seedUsers > 0 || seedClinic > 0 || seedAppointments > 0) && !config.allowDuplicates) {
    blockers.push(`Seed tag "${config.seedTag}" already exists. Use Allow duplicates only when intentionally appending to the same test namespace.`)
  }

  return {
    blockers,
    doctor,
    operator,
    bootstrapActions,
    plan,
    duplicateCounts: {
      users: seedUsers,
      clinics: seedClinic,
      appointments: seedAppointments,
    },
    requiredTables: {
      ok: requiredTables.filter((row) => row.ok).length,
      total: requiredTables.length,
      missing: requiredTables.filter((row) => !row.ok),
    },
    analyticsTables: {
      ok: analyticsTables.filter((row) => row.ok).length,
      total: analyticsTables.length,
      missing: analyticsTables.filter((row) => !row.ok).map((row) => row.tableName),
    },
  }
}
