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
import SetupWorkspace from './SetupWorkspace'

export default function ConsoleScreen({ session, onSignOut }) {
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [activeSection, setActiveSection] = useState('setup')
  const [runningStepId, setRunningStepId] = useState(null)
  const [cancellingJob, setCancellingJob] = useState(false)
  const [compensatingStepId, setCompensatingStepId] = useState(null)
  const [provisioningRunMessage, setProvisioningRunMessage] = useState('')
  const {
    tenants,
    loading,
    error: listError,
    reload: reloadTenants,
  } = useTenantList()
  const tenantDetailId = activeSection === 'setup' ? null : selectedTenant?.id
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

  const tenant = tenantDetail?.tenant || selectedTenant
  const error = listError || detailError || providerConnectionsError
  const provisioningJob = [...(tenant?.tenant_provisioning_jobs || [])]
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0]
  const section = getControlPlaneSection(activeSection)
  const sectionContextLabel = activeSection === 'setup' ? 'New tenant flow' : tenant?.slug

  async function handleProvisioningCreated(result) {
    const nextTenants = await reloadTenants()
    const tenantId = result?.tenant?.id || result?.provisioningJob?.tenant_id
    const createdTenant = tenantId ? nextTenants.find((item) => item.id === tenantId) : null
    if (createdTenant) setSelectedTenant(createdTenant)
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
        <TenantList tenants={tenants} selectedTenantId={selectedTenant?.id} onSelect={setSelectedTenant} />
        <section className="grid gap-5">
          {loading ? <p className="rounded-[2rem] bg-white p-6 text-sm font-semibold text-slate-500">Loading tenants...</p> : null}
          {error ? <p className="rounded-[2rem] bg-rose-50 p-6 text-sm font-bold text-rose-700">{error}</p> : null}
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
                  {activeSection === 'setup' ? (
                    <p className="mt-2 rounded-2xl bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-900">
                      Creation is separate from the selected tenant. This flow creates a new draft and does not edit the current tenant.
                    </p>
                  ) : null}
                </div>
                {sectionContextLabel ? (
                  <p className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                    {sectionContextLabel}
                  </p>
                ) : null}
              </div>
            </div>

            {activeSection === 'setup' ? (
              <SetupWorkspace
                providerConnections={providerConnections}
                providerConnectionsLoading={providerConnectionsLoading}
                onProviderConnectionsChanged={reloadProviderConnections}
                onProvisioningCreated={handleProvisioningCreated}
              />
            ) : null}

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
                onCompensateStep={handleCompensateProvisioningStep}
                runningStepId={runningStepId}
                cancellingJob={cancellingJob}
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

            {!tenant && activeSection !== 'setup' ? (
              <p className="rounded-[2rem] bg-white p-6 text-sm font-semibold text-slate-500">No tenant selected yet.</p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}
