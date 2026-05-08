import { createControlPlaneClient } from './controlPlaneClient'

let client = null

export function getControlPlaneClient() {
  if (!client) client = createControlPlaneClient()
  return client
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

async function invokeAdminFunction(name, body = {}) {
  try {
    const result = await getControlPlaneClient().functions.invoke(name, { body })
    return normalizeFunctionResult(result)
  } catch (error) {
    return { data: null, error: error?.message || 'REQUEST_FAILED' }
  }
}

export const controlPlaneApi = {
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

  listTenants() {
    return invokeAdminFunction('admin-list-tenants')
  },

  getTenant(tenantId) {
    return invokeAdminFunction('admin-get-tenant', { tenantId })
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

  listProviderConnections(payload = {}) {
    return invokeAdminFunction('admin-list-provider-connections', payload)
  },

  upsertProviderConnection(payload) {
    return invokeAdminFunction('admin-upsert-provider-connection', payload)
  },

  archiveProviderConnection(payload) {
    return invokeAdminFunction('admin-archive-provider-connection', payload)
  },
}
