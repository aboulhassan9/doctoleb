export const PROVIDER_OPTIONS = Object.freeze([
  { value: 'supabase', label: 'Supabase' },
  { value: 'vercel', label: 'Vercel' },
])

export const OWNER_SCOPE_OPTIONS = Object.freeze([
  { value: 'doctoleb', label: 'DoctoLeb-owned' },
  { value: 'customer', label: 'Customer-owned' },
  { value: 'partner', label: 'Partner-owned' },
])

export const AUTH_METHOD_OPTIONS = Object.freeze([
  { value: 'oauth', label: 'OAuth / app install' },
  { value: 'personal_access_token', label: 'Personal access token' },
  { value: 'service_account', label: 'Service account' },
  { value: 'manual', label: 'Manual verification' },
])

export const CONNECTION_STATUS_OPTIONS = Object.freeze([
  { value: 'pending_authorization', label: 'Pending authorization' },
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'revoked', label: 'Revoked' },
  { value: 'error', label: 'Error' },
])

export const SECRET_STORAGE_OPTIONS = Object.freeze([
  { value: 'edge_function_secret', label: 'Edge Function secret' },
  { value: 'supabase_vault', label: 'Supabase Vault' },
  { value: 'external_secret_manager', label: 'External secret manager' },
  { value: 'none', label: 'No secret yet' },
])

export const AUTOMATION_MODE_OPTIONS = Object.freeze([
  { value: 'manual', label: 'Manual checklist' },
  { value: 'assisted', label: 'Assisted automation' },
  { value: 'automatic', label: 'Automatic when authorized' },
])

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TOKENISH_SECRET = /(eyJ|sbp_|vcp_|sk_live_|sk_test_)/i
const EDGE_FUNCTION_SECRET_REF = /^[A-Z][A-Z0-9_]{2,200}$/

export function normalizeProviderConnectionId(value) {
  const id = String(value || '').trim().toLowerCase()
  return UUID.test(id) ? id : ''
}

export function normalizeProvisioningAutomationMode(value) {
  const mode = String(value || '').trim().toLowerCase()
  return AUTOMATION_MODE_OPTIONS.some((item) => item.value === mode) ? mode : 'manual'
}

export function connectionCanAutomate(connection, provider) {
  return Boolean(
    connection
      && connection.provider === provider
      && connection.status === 'active'
      && connection.is_automation_enabled === true
      && connection.has_secret_ref === true,
  )
}

export function filterAutomatableConnections(connections, provider) {
  return (connections || []).filter((connection) => connectionCanAutomate(connection, provider))
}

export function validateProvisioningProviderSelection({
  automationMode,
  supabaseConnectionId,
  vercelConnectionId,
}) {
  const mode = normalizeProvisioningAutomationMode(automationMode)
  if (mode === 'manual') return ''
  if (!normalizeProviderConnectionId(supabaseConnectionId)) {
    return 'Assisted or automatic provisioning requires an active Supabase provider connection.'
  }
  if (!normalizeProviderConnectionId(vercelConnectionId)) {
    return 'Assisted or automatic provisioning requires an active Vercel provider connection.'
  }
  return ''
}

export function normalizeProviderConnectionDraft(input = {}) {
  return {
    provider: String(input.provider || 'supabase').trim().toLowerCase(),
    displayName: String(input.displayName || '').trim().slice(0, 160),
    ownerScope: String(input.ownerScope || 'doctoleb').trim().toLowerCase(),
    authMethod: String(input.authMethod || 'oauth').trim().toLowerCase(),
    status: String(input.status || 'pending_authorization').trim().toLowerCase(),
    isAutomationEnabled: input.isAutomationEnabled === true,
    externalAccountSlug: String(input.externalAccountSlug || '').trim().slice(0, 200),
    externalTeamId: String(input.externalTeamId || '').trim().slice(0, 200),
    externalOrgId: String(input.externalOrgId || '').trim().slice(0, 200),
    secretStorage: String(input.secretStorage || 'edge_function_secret').trim().toLowerCase(),
    secretRef: String(input.secretRef || '').trim().slice(0, 512),
  }
}

export function validateProviderConnectionDraft(input = {}) {
  const draft = normalizeProviderConnectionDraft(input)
  if (!PROVIDER_OPTIONS.some((item) => item.value === draft.provider)) return 'Provider is required.'
  if (!draft.displayName) return 'Connection display name is required.'
  if (!OWNER_SCOPE_OPTIONS.some((item) => item.value === draft.ownerScope)) return 'Owner scope is invalid.'
  if (!AUTH_METHOD_OPTIONS.some((item) => item.value === draft.authMethod)) return 'Authorization method is invalid.'
  if (!CONNECTION_STATUS_OPTIONS.some((item) => item.value === draft.status)) return 'Connection status is invalid.'
  if (!SECRET_STORAGE_OPTIONS.some((item) => item.value === draft.secretStorage)) return 'Secret storage is invalid.'
  if (draft.secretRef && TOKENISH_SECRET.test(draft.secretRef)) {
    return 'Paste a secret reference only, not a raw provider token or key.'
  }
  if (draft.isAutomationEnabled && draft.secretStorage !== 'edge_function_secret') {
    return 'Automation currently requires an Edge Function secret reference.'
  }
  if (draft.isAutomationEnabled && draft.secretStorage === 'edge_function_secret' && !EDGE_FUNCTION_SECRET_REF.test(draft.secretRef)) {
    return 'Automation Edge Function secret reference must be an uppercase Edge Function secret name.'
  }
  if (draft.isAutomationEnabled && (draft.status !== 'active' || draft.secretStorage === 'none' || !draft.secretRef)) {
    return 'Automation can be enabled only for an active connection with a server-side secret reference.'
  }
  return ''
}
