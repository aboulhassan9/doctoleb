import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getTenantServiceRoleKey, tenantServiceRoleSecretName } from './admin.ts'

type TenantSecretLookup = {
  tenantId?: string | null
  projectRef?: string | null
  secretKind: 'service_role_key' | 'database_url'
}

type TenantServiceRoleResult = {
  key: string | null
  secretName: string
  secretRef: string | null
  secretStorage: string | null
  source: 'edge_function_secret' | 'supabase_vault' | 'tenant_secret_refs' | 'missing'
}

const SAFE_EDGE_SECRET_REF = /^[A-Z][A-Z0-9_]{2,200}$/
const PROJECT_REF = /^[a-z0-9]{20}$/

function normalizeProjectRef(value: unknown) {
  const ref = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return PROJECT_REF.test(ref) ? ref : ''
}

function normalizeTenantId(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function readVaultSecretRef(
  client: SupabaseClient,
  secretRef: string,
): Promise<{ data: string | null; error: string | null }> {
  const ref = typeof secretRef === 'string' ? secretRef.trim() : ''
  if (!ref.startsWith('vault:')) return { data: null, error: 'INVALID_SECRET_REF' }

  const { data, error } = await client.rpc('admin_read_vault_secret_ref', {
    p_secret_ref: ref,
  })

  if (error) return { data: null, error: 'VAULT_SECRET_LOOKUP_FAILED' }
  return { data: typeof data === 'string' && data ? data : null, error: null }
}

export async function readTenantSecret(
  client: SupabaseClient,
  lookup: TenantSecretLookup,
): Promise<{ data: { value: string | null; secretRef: string | null; secretStorage: string | null } | null; error: string | null }> {
  const projectRef = normalizeProjectRef(lookup.projectRef)
  const tenantId = normalizeTenantId(lookup.tenantId)

  if (!tenantId && !projectRef) return { data: null, error: 'TENANT_SECRET_SELECTOR_REQUIRED' }

  const { data, error } = await client.rpc('admin_read_tenant_secret', {
    p_tenant_id: tenantId || null,
    p_project_ref: projectRef || null,
    p_secret_kind: lookup.secretKind,
  })

  if (error) return { data: null, error: 'TENANT_SECRET_LOOKUP_FAILED' }

  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') return { data: null, error: null }

  return {
    data: {
      value: typeof row.secret_value === 'string' ? row.secret_value : null,
      secretRef: typeof row.secret_ref === 'string' ? row.secret_ref : null,
      secretStorage: typeof row.secret_storage === 'string' ? row.secret_storage : null,
    },
    error: null,
  }
}

export async function resolveTenantServiceRoleKey(
  client: SupabaseClient,
  {
    tenantId,
    projectRef,
  }: {
    tenantId?: string | null
    projectRef?: string | null
  },
): Promise<TenantServiceRoleResult> {
  const normalizedProjectRef = normalizeProjectRef(projectRef)
  const envSecret = getTenantServiceRoleKey(normalizedProjectRef)
  if (envSecret.key) {
    return {
      key: envSecret.key,
      secretName: envSecret.secretName,
      secretRef: envSecret.secretName,
      secretStorage: 'edge_function_secret',
      source: 'edge_function_secret',
    }
  }

  const storedSecret = await readTenantSecret(client, {
    tenantId,
    projectRef: normalizedProjectRef,
    secretKind: 'service_role_key',
  })

  if (storedSecret.error) {
    return {
      key: null,
      secretName: envSecret.secretName,
      secretRef: null,
      secretStorage: null,
      source: 'missing',
    }
  }

  const secretData = storedSecret.data
  if (!secretData?.secretRef) {
    return {
      key: null,
      secretName: envSecret.secretName,
      secretRef: null,
      secretStorage: null,
      source: 'missing',
    }
  }

  if (secretData.secretStorage === 'supabase_vault') {
    return {
      key: secretData.value,
      secretName: secretData.secretRef,
      secretRef: secretData.secretRef,
      secretStorage: 'supabase_vault',
      source: 'supabase_vault',
    }
  }

  if (secretData.secretStorage === 'edge_function_secret' && SAFE_EDGE_SECRET_REF.test(secretData.secretRef)) {
    return {
      key: Deno.env.get(secretData.secretRef) ?? null,
      secretName: secretData.secretRef,
      secretRef: secretData.secretRef,
      secretStorage: 'edge_function_secret',
      source: 'tenant_secret_refs',
    }
  }

  return {
    key: null,
    secretName: tenantServiceRoleSecretName(normalizedProjectRef),
    secretRef: secretData.secretRef,
    secretStorage: secretData.secretStorage,
    source: 'missing',
  }
}
