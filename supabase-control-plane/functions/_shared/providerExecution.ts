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

async function fetchWithTimeout(url: string, token: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)

  try {
    return await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

export async function verifyProviderCredential(connection: ProviderConnection | null): Promise<VerificationResult> {
  const provider = typeof connection?.provider === 'string' ? connection.provider : ''
  const secretStorage = typeof connection?.secret_storage === 'string' ? connection.secret_storage : ''
  const secretRef = typeof connection?.secret_ref === 'string' ? connection.secret_ref.trim() : ''
  const url = providerVerificationUrl(provider)

  if (!url) {
    return { data: null, error: 'INVALID_PROVIDER_CONNECTION', summary: 'Provider is not supported by the runner.' }
  }

  if (secretStorage !== 'edge_function_secret') {
    return {
      data: null,
      error: 'PROVIDER_SECRET_STORAGE_UNSUPPORTED',
      summary: 'This runner currently supports Edge Function secret references only.',
    }
  }

  if (!EDGE_FUNCTION_SECRET_REF.test(secretRef)) {
    return {
      data: null,
      error: 'PROVIDER_SECRET_REF_INVALID',
      summary: 'Provider secret reference must be a safe Edge Function secret name.',
    }
  }

  const token = Deno.env.get(secretRef)
  if (!token) {
    return {
      data: null,
      error: 'PROVIDER_SECRET_NOT_CONFIGURED',
      summary: 'Provider secret reference is valid, but the Edge Function secret is not configured.',
    }
  }

  try {
    const response = await fetchWithTimeout(url, token)

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
