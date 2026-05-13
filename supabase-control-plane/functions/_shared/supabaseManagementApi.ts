// DoctoLeb · Supabase Management API helper
// Server-side only. Reads Personal Access Tokens (PATs) from Vault or Edge
// Function secrets via the provider connection's secret_ref. Never accepts a
// raw token from the browser or stores one in control-plane tables.

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { readVaultSecretRef } from './tenantSecrets.ts'

const SUPABASE_MANAGEMENT_API_BASE = 'https://api.supabase.com'
const REQUEST_TIMEOUT_MS = 12000
const EDGE_FUNCTION_SECRET_REF = /^[A-Z][A-Z0-9_]{2,200}$/
const PROJECT_REF = /^[a-z0-9]{20}$/

export type ProviderConnectionRef = {
  provider?: unknown
  secret_storage?: unknown
  secret_ref?: unknown
}

// Subset of fields on the Management API auth config endpoint.
// Reference: https://supabase.com/docs/reference/api/v1-update-a-projects-auth-config
export type TenantAuthConfigPatch = {
  mailer_otp_length?: number
  mailer_otp_exp?: number
  site_url?: string
  uri_allow_list?: string
}

export type ManagementApiResult<T> =
  | { data: T; error: null; status: number }
  | { data: null; error: string; status: number }

async function readPatFromConnection(
  client: SupabaseClient,
  connection: ProviderConnectionRef,
): Promise<{ data: string | null; error: string | null }> {
  const secretStorage = typeof connection?.secret_storage === 'string' ? connection.secret_storage : ''
  const secretRef = typeof connection?.secret_ref === 'string' ? connection.secret_ref.trim() : ''

  if (!secretRef) return { data: null, error: 'PROVIDER_SECRET_REF_INVALID' }

  if (secretStorage === 'edge_function_secret') {
    if (!EDGE_FUNCTION_SECRET_REF.test(secretRef)) {
      return { data: null, error: 'PROVIDER_SECRET_REF_INVALID' }
    }
    const credential = Deno.env.get(secretRef)
    return { data: credential ?? null, error: credential ? null : 'PROVIDER_SECRET_NOT_CONFIGURED' }
  }

  if (secretStorage === 'supabase_vault') {
    const vault = await readVaultSecretRef(client, secretRef)
    return { data: vault.data, error: vault.error ? 'PROVIDER_SECRET_NOT_CONFIGURED' : null }
  }

  return { data: null, error: 'PROVIDER_SECRET_STORAGE_UNSUPPORTED' }
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

function mapHttpStatusToError(status: number): string {
  if (status === 401 || status === 403) return 'PROVIDER_AUTH_FAILED'
  if (status === 429) return 'PROVIDER_RATE_LIMITED'
  if (status === 404) return 'PROVIDER_RESOURCE_NOT_FOUND'
  return 'PROVIDER_VERIFICATION_FAILED'
}

export async function patchTenantAuthConfig(
  client: SupabaseClient,
  connection: ProviderConnectionRef,
  projectRef: string,
  patch: TenantAuthConfigPatch,
): Promise<ManagementApiResult<{ projectRef: string; appliedFields: string[] }>> {
  if (typeof connection?.provider !== 'string' || connection.provider !== 'supabase') {
    return { data: null, error: 'INVALID_PROVIDER_CONNECTION', status: 0 }
  }

  if (!PROJECT_REF.test(projectRef)) {
    return { data: null, error: 'INVALID_PROJECT_REF', status: 0 }
  }

  const appliedFields = Object.keys(patch).filter((key) => patch[key as keyof TenantAuthConfigPatch] !== undefined)
  if (appliedFields.length === 0) {
    return { data: null, error: 'AUTH_CONFIG_PATCH_EMPTY', status: 0 }
  }

  const credential = await readPatFromConnection(client, connection)
  if (credential.error || !credential.data) {
    return { data: null, error: credential.error ?? 'PROVIDER_SECRET_NOT_CONFIGURED', status: 0 }
  }

  try {
    const response = await fetchWithTimeout(
      `${SUPABASE_MANAGEMENT_API_BASE}/v1/projects/${projectRef}/config/auth`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${credential.data}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(patch),
      },
    )

    if (!response.ok) {
      return { data: null, error: mapHttpStatusToError(response.status), status: response.status }
    }

    return {
      data: { projectRef, appliedFields },
      error: null,
      status: response.status,
    }
  } catch (_error) {
    return { data: null, error: 'AUTH_CONFIG_UPDATE_FAILED', status: 0 }
  }
}
