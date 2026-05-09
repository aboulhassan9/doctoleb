import { useState } from 'react'
import ProviderConnectionsPanel from './ProviderConnectionsPanel'
import ProvisioningPanel from './ProvisioningPanel'
import { SecondaryButton } from './ui'

const CREATE_WORKSPACE_PANELS = Object.freeze([
  {
    id: 'create',
    label: 'Create tenant',
    eyebrow: 'Installer',
    description: 'Fill the minimum clinic, first doctor, hosting, and review steps for a new tenant draft.',
  },
  {
    id: 'providers',
    label: 'Provider accounts',
    eyebrow: 'Optional access',
    description: 'Connect Supabase or Vercel account metadata only when assisted automation needs it.',
  },
])

function getPanel(panelId) {
  return CREATE_WORKSPACE_PANELS.find((panel) => panel.id === panelId) || CREATE_WORKSPACE_PANELS[0]
}

export default function TenantCreationWorkspace({
  providerConnections,
  providerConnectionsLoading,
  selectedTenant,
  onCancel,
  onProviderConnectionsChanged,
  onProvisioningCreated,
}) {
  const [activePanel, setActivePanel] = useState('create')
  const panel = getPanel(activePanel)

  return (
    <section className="grid gap-5">
      <div className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-sm">
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-cyan-300">New tenant</p>
            <h2 className="mt-3 text-3xl font-black">New tenant setup</h2>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-300">
              Create a separate clinic workspace. This installer creates a new tenant draft only and does not edit {selectedTenant?.display_name || 'the selected tenant'} or any existing tenant configuration.
            </p>
          </div>
          <SecondaryButton onClick={onCancel}>Back to selected tenant</SecondaryButton>
        </div>
        <div className="grid gap-3 border-t border-white/10 bg-white/[0.04] p-4 md:grid-cols-2">
          {CREATE_WORKSPACE_PANELS.map((item) => {
            const isActive = item.id === activePanel

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActivePanel(item.id)}
                className={[
                  'rounded-2xl p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
                  isActive
                    ? 'bg-cyan-300 text-slate-950'
                    : 'bg-white/10 text-slate-300 ring-1 ring-white/10 hover:bg-white/15 hover:text-white',
                ].join(' ')}
              >
                <span className="block text-xs font-black uppercase tracking-[0.22em] opacity-70">{item.eyebrow}</span>
                <span className="mt-1 block text-lg font-black">{item.label}</span>
                <span className="mt-2 block text-sm font-semibold opacity-75">{item.description}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-700">{panel.eyebrow}</p>
        <h2 className="mt-2 text-2xl font-black">{panel.label}</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">{panel.description}</p>
      </div>

      {activePanel === 'create' ? (
        <ProvisioningPanel providerConnections={providerConnections} onCreated={onProvisioningCreated} />
      ) : null}

      {activePanel === 'providers' ? (
        <ProviderConnectionsPanel
          connections={providerConnections}
          loading={providerConnectionsLoading}
          onChanged={onProviderConnectionsChanged}
        />
      ) : null}
    </section>
  )
}
