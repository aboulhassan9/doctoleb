import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { readVaultSecretRef } from './tenantSecrets.ts'

type ProviderConnection = {
  provider?: unknown
  secret_storage?: unknown
  secret_ref?: unknown
}

type VerificationResult =
  | { data: { provider: string; verified: true; status: number }; error: null; summary: string }
  | { data: null; error: string; summary: string }

const EDGE_FUNCTION_SECRET_REF = /^[A-Z][A-Z0-9_]{2,200}$/
const VERIFY_TIMEOUT_MS = 8000

function providerVerificationUrl(provider: string) {
  if (provider === 'supabase') return 'https://api.supabase.com/v1/projects'
  if (provider === 'vercel') return 'https://api.vercel.com/v2/user'
  return ''
}

async function fetchWithTimeout(url: string, bearerCredential: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)

  try {
    return await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${bearerCredential}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function readProviderCredentialSecret(client: SupabaseClient | null, secretStorage: string, secretRef: string) {
  if (secretStorage === 'edge_function_secret') {
    if (!EDGE_FUNCTION_SECRET_REF.test(secretRef)) {
      return { data: null, error: 'PROVIDER_SECRET_REF_INVALID' }
    }

    const credential = Deno.env.get(secretRef)
    return {
      data: credential ?? null,
      error: credential ? null : 'PROVIDER_SECRET_NOT_CONFIGURED',
    }
  }

  if (secretStorage === 'supabase_vault') {
    if (!client) return { data: null, error: 'PROVIDER_SECRET_STORAGE_UNSUPPORTED' }
    const vault = await readVaultSecretRef(client, secretRef)
    return {
      data: vault.data,
      error: vault.error ? 'PROVIDER_SECRET_NOT_CONFIGURED' : null,
    }
  }

  return { data: null, error: 'PROVIDER_SECRET_STORAGE_UNSUPPORTED' }
}

export async function verifyProviderCredential(
  connection: ProviderConnection | null,
  client: SupabaseClient | null = null,
): Promise<VerificationResult> {
  const provider = typeof connection?.provider === 'string' ? connection.provider : ''
  const secretStorage = typeof connection?.secret_storage === 'string' ? connection.secret_storage : ''
  const secretRef = typeof connection?.secret_ref === 'string' ? connection.secret_ref.trim() : ''
  const url = providerVerificationUrl(provider)

  if (!url) {
    return { data: null, error: 'INVALID_PROVIDER_CONNECTION', summary: 'Provider is not supported by the runner.' }
  }

  if (!secretRef) {
    return {
      data: null,
      error: 'PROVIDER_SECRET_REF_INVALID',
      summary: 'Provider secret reference is missing or invalid.',
    }
  }

  const credential = await readProviderCredentialSecret(client, secretStorage, secretRef)
  if (credential.error || !credential.data) {
    return {
      data: null,
      error: credential.error ?? 'PROVIDER_SECRET_NOT_CONFIGURED',
      summary: 'Provider secret reference is valid, but the server-side secret is not configured.',
    }
  }

  try {
    const response = await fetchWithTimeout(url, credential.data)

    if (response.status === 401 || response.status === 403) {
      return { data: null, error: 'PROVIDER_AUTH_FAILED', summary: 'Provider rejected the configured credential.' }
    }

    if (response.status === 429) {
      return { data: null, error: 'PROVIDER_RATE_LIMITED', summary: 'Provider rate limit blocked credential verification.' }
    }

    if (!response.ok) {
      return { data: null, error: 'PROVIDER_VERIFICATION_FAILED', summary: 'Provider credential verification failed.' }
    }

    return {
      data: {
        provider,
        verified: true,
        status: response.status,
      },
      error: null,
      summary: `${provider} provider credential verified.`,
    }
  } catch (_error) {
    return {
      data: null,
      error: 'PROVIDER_VERIFICATION_FAILED',
      summary: 'Provider credential verification could not reach the provider API.',
    }
  }
}
