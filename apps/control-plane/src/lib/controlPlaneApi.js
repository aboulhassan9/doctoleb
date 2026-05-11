import { createControlPlaneClient } from './controlPlaneClient'

let client = null
const pendingAdminRequestControllers = new Set()
const TOKEN_REFRESH_SKEW_SECONDS = 60
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i
const TENANT_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

export function getControlPlaneClient() {
  if (!client) client = createControlPlaneClient()
  return client
}

function abortPendingAdminRequests() {
  for (const controller of pendingAdminRequestControllers) {
    controller.abort()
  }
  pendingAdminRequestControllers.clear()
}

function getControlPlaneProjectRef() {
  try {
    return new URL(import.meta.env.VITE_CONTROL_PLANE_SUPABASE_URL || '').hostname.split('.')[0] || ''
  } catch {
    return ''
  }
}

function removeStorageKeys(storage, predicate) {
  if (!storage) return
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index)
    if (key && predicate(key)) storage.removeItem(key)
  }
}

function clearPersistedControlPlaneAuthSession() {
  if (typeof window === 'undefined') return
  const projectRef = getControlPlaneProjectRef()
  const isControlPlaneAuthKey = (key) => {
    if (!projectRef) return key.startsWith('sb-') && key.endsWith('-auth-token')
    return key === `sb-${projectRef}-auth-token` || key.includes(projectRef)
  }

  removeStorageKeys(window.localStorage, isControlPlaneAuthKey)
  removeStorageKeys(window.sessionStorage, isControlPlaneAuthKey)
}

function decodeJwtExpiry(accessToken) {
  try {
    const payload = accessToken.split('.')[1]
    if (!payload) return 0
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = JSON.parse(atob(normalized))
    return typeof decoded.exp === 'number' ? decoded.exp : 0
  } catch {
    return 0
  }
}

function shouldRefreshToken(accessToken) {
  const expiresAt = decodeJwtExpiry(accessToken)
  if (!expiresAt) return true
  return expiresAt <= Math.floor(Date.now() / 1000) + TOKEN_REFRESH_SKEW_SECONDS
}

async function readFunctionHttpError(error) {
  const response = error?.context
  if (!response || typeof response.json !== 'function') return null

  try {
    const payload = await response.json()
    if (payload && typeof payload === 'object' && ('data' in payload || 'error' in payload)) {
      return {
        data: payload.data ?? null,
        error: payload.error ?? error?.message ?? 'REQUEST_FAILED',
        details: payload.details ?? null,
        status: response.status ?? null,
      }
    }
  } catch {
    // Supabase FunctionsHttpError sometimes has a consumed or non-JSON body.
  }

  return null
}

async function getFreshAccessToken() {
  const auth = getControlPlaneClient().auth
  let { data, error } = await auth.getSession()
  if (error) return { data: null, error: 'AUTH_REQUIRED' }

  let session = data?.session
  if (session?.access_token && shouldRefreshToken(session.access_token)) {
    const refreshed = await auth.refreshSession()
    if (refreshed.error) return { data: null, error: 'AUTH_REQUIRED' }
    session = refreshed.data?.session ?? null
  }

  return { data: session?.access_token ?? null, error: session?.access_token ? null : 'AUTH_REQUIRED' }
}

async function normalizeFunctionResult(result) {
  if (result.error) {
    const httpError = await readFunctionHttpError(result.error)
    if (httpError) return httpError
    return { data: null, error: result.error.message || 'REQUEST_FAILED' }
  }

  const payload = result.data
  if (payload && typeof payload === 'object' && ('data' in payload || 'error' in payload)) {
    return {
      data: payload.data ?? null,
      error: payload.error ?? null,
      details: payload.details ?? null,
    }
  }

  return { data: payload ?? null, error: null }
}

async function invokeAdminFunction(name, body = {}, options = {}) {
  if (options.signal?.aborted) return { data: null, error: 'ABORTED' }

  const controller = new AbortController()
  pendingAdminRequestControllers.add(controller)

  const abortFromCaller = () => controller.abort()
  options.signal?.addEventListener('abort', abortFromCaller, { once: true })

  try {
    const tokenResult = await getFreshAccessToken()
    if (tokenResult.error || !tokenResult.data) return { data: null, error: tokenResult.error || 'AUTH_REQUIRED' }

    const result = await getControlPlaneClient().functions.invoke(name, {
      body,
      headers: {
        Authorization: `Bearer ${tokenResult.data}`,
      },
      signal: controller.signal,
    })
    if (controller.signal.aborted) return { data: null, error: 'ABORTED' }
    return normalizeFunctionResult(result)
  } catch (error) {
    if (controller.signal.aborted) return { data: null, error: 'ABORTED' }
    const httpError = await readFunctionHttpError(error)
    if (httpError) return httpError
    return { data: null, error: error?.message || 'REQUEST_FAILED' }
  } finally {
    options.signal?.removeEventListener('abort', abortFromCaller)
    pendingAdminRequestControllers.delete(controller)
  }
}

function hasResumeTarget(payload) {
  return Boolean(
    UUID.test(String(payload.tenantId || payload.tenant_id || ''))
      || UUID.test(String(payload.previousJobId || payload.previous_job_id || payload.jobId || payload.provisioningJobId || payload.provisioning_job_id || ''))
      || TENANT_SLUG.test(String(payload.tenantSlug || payload.tenant_slug || payload.slug || '')),
  )
}

export const controlPlaneApi = {
  abortPendingAdminRequests,

  onAuthStateChange(callback) {
    return getControlPlaneClient().auth.onAuthStateChange(callback)
  },

  async getSession() {
    const { data, error } = await getControlPlaneClient().auth.getSession()
    return { data: data?.session ?? null, error: error?.message ?? null }
  },

  async signIn(email, password) {
    const { data, error } = await getControlPlaneClient().auth.signInWithPassword({ email, password })
    return { data: data?.session ?? null, error: error?.message ?? null }
  },

  async signOut() {
    try {
      const { error } = await getControlPlaneClient().auth.signOut({ scope: 'local' })
      return { data: null, error: error?.message ?? null }
    } finally {
      clearPersistedControlPlaneAuthSession()
    }
  },

  listTenants(options) {
    return invokeAdminFunction('admin-list-tenants', {}, options)
  },

  getTenant(tenantId, options) {
    return invokeAdminFunction('admin-get-tenant', { tenantId }, options)
  },

  updateTenant({ tenantId, patch, domains }) {
    return invokeAdminFunction('admin-update-tenant', { tenantId, patch, domains })
  },

  syncTenantConfig({ tenantId, branding }) {
    return invokeAdminFunction('admin-sync-tenant-config', { tenantId, branding })
  },

  syncEntitlements({ tenantId, entitlements }) {
    return invokeAdminFunction('admin-sync-entitlements', { tenantId, entitlements })
  },

  setTenantRuntimeConfig(payload) {
    return invokeAdminFunction('admin-set-tenant-runtime-config', payload)
  },

  createProvisioningJob(payload) {
    return invokeAdminFunction('admin-create-provisioning-job', payload)
  },

  runProvisioningStep(payload) {
    return invokeAdminFunction('admin-run-provisioning-step', payload)
  },

  cancelProvisioningJob(payload) {
    return invokeAdminFunction('admin-cancel-provisioning-job', payload)
  },

  resumeProvisioningJob(payload = {}) {
    if (!hasResumeTarget(payload)) {
      return { data: null, error: 'RESUME_TARGET_REQUIRED' }
    }
    return invokeAdminFunction('admin-resume-provisioning-job', payload)
  },

  compensateProvisioningStep(payload) {
    return invokeAdminFunction('admin-compensate-provisioning-step', payload)
  },

  listProviderConnections(payload = {}, options) {
    return invokeAdminFunction('admin-list-provider-connections', payload, options)
  },

  upsertProviderConnection(payload) {
    return invokeAdminFunction('admin-upsert-provider-connection', payload)
  },

  archiveProviderConnection(payload) {
    return invokeAdminFunction('admin-archive-provider-connection', payload)
  },

  storeProviderSecret(payload) {
    return invokeAdminFunction('admin-store-provider-secret', payload)
  },

  listTenantDbSetup(payload = {}, options) {
    return invokeAdminFunction('admin-list-tenant-db-setup', payload, options)
  },

  upsertTenantSecret(payload) {
    return invokeAdminFunction('admin-upsert-tenant-secret', payload)
  },

  revokeTenantSecret(payload) {
    return invokeAdminFunction('admin-revoke-tenant-secret', payload)
  },
}
