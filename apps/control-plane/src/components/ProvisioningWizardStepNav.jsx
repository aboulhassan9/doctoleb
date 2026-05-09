import { PROVISIONING_WIZARD_STEPS } from '../lib/provisioningWizard'

export default function ProvisioningWizardStepNav({ activeStepId, onStepChange }) {
  return (
    <nav aria-label="New tenant creation steps" className="mt-6">
      <div role="tablist" aria-label="New tenant creation steps" className="grid gap-2 md:grid-cols-4">
        {PROVISIONING_WIZARD_STEPS.map((step) => {
          const isActive = step.id === activeStepId

          return (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`tenant-wizard-step-${step.id}`}
              id={`tenant-wizard-tab-${step.id}`}
              onClick={() => onStepChange(step.id)}
              className={[
                'rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
                isActive
                  ? 'border-cyan-300 bg-cyan-300 text-slate-950'
                  : 'border-white/10 bg-white/10 text-slate-300 hover:border-white/25 hover:bg-white/15',
              ].join(' ')}
            >
              <span className="block text-xs font-black uppercase tracking-[0.2em] opacity-70">Step {step.number}</span>
              <span className="mt-1 block text-sm font-black">{step.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
