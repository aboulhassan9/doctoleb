import { createControlPlaneClient } from './controlPlaneClient'

let client = null
const pendingAdminRequestControllers = new Set()

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

function normalizeFunctionResult(result) {
  if (result.error) {
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
    const { data } = await getControlPlaneClient().auth.getSession()
    const accessToken = data?.session?.access_token
    if (!accessToken) return { data: null, error: 'AUTH_REQUIRED' }

    const result = await getControlPlaneClient().functions.invoke(name, {
      body,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    })
    if (controller.signal.aborted) return { data: null, error: 'ABORTED' }
    return normalizeFunctionResult(result)
  } catch (error) {
    if (controller.signal.aborted) return { data: null, error: 'ABORTED' }
    return { data: null, error: error?.message || 'REQUEST_FAILED' }
  } finally {
    options.signal?.removeEventListener('abort', abortFromCaller)
    pendingAdminRequestControllers.delete(controller)
  }
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
    const { error } = await getControlPlaneClient().auth.signOut()
    return { data: null, error: error?.message ?? null }
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

  resumeProvisioningJob(payload) {
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
}
