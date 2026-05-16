import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import postgres from 'npm:postgres@3.4.3'
import {
  TENANT_MIGRATION_BUNDLE,
  TENANT_MIGRATION_SOURCE_CHECKSUM,
  type TenantMigration,
} from './tenantMigrationBundle.ts'
import { resolveTenantDatabaseUrl } from './tenantSecrets.ts'

type ControlPlaneContext = {
  client: SupabaseClient
  admin: {
    id: string
  }
}

type MigrationRunnerSuccess = {
  data: {
    migrationRunId: string | null
    expectedMigrationsCount: number
    appliedMigrationsCount: number
    skippedMigrationsCount: number
    sourceChecksum: string
    projectRef: string
    secretStorage: string | null
  }
  error: null
}

type MigrationRunnerFailure = {
  data: null
  error: string
  summary: string
  details?: Record<string, unknown>
}

type MigrationRunnerResult = MigrationRunnerSuccess | MigrationRunnerFailure
type PostgresClient = ReturnType<typeof postgres>

const SAFE_PROJECT_REF = /^[a-z0-9]{20}$/
const DB_URL_PROTOCOLS = new Set(['postgres:', 'postgresql:'])
const REQUIRED_RUNTIME_OBJECTS = [
  'public.tenant_profile',
  'public.tenant_app_config',
  'public.service_seed_tenant_profile(text,text,jsonb)',
  'public.service_seed_first_doctor_admin(uuid,text,text,text,uuid)',
  'public.analytical_reports',
  'public.analytical_report_versions',
  'public.analytical_report_runs',
  'public.run_analytical_report(jsonb,jsonb)',
]

function safeErrorSummary(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || '')
  return raw
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, '[redacted-database-url]')
    .replace(/\b(password|secret|token|key)=?[^\s,;]*/gi, '$1=[redacted]')
    .slice(0, 900) || 'Tenant database migration failed.'
}

function classifyMigrationRunFailure(error: unknown) {
  const errorSummary = safeErrorSummary(error)
  const normalized = errorSummary.toLowerCase()

  if (/authentication failed|password=.*failed|invalid password|28p01/.test(normalized)) {
    return {
      error: 'TENANT_DATABASE_AUTH_FAILED',
      summary: 'Tenant database rejected the saved Postgres password.',
      errorSummary,
    }
  }

  if (/timeout|timed out|econnrefused|enotfound|getaddrinfo|connection refused|network/.test(normalized)) {
    return {
      error: 'TENANT_DATABASE_CONNECTION_FAILED',
      summary: 'Tenant database connection could not be opened from the server runner.',
      errorSummary,
    }
  }

  return {
    error: 'TENANT_MIGRATION_RUN_FAILED',
    summary: 'Tenant database setup failed before migrations could complete.',
    errorSummary,
  }
}

function normalizeProjectRef(value: unknown) {
  const ref = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return SAFE_PROJECT_REF.test(ref) ? ref : ''
}

function parseDatabaseUrl(value: string) {
  try {
    const parsed = new URL(value)
    if (!DB_URL_PROTOCOLS.has(parsed.protocol)) return null
    return parsed
  } catch (_error) {
    return null
  }
}

function databaseUrlReferencesProjectRef(databaseUrl: string, projectRef: string) {
  const parsed = parseDatabaseUrl(databaseUrl)
  if (!parsed) return false

  const normalizedRef = projectRef.toLowerCase()
  const hostname = parsed.hostname.toLowerCase()
  const username = decodeURIComponent(parsed.username || '').toLowerCase()
  return hostname.includes(normalizedRef) || username.includes(normalizedRef)
}

function hasExplicitTransaction(sql: string) {
  return /^\s*begin\s*;/im.test(sql) || /^\s*commit\s*;/im.test(sql)
}

async function createMigrationRun(
  context: ControlPlaneContext,
  {
    tenantId,
    stepId,
    projectRef,
    status,
    errorCode,
    errorSummary,
  }: {
    tenantId: string
    stepId: string | null
    projectRef: string
    status: 'running' | 'blocked' | 'failed'
    errorCode: string | null
    errorSummary: string | null
  },
) {
  const { data, error } = await context.client.rpc('admin_create_tenant_migration_run', {
    p_tenant_id: tenantId,
    p_provisioning_step_id: stepId,
    p_project_ref: projectRef,
    p_runner_mode: 'database_url',
    p_status: status,
    p_error_code: errorCode,
    p_error_summary: errorSummary,
    p_actor_id: context.admin.id,
  })

  if (error) return { data: null, error: 'TENANT_MIGRATION_RUN_RECORD_FAILED' }
  return { data: data as { id?: string } | null, error: null }
}

async function finishMigrationRun(
  context: ControlPlaneContext,
  {
    runId,
    status,
    expectedMigrationsCount,
    appliedMigrationsCount,
    failedMigrationVersion,
    failedMigrationName,
    errorCode,
    errorSummary,
  }: {
    runId: string
    status: 'succeeded' | 'failed' | 'blocked'
    expectedMigrationsCount: number
    appliedMigrationsCount: number
    failedMigrationVersion: string | null
    failedMigrationName: string | null
    errorCode: string | null
    errorSummary: string | null
  },
) {
  const { error } = await context.client.rpc('admin_finish_tenant_migration_run', {
    p_run_id: runId,
    p_status: status,
    p_source_checksum: TENANT_MIGRATION_SOURCE_CHECKSUM,
    p_expected_migrations_count: expectedMigrationsCount,
    p_applied_migrations_count: appliedMigrationsCount,
    p_failed_migration_version: failedMigrationVersion,
    p_failed_migration_name: failedMigrationName,
    p_error_code: errorCode,
    p_error_summary: errorSummary,
  })

  return error ? { error: 'TENANT_MIGRATION_RUN_RECORD_FAILED' } : { error: null }
}

async function upsertMigrationItem(
  context: ControlPlaneContext,
  {
    runId,
    migration,
    sequenceNo,
    status,
    errorCode = null,
    errorSummary = null,
  }: {
    runId: string
    migration: TenantMigration
    sequenceNo: number
    status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped'
    errorCode?: string | null
    errorSummary?: string | null
  },
) {
  const { error } = await context.client.rpc('admin_upsert_tenant_migration_item', {
    p_run_id: runId,
    p_sequence_no: sequenceNo,
    p_version: migration.version,
    p_name: migration.name,
    p_checksum: migration.checksum,
    p_status: status,
    p_error_code: errorCode,
    p_error_summary: errorSummary,
  })

  return error ? { error: 'TENANT_MIGRATION_ITEM_RECORD_FAILED' } : { error: null }
}

async function blockRun(
  context: ControlPlaneContext,
  {
    tenantId,
    stepId,
    projectRef,
    error,
    summary,
    details = {},
  }: {
    tenantId: string
    stepId: string | null
    projectRef: string
    error: string
    summary: string
    details?: Record<string, unknown>
  },
): Promise<MigrationRunnerFailure> {
  const run = await createMigrationRun(context, {
    tenantId,
    stepId,
    projectRef,
    status: 'blocked',
    errorCode: error,
    errorSummary: summary,
  })

  return {
    data: null,
    error,
    summary,
    details: {
      ...details,
      migrationRunId: run.data?.id ?? null,
      projectRef,
    },
  }
}

async function ensureMigrationLedger(sql: PostgresClient) {
  await sql.unsafe('create schema if not exists supabase_migrations')
  await sql.unsafe(`
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      name text,
      statements text[]
    )
  `)
  await sql.unsafe('alter table supabase_migrations.schema_migrations add column if not exists name text')
  await sql.unsafe('alter table supabase_migrations.schema_migrations add column if not exists statements text[]')
}

async function readPublicTables(sql: PostgresClient) {
  const rows = await sql<{ table_name: string }[]>`
    select table_name
      from information_schema.tables
     where table_schema = 'public'
       and table_type = 'BASE TABLE'
     order by table_name
     limit 25
  `

  return rows.map((row) => row.table_name)
}

async function migrationLedgerExists(sql: PostgresClient) {
  const rows = await sql<{ exists: boolean }[]>`
    select to_regclass('supabase_migrations.schema_migrations') is not null as exists
  `
  return rows[0]?.exists === true
}

async function readAppliedVersions(sql: PostgresClient) {
  const rows = await sql<{ version: string }[]>`
    select version
      from supabase_migrations.schema_migrations
  `
  return new Set(rows.map((row) => row.version))
}

async function insertMigrationLedgerRow(sql: PostgresClient, migration: TenantMigration) {
  await sql`
    insert into supabase_migrations.schema_migrations (version, name, statements)
    values (${migration.version}, ${migration.name}, ARRAY[${migration.checksum}]::text[])
    on conflict (version) do nothing
  `
}

async function applyMigration(sql: PostgresClient, migration: TenantMigration) {
  if (hasExplicitTransaction(migration.sql)) {
    await sql.unsafe(migration.sql)
    await insertMigrationLedgerRow(sql, migration)
    return
  }

  await sql.unsafe('begin')
  try {
    await sql.unsafe(migration.sql)
    await insertMigrationLedgerRow(sql, migration)
    await sql.unsafe('commit')
  } catch (error) {
    try {
      await sql.unsafe('rollback')
    } catch (_rollbackError) {
      // Keep the original migration failure as the user-facing error.
    }
    throw error
  }
}

async function verifyRuntimeObjects(sql: PostgresClient) {
  const rows = await sql<{ object_name: string; is_ready: boolean }[]>`
    select object_name,
           case
             when object_name like 'public.%(%' then to_regprocedure(object_name) is not null
             else to_regclass(object_name) is not null
           end as is_ready
      from unnest(${REQUIRED_RUNTIME_OBJECTS}::text[]) as required(object_name)
  `

  return rows.filter((row) => !row.is_ready).map((row) => row.object_name)
}

export async function runTenantDatabaseMigrations(
  context: ControlPlaneContext,
  {
    tenantId,
    stepId,
    projectRef,
  }: {
    tenantId: string
    stepId: string | null
    projectRef: string
  },
): Promise<MigrationRunnerResult> {
  const normalizedProjectRef = normalizeProjectRef(projectRef)
  if (!tenantId || !normalizedProjectRef) {
    return {
      data: null,
      error: 'SUPABASE_PROJECT_RUNTIME_CONFIG_REQUIRED',
      summary: 'Link tenant Supabase runtime config before running tenant database setup.',
    }
  }

  const databaseSecret = await resolveTenantDatabaseUrl(context.client, {
    tenantId,
    projectRef: normalizedProjectRef,
  })

  if (!databaseSecret.databaseUrl) {
    return blockRun(context, {
      tenantId,
      stepId,
      projectRef: normalizedProjectRef,
      error: 'TENANT_DATABASE_URL_SECRET_REQUIRED',
      summary: 'Store the tenant database connection string in control-plane Vault before running migrations.',
      details: {
        secretName: databaseSecret.secretName,
        secretStorage: databaseSecret.secretStorage,
      },
    })
  }

  if (!parseDatabaseUrl(databaseSecret.databaseUrl)) {
    return blockRun(context, {
      tenantId,
      stepId,
      projectRef: normalizedProjectRef,
      error: 'TENANT_DATABASE_URL_INVALID',
      summary: 'The stored tenant database connection string is not a valid Postgres URL.',
      details: {
        secretStorage: databaseSecret.secretStorage,
      },
    })
  }

  if (!databaseUrlReferencesProjectRef(databaseSecret.databaseUrl, normalizedProjectRef)) {
    return blockRun(context, {
      tenantId,
      stepId,
      projectRef: normalizedProjectRef,
      error: 'TENANT_DATABASE_PROJECT_MISMATCH',
      summary: 'The stored database connection string does not appear to belong to this tenant project ref.',
      details: {
        secretStorage: databaseSecret.secretStorage,
      },
    })
  }

  const run = await createMigrationRun(context, {
    tenantId,
    stepId,
    projectRef: normalizedProjectRef,
    status: 'running',
    errorCode: null,
    errorSummary: null,
  })
  const runId = run.data?.id ?? null
  if (run.error || !runId) {
    return {
      data: null,
      error: 'TENANT_MIGRATION_RUN_RECORD_FAILED',
      summary: 'Could not create a tenant migration run ledger entry.',
    }
  }

  const sql = postgres(databaseSecret.databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 5,
    onnotice: () => {},
  })

  let appliedMigrationsCount = 0
  let failedMigration: TenantMigration | null = null

  try {
    const hasLedger = await migrationLedgerExists(sql)
    const publicTables = await readPublicTables(sql)
    if (publicTables.length > 0 && !hasLedger) {
      await finishMigrationRun(context, {
        runId,
        status: 'blocked',
        expectedMigrationsCount: TENANT_MIGRATION_BUNDLE.length,
        appliedMigrationsCount,
        failedMigrationVersion: null,
        failedMigrationName: null,
        errorCode: 'TENANT_DATABASE_NOT_EMPTY',
        errorSummary: 'Tenant database has public tables but no DoctoLeb/Supabase migration ledger.',
      })

      return {
        data: null,
        error: 'TENANT_DATABASE_NOT_EMPTY',
        summary: 'Tenant database has public tables but no DoctoLeb/Supabase migration ledger, so automated setup refused to modify it.',
        details: {
          migrationRunId: runId,
          publicTables,
          projectRef: normalizedProjectRef,
        },
      }
    }

    await ensureMigrationLedger(sql)
    const appliedVersions = await readAppliedVersions(sql)

    for (const [index, migration] of TENANT_MIGRATION_BUNDLE.entries()) {
      if (appliedVersions.has(migration.version)) {
        const item = await upsertMigrationItem(context, {
          runId,
          migration,
          sequenceNo: index,
          status: 'skipped',
        })
        if (item.error) throw new Error(item.error)
        continue
      }

      let item = await upsertMigrationItem(context, {
        runId,
        migration,
        sequenceNo: index,
        status: 'running',
      })
      if (item.error) throw new Error(item.error)

      try {
        await applyMigration(sql, migration)
      } catch (error) {
        failedMigration = migration
        const errorSummary = safeErrorSummary(error)
        await upsertMigrationItem(context, {
          runId,
          migration,
          sequenceNo: index,
          status: 'failed',
          errorCode: 'TENANT_MIGRATION_FAILED',
          errorSummary,
        })

        await finishMigrationRun(context, {
          runId,
          status: 'failed',
          expectedMigrationsCount: TENANT_MIGRATION_BUNDLE.length,
          appliedMigrationsCount,
          failedMigrationVersion: migration.version,
          failedMigrationName: migration.name,
          errorCode: 'TENANT_MIGRATION_FAILED',
          errorSummary,
        })

        return {
          data: null,
          error: 'TENANT_MIGRATION_FAILED',
          summary: `Tenant migration ${migration.version}_${migration.name} failed.`,
          details: {
            migrationRunId: runId,
            failedMigrationVersion: migration.version,
            failedMigrationName: migration.name,
            errorSummary,
            projectRef: normalizedProjectRef,
          },
        }
      }

      item = await upsertMigrationItem(context, {
        runId,
        migration,
        sequenceNo: index,
        status: 'succeeded',
      })
      if (item.error) throw new Error(item.error)
      appliedMigrationsCount += 1
      appliedVersions.add(migration.version)
    }

    const missingRuntimeObjects = await verifyRuntimeObjects(sql)
    if (missingRuntimeObjects.length > 0) {
      await finishMigrationRun(context, {
        runId,
        status: 'blocked',
        expectedMigrationsCount: TENANT_MIGRATION_BUNDLE.length,
        appliedMigrationsCount,
        failedMigrationVersion: null,
        failedMigrationName: null,
        errorCode: 'TENANT_MIGRATIONS_NOT_READY',
        errorSummary: 'Tenant migrations completed but required runtime objects are missing.',
      })

      return {
        data: null,
        error: 'TENANT_MIGRATIONS_NOT_READY',
        summary: 'Tenant migrations completed but required runtime objects are missing.',
        details: {
          migrationRunId: runId,
          missingRuntimeObjects,
          projectRef: normalizedProjectRef,
        },
      }
    }

    await finishMigrationRun(context, {
      runId,
      status: 'succeeded',
      expectedMigrationsCount: TENANT_MIGRATION_BUNDLE.length,
      appliedMigrationsCount,
      failedMigrationVersion: null,
      failedMigrationName: null,
      errorCode: null,
      errorSummary: null,
    })

    return {
      data: {
        migrationRunId: runId,
        expectedMigrationsCount: TENANT_MIGRATION_BUNDLE.length,
        appliedMigrationsCount,
        skippedMigrationsCount: TENANT_MIGRATION_BUNDLE.length - appliedMigrationsCount,
        sourceChecksum: TENANT_MIGRATION_SOURCE_CHECKSUM,
        projectRef: normalizedProjectRef,
        secretStorage: databaseSecret.secretStorage,
      },
      error: null,
    }
  } catch (error) {
    const failure = classifyMigrationRunFailure(error)
    await finishMigrationRun(context, {
      runId,
      status: 'failed',
      expectedMigrationsCount: TENANT_MIGRATION_BUNDLE.length,
      appliedMigrationsCount,
      failedMigrationVersion: failedMigration?.version ?? null,
      failedMigrationName: failedMigration?.name ?? null,
      errorCode: failure.error,
      errorSummary: failure.errorSummary,
    })

    return {
      data: null,
      error: failure.error,
      summary: failure.summary,
      details: {
        migrationRunId: runId,
        errorSummary: failure.errorSummary,
        projectRef: normalizedProjectRef,
      },
    }
  } finally {
    await sql.end({ timeout: 5 })
  }
}
