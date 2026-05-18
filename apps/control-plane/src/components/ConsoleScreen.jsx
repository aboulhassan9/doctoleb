import { lazy, Suspense, useEffect, useState } from 'react'
import { useTenantList } from '../hooks/useTenantList'
import { useTenantDetail } from '../hooks/useTenantDetail'
import { useProviderConnections } from '../hooks/useProviderConnections'
import { controlPlaneApi } from '../lib/controlPlaneApi'
import { SecondaryButton } from './ui'
import TenantList from './TenantList'
import DomainsPanel from './DomainsPanel'
import AuditPanel from './AuditPanel'
import TenantControls from './TenantControls'
import FirstDoctorAdminPanel from './FirstDoctorAdminPanel'
import BrandingPanel from './BrandingPanel'
import EntitlementsPanel from './EntitlementsPanel'
import RuntimeConfigPanel from './RuntimeConfigPanel'
import ProvisioningStepsPanel from './ProvisioningStepsPanel'
import ConsoleWorkspaceTabs, { getControlPlaneSection } from './ConsoleWorkspaceTabs'
import TenantReadinessPanel from './TenantReadinessPanel'
import TenantCreationWorkspace from './TenantCreationWorkspace'
import ConsoleSidebar from './ConsoleSidebar'
import ConsoleHeader from './ConsoleHeader'

const DashboardScreen = lazy(() => import('./DashboardScreen'))
const AnalyticsScreen = lazy(() => import('./AnalyticsScreen'))
const SettingsScreen = lazy(() => import('./SettingsScreen'))

const AUTH_ERROR_CODES = new Set(['AUTH_REQUIRED', 'JWT_EXPIRED', 'INVALID_JWT'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i
const TENANT_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const TENANT_PRIVILEGED_SECRET_KIND = ['service', 'role', 'key'].join('_')

function isAuthError(error) {
  return AUTH_ERROR_CODES.has(String(error || '').toUpperCase())
}

function isUuid(value) {
  return UUID.test(String(value || ''))
}

function isTenantSlug(value) {
  return TENANT_SLUG.test(String(value || ''))
}

function WorkspaceScreenFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <span className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">
        Loading...
      </span>
    </div>
  )
}

export default function ConsoleScreen({ session, onSignOut }) {
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [workspaceMode, setWorkspaceMode] = useState('tenant')
  const [tenantQuery, setTenantQuery] = useState('')
  const [activeSection, setActiveSection] = useState('tenant')
  const [runningStepId, setRunningStepId] = useState(null)
  const [cancellingJob, setCancellingJob] = useState(false)
  const [resumingJob, setResumingJob] = useState(false)
  const [compensatingStepId, setCompensatingStepId] = useState(null)
  const [storingTenantSecret, setStoringTenantSecret] = useState(false)
  const [provisioningRunMessage, setProvisioningRunMessage] = useState('')
  const [seedingTenant, setSeedingTenant] = useState(false)
  const [tenantSeedMessage, setTenantSeedMessage] = useState('')
  const [tenantSeedResult, setTenantSeedResult] = useState(null)

  const {
    tenants,
    loading,
    error: listError,
    reload: reloadTenants,
  } = useTenantList()

  const tenantDetailId = workspaceMode === 'tenant' ? selectedTenant?.id : null

  const {
    tenantDetail,
    error: detailError,
    reload: reloadTenantDetail,
  } = useTenantDetail(tenantDetailId)

  const {
    connections: providerConnections,
    loading: providerConnectionsLoading,
    error: providerConnectionsError,
    reload: reloadProviderConnections,
  } = useProviderConnections()

  const tenant = workspaceMode === 'tenant' ? tenantDetail?.tenant || selectedTenant : null
  const error = listError || detailError || providerConnectionsError
  const authError = isAuthError(error)
  const provisioningJob = [...(tenant?.tenant_provisioning_jobs || [])]
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0]
  const section = getControlPlaneSection(activeSection)
  const tenantQueryText = tenantQuery.trim().toLowerCase()
  const visibleTenants = tenantQueryText
    ? tenants.filter((item) =>
        `${item.display_name || ''} ${item.slug || ''}`.toLowerCase().includes(tenantQueryText),
      )
    : tenants

  function handleSelectTenant(tenantToOpen) {
    setSelectedTenant(tenantToOpen)
    setWorkspaceMode('tenant')
  }

  function handleCreateTenant() {
    setWorkspaceMode('create')
  }

  function handleCancelCreateTenant() {
    setWorkspaceMode('tenant')
  }

  async function handleProvisioningCreated(result) {
    const nextTenants = await reloadTenants()
    const tenantId = result?.tenant?.id || result?.provisioningJob?.tenant_id
    const createdTenant = tenantId ? nextTenants.find((item) => item.id === tenantId) : null
    if (createdTenant) setSelectedTenant(createdTenant)
    setWorkspaceMode('tenant')
    setActiveSection('provisioning')
  }

  async function handleRunProvisioningStep(step) {
    if (!tenant?.id || !step?.id) return

    setRunningStepId(step.id)
    setProvisioningRunMessage('')

    try {
      const result = await controlPlaneApi.runProvisioningStep({ tenantId: tenant.id, stepId: step.id })
      if (result.error) {
        setProvisioningRunMessage(result.details?.summary || result.error)
      } else {
        setProvisioningRunMessage(result.data?.result?.summary || 'Provisioning step check completed.')
      }
      await reloadTenantDetail()
      await reloadTenants()
    } finally {
      setRunningStepId(null)
    }
  }

  async function handleCancelProvisioningJob(job) {
    if (!job?.id) return

    setCancellingJob(true)
    setProvisioningRunMessage('')

    try {
      const result = await controlPlaneApi.cancelProvisioningJob({
        jobId: job.id,
        reason: 'Cancelled from control-plane console',
      })
      setProvisioningRunMessage(result.error || 'Provisioning job cancelled.')
      await reloadTenantDetail()
      await reloadTenants()
    } finally {
      setCancellingJob(false)
    }
  }

  async function handleResumeProvisioningJob(job) {
    const tenantId = tenant?.id || tenantDetail?.tenant?.id || selectedTenant?.id
    const tenantSlug = tenant?.slug || tenantDetail?.tenant?.slug || selectedTenant?.slug
    const previousJobId = job?.id || provisioningJob?.id
    if (!isUuid(tenantId) && !isUuid(previousJobId) && !isTenantSlug(tenantSlug)) {
      setProvisioningRunMessage('Resume needs the selected tenant or the latest provisioning job. Reopen the tenant and try again.')
      return
    }

    setResumingJob(true)
    setProvisioningRunMessage('')

    try {
      const result = await controlPlaneApi.resumeProvisioningJob({
        tenantId: isUuid(tenantId) ? tenantId : undefined,
        tenantSlug: isTenantSlug(tenantSlug) ? tenantSlug : undefined,
        previousJobId: isUuid(previousJobId) ? previousJobId : undefined,
        reason: 'Resumed from control-plane console after cancellation or blocked recovery',
      })
      setProvisioningRunMessage(result.error || 'Provisioning resumed. Continue from the next safe readiness step.')
      await reloadTenantDetail()
      await reloadTenants()
    } finally {
      setResumingJob(false)
    }
  }

  async function handleCompensateProvisioningStep(step) {
    if (!step?.id) return

    setCompensatingStepId(step.id)
    setProvisioningRunMessage('')

    try {
      const result = await controlPlaneApi.compensateProvisioningStep({ stepId: step.id })
      setProvisioningRunMessage(result.error || 'Provisioning step compensated.')
      await reloadTenantDetail()
      await reloadTenants()
    } finally {
      setCompensatingStepId(null)
    }
  }

  async function handleStoreTenantSecret({ secretValue, secretKind = TENANT_PRIVILEGED_SECRET_KIND }) {
    if (!tenant?.id || !tenant?.supabase_project_ref) {
      setProvisioningRunMessage('Save the tenant runtime project ref before storing tenant setup secrets.')
      return { data: null, error: 'RUNTIME_CONFIG_REQUIRED' }
    }

    setStoringTenantSecret(true)
    setProvisioningRunMessage('')

    try {
      const result = await controlPlaneApi.upsertTenantSecret({
        tenantId: tenant.id,
        projectRef: tenant.supabase_project_ref,
        secretKind,
        secretStorage: 'supabase_vault',
        secretValue,
      })
      setProvisioningRunMessage((result.error
        ? (result.details?.summary || result.error)
        : (secretKind === 'database_url'
        ? 'Tenant database connection stored in Vault. Run database setup again.'
        : 'Tenant setup secret stored in Vault. Continue the readiness checks.')))
      if (!result.error) await reloadTenantDetail()
      return result
    } finally {
      setStoringTenantSecret(false)
    }
  }

  async function handleSeedTenantOperationalData({ mode = 'dry_run', volume = 'tiny', seedTag, allowDuplicates = false }) {
    if (!tenant?.id) {
      setTenantSeedMessage('Open an active tenant before running synthetic operational data.')
      return { data: null, error: 'TENANT_REQUIRED' }
    }

    setSeedingTenant(true)
    setTenantSeedMessage('')
    setTenantSeedResult(null)

    try {
      const result = await controlPlaneApi.seedTenantOperationalData({
        tenantId: tenant.id,
        mode,
        volume,
        seedTag,
        allowDuplicates,
      })
      setTenantSeedResult(result)
      setTenantSeedMessage(result.error
        ? (result.details?.summary || result.error)
        : (mode === 'dry_run'
          ? 'Dry run passed. The tenant is ready for synthetic operational data.'
          : 'Synthetic operational data seeded successfully.'))
      await reloadTenantDetail()
      return result
    } finally {
      setSeedingTenant(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
      <ConsoleSidebar
        selectedTenant={selectedTenant}
        workspaceMode={workspaceMode}
        onNavigate={(mode) => {
          setSelectedTenant(null);
          setWorkspaceMode(mode);
        }}
        onCreateTenant={handleCreateTenant}
        onSignOut={onSignOut}
      />

      {/* Main Canvas Wrapper */}
      <main className="relative z-10 ml-64 flex w-full flex-1 flex-col overflow-hidden bg-slate-50">
        <ConsoleHeader
          selectedTenant={selectedTenant}
          workspaceMode={workspaceMode}
          onBack={() => setSelectedTenant(null)}
          userEmail={session?.user?.email}
          tenantQuery={tenantQuery}
          onTenantQueryChange={setTenantQuery}
        />

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 pb-12">
          {loading ? (
            <p className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">
              Loading tenants...
            </p>
          ) : null}

          {authError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm font-semibold text-amber-900">Admin session expired</p>
              <p className="mt-1 text-sm text-amber-700">
                The control-plane API rejected the current browser token. Sign in again.
              </p>
              <div className="mt-4">
                <SecondaryButton onClick={onSignOut}>Sign in again</SecondaryButton>
              </div>
            </div>
          ) : error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm font-medium text-rose-700">
              {error}
            </p>
          ) : null}

          {workspaceMode === 'create' ? (
            <TenantCreationWorkspace
              providerConnections={providerConnections}
              providerConnectionsLoading={providerConnectionsLoading}
              selectedTenant={selectedTenant}
              onCancel={handleCancelCreateTenant}
              onProviderConnectionsChanged={reloadProviderConnections}
              onProvisioningCreated={handleProvisioningCreated}
            />
          ) : selectedTenant ? (
            <div className="grid gap-6">
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                  {section.eyebrow}
                </p>
                <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-slate-900">{section.label}</h2>
                    <p className="mt-1 text-sm text-slate-500">{section.description}</p>
                  </div>
                  {tenant?.slug ? (
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-600">
                      {tenant.slug}
                    </span>
                  ) : null}
                </div>
              </div>

              <ConsoleWorkspaceTabs activeSection={activeSection} onSectionChange={setActiveSection} />

              <div role="tabpanel" id={`control-plane-section-${section.id}`} aria-labelledby={`control-plane-tab-${section.id}`} className="grid gap-6">
                {tenant && activeSection === 'tenant' ? (
                  <>
                    <TenantReadinessPanel tenant={tenant} />
                    <TenantControls tenant={tenant} onSaved={() => { void reloadTenants(); void reloadTenantDetail() }} />
                    <FirstDoctorAdminPanel tenant={tenant} onSaved={() => { void reloadTenants(); void reloadTenantDetail() }} />
                    <RuntimeConfigPanel tenant={tenant} onSaved={() => { void reloadTenants(); void reloadTenantDetail() }} />
                  </>
                ) : null}

                {tenant && activeSection === 'domains' ? (
                  <DomainsPanel tenant={tenant} onSaved={() => { void reloadTenants(); void reloadTenantDetail() }} />
                ) : null}

                {tenant && activeSection === 'provisioning' ? (
                  <ProvisioningStepsPanel
                    tenant={tenant}
                    steps={tenantDetail?.provisioningSteps || []}
                    migrationRuns={tenantDetail?.migrationRuns || []}
                    job={provisioningJob}
                    onRunStep={handleRunProvisioningStep}
                    onCancelJob={handleCancelProvisioningJob}
                    onResumeJob={handleResumeProvisioningJob}
                    onCompensateStep={handleCompensateProvisioningStep}
                    onStoreTenantSecret={handleStoreTenantSecret}
                    onSeedTenantOperationalData={handleSeedTenantOperationalData}
                    runningStepId={runningStepId}
                    cancellingJob={cancellingJob}
                    resumingJob={resumingJob}
                    compensatingStepId={compensatingStepId}
                    storingTenantSecret={storingTenantSecret}
                    seedingTenant={seedingTenant}
                    runMessage={provisioningRunMessage}
                    seedMessage={tenantSeedMessage}
                    seedResult={tenantSeedResult}
                  />
                ) : null}

                {tenant && activeSection === 'branding' ? (
                  <BrandingPanel
                    tenant={tenant}
                    runtimeBranding={tenantDetail?.runtimeBranding}
                    runtimeBrandingError={tenantDetail?.runtimeBrandingError}
                    onSaved={() => { void reloadTenants(); void reloadTenantDetail() }}
                  />
                ) : null}

                {tenant && activeSection === 'features' ? (
                  <EntitlementsPanel
                    tenant={tenant}
                    planEntitlements={tenantDetail?.planEntitlements || []}
                    onSaved={() => { void reloadTenants(); void reloadTenantDetail() }}
                  />
                ) : null}

                {tenant && activeSection === 'audit' ? <AuditPanel events={tenantDetail?.events || []} /> : null}
              </div>
            </div>
          ) : (
            <Suspense fallback={<WorkspaceScreenFallback />}>
              {workspaceMode === 'dashboard' ? (
                <DashboardScreen
                  tenants={tenants}
                  loading={loading}
                  onSelectTenant={handleSelectTenant}
                  onCreateTenant={handleCreateTenant}
                />
              ) : workspaceMode === 'analytics' ? (
                <AnalyticsScreen tenants={tenants} />
              ) : workspaceMode === 'settings' ? (
                <SettingsScreen
                  providerConnections={providerConnections}
                  providerConnectionsLoading={providerConnectionsLoading}
                  onProviderConnectionsChanged={reloadProviderConnections}
                  session={session}
                  onSignOut={onSignOut}
                />
              ) : (
                <TenantList
                  tenants={visibleTenants}
                  selectedTenantId={null}
                  isCreatingTenant={false}
                  onCreateTenant={handleCreateTenant}
                  onSelect={handleSelectTenant}
                />
              )}
            </Suspense>
          )}
        </div>
      </main>
    </div>
  )
}
