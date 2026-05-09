import { useState } from 'react'
import ProviderConnectionsPanel from './ProviderConnectionsPanel'
import ProvisioningPanel from './ProvisioningPanel'

const SETUP_WORKSPACE_TABS = Object.freeze([
  {
    id: 'create',
    label: 'Create tenant',
    eyebrow: 'New tenant draft',
    description: 'A guided launch flow for a new clinic workspace. It does not edit the selected tenant.',
  },
  {
    id: 'providers',
    label: 'Provider accounts',
    eyebrow: 'External access',
    description: 'Optional Supabase and Vercel account metadata for assisted provisioning.',
  },
])

function getSetupTab(tabId) {
  return SETUP_WORKSPACE_TABS.find((tab) => tab.id === tabId) || SETUP_WORKSPACE_TABS[0]
}

export default function SetupWorkspace({
  providerConnections,
  providerConnectionsLoading,
  onProviderConnectionsChanged,
  onProvisioningCreated,
}) {
  const [activeSetupTab, setActiveSetupTab] = useState('create')
  const activeTab = getSetupTab(activeSetupTab)

  return (
    <section className="grid gap-5">
      <div className="rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="grid gap-3 md:grid-cols-2">
          {SETUP_WORKSPACE_TABS.map((tab) => {
            const isActive = tab.id === activeSetupTab

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSetupTab(tab.id)}
                className={[
                  'rounded-3xl p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2',
                  isActive
                    ? 'bg-slate-950 text-white shadow-lg shadow-slate-950/10'
                    : 'bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-white hover:text-slate-950',
                ].join(' ')}
              >
                <span className="block text-xs font-black uppercase tracking-[0.22em] opacity-70">{tab.eyebrow}</span>
                <span className="mt-1 block text-lg font-black">{tab.label}</span>
                <span className="mt-2 block text-sm font-semibold opacity-75">{tab.description}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-700">{activeTab.eyebrow}</p>
        <h2 className="mt-2 text-2xl font-black">{activeTab.label}</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">{activeTab.description}</p>
      </div>

      {activeSetupTab === 'create' ? (
        <ProvisioningPanel providerConnections={providerConnections} onCreated={onProvisioningCreated} />
      ) : null}

      {activeSetupTab === 'providers' ? (
        <ProviderConnectionsPanel
          connections={providerConnections}
          loading={providerConnectionsLoading}
          onChanged={onProviderConnectionsChanged}
        />
      ) : null}
    </section>
  )
}
