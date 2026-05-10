import { useEffect, useState } from 'react'
import { useTenantList } from '../hooks/useTenantList'
import { useTenantDetail } from '../hooks/useTenantDetail'
import { useProviderConnections } from '../hooks/useProviderConnections'
import { controlPlaneApi } from '../lib/controlPlaneApi'
import { SecondaryButton } from './ui'
import TenantList from './TenantList'
import DomainsPanel from './DomainsPanel'
import AuditPanel from './AuditPanel'
import TenantControls from './TenantControls'
import BrandingPanel from './BrandingPanel'
import EntitlementsPanel from './EntitlementsPanel'
import RuntimeConfigPanel from './RuntimeConfigPanel'
import ProvisioningStepsPanel from './ProvisioningStepsPanel'
import ConsoleWorkspaceTabs, { getControlPlaneSection } from './ConsoleWorkspaceTabs'
import TenantReadinessPanel from './TenantReadinessPanel'
import TenantCreationWorkspace from './TenantCreationWorkspace'

const AUTH_ERROR_CODES = new Set(['AUTH_REQUIRED', 'JWT_EXPIRED', 'INVALID_JWT'])

function isAuthError(error) {
  return AUTH_ERROR_CODES.has(String(error || '').toUpperCase())
}

export default function ConsoleScreen({ session, onSignOut }) {
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [workspaceMode, setWorkspaceMode] = useState('tenant')
  const [activeSection, setActiveSection] = useState('tenant')
  const [runningStepId, setRunningStepId] = useState(null)
  const [cancellingJob, setCancellingJob] = useState(false)
  const [resumingJob, setResumingJob] = useState(false)
  const [compensatingStepId, setCompensatingStepId] = useState(null)
  const [provisioningRunMessage, setProvisioningRunMessage] = useState('')
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

  useEffect(() => {
    if (!selectedTenant && tenants[0]) setSelectedTenant(tenants[0])
  }, [selectedTenant, tenants])

  const tenant = workspaceMode === 'tenant' ? tenantDetail?.tenant || selectedTenant : null
  const error = listError || detailError || providerConnectionsError
  const authError = isAuthError(error)
  const provisioningJob = [...(tenant?.tenant_provisioning_jobs || [])]
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0]
  const section = getControlPlaneSection(activeSection)

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
    const previousJobId = job?.id || provisioningJob?.id
    if (!tenantId && !previousJobId) {
      setProvisioningRunMessage('Resume needs the selected tenant or the latest provisioning job. Reopen the tenant and try again.')
      return
    }

    setResumingJob(true)
    setProvisioningRunMessage('')

    try {
      const result = await controlPlaneApi.resumeProvisioningJob({
        tenantId,
        previousJobId,
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

  return (
    <main className="min-h-screen bg-[#eef5f2] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-[#eef5f2]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-700">DoctoLeb SaaS</p>
            <h1 className="text-2xl font-black">Control plane</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-semibold text-slate-500 sm:inline">{session?.user?.email}</span>
            <SecondaryButton onClick={onSignOut}>Sign out</SecondaryButton>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[330px_1fr]">
        <TenantList
          tenants={tenants}
          selectedTenantId={selectedTenant?.id}
          isCreatingTenant={workspaceMode === 'create'}
          onCreateTenant={handleCreateTenant}
          onSelect={handleSelectTenant}
        />
        <section className="grid gap-5">
          {loading ? <p className="rounded-[2rem] bg-white p-6 text-sm font-semibold text-slate-500">Loading tenants...</p> : null}
          {authError ? (
            <div className="rounded-[2rem] bg-amber-50 p-6 text-sm font-bold text-amber-900 ring-1 ring-amber-100">
              <p className="text-base font-black">Admin session expired</p>
              <p className="mt-1 font-semibold">
                The control-plane API rejected the current browser token. Sign in again, then reopen the tenant and continue provisioning.
              </p>
              <div className="mt-4">
                <SecondaryButton onClick={onSignOut}>Sign in again</SecondaryButton>
              </div>
            </div>
          ) : error ? (
            <p className="rounded-[2rem] bg-rose-50 p-6 text-sm font-bold text-rose-700">{error}</p>
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
          ) : (
            <>
              <ConsoleWorkspaceTabs activeSection={activeSection} onSectionChange={setActiveSection} />
              <div
                role="tabpanel"
                id={`control-plane-section-${section.id}`}
                aria-labelledby={`control-plane-tab-${section.id}`}
                className="grid gap-5"
              >
                <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-700">{section.eyebrow}</p>
                  <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h2 className="text-2xl font-black">{section.label}</h2>
                      <p className="mt-1 text-sm font-semibold text-slate-500">{section.description}</p>
                    </div>
                    {tenant?.slug ? (
                      <p className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                        {tenant.slug}
                      </p>
                    ) : null}
                  </div>
                </div>

                {tenant && activeSection === 'tenant' ? (
                  <>
                    <TenantReadinessPanel tenant={tenant} />
                    <TenantControls tenant={tenant} onSaved={() => { void reloadTenants(); void reloadTenantDetail() }} />
                    <RuntimeConfigPanel tenant={tenant} onSaved={() => { void reloadTenants(); void reloadTenantDetail() }} />
                  </>
                ) : null}

                {tenant && activeSection === 'domains' ? (
                  <DomainsPanel tenant={tenant} onSaved={() => { void reloadTenants(); void reloadTenantDetail() }} />
                ) : null}

                {tenant && activeSection === 'provisioning' ? (
                  <ProvisioningStepsPanel
                    steps={tenantDetail?.provisioningSteps || []}
                    job={provisioningJob}
                    onRunStep={handleRunProvisioningStep}
                    onCancelJob={handleCancelProvisioningJob}
                    onResumeJob={handleResumeProvisioningJob}
                    onCompensateStep={handleCompensateProvisioningStep}
                    runningStepId={runningStepId}
                    cancellingJob={cancellingJob}
                    resumingJob={resumingJob}
                    compensatingStepId={compensatingStepId}
                    runMessage={provisioningRunMessage}
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

                {!tenant ? (
                  <p className="rounded-[2rem] bg-white p-6 text-sm font-semibold text-slate-500">No tenant selected yet. Use + New tenant to create one, or choose an existing tenant.</p>
                ) : null}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
