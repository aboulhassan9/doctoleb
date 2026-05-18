import { useState } from 'react'
import ProviderConnectionsPanel from './ProviderConnectionsPanel'
import ProvisioningPanel from './ProvisioningPanel'

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
    <section className="grid gap-6">
      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950 text-white">
        <div className="flex flex-col justify-between gap-6 p-6 md:p-8 lg:flex-row lg:items-start">
          <div>
            <span className="mb-4 inline-flex items-center rounded-md border border-teal-500/20 bg-teal-500/10 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-teal-400">
              New tenant
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-white">New tenant setup</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Create a separate clinic workspace. This installer creates a new tenant draft only and does not edit{' '}
              <span className="font-semibold text-white">{selectedTenant?.display_name || 'the selected tenant'}</span>{' '}
              or any existing tenant configuration.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-3.5 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
          >
            Back to selected tenant
          </button>
        </div>
        <div className="grid gap-px bg-slate-800 md:grid-cols-2">
          {CREATE_WORKSPACE_PANELS.map((item) => {
            const isActive = item.id === activePanel

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActivePanel(item.id)}
                className={`p-5 text-left transition-colors focus:outline-none ${
                  isActive ? 'bg-slate-900' : 'bg-slate-950 hover:bg-slate-900/70'
                }`}
              >
                <span
                  className={`block font-mono text-[10px] uppercase tracking-wide ${
                    isActive ? 'text-teal-400' : 'text-slate-500'
                  }`}
                >
                  {item.eyebrow}
                </span>
                <span className={`mt-1.5 block text-sm font-semibold ${isActive ? 'text-white' : 'text-slate-300'}`}>
                  {item.label}
                </span>
                <span className={`mt-1 block text-sm ${isActive ? 'text-slate-400' : 'text-slate-500'}`}>
                  {item.description}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
        <h2 className="text-base font-semibold tracking-tight text-slate-900">{panel.label}</h2>
        <p className="mt-1 text-sm text-slate-500">{panel.description}</p>
      </div>

      <div className="mb-8">
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
      </div>
    </section>
  )
}
