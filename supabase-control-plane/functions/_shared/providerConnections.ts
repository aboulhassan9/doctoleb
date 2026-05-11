export const PROVIDERS = new Set(['supabase', 'vercel'])
export const OWNER_SCOPES = new Set(['doctoleb', 'customer', 'partner'])
export const AUTH_METHODS = new Set(['oauth', 'personal_access_token', 'service_account', 'manual'])
export const CONNECTION_STATUSES = new Set([
  'pending_authorization',
  'active',
  'disabled',
  'revoked',
  'error',
  'archived',
])
export const SECRET_STORAGES = new Set([
  'edge_function_secret',
  'supabase_vault',
  'external_secret_manager',
  'none',
])

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SAFE_SECRET_REF = /^[a-zA-Z0-9:_./-]{3,512}$/
const EDGE_FUNCTION_SECRET_REF = /^[A-Z][A-Z0-9_]{2,200}$/
const VAULT_SECRET_REF = /^vault:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TOKENISH_SECRET = /(eyJ|sbp_|vcp_|sk_live_|sk_test_)/i
const SECRET_INPUT_KEY = /(token|access[_-]?key|api[_-]?key|secret[_-]?value|service[_-]?role|management[_-]?key)/i
const SAFE_SECRET_REFERENCE_KEYS = new Set(['secretRef', 'secret_ref', 'secretStorage', 'secret_storage'])

export function isUuid(value: unknown) {
  return typeof value === 'string' && UUID.test(value)
}

export function normalizeString(value: unknown, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function normalizeNullableString(value: unknown, max = 200) {
  const text = normalizeString(value, max)
  return text || null
}

export function normalizeEnum(value: unknown, allowed: Set<string>, fallback = '') {
  const text = normalizeString(value, 80).toLowerCase()
  if (text && allowed.has(text)) return text
  return fallback
}

export function normalizeBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

export function normalizeObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function containsForbiddenSecretValue(value: unknown, depth = 0): boolean {
  if (typeof value === 'string') return TOKENISH_SECRET.test(value)
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 5) return false
  return Object.entries(value as Record<string, unknown>).some(([key, nested]) => {
    return SECRET_INPUT_KEY.test(key) || containsForbiddenSecretValue(nested, depth + 1)
  })
}

export function hasForbiddenSecretInput(input: Record<string, unknown>) {
  return Object.entries(input).some(([key, value]) => {
    if (SAFE_SECRET_REFERENCE_KEYS.has(key)) return false
    return SECRET_INPUT_KEY.test(key) || containsForbiddenSecretValue(value)
  })
}

export function normalizeSecretRef(value: unknown) {
  if (value === null || value === undefined || value === '') return { data: null, error: null }
  const secretRef = normalizeString(value, 512)
  if (!secretRef) return { data: null, error: null }
  if (TOKENISH_SECRET.test(secretRef) || !SAFE_SECRET_REF.test(secretRef)) {
    return { data: null, error: 'SECRET_INPUT_NOT_ALLOWED' }
  }
  return { data: secretRef, error: null }
}

export function sanitizeProviderConnection(row: Record<string, unknown> | null) {
  if (!row) return null
  const copy = { ...row }
  const hasSecretRef = typeof copy.secret_ref === 'string' && copy.secret_ref.trim() !== ''
  delete copy.secret_ref
  return {
    ...copy,
    has_secret_ref: hasSecretRef,
  }
}

export function sanitizeProviderConnections(rows: unknown[]) {
  return rows
    .filter((row): row is Record<string, unknown> => row && typeof row === 'object' && !Array.isArray(row))
    .map(sanitizeProviderConnection)
}

export function normalizeProviderConnectionPatch(
  input: Record<string, unknown>,
  {
    actorId,
    existing,
  }: {
    actorId: string
    existing?: Record<string, unknown> | null
  },
) {
  if (hasForbiddenSecretInput(input)) {
    return { data: null, error: 'SECRET_INPUT_NOT_ALLOWED' }
  }

  const isCreate = !existing
  const patch: Record<string, unknown> = {
    updated_by: actorId,
  }

  const provider = normalizeEnum(input.provider, PROVIDERS, String(existing?.provider ?? ''))
  if (isCreate) {
    if (!provider) return { data: null, error: 'INVALID_REQUEST' }
    patch.provider = provider
    patch.created_by = actorId
  } else if (input.provider !== undefined && provider !== existing?.provider) {
    return { data: null, error: 'PROVIDER_IMMUTABLE' }
  }

  if (existing?.status === 'archived') {
    return { data: null, error: 'CONNECTION_ARCHIVED' }
  }

  const displayName = normalizeString(input.displayName ?? input.display_name, 160)
  if (isCreate && !displayName) return { data: null, error: 'INVALID_REQUEST' }
  if (displayName) patch.display_name = displayName

  const ownerScope = normalizeEnum(input.ownerScope ?? input.owner_scope, OWNER_SCOPES, isCreate ? 'doctoleb' : '')
  if (ownerScope) patch.owner_scope = ownerScope

  const authMethod = normalizeEnum(input.authMethod ?? input.auth_method, AUTH_METHODS, isCreate ? 'oauth' : '')
  if (authMethod) patch.auth_method = authMethod

  const status = normalizeEnum(input.status, CONNECTION_STATUSES, isCreate ? 'pending_authorization' : '')
  if (status === 'archived') return { data: null, error: 'USE_ARCHIVE_ENDPOINT' }
  if (status) patch.status = status

  if (input.isAutomationEnabled !== undefined || input.is_automation_enabled !== undefined || isCreate) {
    patch.is_automation_enabled = normalizeBoolean(
      input.isAutomationEnabled ?? input.is_automation_enabled,
      Boolean(existing?.is_automation_enabled ?? false),
    )
  }

  for (const [inputKey, column, max] of [
    ['externalAccountId', 'external_account_id', 200],
    ['external_account_id', 'external_account_id', 200],
    ['externalAccountSlug', 'external_account_slug', 200],
    ['external_account_slug', 'external_account_slug', 200],
    ['externalTeamId', 'external_team_id', 200],
    ['external_team_id', 'external_team_id', 200],
    ['externalOrgId', 'external_org_id', 200],
    ['external_org_id', 'external_org_id', 200],
  ] as const) {
    if (inputKey in input) patch[column] = normalizeNullableString(input[inputKey], max)
  }

  if ('capabilities' in input) {
    patch.capabilities = normalizeObject(input.capabilities)
  } else if (isCreate) {
    patch.capabilities = {}
  }

  const secretStorage = normalizeEnum(
    input.secretStorage ?? input.secret_storage,
    SECRET_STORAGES,
    isCreate ? 'edge_function_secret' : '',
  )
  if (secretStorage) patch.secret_storage = secretStorage

  if ('secretRef' in input || 'secret_ref' in input) {
    const secretRef = normalizeSecretRef(input.secretRef ?? input.secret_ref)
    if (secretRef.error) return { data: null, error: secretRef.error }
    patch.secret_ref = secretRef.data
    patch.secret_last_rotated_at = secretRef.data ? new Date().toISOString() : null
  }

  const nextStatus = String(patch.status ?? existing?.status ?? '')
  const nextSecretStorage = String(patch.secret_storage ?? existing?.secret_storage ?? 'none')
  const nextSecretRef = patch.secret_ref !== undefined ? patch.secret_ref : existing?.secret_ref
  const automationEnabled = Boolean(patch.is_automation_enabled ?? existing?.is_automation_enabled ?? false)

  if (automationEnabled && !['edge_function_secret', 'supabase_vault'].includes(nextSecretStorage)) {
    return { data: null, error: 'UNSUPPORTED_AUTOMATION_SECRET_STORAGE' }
  }

  if (automationEnabled && nextSecretStorage === 'edge_function_secret' && typeof nextSecretRef === 'string' && !EDGE_FUNCTION_SECRET_REF.test(nextSecretRef)) {
    return { data: null, error: 'INVALID_EDGE_SECRET_REF' }
  }

  if (automationEnabled && nextSecretStorage === 'supabase_vault' && typeof nextSecretRef === 'string' && !VAULT_SECRET_REF.test(nextSecretRef)) {
    return { data: null, error: 'INVALID_EDGE_SECRET_REF' }
  }

  if (automationEnabled && (nextStatus !== 'active' || nextSecretStorage === 'none' || !nextSecretRef)) {
    return { data: null, error: 'INVALID_AUTOMATION_STATE' }
  }

  return { data: patch, error: null }
}

export function providerConnectionErrorStatus(code: string) {
  const statuses: Record<string, number> = {
    INVALID_REQUEST: 400,
    SECRET_INPUT_NOT_ALLOWED: 400,
    INVALID_EDGE_SECRET_REF: 400,
    INVALID_AUTOMATION_STATE: 409,
    UNSUPPORTED_AUTOMATION_SECRET_STORAGE: 409,
    PROVIDER_IMMUTABLE: 409,
    USE_ARCHIVE_ENDPOINT: 409,
    CONNECTION_ARCHIVED: 409,
    CONNECTION_NOT_FOUND: 404,
    CONNECTION_IN_USE: 409,
    PROVIDER_ACCOUNT_ALREADY_CONNECTED: 409,
  }
  return statuses[code] ?? 500
}

export function providerConnectionDbErrorCode(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return 'PROVIDER_CONNECTION_SAVE_FAILED'
  if (error.code === '23505') return 'PROVIDER_ACCOUNT_ALREADY_CONNECTED'
  if (error.code === '23514') return 'INVALID_REQUEST'
  return 'PROVIDER_CONNECTION_SAVE_FAILED'
}
