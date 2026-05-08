import { useEffect, useState } from 'react'
import { useTenantList } from '../hooks/useTenantList'
import { useTenantDetail } from '../hooks/useTenantDetail'
import { SecondaryButton } from './ui'
import TenantList from './TenantList'
import DomainsPanel from './DomainsPanel'
import AuditPanel from './AuditPanel'
import TenantControls from './TenantControls'
import BrandingPanel from './BrandingPanel'
import EntitlementsPanel from './EntitlementsPanel'
import ProvisioningPanel from './ProvisioningPanel'

export default function ConsoleScreen({ session, onSignOut }) {
  const [selectedTenant, setSelectedTenant] = useState(null)
  const {
    tenants,
    loading,
    error: listError,
    reload: reloadTenants,
  } = useTenantList()
  const {
    tenantDetail,
    error: detailError,
    reload: reloadTenantDetail,
  } = useTenantDetail(selectedTenant?.id)

  useEffect(() => {
    if (!selectedTenant && tenants[0]) setSelectedTenant(tenants[0])
  }, [selectedTenant, tenants])

  const tenant = tenantDetail?.tenant || selectedTenant
  const error = listError || detailError

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
          <ProvisioningPanel onCreated={reloadTenants} />
          {tenant ? (
            <>
              <TenantControls tenant={tenant} onSaved={() => { void reloadTenants(); void reloadTenantDetail() }} />
              <DomainsPanel tenant={tenant} onSaved={() => { void reloadTenants(); void reloadTenantDetail() }} />
              <BrandingPanel tenant={tenant} />
              <EntitlementsPanel tenant={tenant} onSaved={() => { void reloadTenants(); void reloadTenantDetail() }} />
              <AuditPanel events={tenantDetail?.events || []} />
            </>
          ) : (
            <p className="rounded-[2rem] bg-white p-6 text-sm font-semibold text-slate-500">No tenants found yet.</p>
          )}
        </section>
      </div>
    </main>
  )
}
